import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMyAttendance,
  getMyCareerPath,
  getMyDocuments,
  getMyGoals,
  getMyLeaveRequests,
  getMyPolicies,
  getMyRecognition,
  getMyReviews,
  getMyShifts,
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
  const [careerPlans, setCareerPlans] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recognition, setRecognition] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    if (!employeeID) return;

    const loadWorkspace = async () => {
      setLoading(true);
      try {
        const [
          attendanceData,
          leaveData,
          taskData,
          goalData,
          trainingData,
          careerPathData,
          reviewData,
          recognitionData,
          documentData,
          ticketData,
          shiftData,
          policyData,
        ] = await Promise.all([
          getMyAttendance(employeeID).catch(() => []),
          getMyLeaveRequests(employeeID).catch(() => []),
          getMyTasks(employeeID).catch(() => []),
          getMyGoals(employeeID).catch(() => []),
          getMyTraining(employeeID).catch(() => []),
          getMyCareerPath(employeeID).catch(() => []),
          getMyReviews(employeeID).catch(() => []),
          getMyRecognition(employeeID).catch(() => []),
          getMyDocuments(employeeID).catch(() => []),
          getMyTickets(employeeID).catch(() => []),
          getMyShifts(employeeID).catch(() => []),
          getMyPolicies({ employee_id: employeeID }).catch(() => []),
        ]);

        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
        setTasks(Array.isArray(taskData) ? taskData : []);
        setGoals(Array.isArray(goalData) ? goalData : []);
        setTraining(Array.isArray(trainingData) ? trainingData : []);
        setCareerPlans(Array.isArray(careerPathData) ? careerPathData : []);
        setReviews(Array.isArray(reviewData) ? reviewData : []);
        setRecognition(Array.isArray(recognitionData) ? recognitionData : []);
        setDocuments(Array.isArray(documentData) ? documentData : []);
        setTickets(Array.isArray(ticketData) ? ticketData : []);
        setShifts(Array.isArray(shiftData) ? shiftData : []);
        setPolicies(Array.isArray(policyData) ? policyData : []);
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
  const activeTraining = training.filter((item) => {
    const statuses = Object.values(item?.completionData || {});
    return !statuses.length || statuses.some((entry) => entry?.status !== 'Completed');
  });
  const completedTraining = Math.max(training.length - activeTraining.length, 0);
  const openTickets = tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status));
  const pendingDocuments = documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status));
  const pendingLeaves = leaveRequests.filter((item) => item?.status === 'Pending');
  const upcomingShifts = shifts.filter((item) => !['Completed'].includes(item?.status) && daysUntil(item?.shiftDate) <= 7);
  const publishedPolicies = policies.filter((item) => item?.status === 'Published');
  const pendingReviewAcks = reviews.filter((item) => item?.status !== 'Acknowledged');
  const readySoonPlans = careerPlans.filter((item) => ['Ready Now', '6-12 Months'].includes(item?.readiness)).length;
  const recognitionPoints = recognition.reduce((sum, item) => sum + Number(item?.points || 0), 0);
  const recentAwards = recognition.slice(0, 3);
  const latestReview = [...reviews].sort((a, b) => (parseDate(b?.reviewDate)?.getTime() || 0) - (parseDate(a?.reviewDate)?.getTime() || 0))[0] || null;
  const primaryCareerPlan = [...careerPlans].sort((a, b) => {
    const readinessRank = (value) => {
      if (value === 'Ready Now') return 0;
      if (value === '6-12 Months') return 1;
      if (value === '12+ Months') return 2;
      return 3;
    };
    return readinessRank(a?.readiness) - readinessRank(b?.readiness);
  })[0] || null;

  const focusItems = useMemo(() => {
    const items = [
      ...openTasks.map((task) => ({
        id: `task-${task.taskID}`,
        title: task.title,
        subtitle: `${t('nav.tasks')} • ${t(task.status || 'To Do')}`,
        dueLabel: task.dueDate,
        badge: task.priority === 'High' ? t('High') : t(task.status || 'To Do'),
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
        badge: goal.priority === 'High' ? t('High') : t(goal.status || 'In Progress'),
        tone: toneForStatus(goal.status),
        priority: goal.priority === 'High' ? 0 : 1,
        days: daysUntil(goal.dueDate),
        path: resolvePath('/employee/goals'),
      })),
      ...activeTraining.map((course) => ({
        id: `training-${course.courseID}`,
        title: course.title || t('Training course'),
        subtitle: `${t('Training')} • ${t(course.category || 'Technical')}`,
        dueLabel: course.dueDate,
        badge: t(course.category === 'Compliance' || daysUntil(course.dueDate) <= 5 ? 'Due Soon' : 'In Progress'),
        tone: course.category === 'Compliance' || daysUntil(course.dueDate) <= 5 ? 'orange' : 'accent',
        priority: course.category === 'Compliance' || daysUntil(course.dueDate) <= 5 ? 1 : 2,
        days: daysUntil(course.dueDate),
        path: resolvePath('/employee/training'),
      })),
      ...openTickets.map((ticket) => ({
        id: `ticket-${ticket.ticketID}`,
        title: ticket.subject,
        subtitle: `${t('nav.supportTickets')} • ${t(ticket.status || 'Open')}`,
        dueLabel: ticket.updatedAt || ticket.createdAt,
        badge: t(ticket.priority || ticket.status || 'Open'),
        tone: toneForStatus(ticket.status),
        priority: ticket.priority === 'Critical' || ticket.priority === 'High' ? 0 : 2,
        days: daysUntil(ticket.updatedAt || ticket.createdAt),
        path: resolvePath('/employee/tickets'),
      })),
      ...publishedPolicies.map((policy) => ({
        id: `policy-${policy.policyID}`,
        title: policy.title,
        subtitle: `${t('nav.policies')} • ${t(policy.category || 'Policy')}`,
        dueLabel: policy.effectiveDate,
        badge: t('Published'),
        tone: daysUntil(policy.effectiveDate) <= 3 ? 'orange' : 'accent',
        priority: daysUntil(policy.effectiveDate) <= 3 ? 0 : 2,
        days: daysUntil(policy.effectiveDate),
        path: resolvePath('/employee/policies'),
      })),
      ...upcomingShifts.map((shift) => ({
        id: `shift-${shift.scheduleID}`,
        title: `${t(shift.shiftType || 'Shift')} • ${String(shift.shiftDate || '').slice(0, 10)}`,
        subtitle: `${t('nav.shifts')} • ${t(shift.status || 'Planned')}`,
        dueLabel: shift.shiftDate,
        badge: t(shift.status || 'Planned'),
        tone: shift.status === 'Swapped' ? 'orange' : toneForStatus(shift.status),
        priority: shift.status === 'Swapped' || daysUntil(shift.shiftDate) <= 1 ? 0 : 2,
        days: daysUntil(shift.shiftDate),
        path: resolvePath('/employee/shifts'),
      })),
      ...pendingDocuments.map((document) => ({
        id: `document-${document.requestID}`,
        title: t(document.documentType || 'Document Type'),
        subtitle: `${t('nav.documents')} • ${t(document.status || 'Pending')}`,
        dueLabel: document.updatedAt || document.createdAt,
        badge: t(document.status || 'Pending'),
        tone: toneForStatus(document.status),
        priority: 2,
        days: daysUntil(document.updatedAt || document.createdAt),
        path: resolvePath('/employee/documents'),
      })),
    ];

    return items
      .sort((a, b) => (a.priority - b.priority) || (a.days - b.days))
      .slice(0, 7);
  }, [activeGoals, activeTraining, openTasks, openTickets, pendingDocuments, publishedPolicies, resolvePath, t, upcomingShifts]);

  const workspaceCards = [
    {
      title: t('Attendance, Leave & Payroll'),
      description: t('Personal attendance, leave, payroll, and requests.'),
      count: attendance.length + pendingLeaves.length + upcomingShifts.length,
      accent: '#E8321A',
      path: resolvePath('/employee/attendance'),
    },
    {
      title: t('Growth Hub'),
      description: t('Your goals, reviews, learning, and career path in one place.'),
      count: openTasks.length + activeGoals.length + activeTraining.length + pendingReviewAcks.length + careerPlans.length,
      accent: '#7C3AED',
      path: resolvePath('/employee/career-path'),
    },
    {
      title: t('Support & Requests'),
      description: t('Support, documents, and service requests that still need updates.'),
      count: openTickets.length + pendingDocuments.length,
      accent: '#0EA5E9',
      path: resolvePath('/employee/tickets'),
    },
    {
      title: t('Shifts & Policies'),
      description: t('Upcoming schedules and policy acknowledgements that may need a response.'),
      count: upcomingShifts.length + publishedPolicies.length,
      accent: '#0F766E',
      path: resolvePath('/employee/policies'),
    },
  ];

  const growthFocusItems = useMemo(() => {
    const items = [];

    if (primaryCareerPlan) {
      items.push({
        id: `career-${primaryCareerPlan.planID}`,
        title: primaryCareerPlan.targetRole || t('Career path plan'),
        subtitle: `${t('Career Path')} • ${t(primaryCareerPlan.readiness || 'Active')}`,
        note: primaryCareerPlan.developmentActions || primaryCareerPlan.notes || t('Review the next development steps shared by HR.'),
        path: resolvePath('/employee/career-path'),
        tone: toneForStatus(primaryCareerPlan.status),
      });
    }

    if (latestReview) {
      items.push({
        id: `review-${latestReview.reviewID}`,
        title: latestReview.reviewPeriod || t('Performance review'),
        subtitle: `${t('Reviews')} • ${t(latestReview.status || 'Submitted')}`,
        note: latestReview.improvementAreas || latestReview.goalsSummary || latestReview.strengths || t('Review your latest feedback and action points.'),
        path: resolvePath('/employee/reviews'),
        tone: toneForStatus(latestReview.status),
      });
    }

    if (activeTraining[0]) {
      items.push({
        id: `training-${activeTraining[0].courseID}`,
        title: activeTraining[0].title || t('Training course'),
        subtitle: `${t('Training')} • ${t(activeTraining[0].category || 'Technical')}`,
        note: activeTraining[0].description || t('Keep this course moving so your learning plan stays on track.'),
        path: resolvePath('/employee/training'),
        tone: 'orange',
      });
    }

    if (recentAwards[0]) {
      items.push({
        id: `recognition-${recentAwards[0].awardID}`,
        title: recentAwards[0].title || t('Recent recognition'),
        subtitle: `${t('Recognition')} • ${recentAwards[0].points || 0} ${t('pts')}`,
        note: recentAwards[0].message || t('A recent appreciation note is available in your recognition workspace.'),
        path: resolvePath('/employee/recognition'),
        tone: 'green',
      });
    }

    return items.slice(0, 4);
  }, [activeTraining, latestReview, primaryCareerPlan, recentAwards, resolvePath, t]);

  const growthHubCards = useMemo(() => ([
    {
      label: t('Career Readiness'),
      value: readySoonPlans,
      sub: primaryCareerPlan ? `${primaryCareerPlan.targetRole || t('Career path')} • ${t(primaryCareerPlan.readiness || 'Active')}` : t('No career plan shared yet.'),
      accent: '#7C3AED',
    },
    {
      label: t('Learning Progress'),
      value: `${completedTraining}/${training.length}`,
      sub: activeTraining.length ? `${activeTraining.length} ${t('courses still in progress')}` : t('Your current assigned learning is on track.'),
      accent: '#2563EB',
    },
    {
      label: t('Review Follow-Up'),
      value: pendingReviewAcks.length,
      sub: latestReview ? `${latestReview.reviewPeriod || t('Latest review')} • ${t(latestReview.status || 'Submitted')}` : t('No review is waiting right now.'),
      accent: '#E8321A',
    },
    {
      label: t('Recognition Points'),
      value: recognitionPoints,
      sub: recentAwards.length ? `${recentAwards.length} ${t('recent awards or notes')}` : t('Recognition will appear here as your wins are celebrated.'),
      accent: '#0F766E',
    },
  ]), [activeTraining.length, completedTraining, latestReview, pendingReviewAcks.length, primaryCareerPlan, readySoonPlans, recentAwards.length, recognitionPoints, t, training.length]);

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
      label: t('Growth Readiness'),
      value: readySoonPlans + activeTraining.length + pendingReviewAcks.length,
      note: t('Learning, reviews, and next-role planning gathered in one view.'),
      accent: '#2563EB',
    },
    {
      label: t('Service Follow-Up'),
      value: pendingDocuments.length + openTickets.length + pendingLeaves.length + publishedPolicies.length + upcomingShifts.length,
      note: t('Requests, acknowledgements, and scheduled coverage that may still need your response.'),
      accent: '#0F766E',
    },
  ]), [activeGoals.length, activeTraining.length, openTasks.length, openTickets.length, pendingDocuments.length, pendingLeaves.length, pendingReviewAcks.length, publishedPolicies.length, readySoonPlans, t, todayAttendance?.status, upcomingShifts.length]);

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
              <span>{t('Learning In Motion')}: {activeTraining.length}</span>
              <span>{t('Open Requests')}: {pendingDocuments.length + openTickets.length + pendingLeaves.length + publishedPolicies.length + upcomingShifts.length}</span>
            </div>
          </div>
          <div className="workspace-shell-actions">
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/profile'))}>{t('nav.profile')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/career-path'))}>{t('nav.careerPath')}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/training'))}>{t('nav.training')}</Btn>
          </div>
        </div>
        <div className="workspace-shell-focus">
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t("Today's Priority")}</div>
            <div className="workspace-focus-note">{t('Stay ahead of your requests, goals, and workday follow-up from one clean workspace.')}</div>
          </div>
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Growth Checklist')}</div>
            <div className="workspace-chip-list">
              {[t('Review career path'), t('Check latest feedback'), t('Continue learning')].map((item) => (
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

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Growth & Service Signals')}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Pull together the next actions across your daily work, learning, and service requests.')}</div>
          </div>
          <Badge label={`${focusItems.length} ${t('Items')}`} color={focusItems.length ? 'orange' : 'green'} />
        </div>
        <div className="workspace-summary-grid">
          {[
            {
              label: t('Today Status'),
              value: t(todayAttendance?.status || 'Not started'),
              note: t('Attendance and leave visibility for the current day.'),
              accent: '#E8321A',
            },
            {
              label: t('Open Requests'),
              value: pendingDocuments.length + openTickets.length + pendingLeaves.length,
              note: t('Support, document, and leave items still waiting on an update.'),
              accent: '#0EA5E9',
            },
            {
              label: t('Published Policies'),
              value: publishedPolicies.length,
              note: publishedPolicies.length
                ? t('Review the newest published updates so nothing slips past your acknowledgement queue.')
                : t('No new policy acknowledgement is waiting right now.'),
              accent: '#7C3AED',
            },
            {
              label: t('Upcoming Shifts'),
              value: upcomingShifts.length,
              note: upcomingShifts.length
                ? t('Confirm near-term coverage and any schedule swaps early.')
                : t('No shift changes are pressing right now.'),
              accent: '#0F766E',
            },
          ].map((card) => (
            <div key={card.label} className="workspace-summary-card">
              <div className="workspace-focus-label">{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: card.accent }}>{card.value}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 6, lineHeight: 1.55 }}>{card.note}</div>
            </div>
          ))}
        </div>
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
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Personal Action Summary')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 4 }}>{t('One queue for your next goals, learning, policy, shift, and support follow-up.')}</div>
            </div>
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
                    <Badge label={item.badge || t('Open')} color={item.tone} />
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

      <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.05fr .95fr', marginBottom: 24 }}>
        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Growth Hub')}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('See your career path, feedback, learning plan, and recognition momentum in one clear overview.')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/career-path'))}>{t('nav.careerPath')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/reviews'))}>{t('nav.reviews')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/training'))}>{t('nav.training')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/recognition'))}>{t('nav.recognition')}</Btn>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {growthHubCards.map((card) => (
              <div key={card.label} className="workspace-focus-card" style={{ background: '#fff' }}>
                <div className="workspace-focus-label">{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, lineHeight: 1.5 }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{t('Next Development Actions')}</div>
            <Badge label={`${growthFocusItems.length} ${t('Items')}`} color={growthFocusItems.length ? 'accent' : 'green'} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : growthFocusItems.length === 0 ? (
            <div className="hr-soft-empty" style={{ padding: '22px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No growth follow-up items are flagged right now.')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {growthFocusItems.map((item) => (
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
                    <Badge label={t('Review')} color={item.tone} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>{item.note}</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Tickets')}</span><strong>{openTickets.length}</strong></div>            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Published Policies')}</span><strong>{publishedPolicies.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Upcoming Shifts')}</span><strong>{upcomingShifts.length}</strong></div>          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Growth Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Active Goals')}</span><strong>{activeGoals.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Open Tasks')}</span><strong>{openTasks.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Training In Progress')}</span><strong>{activeTraining.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Career Plans')}</span><strong>{careerPlans.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Pending Acknowledgment')}</span><strong>{pendingReviewAcks.length}</strong></div>
          </div>
        </div>

        <div className="hr-surface-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 10 }}>{t('Workday Snapshot')}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Attendance Entries')}</span><strong>{attendance.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Today')}</span><strong>{t(todayAttendance?.status || 'Not started')}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('My Leave Requests')}</span><strong>{leaveRequests.length}</strong></div>            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Upcoming Shifts')}</span><strong>{upcomingShifts.length}</strong></div>          </div>
        </div>
      </div>
    </div>
  );
}
