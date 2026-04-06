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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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
                  <Badge label={t(plan.status)} color={STATUS_COLORS[plan.status] || 'gray'} />
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

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'end' }}>
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
