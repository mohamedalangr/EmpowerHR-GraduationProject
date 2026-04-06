import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getCandidateApplications,
  getForms,
  getJobs,
  getMyDocuments,
  getMyGoals,
  getMyOnboarding,
  getMyShifts,
  getMyTasks,
  getMyTickets,
  getMyTraining,
  getTeamGoals,
  getTeamTasks,
  hrGetDocuments,
  hrGetEmployees,
  hrGetExpenses,
  hrGetForms,
  hrGetLeaveRequests,
  hrGetPolicyCompliance,
  hrGetSubmissions,
  hrGetTickets,
} from '../../api/index.js';
import { Btn, Spinner } from './index.jsx';

const NAV_GROUPS = {
  TeamMember: [
    { titleKey: 'nav.overview', items: [{ path: '/employee/dashboard', labelKey: 'nav.dashboard' }] },
    {
      titleKey: 'nav.workday',
      items: [
        { path: '/employee/attendance', labelKey: 'nav.attendance' },
        { path: '/employee/shifts', labelKey: 'nav.shifts' },
        { path: '/employee/payroll', labelKey: 'nav.payroll' },
      ],
    },
    {
      titleKey: 'nav.growth',
      items: [
        { path: '/employee/goals', labelKey: 'nav.goals' },
        { path: '/employee/tasks', labelKey: 'nav.tasks' },
        { path: '/employee/training', labelKey: 'nav.training' },
        { path: '/employee/reviews', labelKey: 'nav.reviews' },
        { path: '/employee/career-path', labelKey: 'nav.careerPath' },
      ],
    },
    {
      titleKey: 'nav.requests',
      items: [
        { path: '/employee/benefits', labelKey: 'nav.benefits' },
        { path: '/employee/expenses', labelKey: 'nav.expenses' },
        { path: '/employee/documents', labelKey: 'nav.documents' },
        { path: '/employee/tickets', labelKey: 'nav.supportTickets' },
        { path: '/employee/policies', labelKey: 'nav.policies' },
        { path: '/employee/feedback', labelKey: 'nav.feedback' },
      ],
    },
    { titleKey: 'nav.account', items: [{ path: '/employee/profile', labelKey: 'nav.profile' }] },
  ],
  TeamLeader: [
    {
      titleKey: 'nav.overview',
      items: [
        { path: '/employee/dashboard', labelKey: 'nav.dashboard' },
        { path: '/leader/team', labelKey: 'nav.teamHub' },
      ],
    },
    {
      titleKey: 'nav.workday',
      items: [
        { path: '/employee/attendance', labelKey: 'nav.attendance' },
        { path: '/employee/shifts', labelKey: 'nav.shifts' },
        { path: '/employee/payroll', labelKey: 'nav.payroll' },
      ],
    },
    {
      titleKey: 'nav.growth',
      items: [
        { path: '/employee/goals', labelKey: 'nav.goals' },
        { path: '/employee/tasks', labelKey: 'nav.tasks' },
        { path: '/employee/training', labelKey: 'nav.training' },
        { path: '/employee/reviews', labelKey: 'nav.reviews' },
        { path: '/employee/career-path', labelKey: 'nav.careerPath' },
        { path: '/employee/recognition', labelKey: 'nav.recognition' },
      ],
    },
    {
      titleKey: 'nav.requests',
      items: [
        { path: '/employee/benefits', labelKey: 'nav.benefits' },
        { path: '/employee/expenses', labelKey: 'nav.expenses' },
        { path: '/employee/documents', labelKey: 'nav.documents' },
        { path: '/employee/tickets', labelKey: 'nav.supportTickets' },
        { path: '/employee/policies', labelKey: 'nav.policies' },
        { path: '/employee/feedback', labelKey: 'nav.feedback' },
      ],
    },
    { titleKey: 'nav.account', items: [{ path: '/employee/profile', labelKey: 'nav.profile' }] },
  ],
  HRManager: [
    { titleKey: 'nav.overview', items: [{ path: '/hr/dashboard', labelKey: 'nav.dashboard' }] },
    {
      titleKey: 'nav.operations',
      items: [
        { path: '/hr/approvals', labelKey: 'nav.approvals' },
        { path: '/hr/employees', labelKey: 'nav.employees' },
        { path: '/hr/attendance', labelKey: 'nav.attendance' },
        { path: '/hr/shifts', labelKey: 'nav.shifts' },
        { path: '/hr/payroll', labelKey: 'nav.payroll' },
        { path: '/hr/onboarding', labelKey: 'nav.onboarding' },
      ],
    },
    {
      titleKey: 'nav.peopleServices',
      items: [
        { path: '/hr/benefits', labelKey: 'nav.benefits' },
        { path: '/hr/expenses', labelKey: 'nav.expenses' },
        { path: '/hr/documents', labelKey: 'nav.documents' },
        { path: '/hr/tickets', labelKey: 'nav.supportTickets' },
        { path: '/hr/policies', labelKey: 'nav.policies' },
      ],
    },
    {
      titleKey: 'nav.talentPerformance',
      items: [
        { path: '/hr/reviews', labelKey: 'nav.reviews' },
        { path: '/hr/succession', labelKey: 'nav.succession' },
        { path: '/leader/recognition', labelKey: 'nav.recognition' },
        { path: '/leader/team', labelKey: 'nav.teamHub' },
        { path: '/hr/training', labelKey: 'nav.training' },
      ],
    },
    {
      titleKey: 'nav.hiringSurveys',
      items: [
        { path: '/hr/jobs', labelKey: 'nav.jobs' },
        { path: '/hr/cv-ranking', labelKey: 'nav.cvRanking' },
        { path: '/hr/forms', labelKey: 'nav.forms' },
        { path: '/hr/submissions', labelKey: 'nav.submissions' },
      ],
    },
    { titleKey: 'nav.account', items: [{ path: '/employee/profile', labelKey: 'nav.profile' }] },
  ],
  Admin: [
    { titleKey: 'nav.overview', items: [{ path: '/admin/dashboard', labelKey: 'nav.dashboard' }] },
    {
      titleKey: 'nav.administration',
      items: [
        { path: '/admin/users', labelKey: 'nav.users' },
        { path: '/hr/approvals', labelKey: 'nav.approvals' },
        { path: '/hr/payroll', labelKey: 'nav.payroll' },
        { path: '/hr/benefits', labelKey: 'nav.benefits' },
        { path: '/hr/expenses', labelKey: 'nav.expenses' },
        { path: '/hr/documents', labelKey: 'nav.documents' },
        { path: '/hr/tickets', labelKey: 'nav.supportTickets' },
      ],
    },
    {
      titleKey: 'nav.leadership',
      items: [
        { path: '/leader/team', labelKey: 'nav.teamHub' },
        { path: '/leader/recognition', labelKey: 'nav.recognition' },
      ],
    },
    { titleKey: 'nav.account', items: [{ path: '/employee/profile', labelKey: 'nav.profile' }] },
  ],
  Candidate: [
    {
      titleKey: 'nav.career',
      items: [
        { path: '/candidate/dashboard', labelKey: 'nav.jobs' },
        { path: '/candidate/applications', labelKey: 'nav.applications' },
      ],
    },
  ],
};

