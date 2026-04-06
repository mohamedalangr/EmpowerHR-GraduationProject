import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGoals, getMyTasks, getMyTickets, getTeamGoals, getTeamRecognition, getTeamTasks } from '../../api/index.js';
import { Btn, Spinner } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { EmployeeAttendancePage } from '../employee/AttendancePage';
import { EmployeeBenefitsPage } from '../employee/BenefitsPage';
import { EmployeeCareerPathPage } from '../employee/CareerPathPage';
import { EmployeeDashboardPage } from '../employee/DashboardPage';
import { EmployeeDocumentsPage } from '../employee/DocumentsPage';
import { EmployeeExpensesPage } from '../employee/ExpensesPage';
import { EmployeeFeedbackPage } from '../employee/FeedbackPage';
import { EmployeeGoalsPage } from '../employee/GoalsPage';
import { EmployeeOnboardingPage } from '../employee/OnboardingPage';
import { EmployeePayrollPage } from '../employee/PayrollPage';
import { EmployeeProfilePage } from '../employee/EmployeeProfilePage';
import { EmployeeRecognitionPage } from '../employee/RecognitionPage';
import { EmployeeReviewsPage } from '../employee/ReviewsPage';
import { EmployeeShiftsPage } from '../employee/ShiftsPage';
import { EmployeeTasksPage } from '../employee/TasksPage';
import { EmployeeTicketsPage } from '../employee/TicketsPage';
import { EmployeeTrainingPage } from '../employee/TrainingPage';
import { EmployeePoliciesPage } from '../employee/PoliciesPage';

const EMPTY_SUMMARY = {
  myOpenGoals: 0,
  myOpenTasks: 0,
  myOpenTickets: 0,
  teamOpenGoals: 0,
  teamOpenTasks: 0,
  teamRecognition: 0,
};

const LEADER_VARIANT_CONTENT = {
  overview: {
    badge: 'Leadership Execution',
    note: 'Balance your own priorities while keeping team delivery visible and moving.',
    actions: ['Coach the team', 'Clear blockers', 'Track execution'],
  },
  team: {
    badge: 'Team Oversight',
    note: 'Keep goals, tasks, and recognition momentum aligned across the team.',
    actions: ['Review team load', 'Follow up on recognition', 'Check review readiness'],
  },
  profile: {
    badge: 'Leader Self-Service',
    note: 'Stay close to your profile, requests, training, and support responsibilities.',
    actions: ['Review profile updates', 'Watch support tickets', 'Keep growth on track'],
  },
};

