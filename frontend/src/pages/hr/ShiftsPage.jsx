import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreateShift, hrGetShifts, hrGetShiftWatch } from '../../api/index.js';
import { Badge, Btn, DatalistInput, EmployeeProfileSummary, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  employeeID: '',
  shiftDate: '',
  shiftType: 'Morning',
  startTime: '09:00',
  endTime: '17:00',
  location: '',
  status: 'Planned',
  notes: '',
};

const downloadTextFile = (filename, content, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const STATUS_COLORS = {
  Planned: 'gray',
  Confirmed: 'orange',
  Completed: 'green',
  Swapped: 'red',
};

const WATCH_COLORS = {
  'Coverage Risk': 'red',
  'Swap Review': 'orange',
  'Needs Confirmation': 'yellow',
  'Pending Closeout': 'accent',
  Planned: 'gray',
  Confirmed: 'orange',
  Completed: 'green',
  Swapped: 'red',
};

const EMPTY_WATCH = {
  summary: {},
  shiftTypeBreakdown: [],
  followUpItems: [],
};

const getShiftTone = (item) => {
  if (item?.followUpState === 'Coverage Risk' || item?.status === 'Swapped') return 'red';
  if (item?.followUpState === 'Swap Review') return 'orange';
  if (item?.followUpState === 'Needs Confirmation') return 'yellow';
  if (item?.followUpState === 'Pending Closeout') return 'accent';
  if (item?.status === 'Completed') return 'green';
  return 'gray';
};

export function HRShiftsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadShifts = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetShifts(),
        hrGetShiftWatch().catch(() => EMPTY_WATCH),
      ]);
      setShifts(Array.isArray(data) ? data : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load shift schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const shiftTypeBreakdown = watch?.shiftTypeBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalShifts ?? shifts.length,
    pendingConfirmations: watchSummary.plannedCount ?? shifts.filter((shift) => shift.status === 'Planned').length,
    coverageRisks: watchSummary.coverageRiskCount ?? 0,
    completed: watchSummary.completedCount ?? shifts.filter((shift) => shift.status === 'Completed').length,
  }), [shifts, watchSummary]);

  const coverageRiskCount = watchSummary.coverageRiskCount ?? followUpItems.filter((item) => ['Coverage Risk', 'Swap Review'].includes(item.followUpState)).length;
  const needsConfirmationCount = followUpItems.filter((item) => item.followUpState === 'Needs Confirmation').length;
  const swapReviewCount = followUpItems.filter((item) => item.followUpState === 'Swap Review').length;
  const pendingCloseoutCount = followUpItems.filter((item) => item.followUpState === 'Pending Closeout').length;
  const todayCoverageCount = watchSummary.todayCount ?? shifts.filter((item) => item.shiftDate === new Date().toISOString().slice(0, 10)).length;
  const shiftFocusQueue = useMemo(() => {
    const stateRank = { 'Coverage Risk': 4, 'Swap Review': 3, 'Needs Confirmation': 2, 'Pending Closeout': 1 };
    return [...followUpItems]
      .sort((a, b) => (stateRank[b.followUpState] || 0) - (stateRank[a.followUpState] || 0)
        || Number(a.daysToShift ?? 999) - Number(b.daysToShift ?? 999)
        || String(a.employeeName || '').localeCompare(String(b.employeeName || '')))
      .slice(0, 4);
  }, [followUpItems]);
  const shiftPressureMap = useMemo(() => {
    return [...shiftTypeBreakdown]
      .sort((a, b) => Number(b.followUpCount || 0) - Number(a.followUpCount || 0)
        || Number(b.plannedCount || 0) - Number(a.plannedCount || 0)
        || Number(b.swappedCount || 0) - Number(a.swappedCount || 0))
      .slice(0, 4);
  }, [shiftTypeBreakdown]);
  const coveragePlaybook = useMemo(() => {
    const plays = [];

    if (coverageRiskCount > 0) {
      plays.push({
        title: t('Stabilize risky coverage first'),
        note: t('Start with unconfirmed or swapped shifts that are most likely to create same-day staffing gaps.'),
      });
    }
    if (needsConfirmationCount > 0) {
      plays.push({
        title: t('Lock tomorrow’s confirmations'),
        note: t('Shifts approaching the next day should be confirmed early so managers are not surprised by coverage holes.'),
      });
    }
    if (pendingCloseoutCount > 0) {
      plays.push({
        title: t('Close out completed coverage cleanly'),
        note: t('Yesterday’s confirmed shifts should be wrapped up quickly so attendance and payroll stay aligned.'),
      });
    }
    if (shiftPressureMap.some((item) => Number(item.followUpCount || 0) > 0)) {
      plays.push({
        title: t('Watch the busiest shift type'),
        note: t('Focus on the shift type carrying the most follow-up work to reduce workforce friction fastest.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Keep coverage rhythm steady'),
      note: t('Shift operations look stable, so keep the current confirmation and closeout cadence in place.'),
    }];
  }, [coverageRiskCount, needsConfirmationCount, pendingCloseoutCount, shiftPressureMap, t]);
  const strongestSignal = coverageRiskCount > 0
    ? t('Some shifts are at immediate coverage risk and should be stabilized before they turn into attendance or service gaps.')
    : needsConfirmationCount > 0
      ? t('Several upcoming shifts still need confirmation, so the next best win is locking tomorrow’s schedule.')
      : t('Shift coverage looks stable; keep confirmations moving so planned work does not age into risk.');

  const shiftPulseCards = useMemo(() => ([
    {
      label: t('Coverage Queue'),
      value: stats.pendingConfirmations,
      note: t('Upcoming shifts still waiting on employee confirmation or final assignment.'),
      accent: '#E8321A',
    },
    {
      label: t('Risk Flags'),
      value: stats.coverageRisks,
      note: t('Schedules that may create staffing gaps or need backup coverage.'),
      accent: '#F59E0B',
    },
    {
      label: t('Shift Mix'),
      value: shiftTypeBreakdown.length,
      note: t('Shift patterns currently represented across locations and teams.'),
      accent: '#2563EB',
    },
    {
      label: t('Closeout Watch'),
      value: followUpItems.length,
      note: t('Shifts still needing confirmations, swaps, or end-of-day follow-up.'),
      accent: '#7C3AED',
    },
  ]), [followUpItems.length, shiftTypeBreakdown.length, stats.coverageRisks, stats.pendingConfirmations, t]);

  const shiftLocations = useMemo(() => [...new Set(shifts.map((shift) => shift.location).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [shifts]);

  const applyEmployeeDefaults = (employee) => {
    setSelectedEmployee(employee || null);
    setForm((prev) => ({
      ...prev,
      location: employee?.location ? employee.location : (employee ? prev.location : ''),
    }));
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.shiftDate || !form.startTime || !form.endTime) {
      toast('Employee ID, shift date, and times are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreateShift({
        employeeID: form.employeeID.trim(),
        shiftDate: form.shiftDate,
        shiftType: form.shiftType,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location.trim(),
        status: form.status,
        notes: form.notes.trim(),
      });
      toast('Shift schedule created');
      setForm(INITIAL_FORM);
      await loadShifts();
    } catch (error) {
      toast(error.message || 'Failed to create shift schedule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Shifts', watchSummary.totalShifts ?? shifts.length, ''],
        ['Summary', 'Planned', watchSummary.plannedCount ?? 0, ''],
        ['Summary', 'Confirmed', watchSummary.confirmedCount ?? 0, ''],
        ['Summary', 'Coverage Risks', watchSummary.coverageRiskCount ?? 0, ''],
        ['Summary', 'Needs Follow-Up', watchSummary.followUpCount ?? 0, ''],
      ];

      if (shiftTypeBreakdown.length) {
        rows.push([]);
        rows.push(['Shift Types', 'Shift Type', 'Count', 'Planned / Follow-Up']);
        shiftTypeBreakdown.forEach((item) => {
          rows.push([
            'Shift Types',
            item.shiftType,
            item.count ?? 0,
            `planned ${item.plannedCount ?? 0} | confirmed ${item.confirmedCount ?? 0} | follow-up ${item.followUpCount ?? 0}`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Employee', 'State', 'Summary']);
        followUpItems.forEach((item) => {
          rows.push([
            'Follow-Up',
            item.employeeName || item.employeeID,
            item.followUpState || item.status,
            `${item.shiftDate || ''} | ${item.shiftType || ''} | ${item.location || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`shift-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Coverage watch exported.'));
    } catch {
      toast(t('Failed to export coverage watch.'), 'error');
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'جدولة الورديات' : 'Shift Scheduling'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'خطط تغطية العمل اليومية ووزع الورديات وتابع تأكيدات الموظفين.' : 'Plan workforce coverage, assign daily shifts, and track employee confirmations.'}
          </p>
        </div>
        <Btn variant="outline" onClick={handleExportWatch}>{t('Export Watch CSV')}</Btn>
      </div>

      <div className="hr-surface-card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>
              {t(isAdminView ? 'Admin Control Center' : 'HR Operations')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {t(isAdminView
                ? 'Oversee users, access coverage, and operational readiness across the platform.'
                : 'People operations, compliance, and service delivery.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/dashboard'))}>{t('nav.dashboard')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/attendance'))}>{t('nav.attendance')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/payroll'))}>{t('nav.payroll')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/employees'))}>{t('nav.employees')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Total Shifts'), value: stats.total, color: '#111827' },
            { label: t('Pending Confirmation'), value: stats.pendingConfirmations, color: '#E8321A' },
            { label: t('Coverage Risks'), value: stats.coverageRisks, color: '#F59E0B' },
            { label: t('Completed'), value: stats.completed, color: '#10B981' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {shiftPulseCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Shift Coverage Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring same-day risks, upcoming confirmations, and shift-type pressure into one workforce coverage review layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={coverageRiskCount > 0 ? 'red' : 'green'} label={`${t('Coverage risk')} ${coverageRiskCount}`} />
            <Badge color={needsConfirmationCount > 0 ? 'yellow' : 'gray'} label={`${t('Needs confirmation')} ${needsConfirmationCount}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Coverage Risk'),
              value: coverageRiskCount,
              note: t('Shifts most likely to create a staffing gap if they are not handled immediately.'),
              accent: coverageRiskCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Needs Confirmation'),
              value: needsConfirmationCount,
              note: t('Upcoming shifts that should be locked before the next workday begins.'),
              accent: needsConfirmationCount > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Swap Review'),
              value: swapReviewCount,
              note: t('Schedule changes that still need HR or manager attention before coverage is stable.'),
              accent: swapReviewCount > 0 ? '#2563EB' : '#22C55E',
            },
            {
              label: t('Today Coverage'),
              value: todayCoverageCount,
              note: t('Shifts scheduled for today so operations can quickly sense current workforce load.'),
              accent: '#7C3AED',
            },
          ].map((card) => (
            <div key={card.label} className="workspace-journey-card">
              <div className="workspace-journey-title">{card.label}</div>
              <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
              <div className="workspace-journey-note">{card.note}</div>
            </div>
          ))}
        </div>

        <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', alignItems: 'start' }}>
          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Coverage Queue')}</div>
            {shiftFocusQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority shift items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {shiftFocusQueue.map((item) => (
                  <div key={item.scheduleID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                      <Badge color={getShiftTone(item)} label={t(item.followUpState || item.status)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.shiftDate} • {t(item.shiftType)} • {item.location || t('Location TBD')}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={t(item.shiftType)} />
                      <Badge color="gray" label={(item.daysToShift ?? 0) >= 0 ? `${item.daysToShift ?? 0} ${t('days pending')}` : t('overdue')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Coverage Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {coveragePlaybook.map((item) => (
                <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                  <div className="workspace-focus-label">{item.title}</div>
                  <div className="workspace-focus-note">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Shifts', value: stats.total, accent: '#111827' },
          { label: 'Pending Confirmation', value: stats.pendingConfirmations, accent: '#E8321A' },
          { label: 'Coverage Risks', value: stats.coverageRisks, accent: '#F59E0B' },
          { label: 'Completed', value: stats.completed, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Coverage Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight upcoming unconfirmed or swapped shifts that can affect workforce coverage.')}</div>
            </div>
            <Badge label={`${watchSummary.coverageRiskCount ?? 0} ${t('critical')}`} color={(watchSummary.coverageRiskCount ?? 0) > 0 ? 'red' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No shift follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.scheduleID} className="workspace-action-card">
                  <div className="workspace-action-eyebrow">{t('Shift follow-up')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.shiftDate} · {t(item.shiftType)} · {item.location || '—'}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Badge label={t(item.shiftType)} color="accent" />
                    <Badge label={item.location || t('Location TBD')} color="gray" />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 4 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    {(item.daysToShift ?? 0) >= 0 ? `${item.daysToShift ?? 0} ${t('days pending')}` : t('overdue')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Shift Type Pressure')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{t('See which shift patterns are carrying the most follow-up pressure across confirmations and swaps.')}</div>
          {shiftPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No shift summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {shiftPressureMap.map((item) => (
                <div key={item.shiftType} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>{t(item.shiftType)}</strong>
                    <Badge
                      color={Number(item.followUpCount || 0) > 0 ? 'orange' : 'green'}
                      label={`${item.count ?? 0} ${t('shifts')}`}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.plannedCount ?? 0} {t('planned')} · {item.confirmedCount ?? 0} {t('confirmed')} · {item.followUpCount ?? 0} {t('follow-up')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 6 }}>
                    {item.swappedCount ?? 0} {t('swapped')} · {item.completedCount ?? 0} {t('completed')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Shift')}</h3>
          <EmployeeSelect
            label={t('Employee')}
            value={form.employeeID}
            onChange={(value) => setForm((prev) => ({ ...prev, employeeID: value }))}
            onEmployeeChange={applyEmployeeDefaults}
            placeholder={t('Select an employee')}
            helperText={t('The employee work location is suggested automatically and stays editable for each shift.')}
          />
          <EmployeeProfileSummary
            employee={selectedEmployee}
            t={t}
            language={language}
            note="Employee schedule context was fetched from the directory to speed up shift planning."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Shift Date')} type="date" value={form.shiftDate} onChange={(e) => setForm((prev) => ({ ...prev, shiftDate: e.target.value }))} />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Shift Type')}</label>
              <select value={form.shiftType} onChange={(e) => setForm((prev) => ({ ...prev, shiftType: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Morning', 'Evening', 'Night', 'Remote', 'Flexible'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Start Time')} type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            <Input label={t('End Time')} type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>

          <DatalistInput label={t('Location')} value={form.location} options={shiftLocations} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder={t('Select or type a location')} />
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 12 }}>
              {['Planned', 'Confirmed', 'Completed', 'Swapped'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </div>

          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('Add special instructions or coverage notes')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Shift')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Shift Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : shifts.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No shifts scheduled yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Date', 'Shift', 'Location', 'Status', 'Note'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.scheduleID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{shift.employeeName || shift.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{shift.department || '—'} • {shift.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{shift.shiftDate}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{t(shift.shiftType)}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{shift.startTime} - {shift.endTime}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{shift.location || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(shift.status)} color={STATUS_COLORS[shift.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontSize: 12.5, color: 'var(--gray-500)' }}>{shift.employeeNote || shift.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