const SEEN_NOTIFICATIONS_KEY = 'empowerhr-seen-notifications';
const FAVORITE_LINKS_KEY = 'empowerhr-favorite-links';
const RECENT_LINKS_KEY = 'empowerhr-recent-links';

function getSeenNotificationIds(user) {
  if (!user?.email) return [];
  try {
    const raw = localStorage.getItem(`${SEEN_NOTIFICATIONS_KEY}:${user.email}:${user.role}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSeenNotificationIds(user, ids) {
  if (!user?.email) return;
  localStorage.setItem(`${SEEN_NOTIFICATIONS_KEY}:${user.email}:${user.role}`, JSON.stringify(ids));
}

function getFavoritePaths(user) {
  if (!user?.email) return [];
  try {
    const raw = localStorage.getItem(`${FAVORITE_LINKS_KEY}:${user.email}:${user.role}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFavoritePaths(user, paths) {
  if (!user?.email) return;
  localStorage.setItem(`${FAVORITE_LINKS_KEY}:${user.email}:${user.role}`, JSON.stringify(paths));
}

function getRecentPaths(user) {
  if (!user?.email) return [];
  try {
    const raw = localStorage.getItem(`${RECENT_LINKS_KEY}:${user.email}:${user.role}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setRecentPaths(user, paths) {
  if (!user?.email) return;
  localStorage.setItem(`${RECENT_LINKS_KEY}:${user.email}:${user.role}`, JSON.stringify(paths));
}

function attachReadState(items, seenIds) {
  return items.map((item) => ({
    ...item,
    read: seenIds.includes(item.id),
  }));
}

function buildEmployeeNotifications({ forms = [], tasks = [], tickets = [], documents = [] }, t) {
  const items = [];
  const pendingForms = forms.filter((form) => form?.submission?.status !== 'Completed');
  const openTasks = tasks.filter((task) => !['Done', 'Completed'].includes(task?.status));
  const openTickets = tickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket?.status));
  const documentUpdates = documents.filter((document) => ['Pending', 'In Progress', 'Issued'].includes(document?.status));

  if (pendingForms.length) {
    items.push({
      id: `feedback-${pendingForms.length}`,
      title: t('notifications.feedbackTitle'),
      message: t('notifications.feedbackMessage', { count: pendingForms.length }),
      path: '/employee/feedback',
      tone: 'accent',
      priority: 5,
      preferenceKey: 'shortlistUpdates',
    });
  }

  if (openTasks.length) {
    items.push({
      id: `tasks-${openTasks.length}`,
      title: t('notifications.tasksTitle'),
      message: t('notifications.tasksMessage', { count: openTasks.length }),
      path: '/employee/tasks',
      tone: 'orange',
      priority: 4,
      preferenceKey: 'shortlistUpdates',
    });
  }

  if (openTickets.length) {
    items.push({
      id: `support-${openTickets.length}`,
      title: t('notifications.supportTitle'),
      message: t('notifications.supportMessage', { count: openTickets.length }),
      path: '/employee/tickets',
      tone: 'red',
      priority: 3,
      preferenceKey: 'interviewReminders',
    });
  }

  if (documentUpdates.length) {
    items.push({
      id: `documents-${documentUpdates.length}`,
      title: t('notifications.documentsTitle'),
      message: t('notifications.documentsMessage', { count: documentUpdates.length }),
      path: '/employee/documents',
      tone: 'green',
      priority: 2,
      preferenceKey: 'interviewReminders',
    });
  }

  return items;
}

function buildLeaderNotifications({ forms = [], tasks = [], tickets = [], documents = [], teamGoals = [], teamTasks = [] }, t) {
  const items = buildEmployeeNotifications({ forms, tasks, tickets, documents }, t);
  const teamItems = [
    ...teamGoals.filter((goal) => goal?.status !== 'Completed'),
    ...teamTasks.filter((task) => task?.status !== 'Done'),
  ];

  if (teamItems.length) {
    items.unshift({
      id: `team-${teamItems.length}`,
      title: t('notifications.teamTitle'),
      message: t('notifications.teamMessage', { count: teamItems.length }),
      path: '/leader/team',
      tone: 'red',
      priority: 6,
      preferenceKey: 'interviewReminders',
    });
  }

  return items;
}

function buildHrNotifications({ leaveRequests = [], tickets = [], documents = [], expenses = [], jobs = [], policyCompliance = null }, t) {
  const items = [];
  const pendingLeaves = leaveRequests.filter((request) => request?.status === 'Pending');
  const openTickets = tickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket?.status));
  const pendingDocuments = documents.filter((document) => ['Pending', 'In Progress'].includes(document?.status));
  const pendingExpenses = expenses.filter((expense) => ['Pending', 'Submitted'].includes(expense?.status));
  const activeJobs = jobs.filter((job) => job?.is_active !== false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ageInDays = (value) => {
    const parsed = parsePlannerDate(value);
    if (!parsed) return 0;
    const target = new Date(parsed);
    target.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((today.getTime() - target.getTime()) / 86400000));
  };
  const daysUntil = (value) => {
    const parsed = parsePlannerDate(value);
    if (!parsed) return Number.MAX_SAFE_INTEGER;
    const target = new Date(parsed);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  };
  const escalationCount =
    pendingLeaves.filter((request) => daysUntil(request?.startDate) <= 2 || ageInDays(request?.requestedAt) >= 1).length
    + pendingExpenses.filter((expense) => ageInDays(expense?.createdAt) >= 2).length
    + pendingDocuments.filter((document) => ageInDays(document?.createdAt) >= 1).length
    + openTickets.filter((ticket) => {
      const limit = { Critical: 1, High: 2, Medium: 3, Low: 5 }[ticket?.priority || 'Medium'] || 3;
      return ageInDays(ticket?.createdAt || ticket?.updatedAt) >= Math.max(1, limit - 1);
    }).length;
  const outstandingPolicyAcks = policyCompliance?.summary?.outstandingEmployees ?? 0;
  const duePolicyItems = policyCompliance?.summary?.dueThisWeekCount ?? 0;

  if (outstandingPolicyAcks) {
    items.push({
      id: `policy-compliance-${outstandingPolicyAcks}`,
      title: t('Policy Compliance'),
      message: t('There are {{count}} outstanding policy acknowledgements to follow up.', { count: outstandingPolicyAcks }),
      path: '/hr/policies',
      tone: duePolicyItems ? 'red' : 'accent',
      priority: duePolicyItems ? 8 : 4,
      preferenceKey: 'shortlistUpdates',
    });
  }

  if (escalationCount) {
    items.push({
      id: `hr-escalation-${escalationCount}`,
      title: t('Escalation Watch'),
      message: t('There are {{count}} approval items at risk or overdue.', { count: escalationCount }),
      path: '/hr/approvals',
      tone: 'red',
      priority: 7,
      preferenceKey: 'interviewReminders',
    });
  }

  if (pendingLeaves.length) {
    items.push({
      id: `leave-${pendingLeaves.length}`,
      title: t('notifications.leaveTitle'),
      message: t('notifications.leaveMessage', { count: pendingLeaves.length }),
      path: '/hr/attendance',
      tone: 'orange',
      priority: 6,
      preferenceKey: 'interviewReminders',
    });
  }

  if (pendingExpenses.length) {
    items.push({
      id: `expenses-${pendingExpenses.length}`,
      title: t('notifications.expenseTitle'),
      message: t('notifications.expenseMessage', { count: pendingExpenses.length }),
      path: '/hr/expenses',
      tone: 'accent',
      priority: 5,
      preferenceKey: 'interviewReminders',
    });
  }

  if (pendingDocuments.length) {
    items.push({
      id: `hr-documents-${pendingDocuments.length}`,
      title: t('notifications.documentsTitle'),
      message: t('notifications.documentsMessage', { count: pendingDocuments.length }),
      path: '/hr/documents',
      tone: 'green',
      priority: 4,
      preferenceKey: 'shortlistUpdates',
    });
  }

  if (openTickets.length) {
    items.push({
      id: `hr-support-${openTickets.length}`,
      title: t('notifications.supportTitle'),
      message: t('notifications.supportMessage', { count: openTickets.length }),
      path: '/hr/tickets',
      tone: 'red',
      priority: 3,
      preferenceKey: 'interviewReminders',
    });
  }

  if (activeJobs.length) {
    items.push({
      id: `hiring-${activeJobs.length}`,
      title: t('notifications.hiringTitle'),
      message: t('notifications.hiringMessage', { count: activeJobs.length }),
      path: '/hr/jobs',
      tone: 'accent',
      priority: 2,
      preferenceKey: 'newApplications',
    });
  }

  return items;
}

function buildCandidateNotifications({ jobs = [], applications = [] }, t) {
  const activeJobs = jobs.filter((job) => job?.is_active !== false);
  const shortlisted = applications.filter((application) => application?.review_stage === 'Shortlisted');
  const interviews = applications.filter((application) => application?.review_stage === 'Interview');
  const items = [];

  if (activeJobs.length) {
    items.push({
      id: `candidate-jobs-${activeJobs.length}`,
      title: t('notifications.candidateTitle'),
      message: t('notifications.candidateMessage', { count: activeJobs.length }),
      path: '/candidate/dashboard',
      tone: 'accent',
      priority: 3,
      preferenceKey: 'newApplications',
    });
  }

  if (shortlisted.length) {
    items.push({
      id: `candidate-shortlist-${shortlisted.length}`,
      title: t('notifications.shortlistTitle'),
      message: t('notifications.shortlistMessage', { count: shortlisted.length }),
      path: '/candidate/applications',
      tone: 'orange',
      priority: 5,
      preferenceKey: 'shortlistUpdates',
    });
  }

  if (interviews.length) {
    items.push({
      id: `candidate-interviews-${interviews.length}`,
      title: t('notifications.interviewTitle'),
      message: t('notifications.interviewMessage', { count: interviews.length }),
      path: '/candidate/applications',
      tone: 'red',
      priority: 6,
      preferenceKey: 'interviewReminders',
    });
  }

  return items;
}

function applyNotificationPreferences(items, preferences, t, user) {
  const prefs = {
    newApplications: true,
    shortlistUpdates: true,
    interviewReminders: true,
    weeklyDigest: false,
    ...(preferences || {}),
  };

  let filtered = items.filter((item) => prefs[item.preferenceKey || 'shortlistUpdates'] !== false);

  if (prefs.weeklyDigest && filtered.length) {
    const homePath = user?.role === 'Candidate'
      ? '/candidate/applications'
      : user?.role === 'HRManager' || user?.role === 'Admin'
        ? '/hr/dashboard'
        : '/employee/profile';

    filtered = [{
      id: `weekly-digest-${user?.role || 'user'}-${filtered.length}`,
      title: t('notifications.digestTitle'),
      message: t('notifications.digestMessage', { count: filtered.length }),
      path: homePath,
      tone: 'accent',
      priority: 7,
      preferenceKey: 'weeklyDigest',
    }, ...filtered];
  }

  return filtered;
}

function parsePlannerDate(value) {
  if (!value) return null;
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value;
  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPlannerDateLabel(value, t) {
  const parsed = parsePlannerDate(value);
  if (!parsed) return t('planner.noDate');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return t('planner.today');
  if (diffDays === 1) return t('planner.tomorrow');
  if (diffDays > 1) return t('planner.inDays', { count: diffDays });
  return t('planner.overdue', { count: Math.abs(diffDays) });
}

function normalizePlannerItems(items, t) {
  return items
    .filter((item) => item?.title)
    .map((item) => {
      const parsed = parsePlannerDate(item.date);
      return {
        ...item,
        sortDate: parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER,
        dateLabel: getPlannerDateLabel(item.date, t),
      };
    })
    .sort((a, b) => a.sortDate - b.sortDate)
    .slice(0, 6);
}

function buildEmployeePlanner({ shifts = [], tasks = [], goals = [], training = [], onboarding = [], tickets = [], documents = [] }, t) {
  const items = [
    ...shifts
      .filter((shift) => ['Planned', 'Confirmed'].includes(shift?.status))
      .map((shift) => ({
        id: `shift-${shift.scheduleID}`,
        title: `${t('nav.shifts')}: ${t(shift.shiftType || 'Remote')}`,
        subtitle: shift.location || t(shift.status || 'Planned'),
        date: shift.shiftDate,
        path: '/employee/shifts',
        tone: 'accent',
      })),
    ...tasks
      .filter((task) => !['Done', 'Completed'].includes(task?.status))
      .map((task) => ({
        id: `task-${task.taskID}`,
        title: task.title,
        subtitle: `${t('nav.tasks')} • ${t(task.status || 'To Do')}`,
        date: task.dueDate || task.updatedAt,
        path: '/employee/tasks',
        tone: 'orange',
      })),
    ...goals
      .filter((goal) => goal?.status !== 'Completed')
      .map((goal) => ({
        id: `goal-${goal.goalID}`,
        title: goal.title,
        subtitle: `${t('nav.goals')} • ${t(goal.status || 'In Progress')}`,
        date: goal.dueDate || goal.updatedAt,
        path: '/employee/goals',
        tone: 'green',
      })),
    ...training
      .filter((course) => course?.status !== 'Completed')
      .map((course) => ({
        id: `training-${course.courseID}`,
        title: course.title,
        subtitle: `${t('nav.training')} • ${t(course.category || 'Technical')}`,
        date: course.dueDate || course.createdAt,
        path: '/employee/training',
        tone: 'accent',
      })),
    ...onboarding
      .filter((plan) => plan?.status !== 'Completed')
      .map((plan) => ({
        id: `onboarding-${plan.planID}`,
        title: plan.title,
        subtitle: `${t('nav.onboarding')} • ${t(plan.status || 'Not Started')}`,
        date: plan.targetDate || plan.startDate || plan.updatedAt,
        path: '/employee/onboarding',
        tone: 'green',
      })),
    ...tickets
      .filter((ticket) => !['Resolved', 'Closed'].includes(ticket?.status))
      .map((ticket) => ({
        id: `ticket-${ticket.ticketID}`,
        title: ticket.subject,
        subtitle: `${t('nav.supportTickets')} • ${t(ticket.status || 'Open')}`,
        date: ticket.updatedAt || ticket.createdAt,
        path: '/employee/tickets',
        tone: 'red',
      })),
    ...documents
      .filter((document) => ['Pending', 'In Progress'].includes(document?.status))
      .map((document) => ({
        id: `document-${document.requestID}`,
        title: t(document.documentType || 'Document Type'),
        subtitle: `${t('nav.documents')} • ${t(document.status || 'Pending')}`,
        date: document.updatedAt || document.createdAt,
        path: '/employee/documents',
        tone: 'accent',
      })),
  ];

  return normalizePlannerItems(items, t);
}

function buildLeaderPlanner({ shifts = [], tasks = [], goals = [], training = [], onboarding = [], tickets = [], documents = [], teamGoals = [], teamTasks = [] }, t) {
  const personalItems = buildEmployeePlanner({ shifts, tasks, goals, training, onboarding, tickets, documents }, t);
  const teamItems = normalizePlannerItems([
    ...teamGoals
      .filter((goal) => goal?.status !== 'Completed')
      .map((goal) => ({
        id: `team-goal-${goal.goalID}`,
        title: goal.title,
        subtitle: `${goal.employeeName || goal.employeeID || t('Employee')} • ${t(goal.status || 'In Progress')}`,
        date: goal.dueDate || goal.updatedAt,
        path: '/leader/team',
        tone: 'green',
      })),
    ...teamTasks
      .filter((task) => !['Done', 'Completed'].includes(task?.status))
      .map((task) => ({
        id: `team-task-${task.taskID}`,
        title: task.title,
        subtitle: `${task.employeeName || task.employeeID || t('Employee')} • ${t(task.status || 'To Do')}`,
        date: task.dueDate || task.updatedAt,
        path: '/leader/team',
        tone: 'orange',
      })),
  ], t);

  return normalizePlannerItems([...personalItems, ...teamItems], t);
}

function buildHrPlanner({ leaveRequests = [], expenses = [], documents = [], tickets = [] }, t) {
  const items = [
    ...leaveRequests
      .filter((request) => request?.status === 'Pending')
      .map((request) => ({
        id: `leave-${request.leaveRequestID}`,
        title: request.employeeName || request.employeeID || t('Employee'),
        subtitle: `${t('Leave requests')} • ${t(request.leaveType || 'Annual')}`,
        date: request.startDate || request.createdAt,
        path: '/hr/attendance',
        tone: 'orange',
      })),
    ...expenses
      .filter((expense) => ['Pending', 'Submitted'].includes(expense?.status))
      .map((expense) => ({
        id: `expense-${expense.claimID}`,
        title: expense.title,
        subtitle: `${t('Expense claims')} • ${expense.employeeName || expense.employeeID || t('Employee')}`,
        date: expense.expenseDate || expense.updatedAt,
        path: '/hr/expenses',
        tone: 'accent',
      })),
    ...documents
      .filter((document) => ['Pending', 'In Progress'].includes(document?.status))
      .map((document) => ({
        id: `hr-document-${document.requestID}`,
        title: t(document.documentType || 'Document Type'),
        subtitle: `${t('Document Requests')} • ${document.employeeName || document.employeeID || t('Employee')}`,
        date: document.updatedAt || document.createdAt,
        path: '/hr/documents',
        tone: 'green',
      })),
    ...tickets
      .filter((ticket) => !['Resolved', 'Closed'].includes(ticket?.status))
      .map((ticket) => ({
        id: `hr-ticket-${ticket.ticketID}`,
        title: ticket.subject,
        subtitle: `${t('Support Tickets')} • ${t(ticket.priority || 'Medium')}`,
        date: ticket.updatedAt || ticket.createdAt,
        path: '/hr/tickets',
        tone: 'red',
      })),
  ];

  return normalizePlannerItems(items, t);
}

function buildCandidatePlanner({ applications = [], jobs = [] }, t) {
  const items = [
    ...applications.map((application) => ({
      id: `application-${application.id}`,
      title: application.job_title || t('Untitled'),
      subtitle: `${t('Stage:')} ${t(application.review_stage || 'Applied')}`,
      date: application.stage_updated_at || application.submitted_at,
      path: '/candidate/applications',
      tone: application.review_stage === 'Interview' ? 'orange' : application.review_stage === 'Hired' ? 'green' : 'accent',
    })),
    ...jobs
      .filter((job) => job?.is_active !== false)
      .map((job) => ({
        id: `planner-job-${job.id}`,
        title: job.title,
        subtitle: `${t('Open Positions')} • ${job.department || t('General')}`,
        date: job.created_at,
        path: '/candidate/dashboard',
        tone: 'accent',
      })),
  ];

  return normalizePlannerItems(items, t);
}

export function Navbar() {
  const { user, logout, notificationPreferences, canAccessPath, resolvePath } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => {
    if (!user) return [];
    return (NAV_GROUPS[user.role] ?? [])
      .map((group) => ({
        ...group,
        items: (group.items || [])
          .map((link) => ({ ...link, path: resolvePath(link.path) }))
          .filter((link) => canAccessPath(link.path)),
      }))
      .filter((group) => group.items.length > 0);
  }, [canAccessPath, resolvePath, user]);
  const activePath = location.pathname;
  const activeGroupTitle = groups.find((group) => group.items.some((link) => activePath === link.path))?.titleKey ?? groups[0]?.titleKey ?? '';
  const [openGroup, setOpenGroup] = useState(activeGroupTitle);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [favoritePaths, setFavoritePathsState] = useState([]);
  const [recentPaths, setRecentPathsState] = useState([]);
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerItems, setPlannerItems] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchData, setSearchData] = useState([]);

  useEffect(() => {
    if (activeGroupTitle) setOpenGroup(activeGroupTitle);
  }, [activeGroupTitle]);

  useEffect(() => {
    if (!user) {
      setFavoritePathsState([]);
      setRecentPathsState([]);
      return;
    }
    setFavoritePathsState(getFavoritePaths(user));
    setRecentPathsState(getRecentPaths(user));
  }, [user]);

  useEffect(() => {
    if (!user || !activePath) return;
    const allowedPaths = groups.flatMap((group) => group.items.map((item) => item.path));
    if (!allowedPaths.includes(activePath)) return;

    setRecentPathsState((current) => {
      const next = [activePath, ...current.filter((item) => item !== activePath)].slice(0, 6);
      setRecentPaths(user, next);
      return next;
    });
  }, [activePath, groups, user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    setNotificationLoading(true);
    try {
      let items = [];

      if (user.role === 'Candidate') {
        const [jobs, applications] = await Promise.all([
          getJobs(),
          getCandidateApplications(user.email).catch(() => []),
        ]);
        items = buildCandidateNotifications({ jobs, applications }, t);
      } else if (user.role === 'HRManager' || user.role === 'Admin') {
        const [leaveRequests, tickets, documents, expenses, jobs, policyCompliance] = await Promise.all([
          hrGetLeaveRequests(),
          hrGetTickets(),
          hrGetDocuments(),
          hrGetExpenses(),
          getJobs(),
          hrGetPolicyCompliance().catch(() => null),
        ]);
        items = buildHrNotifications({ leaveRequests, tickets, documents, expenses, jobs, policyCompliance }, t);
      } else if (user.role === 'TeamLeader') {
        const [forms, tasks, tickets, documents, teamGoals, teamTasks] = await Promise.all([
          getForms(user.employee_id),
          getMyTasks(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
          getTeamGoals(),
          getTeamTasks(),
        ]);
        items = buildLeaderNotifications({ forms, tasks, tickets, documents, teamGoals, teamTasks }, t);
      } else {
        const [forms, tasks, tickets, documents] = await Promise.all([
          getForms(user.employee_id),
          getMyTasks(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
        ]);
        items = buildEmployeeNotifications({ forms, tasks, tickets, documents }, t);
      }

      const seenIds = getSeenNotificationIds(user);
      const preferredItems = applyNotificationPreferences(items, notificationPreferences, t, user);
      const rankedItems = preferredItems
        .map((item) => ({ ...item, path: resolvePath(item.path) }))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 6);
      setNotifications(attachReadState(rankedItems, seenIds));
    } catch {
      setNotifications([]);
    } finally {
      setNotificationLoading(false);
    }
  }, [notificationPreferences, resolvePath, t, user]);

  useEffect(() => {
    if (!user) return undefined;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, user]);

  const loadPlannerData = useCallback(async () => {
    if (!user) return;

    setPlannerLoading(true);
    try {
      let items = [];

      if (user.role === 'Candidate') {
        const [applications, jobs] = await Promise.all([
          getCandidateApplications(user.email).catch(() => []),
          getJobs(),
        ]);
        items = buildCandidatePlanner({ applications, jobs }, t);
      } else if (user.role === 'HRManager' || user.role === 'Admin') {
        const [leaveRequests, expenses, documents, tickets] = await Promise.all([
          hrGetLeaveRequests(),
          hrGetExpenses(),
          hrGetDocuments(),
          hrGetTickets(),
        ]);
        items = buildHrPlanner({ leaveRequests, expenses, documents, tickets }, t);
      } else if (user.role === 'TeamLeader') {
        const [shifts, tasks, goals, training, onboarding, tickets, documents, teamGoals, teamTasks] = await Promise.all([
          getMyShifts(user.employee_id),
          getMyTasks(user.employee_id),
          getMyGoals(user.employee_id),
          getMyTraining(user.employee_id),
          getMyOnboarding(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
          getTeamGoals(),
          getTeamTasks(),
        ]);
        items = buildLeaderPlanner({ shifts, tasks, goals, training, onboarding, tickets, documents, teamGoals, teamTasks }, t);
      } else {
        const [shifts, tasks, goals, training, onboarding, tickets, documents] = await Promise.all([
          getMyShifts(user.employee_id),
          getMyTasks(user.employee_id),
          getMyGoals(user.employee_id),
          getMyTraining(user.employee_id),
          getMyOnboarding(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
        ]);
        items = buildEmployeePlanner({ shifts, tasks, goals, training, onboarding, tickets, documents }, t);
      }

      setPlannerItems(items.map((item) => ({ ...item, path: resolvePath(item.path) })));
    } catch {
      setPlannerItems([]);
    } finally {
      setPlannerLoading(false);
    }
  }, [resolvePath, t, user]);

  const favoriteLinks = useMemo(
    () => groups
      .flatMap((group) => group.items.map((link) => ({
        ...link,
        title: t(link.labelKey),
        groupTitle: t(group.titleKey),
      })))
      .filter((link) => favoritePaths.includes(link.path))
      .sort((a, b) => favoritePaths.indexOf(a.path) - favoritePaths.indexOf(b.path)),
    [favoritePaths, groups, t],
  );

  const recentLinks = useMemo(
    () => groups
      .flatMap((group) => group.items.map((link) => ({
        ...link,
        title: t(link.labelKey),
        groupTitle: t(group.titleKey),
      })))
      .filter((link) => recentPaths.includes(link.path))
      .sort((a, b) => recentPaths.indexOf(a.path) - recentPaths.indexOf(b.path)),
    [groups, recentPaths, t],
  );

  const pageSearchEntries = useMemo(
    () => groups.flatMap((group) => group.items.map((link) => ({
      id: `page-${link.path}`,
      title: t(link.labelKey),
      subtitle: t(group.titleKey),
      category: t('search.category.page'),
      path: link.path,
      searchText: `${t(link.labelKey)} ${t(group.titleKey)} ${link.path}`.toLowerCase(),
    }))),
    [groups, t],
  );

  const loadSearchData = useCallback(async () => {
    if (!user) return;

    setSearchLoading(true);
    try {
      let entries = [];

      if (user.role === 'Candidate') {
        const jobs = await getJobs();
        entries = jobs.map((job) => ({
          id: `job-${job.id}`,
          title: job.title,
          subtitle: job.department || t('General'),
          category: t('search.category.job'),
          path: '/candidate/dashboard',
          searchText: `${job.title} ${job.department || ''} ${job.description || ''}`.toLowerCase(),
        }));
      } else if (user.role === 'HRManager' || user.role === 'Admin') {
        const [employees, jobs, forms, submissions, tickets, documents] = await Promise.all([
          hrGetEmployees(),
          getJobs(),
          hrGetForms(),
          hrGetSubmissions(),
          hrGetTickets(),
          hrGetDocuments(),
        ]);

        entries = [
          ...employees.map((employee) => ({
            id: `employee-${employee.employeeID}`,
            title: employee.fullName || employee.email,
            subtitle: `${employee.jobTitle || t('Unassigned')} • ${employee.department || t('Department')}`,
            category: t('search.category.employee'),
            path: '/hr/employees',
            searchText: `${employee.fullName || ''} ${employee.email || ''} ${employee.jobTitle || ''} ${employee.department || ''}`.toLowerCase(),
          })),
          ...jobs.map((job) => ({
            id: `job-${job.id}`,
            title: job.title,
            subtitle: job.department || t('General'),
            category: t('search.category.job'),
            path: '/hr/jobs',
            searchText: `${job.title} ${job.department || ''} ${job.description || ''}`.toLowerCase(),
          })),
          ...forms.map((form) => ({
            id: `form-${form.formID || form.id}`,
            title: form.title,
            subtitle: form.isActive ? t('Active') : t('Inactive'),
            category: t('search.category.form'),
            path: '/hr/forms',
            searchText: `${form.title || ''} ${form.description || ''}`.toLowerCase(),
          })),
          ...submissions.map((submission) => ({
            id: `submission-${submission.submissionID}`,
            title: submission.employeeName || submission.employeeID || t('Employee'),
            subtitle: `${t('Status')}: ${t(submission.status || 'Pending')}`,
            category: t('search.category.submission'),
            path: '/hr/submissions',
            searchText: `${submission.employeeName || ''} ${submission.employeeID || ''} ${submission.status || ''}`.toLowerCase(),
          })),
          ...tickets.map((ticket) => ({
            id: `ticket-${ticket.ticketID}`,
            title: ticket.subject,
            subtitle: `${ticket.employeeName || ticket.employeeID} • ${t(ticket.status || 'Open')}`,
            category: t('search.category.ticket'),
            path: '/hr/tickets',
            searchText: `${ticket.subject || ''} ${ticket.employeeName || ''} ${ticket.description || ''}`.toLowerCase(),
          })),
          ...documents.map((document) => ({
            id: `document-${document.requestID}`,
            title: t(document.documentType || 'Document Type'),
            subtitle: `${document.employeeName || document.employeeID} • ${t(document.status || 'Pending')}`,
            category: t('search.category.document'),
            path: '/hr/documents',
            searchText: `${document.documentType || ''} ${document.employeeName || ''} ${document.purpose || ''}`.toLowerCase(),
          })),
        ];
      } else if (user.role === 'TeamLeader') {
        const [forms, tasks, tickets, documents, teamGoals, teamTasks, jobs] = await Promise.all([
          getForms(user.employee_id),
          getMyTasks(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
          getTeamGoals(),
          getTeamTasks(),
          getJobs(),
        ]);

        entries = [
          ...forms.map((form) => ({
            id: `feedback-${form.formID}`,
            title: form.title,
            subtitle: t('search.category.form'),
            category: t('search.category.form'),
            path: '/employee/feedback',
            searchText: `${form.title || ''} ${form.description || ''}`.toLowerCase(),
          })),
          ...tasks.map((task) => ({
            id: `task-${task.taskID}`,
            title: task.title,
            subtitle: `${t(task.status || 'To Do')} • ${t(task.priority || 'Medium')}`,
            category: t('search.category.task'),
            path: '/employee/tasks',
            searchText: `${task.title || ''} ${task.description || ''} ${task.status || ''}`.toLowerCase(),
          })),
          ...teamGoals.map((goal) => ({
            id: `team-goal-${goal.goalID}`,
            title: goal.title,
            subtitle: `${goal.employeeName || goal.employeeID} • ${t(goal.status || 'Pending')}`,
            category: t('search.category.goal'),
            path: '/leader/team',
            searchText: `${goal.title || ''} ${goal.employeeName || ''} ${goal.description || ''}`.toLowerCase(),
          })),
          ...teamTasks.map((task) => ({
            id: `team-task-${task.taskID}`,
            title: task.title,
            subtitle: `${task.employeeName || task.employeeID} • ${t(task.status || 'Pending')}`,
            category: t('search.category.task'),
            path: '/leader/team',
            searchText: `${task.title || ''} ${task.employeeName || ''} ${task.description || ''}`.toLowerCase(),
          })),
          ...tickets.map((ticket) => ({
            id: `ticket-${ticket.ticketID}`,
            title: ticket.subject,
            subtitle: t(ticket.status || 'Open'),
            category: t('search.category.ticket'),
            path: '/employee/tickets',
            searchText: `${ticket.subject || ''} ${ticket.description || ''} ${ticket.status || ''}`.toLowerCase(),
          })),
          ...documents.map((document) => ({
            id: `document-${document.requestID}`,
            title: t(document.documentType || 'Document Type'),
            subtitle: t(document.status || 'Pending'),
            category: t('search.category.document'),
            path: '/employee/documents',
            searchText: `${document.documentType || ''} ${document.purpose || ''} ${document.status || ''}`.toLowerCase(),
          })),
          ...jobs.map((job) => ({
            id: `job-${job.id}`,
            title: job.title,
            subtitle: job.department || t('General'),
            category: t('search.category.job'),
            path: '/careers',
            searchText: `${job.title} ${job.department || ''} ${job.description || ''}`.toLowerCase(),
          })),
        ];
      } else {
        const [forms, tasks, tickets, documents, jobs] = await Promise.all([
          getForms(user.employee_id),
          getMyTasks(user.employee_id),
          getMyTickets(user.employee_id),
          getMyDocuments(user.employee_id),
          getJobs(),
        ]);

        entries = [
          ...forms.map((form) => ({
            id: `feedback-${form.formID}`,
            title: form.title,
            subtitle: t('search.category.form'),
            category: t('search.category.form'),
            path: '/employee/feedback',
            searchText: `${form.title || ''} ${form.description || ''}`.toLowerCase(),
          })),
          ...tasks.map((task) => ({
            id: `task-${task.taskID}`,
            title: task.title,
            subtitle: `${t(task.status || 'To Do')} • ${t(task.priority || 'Medium')}`,
            category: t('search.category.task'),
            path: '/employee/tasks',
            searchText: `${task.title || ''} ${task.description || ''} ${task.status || ''}`.toLowerCase(),
          })),
          ...tickets.map((ticket) => ({
            id: `ticket-${ticket.ticketID}`,
            title: ticket.subject,
            subtitle: t(ticket.status || 'Open'),
            category: t('search.category.ticket'),
            path: '/employee/tickets',
            searchText: `${ticket.subject || ''} ${ticket.description || ''} ${ticket.status || ''}`.toLowerCase(),
          })),
          ...documents.map((document) => ({
            id: `document-${document.requestID}`,
            title: t(document.documentType || 'Document Type'),
            subtitle: t(document.status || 'Pending'),
            category: t('search.category.document'),
            path: '/employee/documents',
            searchText: `${document.documentType || ''} ${document.purpose || ''} ${document.status || ''}`.toLowerCase(),
          })),
          ...jobs.map((job) => ({
            id: `job-${job.id}`,
            title: job.title,
            subtitle: job.department || t('General'),
            category: t('search.category.job'),
            path: '/careers',
            searchText: `${job.title} ${job.department || ''} ${job.description || ''}`.toLowerCase(),
          })),
        ];
      }

      setSearchData(entries.slice(0, 40).map((entry) => ({ ...entry, path: resolvePath(entry.path) })));
    } catch {
      setSearchData([]);
    } finally {
      setSearchLoading(false);
    }
  }, [groups, resolvePath, t, user]);

  const hasSearchQuery = searchQuery.trim().length >= 2;

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const combined = [...pageSearchEntries, ...searchData];

    if (!query || query.length < 2) {
      return [];
    }

    return combined.filter((item) => item.searchText.includes(query)).slice(0, 8);
  }, [pageSearchEntries, searchData, searchQuery]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markAllAsRead = useCallback(() => {
    if (!user) return;
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, read: true }));
      setSeenNotificationIds(user, next.map((item) => item.id));
      return next;
    });
  }, [user]);

  const handleToggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    setShowPlanner(false);
    setShowSearch(false);
    if (next) markAllAsRead();
  };

  const handleTogglePlanner = () => {
    const next = !showPlanner;
    setShowPlanner(next);
    setShowNotifications(false);
    setShowSearch(false);
    if (next && !plannerItems.length && !plannerLoading) {
      loadPlannerData();
    }
  };

  const handleNotificationClick = (path) => {
    setShowNotifications(false);
    if (path) navigate(path);
  };

  const handleSearchFocus = () => {
    setShowSearch(true);
    setShowPlanner(false);
    setShowNotifications(false);
  };

  const handleSearchResultClick = (path) => {
    setShowSearch(false);
    setSearchQuery('');
    if (path) navigate(path);
  };

  const handleToggleFavorite = (path) => {
    if (!user) return;
    setFavoritePathsState((current) => {
      const next = current.includes(path)
        ? current.filter((item) => item !== path)
        : [path, ...current].slice(0, 6);
      setFavoritePaths(user, next);
      return next;
    });
  };

  if (!user) return null;

  const roleLabel = t(`role.${user.role}`);

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-inner">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-brandmark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="app-sidebar-title">EmpowerHR</div>
            <div className="app-sidebar-subtitle">{t('sidebar.workspace', { role: roleLabel })}</div>
          </div>
        </div>

        <div className="app-sidebar-note">
          {t('sidebar.note')}
        </div>

        <div className="app-sidebar-groups">
          {groups.map((group) => {
            const expanded = openGroup === group.titleKey;
            const hasActive = group.items.some((link) => activePath === link.path);
            return (
              <section key={group.titleKey} className="app-nav-group">
                <button
                  type="button"
                  className={`app-nav-group-toggle${expanded ? ' is-open' : ''}`}
                  onClick={() => setOpenGroup((prev) => (prev === group.titleKey ? '' : group.titleKey))}
                >
                  <span>{t(group.titleKey)}</span>
                  <span>{expanded ? '–' : '+'}</span>
                </button>

                {(expanded || hasActive) && (
                  <div className="app-nav-links">
                    {group.items.map((link) => {
                      const active = activePath === link.path;
                      const isFavorite = favoritePaths.includes(link.path);
                      return (
                        <div key={link.path} className="app-nav-link-row">
                          <button
                            type="button"
                            onClick={() => navigate(link.path)}
                            className={`app-nav-link${active ? ' active' : ''}`}
                          >
                            {t(link.labelKey)}
                          </button>
                          <button
                            type="button"
                            className={`app-nav-fav${isFavorite ? ' active' : ''}`}
                            onClick={() => handleToggleFavorite(link.path)}
                            aria-label={isFavorite ? t('favorites.unpin') : t('favorites.pin')}
                            title={isFavorite ? t('favorites.unpin') : t('favorites.pin')}
                          >
                            {isFavorite ? '★' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="app-global-search">
          <div className="app-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="app-search-input"
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                setShowSearch(true);
                if (nextQuery.trim().length >= 2 && !searchData.length && !searchLoading) loadSearchData();
              }}
              onFocus={handleSearchFocus}
              placeholder={t('search.placeholder')}
            />
          </div>

          {showSearch && (
            <div className="app-search-panel">
              <div className="app-search-panel-header">
                <strong>{t('search.title')}</strong>
                <button type="button" className="app-search-refresh" onClick={loadSearchData}>
                  {t('search.refresh')}
                </button>
              </div>

              {!searchQuery.trim() || !hasSearchQuery ? (
                <div className="app-search-empty">{t('search.startHint')}</div>
              ) : searchLoading ? (
                <div className="app-search-empty">{t('search.loading')}</div>
              ) : filteredSearchResults.length === 0 ? (
                <div className="app-search-empty">{t('search.empty')}</div>
              ) : (
                <div className="app-search-list">
                  {filteredSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="app-search-item"
                      onClick={() => handleSearchResultClick(item.path)}
                    >
                      <span className="app-search-item-meta">{item.category}</span>
                      <span className="app-search-item-title">{item.title}</span>
                      <span className="app-search-item-subtitle">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="app-sidebar-quickaccess">
          <button
            type="button"
            className={`app-sidebar-section-toggle${showQuickAccess ? ' is-open' : ''}`}
            onClick={() => setShowQuickAccess((current) => !current)}
          >
            <span>{t('sidebar.quickAccess')}</span>
            <span className="app-sidebar-section-badge">{favoriteLinks.length + recentLinks.length}</span>
          </button>

          {showQuickAccess && (
            <div className="app-sidebar-section-body">
              <div className="app-sidebar-section-note">{t('sidebar.quickHint')}</div>

              {favoriteLinks.length > 0 && (
                <div className="app-sidebar-utility-block">
                  <div className="app-sidebar-favorites-header">{t('favorites.title')}</div>
                  <div className="app-sidebar-favorites-list">
                    {favoriteLinks.map((link) => {
                      const active = activePath === link.path;
                      return (
                        <button
                          key={`favorite-${link.path}`}
                          type="button"
                          onClick={() => navigate(link.path)}
                          className={`app-favorite-link${active ? ' active' : ''}`}
                        >
                          <span className="app-favorite-star">★</span>
                          <span>{link.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {recentLinks.length > 0 && (
                <div className="app-sidebar-utility-block">
                  <div className="app-sidebar-favorites-header">{t('recent.title')}</div>
                  <div className="app-sidebar-favorites-list">
                    {recentLinks.map((link) => {
                      const active = activePath === link.path;
                      return (
                        <button
                          key={`recent-${link.path}`}
                          type="button"
                          onClick={() => navigate(link.path)}
                          className={`app-recent-link${active ? ' active' : ''}`}
                        >
                          <span>{link.title}</span>
                          <span className="app-recent-meta">{link.groupTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {favoriteLinks.length === 0 && recentLinks.length === 0 && (
                <div className="app-favorites-empty">{t('sidebar.quickEmpty')}</div>
              )}
            </div>
          )}
        </div>

        <div className="app-sidebar-usercard">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{user.full_name}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>{roleLabel}</div>

          <button type="button" className="app-notification-trigger" onClick={handleTogglePlanner}>
            <span className="app-notification-trigger-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{t('planner.title')}</span>
            </span>
            <span className="app-notification-count">{plannerLoading ? '…' : plannerItems.length}</span>
          </button>

          {showPlanner && (
            <div className="app-notification-panel">
              <div className="app-notification-panel-header">
                <strong>{t('planner.title')}</strong>
                <button type="button" className="app-notification-refresh" onClick={loadPlannerData}>
                  {t('planner.refresh')}
                </button>
              </div>

              {plannerLoading ? (
                <div className="app-notification-empty" style={{ textAlign: 'center' }}>
                  <Spinner size={22} />
                </div>
              ) : plannerItems.length === 0 ? (
                <div className="app-notification-empty">{t('planner.empty')}</div>
              ) : (
                <div className="app-notification-list">
                  {plannerItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="app-notification-item"
                      onClick={() => handleNotificationClick(item.path)}
                    >
                      <span className={`app-notification-dot tone-${item.tone || 'accent'}`} />
                      <span className="app-notification-body">
                        <span className="app-notification-title">{item.title}</span>
                        <span className="app-notification-text">{item.subtitle}</span>
                        <span className="app-planner-meta">{item.dateLabel}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" className="app-notification-trigger" onClick={handleToggleNotifications}>
            <span className="app-notification-trigger-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              <span>{t('notifications.title')}</span>
            </span>
            <span className="app-notification-count">{notificationLoading ? '…' : unreadCount}</span>
          </button>

          {showNotifications && (
            <div className="app-notification-panel">
              <div className="app-notification-panel-header">
                <strong>{t('notifications.title')}</strong>
                <button type="button" className="app-notification-refresh" onClick={loadNotifications}>
                  {t('notifications.refresh')}
                </button>
              </div>

              {notificationLoading ? (
                <div className="app-notification-empty" style={{ textAlign: 'center' }}>
                  <Spinner size={22} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="app-notification-empty">{t('notifications.empty')}</div>
              ) : (
                <div className="app-notification-list">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`app-notification-item${item.read ? '' : ' unread'}`}
                      onClick={() => handleNotificationClick(item.path)}
                    >
                      <span className={`app-notification-dot tone-${item.tone || 'accent'}`} />
                      <span className="app-notification-body">
                        <span className="app-notification-title">{item.title}</span>
                        <span className="app-notification-text">{item.message}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" className="app-language-toggle" onClick={toggleLanguage}>
            {t('language.switch')}
          </button>
          <Btn variant="ghost" size="sm" onClick={logout} style={{ width: '100%' }}>
            {t('common.signOut')}
          </Btn>
        </div>
      </div>
    </aside>
  );
}
