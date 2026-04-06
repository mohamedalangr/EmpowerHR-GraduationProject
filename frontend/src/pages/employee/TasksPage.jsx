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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
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
