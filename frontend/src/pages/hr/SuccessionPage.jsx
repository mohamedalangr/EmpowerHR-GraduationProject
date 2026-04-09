import { useEffect, useMemo, useState } from 'react';
import { hrCreateSuccessionPlan, hrGetSuccessionPlans, hrGetSuccessionWatch } from '../../api/index.js';
import { Badge, Btn, DatalistInput, EmployeeProfileSummary, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

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

const INITIAL_FORM = {
  employeeID: '',
  targetRole: '',
  readiness: '1-2 Years',
  status: 'Active',
  retentionRisk: 'Low',
  developmentActions: '',
  notes: '',
};

const STATUS_COLORS = {
  Active: 'orange',
  'On Track': 'blue',
  Acknowledged: 'green',
  Completed: 'green',
  'On Hold': 'red',
};

const RISK_COLORS = {
  High: 'red',
  Medium: 'orange',
  Low: 'green',
};

const EMPTY_WATCH = {
  summary: {},
  readinessBreakdown: [],
  followUpItems: [],
};

const getSuccessionTone = (item) => {
  if (item?.retentionRisk === 'High' || item?.status === 'On Hold') return 'red';
  if (item?.retentionRisk === 'Medium' || item?.status === 'Active') return 'orange';
  if (item?.status === 'Completed' || item?.status === 'Acknowledged') return 'green';
  return 'accent';
};

export function HRSuccessionPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [watch, setWatch] = useState(EMPTY_WATCH);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const [data, watchData] = await Promise.all([
        hrGetSuccessionPlans(),
        hrGetSuccessionWatch().catch(() => EMPTY_WATCH),
      ]);
      setPlans(Array.isArray(data) ? data : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load succession plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const watchSummary = watch?.summary || {};
  const readinessBreakdown = watch?.readinessBreakdown || [];
  const followUpItems = watch?.followUpItems || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalPlans ?? plans.length,
    readyNow: watchSummary.readyNowCount ?? plans.filter((plan) => plan.readiness === 'Ready Now').length,
    highRisk: watchSummary.highRiskCount ?? plans.filter((plan) => plan.retentionRisk === 'High').length,
    acknowledged: watchSummary.acknowledgedCount ?? plans.filter((plan) => plan.status === 'Acknowledged').length,
  }), [plans, watchSummary]);

  const readySoonCount = useMemo(
    () => readinessBreakdown.find((item) => item.readiness === '6-12 Months')?.count
      ?? plans.filter((plan) => plan.readiness === '6-12 Months').length,
    [plans, readinessBreakdown],
  );
  const onHoldCount = watchSummary.onHoldCount ?? plans.filter((plan) => plan.status === 'On Hold').length;
  const successionSpotlights = useMemo(() => {
    const riskRank = { High: 3, Medium: 2, Low: 1 };
    const statusRank = { 'On Hold': 3, Active: 2, 'On Track': 1, Acknowledged: 1, Completed: 0 };
    const readinessRank = { 'Ready Now': 0, '6-12 Months': 1, '1-2 Years': 2, 'Long Term': 3 };

    const source = (followUpItems.length ? followUpItems : plans).map((item) => ({
      ...item,
      employeeName: item.employeeName || item.employeeID,
      summary: item.summary || item.developmentActions || item.notes || 'Review this successor in the next talent meeting.',
    }));

    return source
      .sort((a, b) => (riskRank[b.retentionRisk] || 0) - (riskRank[a.retentionRisk] || 0)
        || (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || (readinessRank[a.readiness] || 9) - (readinessRank[b.readiness] || 9)
        || String(a.employeeName || '').localeCompare(String(b.employeeName || '')))
      .slice(0, 4);
  }, [followUpItems, plans]);
  const departmentPressureMap = useMemo(() => {
    const map = new Map();

    plans.forEach((plan) => {
      const key = plan.department || 'Unassigned';
      const current = map.get(key) || {
        department: key,
        total: 0,
        readyNow: 0,
        highRisk: 0,
        onHold: 0,
      };

      current.total += 1;
      if (plan.readiness === 'Ready Now') current.readyNow += 1;
      if (plan.retentionRisk === 'High') current.highRisk += 1;
      if (plan.status === 'On Hold') current.onHold += 1;
      map.set(key, current);
    });

    return [...map.values()]
      .sort((a, b) => b.highRisk - a.highRisk || b.readyNow - a.readyNow || b.total - a.total)
      .slice(0, 4);
  }, [plans]);
  const successionPlaybook = useMemo(() => {
    const plays = [];

    if (stats.highRisk > 0) {
      plays.push({
        title: t('Protect high-risk successors'),
        note: t('Pair retention conversations with a clear next-step plan for bench-critical employees.'),
      });
    }
    if (stats.readyNow > 0) {
      plays.push({
        title: t('Activate ready-now talent'),
        note: t('Use ready-now successors for shadowing, stretch work, or near-term coverage planning.'),
      });
    }
    if (onHoldCount > 0) {
      plays.push({
        title: t('Unblock stalled plans'),
        note: t('Review on-hold succession plans with leaders and identify the blocker before the next talent review.'),
      });
    }
    if (readySoonCount > 0) {
      plays.push({
        title: t('Build the 6-12 month bench'),
        note: t('Focus development actions on successors who are close to readiness but still need targeted growth.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Maintain bench health'),
      note: t('Current succession plans look balanced, so keep the same quarterly talent-review cadence.'),
    }];
  }, [onHoldCount, readySoonCount, stats.highRisk, stats.readyNow, t]);
  const strongestSignal = stats.highRisk > 0
    ? t('High-risk successors need a retention and readiness check before the next leadership review.')
    : stats.readyNow > 0
      ? t('There is ready-now bench strength available for near-term movement and coverage planning.')
      : t('The bench looks steady; focus next on developing the 6-12 month successor pool.');

  const targetRoles = useMemo(() => [...new Set(plans.map((plan) => plan.targetRole).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [plans]);

  const applyEmployeeDefaults = (employee) => {
    setSelectedEmployee(employee || null);
    if (!employee) return;

    setForm((prev) => ({
      ...prev,
      targetRole: !prev.targetRole.trim() ? (employee.jobTitle || prev.targetRole) : prev.targetRole,
    }));
  };

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Plans', watchSummary.totalPlans ?? plans.length, ''],
        ['Summary', 'Ready Now', watchSummary.readyNowCount ?? 0, ''],
        ['Summary', 'High Risk', watchSummary.highRiskCount ?? 0, ''],
        ['Summary', 'On Hold', watchSummary.onHoldCount ?? 0, ''],
        ['Summary', 'Follow-Up Count', watchSummary.followUpCount ?? 0, ''],
      ];

      if (readinessBreakdown.length) {
        rows.push([]);
        rows.push(['Readiness', 'Bucket', 'Count', 'Follow-Up / Risk']);
        readinessBreakdown.forEach((item) => {
          rows.push([
            'Readiness',
            item.readiness,
            item.count ?? 0,
            `follow-up ${item.followUpCount ?? 0} | high risk ${item.highRiskCount ?? 0}`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Employee', 'Readiness', 'Summary']);
        followUpItems.forEach((item) => {
          rows.push([
            'Follow-Up',
            item.employeeName || item.employeeID,
            item.readiness || '—',
            `${item.targetRole || ''} | ${item.retentionRisk || ''} | ${item.status || ''} | ${item.summary || ''}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`succession-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Succession watch exported.'));
    } catch {
      toast(t('Failed to export succession watch.'), 'error');
    }
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.targetRole.trim()) {
      toast('Employee ID and target role are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreateSuccessionPlan({
        employeeID: form.employeeID.trim(),
        targetRole: form.targetRole.trim(),
        readiness: form.readiness,
        status: form.status,
        retentionRisk: form.retentionRisk,
        developmentActions: form.developmentActions.trim(),
        notes: form.notes.trim(),
      });
      toast('Succession plan created');
      setForm(INITIAL_FORM);
      await loadPlans();
    } catch (error) {
      toast(error.message || 'Failed to create succession plan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'تخطيط الإحلال الوظيفي' : 'Succession Planning'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'ارسم جاهزية الأدوار القادمة وحدد مخاطر الاحتفاظ وشارك مسارات التطوير مع الموظفين.' : 'Map next-role readiness, highlight retention risk, and share development paths with employees.'}
          </p>
        </div>
        <Btn variant="outline" onClick={handleExportWatch}>{t('Export Watch CSV')}</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Plans', value: stats.total, accent: '#111827' },
          { label: 'Ready Now', value: stats.readyNow, accent: '#10B981' },
          { label: 'High Risk', value: stats.highRisk, accent: '#E8321A' },
          { label: 'Acknowledged', value: stats.acknowledged, accent: '#F59E0B' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Succession Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Pull the strongest readiness, bench-risk, and continuity signals into one executive planning layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={stats.highRisk > 0 ? 'red' : 'green'} label={`${t('High Risk')} ${stats.highRisk}`} />
            <Badge color={stats.readyNow > 0 ? 'accent' : 'gray'} label={`${t('Ready Now')} ${stats.readyNow}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Ready Now'),
              value: stats.readyNow,
              note: t('Successors already close to a role transition or stretch assignment.'),
              accent: stats.readyNow > 0 ? '#7C3AED' : '#94A3B8',
            },
            {
              label: t('6-12 Months'),
              value: readySoonCount,
              note: t('Bench talent that can become promotable with focused development work.'),
              accent: readySoonCount > 0 ? '#2563EB' : '#94A3B8',
            },
            {
              label: t('On Hold'),
              value: onHoldCount,
              note: t('Plans that need a fresh conversation or blocker removal.'),
              accent: onHoldCount > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Follow-Up Queue'),
              value: followUpItems.length,
              note: t('Succession items currently flagged for HR or leadership review.'),
              accent: followUpItems.length > 0 ? '#F59E0B' : '#22C55E',
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
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Successors')}</div>
            {successionSpotlights.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No succession priorities are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {successionSpotlights.map((item, index) => (
                  <div key={`${item.planID || item.employeeID}-${index}`} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.employeeName || item.employeeID}</strong>
                      <Badge color={getSuccessionTone(item)} label={t(item.status || 'Active')} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{item.targetRole || '—'} • {t(item.readiness || 'Long Term')} • {t(item.status || 'Active')}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{item.summary}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={`${t('Risk')}: ${t(item.retentionRisk || 'Low')}`} />
                      <Badge color="gray" label={`${t('Department')}: ${item.department || '—'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Executive Succession Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {successionPlaybook.map((item) => (
                <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                  <div className="workspace-focus-label">{item.title}</div>
                  <div className="workspace-focus-note">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Succession Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Highlight ready-now talent, retention risk, and plans that need leadership follow-up.')}</div>
            </div>
            <Badge label={`${watchSummary.followUpCount ?? 0} ${t('follow-up')}`} color={(watchSummary.followUpCount ?? 0) > 0 ? 'orange' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No succession follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.planID} style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{item.targetRole} · {t(item.readiness)}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                      <Badge label={t(item.retentionRisk)} color={RISK_COLORS[item.retentionRisk] || 'gray'} />
                      <Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 10 }}>{item.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.department || '—'} · {item.team || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Readiness Snapshot')}</div>
          {readinessBreakdown.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No readiness breakdown is available yet.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {readinessBreakdown.map((item) => (
                <div key={item.readiness} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{t(item.readiness)}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.count ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.followUpCount ?? 0} {t('follow-up')} · {item.highRiskCount ?? 0} {t('high risk')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', margin: '16px 0 10px' }}>{t('Department Pressure')}</div>
          {departmentPressureMap.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Department succession signals will appear as plans are created.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {departmentPressureMap.map((item) => (
                <div key={item.department} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-700)' }}>{item.department}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2 }}>{item.total} {t('Plans')} • {item.readyNow} {t('Ready Now')}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700 }}>
                    <div style={{ color: item.highRisk > 0 ? '#E8321A' : 'var(--gray-500)' }}>{item.highRisk} {t('High Risk')}</div>
                    <div style={{ color: item.onHold > 0 ? '#F59E0B' : 'var(--gray-500)', marginTop: 2 }}>{item.onHold} {t('On Hold')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Succession Plan')}</h3>
          <EmployeeSelect
            label={t('Employee')}
            value={form.employeeID}
            onChange={(value) => setForm((prev) => ({ ...prev, employeeID: value }))}
            onEmployeeChange={applyEmployeeDefaults}
            placeholder={t('Select an employee')}
            helperText={t('The employee’s current role is suggested as a starting point and remains editable for succession planning.')}
          />
          <EmployeeProfileSummary
            employee={selectedEmployee}
            t={t}
            language={language}
            note="Current role, team, and department were fetched from the employee profile for easier succession planning."
          />
          <DatalistInput label={t('Target Role')} value={form.targetRole} options={targetRoles} onChange={(e) => setForm((prev) => ({ ...prev, targetRole: e.target.value }))} placeholder={t('Select or type a target role')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Readiness')}</label>
              <select value={form.readiness} onChange={(e) => setForm((prev) => ({ ...prev, readiness: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Ready Now', '6-12 Months', '1-2 Years', 'Long Term'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Retention Risk')}</label>
              <select value={form.retentionRisk} onChange={(e) => setForm((prev) => ({ ...prev, retentionRisk: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Low', 'Medium', 'High'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 12 }}>
              {['Active', 'On Track', 'Completed', 'On Hold'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </div>

          <Textarea label={t('Development Actions')} value={form.developmentActions} onChange={(e) => setForm((prev) => ({ ...prev, developmentActions: e.target.value }))} placeholder={t('Mentor a junior engineer and lead a delivery initiative')} />
          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('Context for the succession discussion')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Plan')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Succession Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : plans.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No succession plans created yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Target Role', 'Readiness', 'Risk', 'Status', 'Acknowledged'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.planID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{plan.employeeName || plan.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{plan.department || '—'} • {plan.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{plan.targetRole}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(plan.readiness)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(plan.retentionRisk)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(plan.status)} color={STATUS_COLORS[plan.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{plan.acknowledgedAt ? t('Yes') : t('No')}</td>
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
