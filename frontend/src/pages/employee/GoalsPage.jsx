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

const daysUntilDue = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
};

const getDueWindowLabel = (value, t) => {
  const days = daysUntilDue(value);
  if (!Number.isFinite(days)) return t('No due date');
  if (days < 0) return `${Math.abs(days)} ${t('days overdue')}`;
  if (days === 0) return t('Due today');
  if (days === 1) return t('Due tomorrow');
  return `${days} ${t('days left')}`;
};

const getGoalTone = (goal) => {
  if (goal?.status === 'On Hold') return 'red';
  if (goal?.status === 'Completed') return 'green';
  if (goal?.priority === 'High' || daysUntilDue(goal?.dueDate) <= 7) return 'orange';
  return 'accent';
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

  const completionMomentum = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const dueSoonCount = goals.filter((goal) => goal.status !== 'Completed' && daysUntilDue(goal.dueDate) <= 7).length;
  const blockedCount = goals.filter((goal) => goal.status === 'On Hold').length;
  const highPriorityOpenCount = goals.filter((goal) => goal.priority === 'High' && goal.status !== 'Completed').length;

  const goalFocusQueue = useMemo(() => {
    const statusRank = { 'On Hold': 4, 'Not Started': 3, 'In Progress': 2, Completed: 1 };
    const priorityRank = { High: 3, Medium: 2, Low: 1 };

    return [...goals]
      .filter((goal) => goal.status !== 'Completed')
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || daysUntilDue(a.dueDate) - daysUntilDue(b.dueDate)
        || Number(a.progress || 0) - Number(b.progress || 0))
      .slice(0, 4);
  }, [goals]);

  const goalPressureMap = useMemo(() => {
    const grouped = goals.reduce((acc, goal) => {
      if (goal.status === 'Completed') return acc;
      const key = goal.category || 'Uncategorized';
      if (!acc[key]) {
        acc[key] = { category: key, openCount: 0, blockedCount: 0, progressTotal: 0 };
      }
      acc[key].openCount += 1;
      acc[key].progressTotal += Number(goal.progress || 0);
      if (goal.status === 'On Hold') acc[key].blockedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        averageProgress: item.openCount ? Math.round(item.progressTotal / item.openCount) : 0,
      }))
      .sort((a, b) => b.openCount - a.openCount || b.blockedCount - a.blockedCount)
      .slice(0, 4);
  }, [goals]);

  const goalPlaybook = useMemo(() => {
    const plays = [];

    if (blockedCount > 0) {
      plays.push({
        title: t('Unblock paused goals first'),
        note: t('Goals on hold usually need a decision, dependency, or manager check-in before progress can resume.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Protect the upcoming deadlines'),
        note: t('Goals due soon should get a quick progress update now so nothing slips at the last minute.'),
      });
    }
    if (highPriorityOpenCount > 0) {
      plays.push({
        title: t('Focus on high-priority outcomes'),
        note: t('The highest-impact goals are the best place to spend focused effort this week.'),
      });
    }
    if (completionMomentum < 60 && stats.total > 0) {
      plays.push({
        title: t('Use one quick update to rebuild momentum'),
        note: t('Even a small progress check-in helps your goal board move forward and stay visible.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Your goals are moving well'),
      note: t('Keep the current update rhythm and continue checking off completed milestones.'),
    }];
  }, [blockedCount, completionMomentum, dueSoonCount, highPriorityOpenCount, stats.total, t]);

  const strongestSignal = blockedCount > 0
    ? t('One or more goals are currently on hold, so removing blockers will create the biggest progress lift.')
    : dueSoonCount > 0
      ? t('A few goals are approaching their due dates, so now is the right time for a focused progress push.')
      : highPriorityOpenCount > 0
        ? t('Your highest-priority goals are still active, so concentrated effort there will matter most.')
        : t('Goal momentum looks steady right now, with progress broadly moving in the right direction.');

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Goal Momentum Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('High Priority'), value: highPriorityOpenCount, color: '#E8321A', note: t('Open goals that carry the highest business impact.') },
                { label: t('Due Soon'), value: dueSoonCount, color: '#B54708', note: t('Goals that need attention within the next week.') },
                { label: t('On Hold'), value: blockedCount, color: '#7A271A', note: t('Items currently paused by blockers or dependencies.') },
                { label: t('Momentum'), value: `${completionMomentum}%`, color: '#175CD3', note: t('Overall completion progress across your goal board.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Goal Queue')}</h3>
            </div>
            {goalFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No active goals need follow-up right now.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {goalFocusQueue.map((goal) => (
                  <div key={`queue-${goal.goalID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{goal.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t(goal.category)} • {t('Priority:')} {t(goal.priority)} • {t('Progress')} {goal.progress ?? 0}%
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>
                        {t('Due:')} {goal.dueDate || '—'}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(goal.status)} color={getGoalTone(goal)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{getDueWindowLabel(goal.dueDate, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Goal Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {goalPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Category Pressure')}</div>
            {goalPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No category pressure is visible right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {goalPressureMap.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.category)}</div>
                      <Badge label={`${item.openCount} ${t('open')}`} color={item.blockedCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Blocked')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.blockedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Avg Progress')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.averageProgress}%</div>
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
