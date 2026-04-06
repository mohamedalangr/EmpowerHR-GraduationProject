import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getJobs,
  getTeamGoals,
  getTeamTasks,
  hrGetEmployees,
  hrGetExpenses,
  hrGetForms,
  hrGetLeaveRequests,
  hrGetTickets,
} from '../../api/index.js';
import { Btn, Spinner } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { EmployeeProfilePage } from '../employee/EmployeeProfilePage';
import { HRApprovalCenterPage } from '../hr/ApprovalCenterPage';
import { HRAttendancePage } from '../hr/AttendancePage';
import { HRBenefitsPage } from '../hr/BenefitsPage';
import { HRCVRankingPage } from '../hr/CVRankingPage';
import { HRDocumentsPage } from '../hr/DocumentsPage';
import { HREmployeesPage } from '../hr/EmployeesPage';
import { HRExpensesPage } from '../hr/ExpensesPage';
import { HRFormsPage } from '../hr/FormPage';
import { HRJobPostingsPage } from '../hr/JobPostingsPage';
import { HROnboardingPage } from '../hr/OnboardingPage';
import { HRPayrollPage } from '../hr/PayrollPage';
import { HRPoliciesPage } from '../hr/PoliciesPage';
import { HRReviewsPage } from '../hr/ReviewsPage';
import { HRShiftsPage } from '../hr/ShiftsPage';
import { HRSubmissionPage } from '../hr/SubmissionPage';
import { HRSuccessionPage } from '../hr/SuccessionPage';
import { HRTicketsPage } from '../hr/TicketsPage';
import { HRTrainingPage } from '../hr/TrainingPage';
import { TeamGoalsPage } from '../leader/TeamPage';
import { TeamRecognitionPage } from '../leader/RecognitionPage';

const EMPTY_SUMMARY = {
  managedPeople: 0,
  activeRoles: 0,
  admins: 0,
  leaders: 0,
  pendingActions: 0,
  openServiceQueues: 0,
  activeForms: 0,
  openJobs: 0,
  leadershipItems: 0,
  liveWorkspaces: 5,
};

const ADMIN_VARIANT_CONTENT = {
  governance: {
    badge: 'Governance Mode',
    note: 'Validate route ownership, permissions, and workspace readiness from one place.',
    actions: ['Review access coverage', 'Check queue pressure', 'Keep role routes aligned'],
  },
  users: {
    badge: 'Access Oversight',
    note: 'Keep role ownership clear while monitoring who can reach each workspace.',
    actions: ['Audit admins and leaders', 'Review employee coverage', 'Confirm shared access'],
  },
  approvals: {
    badge: 'Queue Command',
    note: 'Prioritize service pressure before approvals, expenses, or support queues stall.',
    actions: ['Clear pending actions', 'Watch service backlogs', 'Unblock high-priority items'],
  },
  talent: {
    badge: 'Talent Oversight',
    note: 'Monitor reviews, learning, and succession from an executive governance lens.',
    actions: ['Review readiness signals', 'Check training pressure', 'Track talent follow-up'],
  },
  hiring: {
    badge: 'Hiring Command',
    note: 'Keep recruiting flow, submissions, and forms aligned with admin oversight.',
    actions: ['Review live openings', 'Check candidate flow', 'Validate form readiness'],
  },
  leadership: {
    badge: 'Leadership Alignment',
    note: 'Track team execution and recognition activity without leaving the admin workspace.',
    actions: ['Review team load', 'Check recognition momentum', 'Escalate blockers early'],
  },
  services: {
    badge: 'Service Reliability',
    note: 'Keep payroll, benefits, documents, and support operations moving cleanly.',
    actions: ['Watch operational queues', 'Confirm service owners', 'Resolve aging requests'],
  },
};

