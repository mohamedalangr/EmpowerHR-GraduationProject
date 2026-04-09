import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrCreatePolicy, hrGetPolicies, hrGetPolicyCompliance, hrSendPolicyReminder } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  title: '',
  category: 'Policy',
  audience: 'All Employees',
  content: '',
  status: 'Published',
  effectiveDate: '',
};

const STATUS_COLORS = {
  Draft: 'gray',
  Published: 'orange',
  Acknowledged: 'green',
};

export function HRPoliciesPage() {
  const toast = useToast();
  const { t, language } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const isAdminView = user?.role === 'Admin';
  const [policies, setPolicies] = useState([]);
  const [compliance, setCompliance] = useState({
    summary: {},
    audienceBreakdown: [],
    followUpItems: [],
  });
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remindingId, setRemindingId] = useState(null);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const [data, complianceData] = await Promise.all([
        hrGetPolicies(),
        hrGetPolicyCompliance().catch(() => null),
      ]);
      setPolicies(Array.isArray(data) ? data : []);
      setCompliance(complianceData && typeof complianceData === 'object'
        ? complianceData
        : { summary: {}, audienceBreakdown: [], followUpItems: [] });
    } catch (error) {
      toast(error.message || 'Failed to load policy announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const stats = useMemo(() => ({
    total: compliance?.summary?.publishedCount ?? policies.length,
    outstanding: compliance?.summary?.outstandingEmployees ?? 0,
    dueThisWeek: compliance?.summary?.dueThisWeekCount ?? 0,
    averageCoverage: `${compliance?.summary?.averageCoverageRate ?? 100}%`,
  }), [compliance, policies.length]);

  const followUpItems = compliance?.followUpItems || [];
  const audienceBreakdown = compliance?.audienceBreakdown || [];
  const averageCoverageValue = Number(compliance?.summary?.averageCoverageRate ?? 100);
  const overduePolicies = followUpItems.filter((item) => item.dueState === 'Overdue').length;
  const lowCoveragePolicies = followUpItems.filter((item) => Number(item.coverageRate || 0) < 80).length;
  const reminderPressure = followUpItems.reduce((sum, item) => sum + Number(item.reminderCount || 0), 0);
  const priorityPolicies = useMemo(() => {
    const dueRank = { Overdue: 3, 'Due This Week': 2, Open: 1 };
    return [...followUpItems]
      .sort((a, b) => (dueRank[b.dueState] || 0) - (dueRank[a.dueState] || 0)
        || Number(b.pendingEmployees || 0) - Number(a.pendingEmployees || 0)
        || Number(a.coverageRate || 100) - Number(b.coverageRate || 100))
      .slice(0, 4);
  }, [followUpItems]);
  const audienceRiskMap = useMemo(() => {
    return [...audienceBreakdown]
      .sort((a, b) => Number(b.outstandingEmployees || 0) - Number(a.outstandingEmployees || 0)
        || Number(b.policies || 0) - Number(a.policies || 0))
      .slice(0, 3);
  }, [audienceBreakdown]);
  const audiencePressure = audienceRiskMap[0]?.outstandingEmployees ?? 0;
  const mostExposedAudience = audienceRiskMap[0]?.audience || 'All Employees';
  const governancePlaybook = useMemo(() => {
    const plays = [];

    if (overduePolicies > 0) {
      plays.push({
        title: t('Escalate overdue acknowledgements'),
        note: t('Start with overdue policy items so unresolved compliance gaps do not stay open another week.'),
      });
    }
    if (lowCoveragePolicies > 0 || averageCoverageValue < 90) {
      plays.push({
        title: t('Recover low-coverage policies'),
        note: t('Policies under healthy coverage need a tighter reminder loop and clearer manager ownership.'),
      });
    }
    if (stats.dueThisWeek > 0) {
      plays.push({
        title: t('Close this week’s deadlines'),
        note: t('Use short reminders and direct follow-up before due-this-week items slip into overdue status.'),
      });
    }
    if (reminderPressure > 0) {
      plays.push({
        title: t('Review reminder fatigue'),
        note: t('High reminder counts may signal a communication issue or the need for manager escalation.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Maintain compliance rhythm'),
      note: t('Policy acknowledgements look stable, so keep the current reminder and publishing cadence.'),
    }];
  }, [averageCoverageValue, lowCoveragePolicies, overduePolicies, reminderPressure, stats.dueThisWeek, t]);
  const strongestSignal = overduePolicies > 0
    ? t('Some policy acknowledgements are already overdue and need immediate follow-up.')
    : lowCoveragePolicies > 0
      ? t(`Coverage is weakest in ${mostExposedAudience}, so that audience should be reviewed first.`)
      : stats.dueThisWeek > 0
        ? t('Several policy items are due this week and should be closed before the deadline window ends.')
        : t('Policy compliance looks steady; focus next on maintaining strong acknowledgement coverage.');

  const getDueTone = (state) => {
    if (state === 'Overdue') return 'red';
    if (state === 'Due This Week') return 'yellow';
    return 'blue';
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast('Title and content are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await hrCreatePolicy({
        title: form.title.trim(),
        category: form.category,
        audience: form.audience,
        content: form.content.trim(),
        status: form.status,
        effectiveDate: form.effectiveDate || null,
      });
      toast('Policy announcement created');
      setForm(INITIAL_FORM);
      await loadPolicies();
    } catch (error) {
      toast(error.message || 'Failed to create policy announcement', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async (item) => {
    setRemindingId(item.policyID);
    try {
      const defaultNote = item.dueState === 'Overdue'
        ? 'Urgent reminder sent for an overdue policy acknowledgement.'
        : item.dueState === 'Due This Week'
          ? 'Reminder sent ahead of this week’s policy acknowledgement deadline.'
          : 'Reminder sent from the HR compliance center.';
      await hrSendPolicyReminder(item.policyID, { note: defaultNote });
      toast('Policy reminder logged');
      await loadPolicies();
    } catch (error) {
      toast(error.message || 'Failed to send policy reminder', 'error');
    } finally {
      setRemindingId(null);
    }
  };

  const handleExportFollowUp = () => {
    const items = compliance?.followUpItems || [];
    if (!items.length) {
      toast('No follow-up items to export.', 'error');
      return;
    }

    const rows = [
      ['Title', 'Audience', 'Pending Acknowledgements', 'Coverage %', 'Due State', 'Effective Date', 'Reminder Count', 'Last Reminder'],
      ...items.map((item) => ([
        item.title,
        item.audience,
        item.pendingEmployees,
        item.coverageRate,
        item.dueState,
        item.effectiveDate || '',
        item.reminderCount || 0,
        item.lastReminderAt ? new Date(item.lastReminderAt).toLocaleString() : '',
      ])),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `policy-compliance-follow-up-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Compliance follow-up report exported');
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{language === 'ar' ? 'إعلانات وسياسات الموارد البشرية' : 'Policy Announcements'}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {language === 'ar' ? 'انشر السياسات والإعلانات الجديدة وتابع حالة الإقرار بها.' : 'Publish new HR policies, share announcements, and monitor acknowledgment status.'}
        </p>
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
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/training'))}>{t('nav.training')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/documents'))}>{t('nav.documents')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/hr/approvals'))}>{t('nav.approvals')}</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: t('Tracked Items'), value: stats.total, color: '#111827' },
            { label: t('Outstanding Acks'), value: stats.outstanding, color: '#E8321A' },
            { label: t('Due This Week'), value: stats.dueThisWeek, color: '#F59E0B' },
            { label: t('Avg. Coverage'), value: stats.averageCoverage, color: '#10B981' },
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
          { label: 'Tracked Items', value: stats.total, accent: '#111827' },
          { label: 'Outstanding Acks', value: stats.outstanding, accent: '#E8321A' },
          { label: 'Due This Week', value: stats.dueThisWeek, accent: '#F59E0B' },
          { label: 'Avg. Coverage', value: stats.averageCoverage, accent: '#10B981' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Policy Governance Radar')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Bring policy risk, reminder pressure, and audience coverage into one governance review layer.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color={overduePolicies > 0 ? 'red' : 'green'} label={`${t('Overdue')} ${overduePolicies}`} />
            <Badge color={lowCoveragePolicies > 0 ? 'orange' : 'gray'} label={`${t('Low Coverage')} ${lowCoveragePolicies}`} />
          </div>
        </div>

        <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
          {[
            {
              label: t('Overdue Policies'),
              value: overduePolicies,
              note: t('Acknowledgement items already outside the expected response window.'),
              accent: overduePolicies > 0 ? '#E8321A' : '#22C55E',
            },
            {
              label: t('Low Coverage'),
              value: lowCoveragePolicies,
              note: t('Policies still sitting below healthy acknowledgement coverage.'),
              accent: lowCoveragePolicies > 0 ? '#F59E0B' : '#22C55E',
            },
            {
              label: t('Audience Pressure'),
              value: audiencePressure,
              note: t('Outstanding acknowledgements in the most exposed audience group.'),
              accent: audiencePressure > 0 ? '#2563EB' : '#94A3B8',
            },
            {
              label: t('Reminder Load'),
              value: reminderPressure,
              note: t('Reminder touchpoints already logged across open policy follow-up items.'),
              accent: reminderPressure > 0 ? '#7C3AED' : '#94A3B8',
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
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Policy Queue')}</div>
            {priorityPolicies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No priority policy items are flagged right now.')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {priorityPolicies.map((item) => (
                  <div key={item.policyID} className="workspace-action-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                      <Badge color={getDueTone(item.dueState)} label={t(item.dueState)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.audience)} • {item.pendingEmployees} {t('pending acknowledgements')}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-700)', marginBottom: 6 }}>{t('Coverage')}: {item.coverageRate}% • {t('Reminder Count')}: {item.reminderCount || 0}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="accent" label={`${t('Effective Date')}: ${item.effectiveDate || '—'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Compliance Playbook')}</div>
            <div className="workspace-focus-card" style={{ background: '#fff', marginBottom: 10 }}>
              <div className="workspace-focus-label">{t('Strongest Signal')}</div>
              <div className="workspace-focus-note">{strongestSignal}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {governancePlaybook.map((item) => (
                <div key={item.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                  <div className="workspace-focus-label">{item.title}</div>
                  <div className="workspace-focus-note">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.15fr .85fr', marginBottom: 24, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Compliance Snapshot')}</div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)' }}>{t('See which policies need follow-up before they become a compliance risk.')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={(compliance?.summary?.outstandingEmployees ?? 0) > 0 ? 'yellow' : 'green'} label={`${stats.averageCoverage} ${t('covered')}`} />
              <Btn size="sm" variant="ghost" onClick={handleExportFollowUp}>{t('Export Follow-up CSV')}</Btn>
            </div>
          </div>

          {followUpItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('All published policy items are currently acknowledged or on track.')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {followUpItems.map((item) => (
                <div key={item.policyID} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E7EAEE', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                    <Badge color={getDueTone(item.dueState)} label={t(item.dueState)} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 4 }}>{t(item.audience)} • {item.pendingEmployees} {t('pending acknowledgements')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Coverage')}: {item.coverageRate}% • {t('Effective Date')}: {item.effectiveDate || '—'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>
                      {t('Reminder Count')}: {item.reminderCount || 0}
                      <br />
                      {t('Last Reminder')}: {item.lastReminderAt ? new Date(item.lastReminderAt).toLocaleString() : t('Not sent yet')}
                    </div>
                    <Btn size="sm" onClick={() => handleSendReminder(item)} disabled={remindingId === item.policyID}>
                      {remindingId === item.policyID ? t('Sending...') : t('Send Reminder')}
                    </Btn>
                  </div>
                  {item.lastReminderNote ? (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--gray-600)' }}>
                      <strong>{t('Last Note')}:</strong> {item.lastReminderNote}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Audience Readiness')}</div>
          <div style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 12 }}>{t('Track which employee groups still need policy acknowledgement follow-up.')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {audienceBreakdown.map((item) => (
              <div key={item.audience} style={{ padding: '10px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E7EAEE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 12.5 }}>{t(item.audience)}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{item.targetEmployees} {t('employees')}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--gray-600)' }}>{item.outstandingEmployees} {t('outstanding acknowledgements')} • {item.policies} {t('items')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Announcement')}</h3>
          <Input label={t('Title')} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Updated Remote Work Policy')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
              <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Policy', 'Announcement'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Audience')}</label>
              <select value={form.audience} onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['All Employees', 'Managers', 'Team Leaders'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Effective Date')} type="date" value={form.effectiveDate} onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Draft', 'Published', 'Acknowledged'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <Textarea label={t('Content')} value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} placeholder={t('Explain policy details and action required from employees')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Publish Item')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Policy Feed')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : policies.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No policy announcements yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Title', 'Category', 'Audience', 'Status', 'Effective Date', 'Acks'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {policies.map((item) => (
                    <tr key={item.policyID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.createdBy || t('HR')} </div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(item.category)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{t(item.audience)}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(item.status)} color={STATUS_COLORS[item.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.effectiveDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{item.acknowledgements || 0}</td>
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
