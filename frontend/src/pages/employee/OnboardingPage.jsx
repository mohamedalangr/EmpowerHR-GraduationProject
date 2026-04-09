import { useEffect, useMemo, useState } from 'react';
import { getMyOnboarding, updateMyOnboardingProgress } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  'Not Started': 'gray',
  'In Progress': 'orange',
  Completed: 'green',
  Blocked: 'red',
};

const daysUntilDate = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
};

const getTargetWindowLabel = (value, t) => {
  const days = daysUntilDate(value);
  if (!Number.isFinite(days)) return t('No target date');
  if (days < 0) return `${Math.abs(days)} ${t('days overdue')}`;
  if (days === 0) return t('Due today');
  if (days === 1) return t('Due tomorrow');
  return `${days} ${t('days left')}`;
};

const getOnboardingTone = (plan) => {
  const days = daysUntilDate(plan?.targetDate);
  if (plan?.status === 'Blocked') return 'red';
  if (plan?.status === 'Completed') return 'green';
  if (Number.isFinite(days) && days < 0) return 'red';
  if (plan?.status === 'In Progress' && days <= 3) return 'orange';
  if (plan?.status === 'Not Started' && days <= 7) return 'yellow';
  return STATUS_COLORS[plan?.status] || 'gray';
};

export function EmployeeOnboardingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadPlans = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyOnboarding(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setPlans(list);
      const nextDrafts = {};
      list.forEach((plan) => {
        nextDrafts[plan.planID] = {
          status: plan.status || 'Not Started',
          progress: plan.progress ?? 0,
          note: plan.employeeNote || '',
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      toast(error.message || 'Failed to load onboarding plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((plan) => plan.status === 'In Progress').length,
    completed: plans.filter((plan) => plan.status === 'Completed').length,
  }), [plans]);

  const blockedCount = plans.filter((plan) => plan.status === 'Blocked').length;
  const notStartedCount = plans.filter((plan) => plan.status === 'Not Started').length;
  const dueSoonCount = plans.filter((plan) => plan.status !== 'Completed' && Number.isFinite(daysUntilDate(plan.targetDate)) && daysUntilDate(plan.targetDate) <= 7).length;
  const readyToCloseCount = plans.filter((plan) => plan.status !== 'Completed' && Number(plan.progress || 0) >= 75).length;
  const averageProgress = plans.length
    ? Math.round(plans.reduce((sum, plan) => sum + Number(plan.progress || 0), 0) / plans.length)
    : 0;

  const onboardingFocusQueue = useMemo(() => {
    const statusRank = { Blocked: 4, 'Not Started': 3, 'In Progress': 2, Completed: 1 };
    return [...plans]
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || Number(a.progress || 0) - Number(b.progress || 0)
        || daysUntilDate(a.targetDate) - daysUntilDate(b.targetDate)
        || String(a.title || '').localeCompare(String(b.title || '')))
      .slice(0, 4);
  }, [plans]);

  const planTypePressureMap = useMemo(() => {
    const grouped = plans.reduce((acc, plan) => {
      const key = plan.planType || 'Onboarding';
      if (!acc[key]) {
        acc[key] = { planType: key, count: 0, activeCount: 0, blockedCount: 0, dueSoonCount: 0, completedCount: 0 };
      }
      acc[key].count += 1;
      if (plan.status !== 'Completed') acc[key].activeCount += 1;
      if (plan.status === 'Blocked') acc[key].blockedCount += 1;
      if (plan.status === 'Completed') acc[key].completedCount += 1;
      if (plan.status !== 'Completed' && Number.isFinite(daysUntilDate(plan.targetDate)) && daysUntilDate(plan.targetDate) <= 7) {
        acc[key].dueSoonCount += 1;
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.activeCount - a.activeCount || b.blockedCount - a.blockedCount || b.count - a.count)
      .slice(0, 4);
  }, [plans]);

  const onboardingPlaybook = useMemo(() => {
    const plays = [];

    if (blockedCount > 0) {
      plays.push({
        title: t('Clear blockers first'),
        note: t('Blocked plans are the fastest place to regain momentum because one update can unlock multiple checklist steps.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Protect the next milestone'),
        note: t('Plans nearing their target date should get a quick review so onboarding or transition tasks do not slip.'),
      });
    }
    if (notStartedCount > 0) {
      plays.push({
        title: t('Kick off untouched plans'),
        note: t('Not-started plans usually need a clear first action, owner, or check-in to move forward.'),
      });
    }
    if (readyToCloseCount > 0) {
      plays.push({
        title: t('Finish nearly complete plans'),
        note: t('High-progress plans are quick wins that can close out transition work and reduce visible load.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Transition flow looks steady'),
      note: t('Your onboarding and transition plans appear stable right now, so keep sharing clear progress notes with HR.'),
    }];
  }, [blockedCount, dueSoonCount, notStartedCount, readyToCloseCount, t]);

  const strongestSignal = blockedCount > 0
    ? t('One or more plans are blocked, so clearing those blockers is the most important next move.')
    : dueSoonCount > 0
      ? t('Several transition steps are approaching their target date, making timing the clearest pressure point right now.')
      : notStartedCount > 0
        ? t('Some plans have not started yet, so an early kickoff will create the biggest momentum gain.')
        : t('Your onboarding and transition workload looks steady right now, with no major delivery pressure standing out.');

  const setDraftField = (planID, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [planID]: {
        ...(prev[planID] || {}),
        [key]: value,
      },
    }));
  };

  const handleUpdate = async (planID) => {
    const draft = drafts[planID];
    if (!draft) return;

    setSavingId(planID);
    try {
      await updateMyOnboardingProgress(planID, {
        status: draft.status,
        progress: Number(draft.progress || 0),
        note: draft.note || '',
      });
      toast('Plan progress updated');
      await loadPlans();
    } catch (error) {
      toast(error.message || 'Failed to update onboarding plan', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Onboarding & Transition')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Track onboarding, offboarding, or transition plans and update progress as tasks are completed.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Plans'), value: stats.total, accent: '#111827' },
          { label: t('In Progress'), value: stats.active, accent: '#F59E0B' },
          { label: t('Completed'), value: stats.completed, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Onboarding Transition Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Blocked'), value: blockedCount, color: '#DC2626', note: t('Plans that need a blocker removed before progress can continue.') },
                { label: t('Due Soon'), value: dueSoonCount, color: '#B54708', note: t('Open plans with a nearby target date or upcoming milestone.') },
                { label: t('Need Kickoff'), value: notStartedCount, color: '#175CD3', note: t('Assigned plans that still need their first progress step or check-in.') },
                { label: t('Avg Progress'), value: `${averageProgress}%`, color: '#027A48', note: t('Average completion level across your onboarding and transition work.') },
              ].map((item) => (
                <div key={item.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 23, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #FDE68A', background: '#FFFBEB', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#B45309', marginBottom: 6 }}>{t('Strongest signal')}</div>
              <div style={{ fontSize: 13.5, color: '#92400E' }}>{strongestSignal}</div>
            </div>
          </div>

          <div className="hr-table-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Transition Queue')}</h3>
            </div>
            {onboardingFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority transition items will appear here as plans are assigned.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {onboardingFocusQueue.map((plan) => (
                  <div key={`queue-${plan.planID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{plan.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t(plan.planType)} • {getTargetWindowLabel(plan.targetDate, t)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{Number(plan.progress || 0)}% {t('complete')}</div>
                    </div>
                    <Badge label={t(plan.status)} color={getOnboardingTone(plan)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Onboarding Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {onboardingPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Plan Type Pressure')}</div>
            {planTypePressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No plan-type pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {planTypePressureMap.map((item) => (
                  <div key={item.planType} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.planType)}</div>
                      <Badge label={`${item.count} ${t('plans')}`} color={item.activeCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Active')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.activeCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Blocked')}</div>
                        <div style={{ fontWeight: 700, color: '#DC2626' }}>{item.blockedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Due Soon')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.dueSoonCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>
      ) : plans.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No onboarding plans assigned')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can add onboarding or transition plans from the Onboarding page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {plans.map((plan) => {
            const draft = drafts[plan.planID] || { status: plan.status, progress: plan.progress ?? 0, note: plan.employeeNote || '' };
            return (
              <div key={plan.planID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {t(plan.planType)} • {t('Start')}: {plan.startDate || '—'} • {t('Target')}: {plan.targetDate || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge label={getTargetWindowLabel(plan.targetDate, t)} color={getOnboardingTone(plan)} />
                    <Badge label={t(plan.status)} color={getOnboardingTone(plan)} />
                  </div>
                </div>

                {Array.isArray(plan.checklistItems) && plan.checklistItems.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Checklist')}</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--gray-700)', fontSize: 13.5 }}>
                      {plan.checklistItems.map((item, index) => <li key={`${plan.planID}-${index}`}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {plan.notes && <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{plan.notes}</p>}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Progress')}</span>
                    <strong style={{ fontSize: 12.5 }}>{draft.progress}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${draft.progress}%`, height: '100%', background: 'var(--red)', borderRadius: 999 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraftField(plan.planID, 'status', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
                    >
                      {['Not Started', 'In Progress', 'Completed', 'Blocked'].map((item) => (
                        <option key={item} value={item}>{t(item)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Progress %')}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draft.progress}
                      onChange={(e) => setDraftField(plan.planID, 'progress', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  <Textarea
                    label={t('Employee Note')}
                    value={draft.note}
                    onChange={(e) => setDraftField(plan.planID, 'note', e.target.value)}
                    placeholder={t('Add any blockers or updates for HR')}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Btn onClick={() => handleUpdate(plan.planID)} disabled={savingId === plan.planID}>
                      {savingId === plan.planID ? t('Saving...') : t('Update Progress')}
                    </Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
