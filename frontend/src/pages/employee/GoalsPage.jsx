import { useEffect, useMemo, useState } from 'react';
import { getMyGoals, updateMyGoalProgress } from '../../api/index.js';
import { Badge, Btn, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  'Not Started': 'gray',
  'In Progress': 'orange',
  Completed: 'green',
  'On Hold': 'red',
};

export function EmployeeGoalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadGoals = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyGoals(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setGoals(list);
      const nextDrafts = {};
      list.forEach((goal) => {
        nextDrafts[goal.goalID] = {
          status: goal.status,
          progress: goal.progress ?? 0,
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      toast(error.message || 'Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: goals.length,
    inProgress: goals.filter((goal) => goal.status === 'In Progress').length,
    completed: goals.filter((goal) => goal.status === 'Completed').length,
  }), [goals]);

  const setDraftField = (goalID, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [goalID]: {
        ...(prev[goalID] || {}),
        [key]: value,
      },
    }));
  };

  const handleUpdate = async (goalID) => {
    const draft = drafts[goalID];
    if (!draft) return;

    setSavingId(goalID);
    try {
      await updateMyGoalProgress(goalID, {
        status: draft.status,
        progress: Number(draft.progress || 0),
      });
      toast('Goal progress updated');
      await loadGoals();
    } catch (error) {
      toast(error.message || 'Failed to update goal', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Goals')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Track your assigned goals, update progress, and keep your manager informed.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Total Goals'), value: stats.total, accent: '#111827' },
          { label: t('In Progress'), value: stats.inProgress, accent: '#F59E0B' },
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
      ) : goals.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No goals assigned yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Your manager can assign goals from the Team Goals page.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {goals.map((goal) => {
            const draft = drafts[goal.goalID] || { status: goal.status, progress: goal.progress ?? 0 };
            return (
              <div key={goal.goalID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{goal.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {t(goal.category)} • {t('Priority:')} {t(goal.priority)} • {t('Due:')} {goal.dueDate || '—'}
                    </div>
                  </div>
                  <Badge label={t(goal.status)} color={STATUS_COLORS[goal.status] || 'gray'} />
                </div>

                {goal.description && (
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{goal.description}</p>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Progress')}</span>
                    <strong style={{ fontSize: 12.5 }}>{draft.progress}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${draft.progress}%`, height: '100%', background: 'var(--red)', borderRadius: 999 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Status')}</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraftField(goal.goalID, 'status', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
                    >
                      {['Not Started', 'In Progress', 'Completed', 'On Hold'].map((item) => (
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
                      onChange={(e) => setDraftField(goal.goalID, 'progress', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <Btn onClick={() => handleUpdate(goal.goalID)} disabled={savingId === goal.goalID}>
                    {savingId === goal.goalID ? t('Saving...') : t('Update')}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
