import { useEffect, useMemo, useState } from 'react';
import { hrCreateOnboardingPlan, hrGetOnboardingPlans, hrGetOnboardingWatch } from '../../api/index.js';
import { Badge, Btn, EmployeeProfileSummary, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
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
  planType: 'Onboarding',
  title: '',
  status: 'Not Started',
  progress: 0,
  startDate: '',
  targetDate: '',
  checklistItems: '',
  notes: '',
};

const STATUS_COLORS = {
  'Not Started': 'gray',
  'In Progress': 'orange',
  Completed: 'green',
  Blocked: 'red',
};

const WATCH_COLORS = {
  'On Track': 'green',
  'Due Soon': 'yellow',
  Overdue: 'red',
  Blocked: 'red',
  'Needs Kickoff': 'orange',
  Completed: 'green',
};

const EMPTY_WATCH = {
  summary: {},
  planTypeBreakdown: [],
  followUpItems: [],
};

export function HROnboardingPage() {
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
        hrGetOnboardingPlans(),
        hrGetOnboardingWatch().catch(() => EMPTY_WATCH),
      ]);
      setPlans(Array.isArray(data) ? data : []);
      setWatch(watchData && typeof watchData === 'object' ? watchData : EMPTY_WATCH);
    } catch (error) {
      toast(error.message || 'Failed to load onboarding plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const watchSummary = watch?.summary || {};
  const followUpItems = watch?.followUpItems || [];
  const planTypeBreakdown = watch?.planTypeBreakdown || [];

  const stats = useMemo(() => ({
    total: watchSummary.totalPlans ?? plans.length,
    onboarding: watchSummary.onboardingCount ?? plans.filter((plan) => plan.planType === 'Onboarding').length,
    followUp: watchSummary.followUpCount ?? 0,
    completed: plans.filter((plan) => plan.status === 'Completed').length,
  }), [plans, watchSummary]);

  const buildSuggestedPlanTitle = (employee, planType = 'Onboarding') => {
    if (!employee) return '';
    const roleSuffix = employee.jobTitle ? ` — ${employee.jobTitle}` : '';
    return `${planType} plan for ${employee.fullName}${roleSuffix}`;
  };

  const applyEmployeeDefaults = (employee) => {
    setSelectedEmployee(employee || null);
    setForm((prev) => {
      const currentSuggestedTitle = buildSuggestedPlanTitle(selectedEmployee, prev.planType);
      const nextSuggestedTitle = buildSuggestedPlanTitle(employee, prev.planType);
      const shouldReplaceTitle = !prev.title.trim() || prev.title === currentSuggestedTitle;
      return {
        ...prev,
        title: shouldReplaceTitle ? nextSuggestedTitle : prev.title,
      };
    });
  };

  const handlePlanTypeChange = (nextType) => {
    setForm((prev) => {
      const currentSuggestedTitle = buildSuggestedPlanTitle(selectedEmployee, prev.planType);
      const nextSuggestedTitle = buildSuggestedPlanTitle(selectedEmployee, nextType);
      const shouldReplaceTitle = !prev.title.trim() || prev.title === currentSuggestedTitle;
      return {
        ...prev,
        planType: nextType,
        title: shouldReplaceTitle ? nextSuggestedTitle : prev.title,
      };
    });
  };

  const handleExportWatch = () => {
    try {
      const rows = [
        ['Section', 'Label', 'Value', 'Notes'],
        ['Summary', 'Total Plans', watchSummary.totalPlans ?? plans.length, ''],
        ['Summary', 'Follow-Up Count', watchSummary.followUpCount ?? 0, ''],
        ['Summary', 'Overdue Plans', watchSummary.overduePlans ?? 0, ''],
        ['Summary', 'Blocked Plans', watchSummary.blockedPlans ?? 0, ''],
        ['Summary', 'Due Soon Plans', watchSummary.dueSoonPlans ?? 0, ''],
        ['Summary', 'Kickoff Needed', watchSummary.kickoffNeeded ?? 0, ''],
      ];

      if (planTypeBreakdown.length) {
        rows.push([]);
        rows.push(['Plan Types', 'Type', 'Count', 'Progress / Follow-Up']);
        planTypeBreakdown.forEach((item) => {
          rows.push([
            'Plan Types',
            item.planType,
            item.totalCount ?? 0,
            `completed ${item.completedCount ?? 0} | follow-up ${item.followUpCount ?? 0} | avg ${item.averageProgress ?? 0}%`,
          ]);
        });
      }

      if (followUpItems.length) {
        rows.push([]);
        rows.push(['Follow-Up', 'Employee', 'Due State', 'Plan']);
        followUpItems.forEach((item) => {
          rows.push([
            'Follow-Up',
            item.employeeName || item.employeeID,
            item.dueState || item.status,
            `${item.planType || ''} | ${item.title || ''} | ${item.progress ?? 0}% | ${item.targetDate || 'No target date'}`,
          ]);
        });
      }

      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadTextFile(`onboarding-watch-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
      toast(t('Onboarding watch exported.'));
    } catch {
      toast(t('Failed to export onboarding watch.'), 'error');
    }
  };

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.title.trim()) {
      toast('Employee ID and title are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const checklistItems = form.checklistItems
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);

      await hrCreateOnboardingPlan({
        employeeID: form.employeeID.trim(),
        planType: form.planType,
        title: form.title.trim(),
        status: form.status,
        progress: Number(form.progress || 0),
        startDate: form.startDate || null,
        targetDate: form.targetDate || null,
        checklistItems,
        notes: form.notes.trim(),
      });
      toast('Onboarding plan created');
      setForm(INITIAL_FORM);
      await loadPlans();
    } catch (error) {
      toast(error.message || 'Failed to create onboarding plan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'التهيئة والانتقال الوظيفي' : 'Onboarding & Transition'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {language === 'ar' ? 'أنشئ خطط التهيئة أو المغادرة أو الانتقال الوظيفي وتابع تقدم الموظفين.' : 'Create onboarding, offboarding, or role-transition plans and track employee progress.'}
          </p>
        </div>
        <Btn variant="outline" onClick={handleExportWatch}>{t('Export Watch CSV')}</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Plans', value: stats.total, accent: '#111827' },
          { label: 'Onboarding', value: stats.onboarding, accent: '#E8321A' },
          { label: 'Needs Follow-Up', value: stats.followUp, accent: '#F59E0B' },
          { label: 'Completed', value: stats.completed, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{t(card.label)}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Transition Watch')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 4 }}>{t('Flag onboarding, offboarding, and role transitions that need HR follow-up.')}</div>
            </div>
            <Badge label={`${watchSummary.averageProgress ?? 0}% ${t('avg progress')}`} color={(watchSummary.followUpCount ?? 0) > 0 ? 'yellow' : 'green'} />
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No onboarding follow-up items are flagged right now.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {followUpItems.map((item) => (
                <div key={item.planID} style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t(item.planType)} · {item.title}</div>
                    </div>
                    <Badge label={t(item.dueState || item.status)} color={WATCH_COLORS[item.dueState] || STATUS_COLORS[item.status] || 'gray'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginTop: 10 }}>
                    {item.department || '—'} · {item.team || '—'} · {item.progress ?? 0}% {t('complete')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                    {item.targetDate ? `${t('Target')}: ${item.targetDate}` : t('No target date set')} {item.notes ? `• ${item.notes}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Watch Snapshot')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Overdue Plans')}</span><strong>{watchSummary.overduePlans ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Blocked Plans')}</span><strong>{watchSummary.blockedPlans ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Due Soon')}</span><strong>{watchSummary.dueSoonPlans ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Needs Kickoff')}</span><strong>{watchSummary.kickoffNeeded ?? 0}</strong></div>
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Plan Type Health')}</div>
            {planTypeBreakdown.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('No onboarding health breakdown is available yet.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {planTypeBreakdown.map((item) => (
                  <div key={item.planType} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{t(item.planType)}</strong>
                      <Badge label={`${item.followUpCount ?? 0} ${t('follow-up')}`} color={(item.followUpCount ?? 0) > 0 ? 'orange' : 'green'} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                      {item.totalCount ?? 0} {t('plans')} · {item.completedCount ?? 0} {t('completed')} · {item.averageProgress ?? 0}% {t('avg progress')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Plan')}</h3>
          <EmployeeSelect
            label={t('Employee')}
            value={form.employeeID}
            onChange={(value) => setForm((prev) => ({ ...prev, employeeID: value }))}
            onEmployeeChange={applyEmployeeDefaults}
            placeholder={t('Select an employee')}
            helperText={t('The plan title starts from the selected employee profile and stays editable.')}
          />
          <EmployeeProfileSummary
            employee={selectedEmployee}
            t={t}
            language={language}
            note="Employee role and team details were fetched to speed up onboarding and transition planning."
          />
          <Input label={t('Title')} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Engineering onboarding')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Plan Type')}</label>
              <select value={form.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Onboarding', 'Offboarding', 'Transition'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Not Started', 'In Progress', 'Completed', 'Blocked'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Start Date')} type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
            <Input label={t('Target Date')} type="date" value={form.targetDate} onChange={(e) => setForm((prev) => ({ ...prev, targetDate: e.target.value }))} />
          </div>

          <Input label={t('Initial Progress %')} type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm((prev) => ({ ...prev, progress: e.target.value }))} />
          <Textarea label={t('Checklist Items')} value={form.checklistItems} onChange={(e) => setForm((prev) => ({ ...prev, checklistItems: e.target.value }))} placeholder={t('One item per line or comma-separated')} />
          <Textarea label={t('Notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('Add HR notes or blockers')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Create Plan')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Plan Overview')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : plans.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No onboarding or transition plans created yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Plan', 'Type', 'Target', 'Status', 'Progress'].map((head) => (
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
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{plan.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{Array.isArray(plan.checklistItems) ? plan.checklistItems.length : 0} {t('checklist item(s)')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(plan.planType)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{plan.targetDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(plan.status)} color={STATUS_COLORS[plan.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{plan.progress}%</td>
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