function LeaderOwnedShell({ titleKey, variant = 'overview', children }) {
  const { t } = useLanguage();
  const { user, resolvePath } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setLoading(true);
      try {
        const [myGoals, myTasks, myTickets, teamGoals, teamTasks, recognition] = await Promise.all([
          getMyGoals(user?.employee_id).catch(() => []),
          getMyTasks(user?.employee_id).catch(() => []),
          getMyTickets(user?.employee_id).catch(() => []),
          getTeamGoals().catch(() => []),
          getTeamTasks().catch(() => []),
          getTeamRecognition().catch(() => []),
        ]);

        if (!active) return;

        setSummary({
          myOpenGoals: (Array.isArray(myGoals) ? myGoals : []).filter((item) => item?.status !== 'Completed').length,
          myOpenTasks: (Array.isArray(myTasks) ? myTasks : []).filter((item) => item?.status !== 'Done').length,
          myOpenTickets: (Array.isArray(myTickets) ? myTickets : []).filter((item) => !['Resolved', 'Closed'].includes(item?.status)).length,
          teamOpenGoals: (Array.isArray(teamGoals) ? teamGoals : []).filter((item) => item?.status !== 'Completed').length,
          teamOpenTasks: (Array.isArray(teamTasks) ? teamTasks : []).filter((item) => item?.status !== 'Done').length,
          teamRecognition: Array.isArray(recognition) ? recognition.length : 0,
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
  }, [user?.employee_id]);

  const metrics = useMemo(() => {
    const map = {
      overview: [
        { label: t('My Goals'), value: summary.myOpenGoals, accent: '#2563EB' },
        { label: t('My Tasks'), value: summary.myOpenTasks, accent: '#7C3AED' },
        { label: t('Open tickets'), value: summary.myOpenTickets, accent: '#E8321A' },
      ],
      team: [
        { label: t('Total Goals'), value: summary.teamOpenGoals, accent: '#2563EB' },
        { label: t('Open Tasks'), value: summary.teamOpenTasks, accent: '#7C3AED' },
        { label: t('Recognition Points'), value: summary.teamRecognition, accent: '#E8321A' },
      ],
      profile: [
        { label: t('My Goals'), value: summary.myOpenGoals, accent: '#2563EB' },
        { label: t('My Tasks'), value: summary.myOpenTasks, accent: '#7C3AED' },
        { label: t('Open tickets'), value: summary.myOpenTickets, accent: '#E8321A' },
      ],
    };

    return map[variant] || map.overview;
  }, [summary, t, variant]);

  const quickLinks = useMemo(() => {
    const map = {
      overview: [
        { label: t('nav.teamHub'), path: resolvePath('/leader/team') },
        { label: t('nav.tasks'), path: resolvePath('/employee/tasks') },
        { label: t('nav.goals'), path: resolvePath('/employee/goals') },
      ],
      team: [
        { label: t('nav.teamHub'), path: resolvePath('/leader/team') },
        { label: t('nav.recognition'), path: resolvePath('/leader/recognition') },
        { label: t('nav.reviews'), path: resolvePath('/employee/reviews') },
      ],
      profile: [
        { label: t('nav.profile'), path: resolvePath('/employee/profile') },
        { label: t('nav.supportTickets'), path: resolvePath('/employee/tickets') },
        { label: t('nav.training'), path: resolvePath('/employee/training') },
      ],
    };

    return map[variant] || map.overview;
  }, [resolvePath, t, variant]);

  const variantContent = LEADER_VARIANT_CONTENT[variant] || LEADER_VARIANT_CONTENT.overview;

  return (
    <div>
      <div className="hr-surface-card workspace-shell-card workspace-shell-leader" style={{ maxWidth: 1280, margin: '0 auto 18px', padding: '18px 20px' }}>
        <div className="workspace-shell-topline">{t('Leadership Workspace')}</div>
        <div className="workspace-shell-header">
          <div className="workspace-shell-copy">
            <div className="workspace-shell-title">{t(titleKey)}</div>
            <div className="workspace-shell-subtitle">{t('Team coordination, approvals, and workload follow-up.')}</div>
            <div className="workspace-shell-meta">
              <span>{t(variantContent.badge)}</span>
              <span>{t('My Goals')}: {summary.myOpenGoals}</span>
              <span>{t('Open Tasks')}: {summary.teamOpenTasks}</span>
            </div>
          </div>
          <div className="workspace-shell-actions">
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
              <div key={card.label} className="workspace-focus-card" style={{ background: '#fff' }}>
                <div className="workspace-focus-label">{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="workspace-shell-focus">
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Leadership Focus')}</div>
            <div className="workspace-focus-note">{t(variantContent.note)}</div>
          </div>
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('Execution Checklist')}</div>
            <div className="workspace-chip-list">
              {variantContent.actions.map((action) => (
                <span key={action} className="workspace-chip">{t(action)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function LeaderDashboardPage() {
  return <LeaderOwnedShell titleKey="nav.dashboard" variant="overview"><EmployeeDashboardPage /></LeaderOwnedShell>;
}

export function LeaderAttendancePage() {
  return <LeaderOwnedShell titleKey="nav.attendance" variant="overview"><EmployeeAttendancePage /></LeaderOwnedShell>;
}

export function LeaderPayrollPage() {
  return <LeaderOwnedShell titleKey="nav.payroll" variant="overview"><EmployeePayrollPage /></LeaderOwnedShell>;
}

export function LeaderReviewsPage() {
  return <LeaderOwnedShell titleKey="nav.reviews" variant="team"><EmployeeReviewsPage /></LeaderOwnedShell>;
}

export function LeaderCareerPathPage() {
  return <LeaderOwnedShell titleKey="nav.careerPath" variant="overview"><EmployeeCareerPathPage /></LeaderOwnedShell>;
}

export function LeaderOnboardingPage() {
  return <LeaderOwnedShell titleKey="nav.onboarding" variant="overview"><EmployeeOnboardingPage /></LeaderOwnedShell>;
}

export function LeaderShiftsPage() {
  return <LeaderOwnedShell titleKey="nav.shifts" variant="overview"><EmployeeShiftsPage /></LeaderOwnedShell>;
}

export function LeaderGoalsPage() {
  return <LeaderOwnedShell titleKey="nav.goals" variant="team"><EmployeeGoalsPage /></LeaderOwnedShell>;
}

export function LeaderTasksPage() {
  return <LeaderOwnedShell titleKey="nav.tasks" variant="team"><EmployeeTasksPage /></LeaderOwnedShell>;
}

export function LeaderTrainingPage() {
  return <LeaderOwnedShell titleKey="nav.training" variant="profile"><EmployeeTrainingPage /></LeaderOwnedShell>;
}

export function LeaderPoliciesPage() {
  return <LeaderOwnedShell titleKey="nav.policies" variant="profile"><EmployeePoliciesPage /></LeaderOwnedShell>;
}

export function LeaderMyRecognitionPage() {
  return <LeaderOwnedShell titleKey="nav.recognition" variant="team"><EmployeeRecognitionPage /></LeaderOwnedShell>;
}

export function LeaderBenefitsPage() {
  return <LeaderOwnedShell titleKey="nav.benefits" variant="profile"><EmployeeBenefitsPage /></LeaderOwnedShell>;
}

export function LeaderExpensesPage() {
  return <LeaderOwnedShell titleKey="nav.expenses" variant="profile"><EmployeeExpensesPage /></LeaderOwnedShell>;
}

export function LeaderDocumentsPage() {
  return <LeaderOwnedShell titleKey="nav.documents" variant="profile"><EmployeeDocumentsPage /></LeaderOwnedShell>;
}

export function LeaderTicketsPage() {
  return <LeaderOwnedShell titleKey="nav.supportTickets" variant="profile"><EmployeeTicketsPage /></LeaderOwnedShell>;
}

export function LeaderFeedbackPage() {
  return <LeaderOwnedShell titleKey="nav.feedback" variant="profile"><EmployeeFeedbackPage /></LeaderOwnedShell>;
}

export function LeaderProfilePage() {
  return <LeaderOwnedShell titleKey="nav.profile" variant="profile"><EmployeeProfilePage /></LeaderOwnedShell>;
}
