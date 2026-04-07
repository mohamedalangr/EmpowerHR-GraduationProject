import { useEffect, useMemo, useState } from 'react';
import {
  createTeamGoal,
  getTeamGoals,
  updateTeamGoal,
  createTeamTask,
  getTeamTasks,
  updateTeamTask,
} from '../../api/index.js';
import { Badge, Btn, EmployeeSelect, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

const EMPTY_GOAL_FORM = {
  employeeID: '',
  title: '',
  description: '',
  category: 'Performance',
  priority: 'Medium',
  status: 'Not Started',
  progress: 0,
  dueDate: '',
};

const EMPTY_TASK_FORM = {
  employeeID: '',
  title: '',
  description: '',
  priority: 'Medium',
  status: 'To Do',
  progress: 0,
  estimatedHours: 1,
  dueDate: '',
};

const GOAL_STATUS_COLORS = {
  'Not Started': 'gray',
  'In Progress': 'orange',
  Completed: 'green',
  'On Hold': 'red',
};

const TASK_STATUS_COLORS = {
  'To Do': 'gray',
  'In Progress': 'orange',
  Done: 'green',
  Blocked: 'red',
};

const PRIORITY_COLORS = {
  Low: 'gray',
  Medium: 'accent',
  High: 'red',
};

export function TeamGoalsPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goalSubmitting, setGoalSubmitting] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [savingGoalId, setSavingGoalId] = useState(null);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL_FORM);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [goalData, taskData] = await Promise.all([getTeamGoals(), getTeamTasks()]);
      setGoals(Array.isArray(goalData) ? goalData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (error) {
      toast(error.message || 'Failed to load team workspace', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const weekAheadKey = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const stats = useMemo(() => ({
    totalGoals: goals.length,
    openTasks: tasks.filter((task) => task.status !== 'Done').length,
    inProgress: goals.filter((goal) => goal.status === 'In Progress').length + tasks.filter((task) => task.status === 'In Progress').length,
    completed: goals.filter((goal) => goal.status === 'Completed').length + tasks.filter((task) => task.status === 'Done').length,
    overdueItems:
      goals.filter((goal) => goal.status !== 'Completed' && goal.dueDate && goal.dueDate < todayKey).length +
      tasks.filter((task) => task.status !== 'Done' && task.dueDate && task.dueDate < todayKey).length,
    blockedItems:
      goals.filter((goal) => goal.status === 'On Hold').length +
      tasks.filter((task) => task.status === 'Blocked').length,
    highPriority:
      goals.filter((goal) => goal.priority === 'High' && goal.status !== 'Completed').length +
      tasks.filter((task) => task.priority === 'High' && task.status !== 'Done').length,
  }), [goals, tasks, todayKey]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesSearch = (item) => {
    if (!normalizedSearch) return true;
    return [item.title, item.employeeName, item.employeeID, item.team, item.category, item.priority]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  };

  const matchesFocus = (item, kind) => {
    if (focusFilter === 'all') return true;
    const isOverdue = Boolean(item.dueDate) && item.dueDate < todayKey && !['Completed', 'Done'].includes(item.status);
    if (focusFilter === 'overdue') return isOverdue;
    if (focusFilter === 'priority') return item.priority === 'High';
    if (focusFilter === 'blocked') return kind === 'goal' ? item.status === 'On Hold' : item.status === 'Blocked';
    return true;
  };

  const filteredGoals = useMemo(
    () => goals.filter((goal) => matchesSearch(goal) && matchesFocus(goal, 'goal')),
    [goals, normalizedSearch, focusFilter, todayKey],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchesSearch(task) && matchesFocus(task, 'task')),
    [tasks, normalizedSearch, focusFilter, todayKey],
  );

  const leaderFocusItems = useMemo(() => {
    const goalItems = goals
      .filter((goal) => goal.status !== 'Completed')
      .map((goal) => {
        const overdue = Boolean(goal.dueDate) && goal.dueDate < todayKey;
        const isBlocked = goal.status === 'On Hold';
        const score = (overdue ? 4 : 0) + (goal.priority === 'High' ? 2 : 0) + (isBlocked ? 2 : 0) + (goal.status === 'In Progress' ? 1 : 0);
        return {
          id: `goal-${goal.goalID}`,
          kind: 'goal',
          title: goal.title,
          employeeID: goal.employeeID,
          employeeName: goal.employeeName,
          team: goal.team,
          dueDate: goal.dueDate,
          status: goal.status,
          priority: goal.priority,
          overdue,
          score,
          source: goal,
        };
      });

    const taskItems = tasks
      .filter((task) => task.status !== 'Done')
      .map((task) => {
        const overdue = Boolean(task.dueDate) && task.dueDate < todayKey;
        const isBlocked = task.status === 'Blocked';
        const score = (overdue ? 4 : 0) + (task.priority === 'High' ? 2 : 0) + (isBlocked ? 3 : 0) + (task.status === 'In Progress' ? 1 : 0);
        return {
          id: `task-${task.taskID}`,
          kind: 'task',
          title: task.title,
          employeeID: task.employeeID,
          employeeName: task.employeeName,
          team: task.team,
          dueDate: task.dueDate,
          status: task.status,
          priority: task.priority,
          overdue,
          score,
          source: task,
        };
      });

    return [...goalItems, ...taskItems]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [goals, tasks, todayKey]);

  const coachingRows = useMemo(() => {
    const rows = new Map();

    const register = (item, kind) => {
      const isDone = kind === 'goal' ? item.status === 'Completed' : item.status === 'Done';
      if (isDone) return;

      const key = item.employeeID || item.employeeName || `${kind}-${item.title}`;
      const current = rows.get(key) || {
        key,
        employeeID: item.employeeID,
        employeeName: item.employeeName || item.employeeID || '—',
        team: item.team,
        openGoals: 0,
        openTasks: 0,
        overdueItems: 0,
        blockedItems: 0,
        highPriorityItems: 0,
        dueThisWeek: 0,
        totalProgress: 0,
        progressCount: 0,
      };

      if (kind === 'goal') current.openGoals += 1;
      else current.openTasks += 1;

      const dueDate = String(item.dueDate || '');
      const isOverdue = Boolean(dueDate) && dueDate < todayKey;
      const isDueThisWeek = Boolean(dueDate) && dueDate >= todayKey && dueDate <= weekAheadKey;
      const isBlocked = kind === 'goal' ? item.status === 'On Hold' : item.status === 'Blocked';

      if (isOverdue) current.overdueItems += 1;
      if (isDueThisWeek) current.dueThisWeek += 1;
      if (isBlocked) current.blockedItems += 1;
      if (item.priority === 'High') current.highPriorityItems += 1;

      current.totalProgress += Number(item.progress || 0);
      current.progressCount += 1;
      rows.set(key, current);
    };

    goals.forEach((goal) => register(goal, 'goal'));
    tasks.forEach((task) => register(task, 'task'));

    return Array.from(rows.values())
      .map((row) => {
        const averageProgress = row.progressCount ? Math.round(row.totalProgress / row.progressCount) : 0;
        const focusScore = (row.overdueItems * 3) + (row.blockedItems * 3) + (row.highPriorityItems * 2) + (row.dueThisWeek ? 1 : 0);
        return {
          ...row,
          averageProgress,
          focusScore,
          openItems: row.openGoals + row.openTasks,
          nextStep: row.blockedItems > 0
            ? t('Unblock work')
            : row.overdueItems > 0
              ? t('Replan deadlines')
              : row.highPriorityItems > 1
                ? t('Review priorities')
                : t('Coach this week'),
        };
      })
      .sort((a, b) => b.focusScore - a.focusScore || b.openItems - a.openItems)
      .slice(0, 6);
  }, [goals, tasks, todayKey, weekAheadKey, t]);

  const teamCoachingSnapshot = useMemo(() => {
    const uniqueMembers = new Set();
    const progressValues = [];

    goals.forEach((goal) => {
      if (goal.employeeID || goal.employeeName) uniqueMembers.add(goal.employeeID || goal.employeeName);
      if (goal.status !== 'Completed') progressValues.push(Number(goal.progress || 0));
    });

    tasks.forEach((task) => {
      if (task.employeeID || task.employeeName) uniqueMembers.add(task.employeeID || task.employeeName);
      if (task.status !== 'Done') progressValues.push(Number(task.progress || 0));
    });

    const dueThisWeek = goals.filter((goal) => goal.status !== 'Completed' && goal.dueDate && goal.dueDate >= todayKey && goal.dueDate <= weekAheadKey).length
      + tasks.filter((task) => task.status !== 'Done' && task.dueDate && task.dueDate >= todayKey && task.dueDate <= weekAheadKey).length;

    const averageCompletion = progressValues.length
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0;

    return {
      contributors: uniqueMembers.size,
      coachReady: coachingRows.filter((row) => row.focusScore >= 4).length,
      atRiskDelivery: stats.overdueItems + stats.blockedItems,
      dueThisWeek,
      averageCompletion,
    };
  }, [goals, tasks, coachingRows, stats.overdueItems, stats.blockedItems, todayKey, weekAheadKey]);

  const prepareFollowUp = (item) => {
    if (item.kind === 'goal') {
      setGoalForm((prev) => ({
        ...prev,
        employeeID: item.employeeID || prev.employeeID,
        title: prev.title || `${t('Follow-up')}: ${item.title}`.slice(0, 160),
        priority: item.priority || prev.priority,
      }));
      toast(t('Goal form prepared for quick follow-up.'));
      return;
    }

    setTaskForm((prev) => ({
      ...prev,
      employeeID: item.employeeID || prev.employeeID,
      title: prev.title || `${t('Follow-up')}: ${item.title}`.slice(0, 160),
      priority: item.priority || prev.priority,
    }));
    toast(t('Task form prepared for quick follow-up.'));
  };

  const prepareCoachingFollowUp = (row) => {
    const name = row.employeeName || row.employeeID || '—';

    setGoalForm((prev) => ({
      ...prev,
      employeeID: row.employeeID || prev.employeeID,
      title: prev.title || `${t('Follow-up')}: ${name}`.slice(0, 160),
      priority: row.highPriorityItems > 0 ? 'High' : prev.priority,
    }));

    setTaskForm((prev) => ({
      ...prev,
      employeeID: row.employeeID || prev.employeeID,
      title: prev.title || `${t('Follow-up')}: ${name}`.slice(0, 160),
      priority: row.overdueItems > 0 || row.blockedItems > 0 ? 'High' : prev.priority,
    }));

    toast(t('Prepared coaching follow-up for this team member.'));
  };

  const handleCreateGoal = async () => {
    if (!goalForm.employeeID.trim() || !goalForm.title.trim()) {
      toast('Employee ID and goal title are required.', 'error');
      return;
    }

    setGoalSubmitting(true);
    try {
      await createTeamGoal({
        ...goalForm,
        employeeID: goalForm.employeeID.trim(),
        progress: Number(goalForm.progress || 0),
      });
      toast('Goal created for team member');
      setGoalForm(EMPTY_GOAL_FORM);
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to create team goal', 'error');
    } finally {
      setGoalSubmitting(false);
    }
  };

  const handleCompleteGoal = async (goal) => {
    setSavingGoalId(goal.goalID);
    try {
      await updateTeamGoal(goal.goalID, {
        employeeID: goal.employeeID,
        title: goal.title,
        description: goal.description || '',
        category: goal.category,
        priority: goal.priority,
        status: 'Completed',
        progress: 100,
        dueDate: goal.dueDate,
      });
      toast('Goal marked as completed');
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to update goal', 'error');
    } finally {
      setSavingGoalId(null);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.employeeID.trim() || !taskForm.title.trim()) {
      toast('Employee ID and task title are required.', 'error');
      return;
    }

    setTaskSubmitting(true);
    try {
      await createTeamTask({
        ...taskForm,
        employeeID: taskForm.employeeID.trim(),
        progress: Number(taskForm.progress || 0),
        estimatedHours: Number(taskForm.estimatedHours || 0),
      });
      toast('Task assigned to team member');
      setTaskForm(EMPTY_TASK_FORM);
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to assign task', 'error');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleCompleteTask = async (task) => {
    setSavingTaskId(task.taskID);
    try {
      await updateTeamTask(task.taskID, {
        employeeID: task.employeeID,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: 'Done',
        progress: 100,
        estimatedHours: task.estimatedHours,
        dueDate: task.dueDate,
      });
      toast('Task marked as done');
      await loadData();
    } catch (error) {
      toast(error.message || 'Failed to update task', 'error');
    } finally {
      setSavingTaskId(null);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header is-split" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Team Hub')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('Manage team goals and day-to-day work tasks from one place.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={loadData}>{t('Refresh Workspace')}</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Total Goals'), value: stats.totalGoals, accent: '#111827' },
          { label: t('Open Tasks'), value: stats.openTasks, accent: '#E8321A' },
          { label: t('Overdue Items'), value: stats.overdueItems, accent: '#B42318' },
          { label: t('High Priority'), value: stats.highPriority, accent: '#B54708' },
          { label: t('Blocked Items'), value: stats.blockedItems, accent: '#7C2D12' },
          { label: t('Completed'), value: stats.completed, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Team Coaching Snapshot')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Keep delivery healthy, balance workload, and spot coaching needs across the team.')}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: t('Active Contributors'), value: teamCoachingSnapshot.contributors, accent: '#111827' },
            { label: t('Coach-ready employees'), value: teamCoachingSnapshot.coachReady, accent: '#E8321A' },
            { label: t('At-risk delivery'), value: teamCoachingSnapshot.atRiskDelivery, accent: '#B42318' },
            { label: t('Due this week'), value: teamCoachingSnapshot.dueThisWeek, accent: '#B54708' },
            { label: t('Average completion'), value: `${teamCoachingSnapshot.averageCompletion}%`, accent: '#10B981' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '14px 15px', background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.accent }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)', marginBottom: 4 }}>{t('Workload Balance')}</div>
            <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 12 }}>{t('See which team members are overloaded, blocked, or ready for a quick coaching check-in.')}</p>

            {coachingRows.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '18px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No coaching nudges are needed right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {coachingRows.map((row) => (
                  <div key={row.key} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{row.employeeName || row.employeeID || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{row.team || '—'} • {row.openItems} {t('open items')}</div>
                      </div>
                      <Badge label={row.nextStep} color={row.blockedItems > 0 || row.overdueItems > 0 ? 'red' : 'orange'} />
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {row.highPriorityItems ? <Badge label={`${row.highPriorityItems} ${t('High Priority')}`} color="accent" /> : null}
                      {row.overdueItems ? <Badge label={`${row.overdueItems} ${t('Overdue')}`} color="red" /> : null}
                      {row.blockedItems ? <Badge label={`${row.blockedItems} ${t('Blocked')}`} color="red" /> : null}
                      {row.dueThisWeek ? <Badge label={`${row.dueThisWeek} ${t('Due this week')}`} color="orange" /> : null}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--gray-500)' }}>
                        <span>{t('Average completion')}</span>
                        <strong style={{ color: 'var(--gray-700)' }}>{row.averageProgress}%</strong>
                      </div>
                      <div style={{ height: 8, background: '#F2F4F7', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(row.averageProgress, 100))}%`,
                            height: '100%',
                            background: row.averageProgress >= 75 ? '#12B76A' : row.averageProgress >= 45 ? '#F79009' : '#F04438',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)', marginBottom: 4 }}>{t('Coaching Queue')}</div>
            <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 12 }}>{t('Priority employees to check in with this week based on workload and blocker signals.')}</p>

            {coachingRows.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '18px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No coaching nudges are needed right now.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {coachingRows.slice(0, 4).map((row) => (
                  <div key={`queue-${row.key}`} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{row.employeeName || row.employeeID || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{row.team || '—'} • {row.openItems} {t('open items')}</div>
                      </div>
                      <Badge label={row.nextStep} color={row.blockedItems > 0 || row.overdueItems > 0 ? 'red' : 'orange'} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      <Badge label={`${t('Average completion')}: ${row.averageProgress}%`} color="gray" />
                      {row.highPriorityItems ? <Badge label={`${row.highPriorityItems} ${t('High Priority')}`} color="accent" /> : null}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Btn size="sm" variant="ghost" onClick={() => prepareCoachingFollowUp(row)}>{t('Prepare 1:1')}</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Leadership Focus Board')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Spot urgent team work, clear blockers, and prepare follow-up actions faster.')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('Search employee, title, or priority')}
              style={{ minWidth: 240, padding: '10px 12px', borderRadius: 10, border: '1px solid #D0D5DD', outline: 'none' }}
            />
            <select
              value={focusFilter}
              onChange={(e) => setFocusFilter(e.target.value)}
              style={{ minWidth: 160, padding: '10px 12px', borderRadius: 10, border: '1px solid #D0D5DD', outline: 'none' }}
            >
              <option value="all">{t('All Focus')}</option>
              <option value="overdue">{t('Overdue')}</option>
              <option value="priority">{t('High Priority')}</option>
              <option value="blocked">{t('Blocked')}</option>
            </select>
          </div>
        </div>

        {leaderFocusItems.length === 0 ? (
          <div className="hr-soft-empty" style={{ padding: '18px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No urgent team items need attention right now.')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {leaderFocusItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '14px 15px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{item.employeeName || item.employeeID || '—'} • {item.team || '—'}</div>
                  </div>
                  <Badge label={t(item.kind === 'goal' ? 'Goal' : 'Task')} color={item.kind === 'goal' ? 'green' : 'blue'} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <Badge label={t(item.status || (item.kind === 'goal' ? 'Not Started' : 'To Do'))} color={item.kind === 'goal' ? (GOAL_STATUS_COLORS[item.status] || 'gray') : (TASK_STATUS_COLORS[item.status] || 'gray')} />
                  <Badge label={t(item.priority || 'Medium')} color={PRIORITY_COLORS[item.priority] || 'accent'} />
                  {item.dueDate ? <Badge label={`${t('Due')} ${item.dueDate}`} color={item.overdue ? 'red' : 'gray'} /> : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <Btn size="sm" variant="ghost" onClick={() => prepareFollowUp(item)}>{t('Prepare Follow-up')}</Btn>
                  <Btn
                    size="sm"
                    variant="outline"
                    disabled={(item.kind === 'goal' && savingGoalId === item.source.goalID) || (item.kind === 'task' && savingTaskId === item.source.taskID)}
                    onClick={() => item.kind === 'goal' ? handleCompleteGoal(item.source) : handleCompleteTask(item.source)}
                  >
                    {item.kind === 'goal'
                      ? savingGoalId === item.source.goalID ? t('Saving...') : t('Mark Complete')
                      : savingTaskId === item.source.taskID ? t('Saving...') : t('Mark Done')}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Assign New Goal')}</h3>
          <EmployeeSelect label={t('Employee')} value={goalForm.employeeID} onChange={(value) => setGoalForm((prev) => ({ ...prev, employeeID: value }))} placeholder={t('Select an employee')} />
          <Input label={t('Goal Title')} value={goalForm.title} onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Improve dashboard performance')} />
          <Textarea label={t('Description')} value={goalForm.description} onChange={(e) => setGoalForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('Add details or milestones')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
              <select value={goalForm.category} onChange={(e) => setGoalForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Performance', 'Development', 'Leadership', 'Attendance'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Priority')}</label>
              <select value={goalForm.priority} onChange={(e) => setGoalForm((prev) => ({ ...prev, priority: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Low', 'Medium', 'High'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
          </div>

          <Input label={t('Due Date')} type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm((prev) => ({ ...prev, dueDate: e.target.value }))} />

          <Btn onClick={handleCreateGoal} disabled={goalSubmitting} style={{ width: '100%' }}>
            {goalSubmitting ? t('Saving...') : t('Assign Goal')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Team Goal Tracker')}</h3>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{filteredGoals.length} {t('shown')}</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : goals.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No team goals created yet.')}</div>
          ) : filteredGoals.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No goals match the current leadership filter.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Goal', 'Due', 'Status', 'Progress', 'Action'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGoals.map((goal) => (
                    <tr key={goal.goalID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{goal.employeeName || goal.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{goal.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{goal.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(goal.category)} • {t(goal.priority)}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge label={t(goal.priority || 'Medium')} color={PRIORITY_COLORS[goal.priority] || 'accent'} />
                          {goal.dueDate && goal.dueDate < todayKey && goal.status !== 'Completed' ? <Badge label={t('Overdue')} color="red" /> : null}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{goal.dueDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(goal.status)} color={GOAL_STATUS_COLORS[goal.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{goal.progress}%</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        {goal.status !== 'Completed' ? (
                          <Btn size="sm" onClick={() => handleCompleteGoal(goal)} disabled={savingGoalId === goal.goalID}>
                            {savingGoalId === goal.goalID ? t('Saving...') : t('Mark Complete')}
                          </Btn>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('Done')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Assign New Task')}</h3>
          <EmployeeSelect label={t('Employee')} value={taskForm.employeeID} onChange={(value) => setTaskForm((prev) => ({ ...prev, employeeID: value }))} placeholder={t('Select an employee')} />
          <Input label={t('Task Title')} value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Prepare release checklist')} />
          <Textarea label={t('Description')} value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('Describe the work item and deliverables')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Priority')}</label>
              <select value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                {['Low', 'Medium', 'High'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Est. Hours')}</label>
              <input type="number" min="0" value={taskForm.estimatedHours} onChange={(e) => setTaskForm((prev) => ({ ...prev, estimatedHours: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }} />
            </div>
          </div>

          <Input label={t('Due Date')} type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))} />

          <Btn onClick={handleCreateTask} disabled={taskSubmitting} style={{ width: '100%' }}>
            {taskSubmitting ? t('Saving...') : t('Assign Task')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Team Task Tracker')}</h3>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{filteredTasks.length} {t('shown')}</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No tasks assigned yet')}</div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No tasks match the current leadership filter.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Task', 'Due', 'Status', 'Progress', 'Action'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.taskID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{task.employeeName || task.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{task.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{task.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t(task.priority)} • {task.estimatedHours ?? '—'} {t('hrs')}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge label={t(task.priority || 'Medium')} color={PRIORITY_COLORS[task.priority] || 'accent'} />
                          {task.dueDate && task.dueDate < todayKey && task.status !== 'Done' ? <Badge label={t('Overdue')} color="red" /> : null}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{task.dueDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(task.status)} color={TASK_STATUS_COLORS[task.status] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700 }}>{task.progress}%</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        {task.status !== 'Done' ? (
                          <Btn size="sm" onClick={() => handleCompleteTask(task)} disabled={savingTaskId === task.taskID}>
                            {savingTaskId === task.taskID ? t('Saving...') : t('Mark Done')}
                          </Btn>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{t('Done')}</span>
                        )}
                      </td>
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
