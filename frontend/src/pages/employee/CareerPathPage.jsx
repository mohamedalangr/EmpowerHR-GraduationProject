import { useEffect, useMemo, useState } from 'react';
import { acknowledgeCareerPlan, getMyCareerPath } from '../../api/index.js';
import { Badge, Btn, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  Active: 'orange',
  'On Track': 'blue',
  Acknowledged: 'green',
  Completed: 'green',
  'On Hold': 'red',
};

const RISK_COLORS = {
  Low: 'green',
  Medium: 'orange',
  High: 'red',
};

const READINESS_RANK = {
  'Ready Now': 4,
  '6-12 Months': 3,
  '12+ Months': 2,
  Future: 1,
};

const getCareerTone = (plan) => {
  if (plan?.retentionRisk === 'High' || plan?.status === 'On Hold') return 'red';
  if (plan?.status === 'Acknowledged' || plan?.status === 'Completed') return 'green';
  if (['Ready Now', '6-12 Months'].includes(plan?.readiness)) return 'orange';
  return 'accent';
};

export function EmployeeCareerPathPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});

  const loadPlans = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyCareerPath(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setPlans(list);
      const nextNotes = {};
      list.forEach((plan) => {
        nextNotes[plan.planID] = plan.employeeNote || '';
      });
      setNotes(nextNotes);
    } catch (error) {
      toast(error.message || 'Failed to load career path plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: plans.length,
    readySoon: plans.filter((plan) => ['Ready Now', '6-12 Months'].includes(plan.readiness)).length,
    acknowledged: plans.filter((plan) => plan.status === 'Acknowledged').length,
  }), [plans]);

  const highRiskCount = plans.filter((plan) => plan.retentionRisk === 'High').length;
  const pendingAckCount = plans.filter((plan) => plan.status !== 'Acknowledged').length;
  const readyNowCount = plans.filter((plan) => plan.readiness === 'Ready Now').length;
  const actionPlanCount = plans.filter((plan) => String(plan.developmentActions || '').trim()).length;

  const growthFocusQueue = useMemo(() => {
    const statusRank = { 'On Hold': 4, Active: 3, 'On Track': 2, Acknowledged: 1, Completed: 1 };
    const riskRank = { High: 3, Medium: 2, Low: 1 };

    return [...plans]
      .sort((a, b) => (riskRank[b.retentionRisk] || 0) - (riskRank[a.retentionRisk] || 0)
        || (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || (READINESS_RANK[b.readiness] || 0) - (READINESS_RANK[a.readiness] || 0)
        || String(a.targetRole || '').localeCompare(String(b.targetRole || '')))
      .slice(0, 4);
  }, [plans]);

  const readinessPressureMap = useMemo(() => {
    const grouped = plans.reduce((acc, plan) => {
      const key = plan.readiness || 'Future';
      if (!acc[key]) {
        acc[key] = { readiness: key, count: 0, highRiskCount: 0, acknowledgedCount: 0 };
      }
      acc[key].count += 1;
      if (plan.retentionRisk === 'High') acc[key].highRiskCount += 1;
      if (plan.status === 'Acknowledged') acc[key].acknowledgedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => (READINESS_RANK[b.readiness] || 0) - (READINESS_RANK[a.readiness] || 0)
        || b.highRiskCount - a.highRiskCount
        || b.count - a.count)
      .slice(0, 4);
  }, [plans]);

  const careerPlaybook = useMemo(() => {
    const plays = [];

    if (pendingAckCount > 0) {
      plays.push({
        title: t('Acknowledge shared growth plans quickly'),
        note: t('Closing the loop on new career-path plans keeps development conversations active and visible.'),
      });
    }
    if (highRiskCount > 0) {
      plays.push({
        title: t('Prioritize retention-risk signals'),
        note: t('High-risk plans deserve a near-term check-in so growth goals and support stay aligned.'),
      });
    }
    if (readyNowCount > 0) {
      plays.push({
        title: t('Use ready-now plans as your next step'),
        note: t('Near-ready roles are the clearest place to turn development actions into visible progress.'),
      });
    }
    if (actionPlanCount > 0) {
      plays.push({
        title: t('Turn development actions into routines'),
        note: t('Pick one action from the plan and connect it to a course, goal, or recurring weekly habit.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Your growth plan is open for the next step'),
      note: t('As HR shares more pathing details, this space will highlight the strongest development signals.'),
    }];
  }, [actionPlanCount, highRiskCount, pendingAckCount, readyNowCount, t]);

  const strongestSignal = highRiskCount > 0
    ? t('One or more career plans carry elevated retention risk, so focused follow-up there will matter most.')
    : pendingAckCount > 0
      ? t('Some career-path plans are still waiting for acknowledgment, making quick review the clearest next move.')
      : readyNowCount > 0
        ? t('You already have near-ready growth paths, which makes this a strong moment to act on development steps.')
        : t('Your career-path outlook looks steady right now, with no major pressure signals standing out.');

  const handleAcknowledge = async (planID) => {
    setSavingId(planID);
    try {
      await acknowledgeCareerPlan(planID, { note: notes[planID] || '' });
      toast('Career path acknowledged');
      await loadPlans();
    } catch (error) {
      toast(error.message || 'Failed to acknowledge career path', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Career Path')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review your growth plan, readiness level, and next development steps shared by HR.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Career Plans'), value: stats.total, accent: '#111827' },
          { label: t('Ready Soon'), value: stats.readySoon, accent: '#E8321A' },
          { label: t('Acknowledged'), value: stats.acknowledged, accent: '#10B981' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Career Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('Pending Acks'), value: pendingAckCount, color: '#B54708', note: t('Plans still waiting for your acknowledgment or feedback.') },
                { label: t('High Risk'), value: highRiskCount, color: '#E8321A', note: t('Growth paths carrying a higher retention or support risk.') },
                { label: t('Ready Now'), value: readyNowCount, color: '#027A48', note: t('Roles or paths that look closest to near-term progression.') },
                { label: t('Action Plans'), value: actionPlanCount, color: '#175CD3', note: t('Plans that already include concrete development actions.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Growth Focus Queue')}</h3>
            </div>
            {growthFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('Priority growth follow-up items will appear here as plans are shared.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {growthFocusQueue.map((plan) => (
                  <div key={`queue-${plan.planID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{plan.targetRole}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t('Readiness')}: {t(plan.readiness)} • {t('Risk')}: {t(plan.retentionRisk)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{plan.createdBy || t('HR')}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(plan.status)} color={getCareerTone(plan)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{t(plan.readiness || 'Future')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Career Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {careerPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Readiness Pressure')}</div>
            {readinessPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No readiness pattern stands out yet.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {readinessPressureMap.map((item) => (
                  <div key={item.readiness} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.readiness)}</div>
                      <Badge label={`${item.count} ${t('plans')}`} color={item.highRiskCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('High Risk')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.highRiskCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Acknowledged')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.acknowledgedCount}</div>
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
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No career path plans yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('HR can add succession and growth plans from the Succession page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {plans.map((plan) => (
            <div key={plan.planID} className="hr-surface-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.targetRole}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {t('Readiness')}: {t(plan.readiness)} • {t('Shared by')} {plan.createdBy || t('HR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={t(plan.status)} color={STATUS_COLORS[plan.status] || 'gray'} />
                  <Badge label={`${t('Risk')}: ${t(plan.retentionRisk)}`} color={RISK_COLORS[plan.retentionRisk] || 'gray'} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Development Actions')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{plan.developmentActions || t('No development actions added yet.')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('HR Notes')}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--gray-700)' }}>{plan.notes || t('No notes shared yet.')}</div>
                </div>
              </div>

              <Textarea
                label={t('Employee Note')}
                value={notes[plan.planID] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [plan.planID]: e.target.value }))}
                placeholder={t('Add a short acknowledgment or growth note')}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
                  {plan.acknowledgedAt ? `${t('Acknowledged')} ${new Date(plan.acknowledgedAt).toLocaleString()}` : t('Awaiting employee acknowledgment')}
                </div>
                <Btn
                  onClick={() => handleAcknowledge(plan.planID)}
                  disabled={savingId === plan.planID || plan.status === 'Acknowledged'}
                >
                  {plan.status === 'Acknowledged' ? t('Acknowledged') : savingId === plan.planID ? t('Saving...') : t('Acknowledge')}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
