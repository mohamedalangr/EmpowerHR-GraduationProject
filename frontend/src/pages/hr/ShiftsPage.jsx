import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreateShift, hrGetShifts, hrGetShiftWatch } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
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

export function HRShiftsPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
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
                <div key={item.scheduleID} style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.shiftDate} · {t(item.shiftType)} · {item.location || '—'}</div>
                    </div>
                    <Badge label={t(item.followUpState || item.status)} color={WATCH_COLORS[item.followUpState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 10 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {(item.daysToShift ?? 0) >= 0 ? `${item.daysToShift ?? 0} ${t('days pending')}` : t('overdue')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Shift Type Snapshot')}</div>
          {shiftTypeBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No shift summary is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {shiftTypeBreakdown.map((item) => (
                <div key={item.shiftType} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{t(item.shiftType)}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.plannedCount ?? 0} {t('planned')} · {item.confirmedCount ?? 0} {t('confirmed')} · {item.followUpCount ?? 0} {t('follow-up')}
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
          <Input label={t('Employee ID')} value={form.employeeID} onChange={(e) => setForm((prev) => ({ ...prev, employeeID: e.target.value }))} placeholder="EMP12345" />
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

          <Input label={t('Location')} value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder={t('Cairo HQ / Remote')} />
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