function AdminOwnedShell({ titleKey, subtitleKey, variant = 'governance', children }) {
  const { t } = useLanguage();
  const { resolvePath } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setLoading(true);
      try {
        const [employees, jobs, forms, leaveRequests, expenses, tickets, teamGoals, teamTasks] = await Promise.all([
          hrGetEmployees().catch(() => []),
          getJobs().catch(() => []),
          hrGetForms().catch(() => []),
          hrGetLeaveRequests().catch(() => []),
          hrGetExpenses().catch(() => []),
          hrGetTickets().catch(() => []),
          getTeamGoals().catch(() => []),
          getTeamTasks().catch(() => []),
        ]);

        if (!active) return;

        const roleCounts = (Array.isArray(employees) ? employees : []).reduce((acc, employee) => {
          const role = employee?.role || 'TeamMember';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});

        const pendingLeaves = (Array.isArray(leaveRequests) ? leaveRequests : []).filter((item) => item?.status === 'Pending').length;
        const activeExpenses = (Array.isArray(expenses) ? expenses : []).filter((item) => ['Pending', 'Submitted'].includes(item?.status)).length;
        const openTickets = (Array.isArray(tickets) ? tickets : []).filter((item) => !['Resolved', 'Closed'].includes(item?.status)).length;
        const leadershipItems = (Array.isArray(teamGoals) ? teamGoals : []).filter((item) => item?.status !== 'Completed').length
          + (Array.isArray(teamTasks) ? teamTasks : []).filter((item) => item?.status !== 'Done').length;

        setSummary({
          managedPeople: Array.isArray(employees) ? employees.length : 0,
          activeRoles: Object.keys(roleCounts).length,
          admins: roleCounts.Admin || 0,
          leaders: roleCounts.TeamLeader || 0,
          pendingActions: pendingLeaves + activeExpenses + openTickets,
          openServiceQueues: activeExpenses + openTickets,
          activeForms: (Array.isArray(forms) ? forms : []).filter((item) => item?.isActive).length,
          openJobs: (Array.isArray(jobs) ? jobs : []).filter((job) => job?.is_active !== false).length,
          leadershipItems,
          liveWorkspaces: 5,
        });
      } catch {
        if (active) setSummary(EMPTY_SUMMARY);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const map = {
      governance: [
        { label: t('Managed People'), value: summary.managedPeople, accent: '#111827' },
        { label: t('Role Coverage'), value: summary.activeRoles, accent: '#2563EB' },
        { label: t('Live Workspaces'), value: summary.liveWorkspaces, accent: '#7C3AED' },
      ],
      users: [
        { label: t('Managed People'), value: summary.managedPeople, accent: '#111827' },
        { label: t('Role Coverage'), value: summary.activeRoles, accent: '#2563EB' },
        { label: t('Shared access'), value: summary.admins + summary.leaders, accent: '#E8321A' },
      ],
      approvals: [
        { label: t('Pending Actions'), value: summary.pendingActions, accent: '#E8321A' },
        { label: t('Open Service Queues'), value: summary.openServiceQueues, accent: '#B54708' },
        { label: t('Active Forms'), value: summary.activeForms, accent: '#2563EB' },
      ],
      talent: [
        { label: t('Managed People'), value: summary.managedPeople, accent: '#111827' },
        { label: t('Leadership Workspace'), value: summary.leaders, accent: '#7C3AED' },
        { label: t('Role Coverage'), value: summary.activeRoles, accent: '#2563EB' },
      ],
      hiring: [
        { label: t('Candidate Experience'), value: summary.openJobs, accent: '#E8321A' },
        { label: t('Active Forms'), value: summary.activeForms, accent: '#2563EB' },
        { label: t('Live Workspaces'), value: summary.liveWorkspaces, accent: '#7C3AED' },
      ],
      leadership: [
        { label: t('Leadership Workspace'), value: summary.leadershipItems, accent: '#7C3AED' },
        { label: t('Pending Actions'), value: summary.pendingActions, accent: '#E8321A' },
        { label: t('Managed People'), value: summary.managedPeople, accent: '#111827' },
      ],
      services: [
        { label: t('Open Service Queues'), value: summary.openServiceQueues, accent: '#B54708' },
        { label: t('Pending Actions'), value: summary.pendingActions, accent: '#E8321A' },
        { label: t('Managed People'), value: summary.managedPeople, accent: '#111827' },
      ],
    };

    return map[variant] || map.governance;
  }, [summary, t, variant]);

  const quickLinks = useMemo(() => {
    const map = {
      governance: [
        { label: t('nav.dashboard'), path: resolvePath('/hr/dashboard') },
        { label: t('nav.users'), path: resolvePath('/hr/employees') },
        { label: t('nav.approvals'), path: resolvePath('/hr/approvals') },
      ],
      users: [
        { label: t('nav.users'), path: resolvePath('/hr/employees') },
        { label: t('nav.profile'), path: resolvePath('/employee/profile') },
        { label: t('nav.approvals'), path: resolvePath('/hr/approvals') },
      ],
      approvals: [
        { label: t('nav.approvals'), path: resolvePath('/hr/approvals') },
        { label: t('nav.expenses'), path: resolvePath('/hr/expenses') },
        { label: t('nav.supportTickets'), path: resolvePath('/hr/tickets') },
      ],
      talent: [
        { label: t('nav.reviews'), path: resolvePath('/hr/reviews') },
        { label: t('nav.training'), path: resolvePath('/hr/training') },
        { label: t('nav.succession'), path: resolvePath('/hr/succession') },
      ],
      hiring: [
        { label: t('nav.jobs'), path: resolvePath('/hr/jobs') },
        { label: t('nav.cvRanking'), path: resolvePath('/hr/cv-ranking') },
        { label: t('nav.forms'), path: resolvePath('/hr/forms') },
      ],
      leadership: [
        { label: t('nav.teamHub'), path: resolvePath('/leader/team') },
        { label: t('nav.recognition'), path: resolvePath('/leader/recognition') },
        { label: t('nav.approvals'), path: resolvePath('/hr/approvals') },
      ],
      services: [
        { label: t('nav.benefits'), path: resolvePath('/hr/benefits') },
        { label: t('nav.documents'), path: resolvePath('/hr/documents') },
        { label: t('nav.payroll'), path: resolvePath('/hr/payroll') },
      ],
    };

    return map[variant] || map.governance;
  }, [resolvePath, t, variant]);

  const variantContent = ADMIN_VARIANT_CONTENT[variant] || ADMIN_VARIANT_CONTENT.governance;

  return (
    <div>
      <div className="hr-surface-card admin-owned-shell" style={{ maxWidth: 1280, margin: '0 auto 18px', padding: '18px 20px' }}>
        <div className="admin-shell-topline">{t('Admin Control Center')}</div>

        <div className="admin-shell-header">
          <div className="admin-shell-copy">
            <div className="admin-shell-title">{t(titleKey)}</div>
            <div className="admin-shell-subtitle">{t(subtitleKey)}</div>
            <div className="admin-shell-meta">
              <span>{t(variantContent.badge)}</span>
              <span>{t('Role Coverage')}: {summary.activeRoles}</span>
              <span>{t('Pending Actions')}: {summary.pendingActions}</span>
            </div>
          </div>

          <div className="admin-shell-actions">
            {quickLinks.map((item) => (
              <Btn key={item.path} size="sm" variant="ghost" onClick={() => navigate(item.path)}>
                {item.label}
              </Btn>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 18 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
            {metrics.map((card) => (
              <div key={card.label} className="admin-focus-card" style={{ background: '#fff' }}>
                <div className="admin-focus-label">{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-shell-focus">
          <div className="admin-focus-card">
            <div className="admin-focus-label">{t('Admin Priority')}</div>
            <div className="admin-focus-note">{t(variantContent.note)}</div>
          </div>
          <div className="admin-focus-card">
            <div className="admin-focus-label">{t('Decision Checklist')}</div>
            <div className="admin-chip-list">
              {variantContent.actions.map((action) => (
                <span key={action} className="admin-chip">{t(action)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AdminUsersPage() {
  return <AdminOwnedShell titleKey="nav.users" subtitleKey="Oversee users, access coverage, and operational readiness across the platform." variant="users"><HREmployeesPage /></AdminOwnedShell>;
}

export function AdminEmployeesPage() {
  return <AdminOwnedShell titleKey="nav.employees" subtitleKey="Oversee users, access coverage, and operational readiness across the platform." variant="users"><HREmployeesPage /></AdminOwnedShell>;
}

export function AdminApprovalsPage() {
  return <AdminOwnedShell titleKey="nav.approvals" subtitleKey="Open Service Queues" variant="approvals"><HRApprovalCenterPage /></AdminOwnedShell>;
}

export function AdminAttendancePage() {
  return <AdminOwnedShell titleKey="nav.attendance" subtitleKey="System Activity" variant="approvals"><HRAttendancePage /></AdminOwnedShell>;
}

export function AdminPayrollPage() {
  return <AdminOwnedShell titleKey="nav.payroll" subtitleKey="System Activity" variant="services"><HRPayrollPage /></AdminOwnedShell>;
}

export function AdminReviewsPage() {
  return <AdminOwnedShell titleKey="nav.reviews" subtitleKey="Access & Governance Board" variant="talent"><HRReviewsPage /></AdminOwnedShell>;
}

export function AdminSuccessionPage() {
  return <AdminOwnedShell titleKey="nav.succession" subtitleKey="Role Coverage" variant="talent"><HRSuccessionPage /></AdminOwnedShell>;
}

export function AdminOnboardingPage() {
  return <AdminOwnedShell titleKey="nav.onboarding" subtitleKey="System Activity" variant="services"><HROnboardingPage /></AdminOwnedShell>;
}

export function AdminShiftsPage() {
  return <AdminOwnedShell titleKey="nav.shifts" subtitleKey="System Activity" variant="services"><HRShiftsPage /></AdminOwnedShell>;
}

export function AdminPoliciesPage() {
  return <AdminOwnedShell titleKey="nav.policies" subtitleKey="Access & Governance Board" variant="governance"><HRPoliciesPage /></AdminOwnedShell>;
}

export function AdminBenefitsPage() {
  return <AdminOwnedShell titleKey="nav.benefits" subtitleKey="Open Service Queues" variant="services"><HRBenefitsPage /></AdminOwnedShell>;
}

export function AdminExpensesPage() {
  return <AdminOwnedShell titleKey="nav.expenses" subtitleKey="Open Service Queues" variant="services"><HRExpensesPage /></AdminOwnedShell>;
}

export function AdminDocumentsPage() {
  return <AdminOwnedShell titleKey="nav.documents" subtitleKey="Open Service Queues" variant="services"><HRDocumentsPage /></AdminOwnedShell>;
}

export function AdminTicketsPage() {
  return <AdminOwnedShell titleKey="nav.supportTickets" subtitleKey="System Activity" variant="services"><HRTicketsPage /></AdminOwnedShell>;
}

export function AdminTrainingPage() {
  return <AdminOwnedShell titleKey="nav.training" subtitleKey="Role Coverage" variant="talent"><HRTrainingPage /></AdminOwnedShell>;
}

export function AdminFormsPage() {
  return <AdminOwnedShell titleKey="nav.forms" subtitleKey="System Activity" variant="hiring"><HRFormsPage /></AdminOwnedShell>;
}

export function AdminSubmissionsPage() {
  return <AdminOwnedShell titleKey="nav.submissions" subtitleKey="System Activity" variant="hiring"><HRSubmissionPage /></AdminOwnedShell>;
}

export function AdminJobsPage() {
  return <AdminOwnedShell titleKey="nav.jobs" subtitleKey="Candidate Experience" variant="hiring"><HRJobPostingsPage /></AdminOwnedShell>;
}

export function AdminCVRankingPage() {
  return <AdminOwnedShell titleKey="nav.cvRanking" subtitleKey="Candidate Experience" variant="hiring"><HRCVRankingPage /></AdminOwnedShell>;
}

export function AdminTeamPage() {
  return <AdminOwnedShell titleKey="nav.teamHub" subtitleKey="Leadership Workspace" variant="leadership"><TeamGoalsPage /></AdminOwnedShell>;
}

export function AdminRecognitionPage() {
  return <AdminOwnedShell titleKey="nav.recognition" subtitleKey="Leadership Workspace" variant="leadership"><TeamRecognitionPage /></AdminOwnedShell>;
}

export function AdminProfilePage() {
  return <AdminOwnedShell titleKey="nav.profile" subtitleKey="Access & Governance Board" variant="governance"><EmployeeProfilePage /></AdminOwnedShell>;
}
