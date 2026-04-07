import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMyAttendance,
  getMyDocuments,
  getMyGoals,
  getMyLeaveRequests,
  getMyTasks,
  getMyTickets,
  getMyTraining,
} from '../../api/index.js';
import { Badge, Btn, Spinner, useToast } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

function parseDate(value) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(value) {
  const parsed = parseDate(value);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

function toneForStatus(status) {
  if (['Done', 'Completed', 'Issued', 'Resolved', 'Approved'].includes(status)) return 'green';
  if (['Pending', 'In Progress', 'Submitted', 'Open', 'Planned'].includes(status)) return 'orange';
  if (['Rejected', 'Blocked', 'Declined'].includes(status)) return 'red';
  return 'accent';
}

export function EmployeeDashboardPage() {
  const { user, resolvePath } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const employeeID = user?.employee_id;

  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [training, setTraining] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!employeeID) return;

    const loadWorkspace = async () => {
      setLoading(true);
      try {
        const [attendanceData, leaveData, taskData, goalData, trainingData, documentData, ticketData] = await Promise.all([
          getMyAttendance(employeeID).catch(() => []),
          getMyLeaveRequests(employeeID).catch(() => []),
          getMyTasks(employeeID).catch(() => []),
          getMyGoals(employeeID).catch(() => []),
          getMyTraining(employeeID).catch(() => []),
          getMyDocuments(employeeID).catch(() => []),
          getMyTickets(employeeID).catch(() => []),
        ]);

        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
        setTasks(Array.isArray(taskData) ? taskData : []);
        setGoals(Array.isArray(goalData) ? goalData : []);
        setTraining(Array.isArray(trainingData) ? trainingData : []);
        setDocuments(Array.isArray(documentData) ? documentData : []);
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      } catch (error) {
        toast(error.message || 'Failed to load your workspace.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [employeeID, toast]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.find((item) => item.date === todayKey);
  const openTasks = tasks.filter((item) => !['Done', 'Completed'].includes(item?.status));
  const activeGoals = goals.filter((item) => item?.status !== 'Completed');
  const openTickets = tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status));
  const pendingDocuments = documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status));
  const pendingLeaves = leaveRequests.filter((item) => item?.status === 'Pending');

  const focusItems = useMemo(() => {
    const items = [
      ...openTasks.map((task) => ({
        id: `task-${task.taskID}`,
        title: task.title,
        subtitle: `${t('nav.tasks')} • ${t(task.status || 'To Do')}`,
        dueLabel: task.dueDate,
        tone: toneForStatus(task.status),
        priority: task.priority === 'High' ? 0 : 1,
        days: daysUntil(task.dueDate),
        path: resolvePath('/employee/tasks'),
      })),
      ...activeGoals.map((goal) => ({
        id: `goal-${goal.goalID}`,
        title: goal.title,
        subtitle: `${t('nav.goals')} • ${t(goal.status || 'In Progress')}`,
        dueLabel: goal.dueDate,
        tone: toneForStatus(goal.status),
        priority: goal.priority === 'High' ? 0 : 1,
        days: daysUntil(goal.dueDate),
        path: resolvePath('/employee/goals'),
      })),
      ...openTickets.map((ticket) => ({
        id: `ticket-${ticket.ticketID}`,
        title: ticket.subject,
        subtitle: `${t('nav.supportTickets')} • ${t(ticket.status || 'Open')}`,
        dueLabel: ticket.updatedAt || ticket.createdAt,
        tone: toneForStatus(ticket.status),
        priority: ticket.priority === 'Critical' || ticket.priority === 'High' ? 0 : 2,
        days: daysUntil(ticket.updatedAt || ticket.createdAt),
        path: resolvePath('/employee/tickets'),
      })),
      ...pendingDocuments.map((document) => ({
        id: `document-${document.requestID}`,
        title: t(document.documentType || 'Document Type'),
        subtitle: `${t('nav.documents')} • ${t(document.status || 'Pending')}`,
        dueLabel: document.updatedAt || document.createdAt,
        tone: toneForStatus(document.status),
        priority: 2,
        days: daysUntil(document.updatedAt || document.createdAt),
        path: resolvePath('/employee/documents'),
      })),
    ];

    return items
      .sort((a, b) => (a.priority - b.priority) || (a.days - b.days))
      .slice(0, 6);
  }, [activeGoals, openTasks, openTickets, pendingDocuments, resolvePath, t]);

  const workspaceCards = [
    {
      title: t('Attendance & Leave'),
      description: t('Personal attendance, leave, payroll, and requests.'),
      count: attendance.length + pendingLeaves.length,
      accent: '#E8321A',
      path: resolvePath('/employee/attendance'),
    },
    {
      title: t('Growth & Execution'),
      description: t('Your active goals, tasks, and learning plan.'),
      count: openTasks.length + activeGoals.length + training.length,
      accent: '#7C3AED',
      path: resolvePath('/employee/goals'),
    },
    {
      title: t('Support & Requests'),
      description: t('Support, documents, and service requests that still need updates.'),
      count: openTickets.length + pendingDocuments.length,
      accent: '#0EA5E9',
      path: resolvePath('/employee/tickets'),
    },
  ];

  const workspaceRhythmCards = useMemo(() => ([
    {
      label: t('Today Status'),
      value: t(todayAttendance?.status || 'Not started'),
      note: t('Keep attendance and leave visibility in one glance.'),
      accent: '#E8321A',
    },
    {
      label: t('Tasks & Goals'),
      value: openTasks.length + activeGoals.length,
      note: t('Your execution and growth items currently in motion.'),
      accent: '#7C3AED',
    },
    {
      label: t('Service Follow-Up'),
      value: pendingDocuments.length + openTickets.length + pendingLeaves.length,
      note: t('Requests waiting on updates across support, documents, and leave.'),
      accent: '#0F766E',
    },
  ]), [activeGoals.length, openTasks.length, openTickets.length, pendingDocuments.length, pendingLeaves.length, t, todayAttendance?.status]);

  return (
    <div className="hr-page-shell">
      <div className="hr-page-header is-split">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('My Workspace')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
            {t('Stay on top of your workday, growth, and open service requests from one place.')}
          </p>
        </div>
        <Btn variant="ghost" onClick={() => navigate(resolvePath('/employee/profile'))}>{t('nav.profile')}</Btn>
      </div>

      <div className="hr-surface-card workspace-shell-card workspace-shell-employee" style={{ padding: 18, marginBottom: 24 }}>
        <div className="workspace-shell-topline">{t('My Workspace')}</div>
        <div className="workspace-shell-header">
          <div className="workspace-shell-copy">
            <div className="workspace-shell-title">{t('Self-Service Snapshot')}</div>
            <div className="workspace-shell-subtitle">{t('Stay on top of your workday, growth, and open service requests from one place.')}</div>
            <div className="workspace-shell-meta">
              <span>{t('Open Tasks')}: {openTasks.length}</span>
              <span>{t('Active Goals')}: {activeGoals.length}</span>
              <span>{t('Open Requests')}: {pendingDocuments.length + openTickets.length + pendingLeaves.length}</span>
            </div>
          </div>
          <div className="workspace-shell-actions">
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/profile'))}>{t('nav.profile')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/goals'))}>{t('nav.goals')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/tickets'))}>{t('nav.supportTickets')}</Btn>
          </div>
        </div>
        <div className="workspace-shell-focus">
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t("Today's Priority")}</div>
            <div className="workspace-focus-note">{t('Stay ahead of your requests, goals, and workday follow-up from one clean workspace.')}</div>
          </div>
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Self-Service Checklist')}</div>
            <div className="workspace-chip-list">
              {[t('Check attendance'), t('Review tasks'), t('Open support requests')].map((item) => (
                <span key={item} className="workspace-chip">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="workspace-journey-strip" style={{ marginBottom: 24 }}>
        {workspaceRhythmCards.map((card) => (
          <div key={card.label} className="workspace-journey-card">
            <div className="workspace-journey-title">{card.label}</div>
            <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="workspace-journey-note">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="hr-stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: t('Today'), value: t(todayAttendance?.status || 'Not started'), accent: '#E8321A' },
          { label: t('Open Tasks'), value: openTasks.length, accent: '#7C3AED' },
          { label: t('Active Goals'), value: activeGoals.length, accent: '#2563EB' },
          { label: t('Open Requests'), value: pendingDocuments.length + openTickets.length + pendingLeaves.length, accent: '#0F766E' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.1fr .9fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 12 }}>{t('Quick Actions')}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {workspaceCards.map((card) => (
              <div key={card.title} className="workspace-action-card">
                <div className="workspace-action-card-head">
                  <div>
                    <div className="workspace-action-eyebrow">{t('Quick route')}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{card.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{card.description}</div>
                  </div>
                  <div className="workspace-action-value" style={{ color: card.accent }}>{card.count}</div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn size="sm" variant="outline" onClick={() => navigate(card.path)}>{t('Go to workspace')}</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t("Today's Focus")}</div>
            <Badge label={`${focusItems.length} ${t('Items')}`} color={focusItems.length ? 'orange' : 'green'} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : focusItems.length === 0 ? (
            <div className="hr-soft-empty" style={{ padding: '22px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No urgent personal follow-up items are flagged right now.')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {focusItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{ textAlign: 'left', border: '1px solid #EEF2F7', borderRadius: 14, padding: '12px 14px', background: '#fff', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>{item.subtitle}</div>
                    </div>
                    <Badge label={t('Open')} color={item.tone} />
                  </div>
                  {item.dueLabel && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--gray-500)' }}>
                      {t('Due')}: {String(item.dueLabel).slice(0, 10)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hr-panel-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Self-Service Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Leave')}</span><strong>{pendingLeaves.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Documents')}</span><strong>{pendingDocuments.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Tickets')}</span><strong>{openTickets.length}</strong></div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Growth Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Active Goals')}</span><strong>{activeGoals.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Tasks')}</span><strong>{openTasks.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Assigned Training')}</span><strong>{training.length}</strong></div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Workday Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Attendance Entries')}</span><strong>{attendance.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Today')}</span><strong>{t(todayAttendance?.status || 'Not started')}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('My Leave Requests')}</span><strong>{leaveRequests.length}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
