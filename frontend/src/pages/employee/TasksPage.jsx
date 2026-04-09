import { useEffect, useMemo, useState } from 'react';
import { getMyTasks, updateMyTaskProgress } from '../../api/index.js';
import { Badge, Btn, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_COLORS = {
  'To Do': 'gray',
  'In Progress': 'orange',
  Done: 'green',
  Blocked: 'red',
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

const getTaskTone = (task) => {
  if (task?.status === 'Blocked') return 'red';
  if (task?.status === 'Done') return 'green';
  if (task?.priority === 'High' || daysUntilDue(task?.dueDate) <= 3) return 'orange';
  return 'accent';
};

export function EmployeeTasksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadTasks = async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    try {
      const data = await getMyTasks(user.employee_id);
      const list = Array.isArray(data) ? data : [];
      setTasks(list);
      const nextDrafts = {};
      list.forEach((task) => {
        nextDrafts[task.taskID] = {
          status: task.status,
          progress: task.progress ?? 0,
        };
      });
      setDrafts(nextDrafts);
    } catch (error) {
      toast(error.message || 'Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user?.employee_id]);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'In Progress').length,
    done: tasks.filter((task) => task.status === 'Done').length,
  }), [tasks]);

  const executionMomentum = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const blockedCount = tasks.filter((task) => task.status === 'Blocked').length;
  const dueSoonCount = tasks.filter((task) => task.status !== 'Done' && daysUntilDue(task.dueDate) <= 3).length;
  const highPriorityCount = tasks.filter((task) => task.priority === 'High' && task.status !== 'Done').length;
  const quickWinCount = tasks.filter((task) => task.status !== 'Done' && Number(task.estimatedHours || 0) > 0 && Number(task.estimatedHours || 0) <= 2).length;

  const taskFocusQueue = useMemo(() => {
    const statusRank = { Blocked: 4, 'To Do': 3, 'In Progress': 2, Done: 1 };
    const priorityRank = { High: 3, Medium: 2, Low: 1 };

    return [...tasks]
      .filter((task) => task.status !== 'Done')
      .sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)
        || (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        || daysUntilDue(a.dueDate) - daysUntilDue(b.dueDate)
        || Number(a.progress || 0) - Number(b.progress || 0))
      .slice(0, 4);
  }, [tasks]);

  const workloadPressureMap = useMemo(() => {
    const grouped = tasks.reduce((acc, task) => {
      if (task.status === 'Done') return acc;
      const key = task.priority || 'Unspecified';
      if (!acc[key]) {
        acc[key] = { priority: key, openCount: 0, blockedCount: 0, totalHours: 0 };
      }
      acc[key].openCount += 1;
      acc[key].totalHours += Number(task.estimatedHours || 0);
      if (task.status === 'Blocked') acc[key].blockedCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.openCount - a.openCount || b.blockedCount - a.blockedCount || b.totalHours - a.totalHours)
      .slice(0, 4);
  }, [tasks]);

  const taskPlaybook = useMemo(() => {
    const plays = [];

    if (blockedCount > 0) {
      plays.push({
        title: t('Clear blocked tasks first'),
        note: t('Blocked work needs a decision or dependency removed before progress can restart.'),
      });
    }
    if (dueSoonCount > 0) {
      plays.push({
        title: t('Protect the nearest deadlines'),
        note: t('Tasks due in the next few days should get a quick update before they become overdue.'),
      });
    }
    if (highPriorityCount > 0) {
      plays.push({
        title: t('Focus on the highest impact work'),
        note: t('High-priority tasks are the best place to spend concentrated effort this week.'),
      });
    }
    if (quickWinCount > 0) {
      plays.push({
        title: t('Use short tasks to build momentum'),
        note: t('Quick wins help reduce your queue and create visible progress fast.'),
      });
    }

    return plays.length ? plays.slice(0, 4) : [{
      title: t('Task flow looks stable'),
      note: t('Your current workload is balanced, so keep updating progress as you close items out.'),
    }];
  }, [blockedCount, dueSoonCount, highPriorityCount, quickWinCount, t]);

  const strongestSignal = blockedCount > 0
    ? t('One or more tasks are blocked right now, so removing those blockers will create the biggest progress lift.')
    : dueSoonCount > 0
      ? t('A few tasks are approaching their deadlines, so focused follow-through now will protect delivery.')
      : highPriorityCount > 0
        ? t('Your high-priority work is still active, making it the best place to focus next.')
        : t('Task execution looks steady right now, with work generally moving in a healthy rhythm.');

  const setDraftField = (taskID, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [taskID]: {
        ...(prev[taskID] || {}),
        [key]: value,
      },
    }));
  };

  const handleUpdate = async (taskID) => {
    const draft = drafts[taskID];
    if (!draft) return;

    setSavingId(taskID);
    try {
      await updateMyTaskProgress(taskID, {
        status: draft.status,
        progress: Number(draft.progress || 0),
      });
      toast('Task progress updated');
      await loadTasks();
    } catch (error) {
      toast(error.message || 'Failed to update task', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Tasks')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Review assigned work items, update progress, and track deadlines.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Assigned Tasks'), value: stats.total, accent: '#111827' },
          { label: t('In Progress'), value: stats.active, accent: '#F59E0B' },
          { label: t('Done'), value: stats.done, accent: '#10B981' },
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
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Task Execution Radar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { label: t('High Priority'), value: highPriorityCount, color: '#E8321A', note: t('Open tasks carrying the highest urgency or impact.') },
                { label: t('Due Soon'), value: dueSoonCount, color: '#B54708', note: t('Tasks that need action within the next few days.') },
                { label: t('Blocked'), value: blockedCount, color: '#7A271A', note: t('Work items waiting on a blocker or dependency.') },
                { label: t('Momentum'), value: `${executionMomentum}%`, color: '#175CD3', note: t('Overall completion progress across your task board.') },
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Priority Task Queue')}</h3>
            </div>
            {taskFocusQueue.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No active tasks need follow-up right now.')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {taskFocusQueue.map((task) => (
                  <div key={`queue-${task.taskID}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{task.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>
                        {t('Priority:')} {t(task.priority)} • {t('Progress')} {task.progress ?? 0}% • {t('Est.')} {task.estimatedHours ?? '—'} {t('hrs')}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 4 }}>{t('Due:')} {task.dueDate || '—'}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      <Badge label={t(task.status)} color={getTaskTone(task)} />
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{getDueWindowLabel(task.dueDate, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Execution Playbook')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {taskPlaybook.map((item) => (
                <div key={item.title} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hr-surface-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Workload Pressure')}</div>
            {workloadPressureMap.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, color: 'var(--gray-500)', margin: 0 }}>{t('No workload pressure stands out right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {workloadPressureMap.map((item) => (
                  <div key={item.priority} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{t(item.priority)} {t('Priority')}</div>
                      <Badge label={`${item.openCount} ${t('open')}`} color={item.blockedCount > 0 ? 'orange' : 'accent'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Blocked')}</div>
                        <div style={{ fontWeight: 700, color: '#E8321A' }}>{item.blockedCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--gray-400)', fontWeight: 700 }}>{t('Hours')}</div>
                        <div style={{ fontWeight: 700, color: '#175CD3' }}>{item.totalHours || 0}</div>
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
      ) : tasks.length === 0 ? (
        <div className="hr-soft-empty" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>{t('No tasks assigned yet')}</p>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Your team lead can assign tasks from the Team Hub.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {tasks.map((task) => {
            const draft = drafts[task.taskID] || { status: task.status, progress: task.progress ?? 0 };
            return (
              <div key={task.taskID} className="hr-surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{task.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      {t('Priority:')} {t(task.priority)} • {t('Due:')} {task.dueDate || '—'} • {t('Est.')} {task.estimatedHours ?? '—'} {t('hrs')}
                    </div>
                  </div>
                  <Badge label={t(task.status)} color={STATUS_COLORS[task.status] || 'gray'} />
                </div>

                {task.description && (
                  <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 14 }}>{task.description}</p>
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
                      onChange={(e) => setDraftField(task.taskID, 'status', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
                    >
                      {['To Do', 'In Progress', 'Done', 'Blocked'].map((item) => (
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
                      onChange={(e) => setDraftField(task.taskID, 'progress', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <Btn onClick={() => handleUpdate(task.taskID)} disabled={savingId === task.taskID}>
                    {savingId === task.taskID ? t('Saving...') : t('Update')}
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
