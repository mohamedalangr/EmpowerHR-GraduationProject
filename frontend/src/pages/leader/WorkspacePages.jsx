import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGoals, getMyTasks, getMyTickets, getTeamGoals, getTeamRecognition, getTeamTasks } from '../../api/index.js';
import { Badge, Btn, Spinner } from '../../components/shared/index.jsx';
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

const EMPTY_COACHING_BRIEF = {
  contributors: 0,
  coachNow: 0,
  deliveryRisk: 0,
  dueThisWeek: 0,
  recognitionThisMonth: 0,
  appreciationGaps: 0,
  queue: [],
  plays: [],
};

const getCoachingTone = (item = {}) => {
  if ((item.overdueItems || 0) > 0 || (item.blockedItems || 0) > 0 || (item.focusScore || 0) >= 6) return 'red';
  if ((item.highPriorityItems || 0) > 0 || (item.dueThisWeek || 0) > 0 || (item.focusScore || 0) >= 3) return 'orange';
  return 'green';
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

function LeaderCoachingHub() {
  const { t } = useLanguage();
  const { resolvePath } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(EMPTY_COACHING_BRIEF);

  useEffect(() => {
    let active = true;

    const loadBrief = async () => {
      setLoading(true);
      try {
        const [teamGoals, teamTasks, recognition] = await Promise.all([
          getTeamGoals().catch(() => []),
          getTeamTasks().catch(() => []),
          getTeamRecognition().catch(() => []),
        ]);

        if (!active) return;

        const todayKey = new Date().toISOString().slice(0, 10);
        const weekAheadKey = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const monthKey = new Date().toISOString().slice(0, 7);
        const memberMap = new Map();
        const recognitionMap = new Map();

        const register = (item, kind) => {
          const isDone = kind === 'goal' ? item?.status === 'Completed' : item?.status === 'Done';
          if (isDone) return;

          const key = item?.employeeID || item?.employeeName || `${kind}-${item?.title || 'item'}`;
          const row = memberMap.get(key) || {
            key,
            employeeID: item?.employeeID,
            employeeName: item?.employeeName || item?.employeeID || '—',
            team: item?.team,
            openGoals: 0,
            openTasks: 0,
            overdueItems: 0,
            blockedItems: 0,
            highPriorityItems: 0,
            dueThisWeek: 0,
          };

          if (kind === 'goal') row.openGoals += 1;
          else row.openTasks += 1;

          const dueDate = String(item?.dueDate || '');
          const isOverdue = Boolean(dueDate) && dueDate < todayKey;
          const isDueThisWeek = Boolean(dueDate) && dueDate >= todayKey && dueDate <= weekAheadKey;
          const isBlocked = kind === 'goal' ? item?.status === 'On Hold' : item?.status === 'Blocked';

          if (isOverdue) row.overdueItems += 1;
          if (isBlocked) row.blockedItems += 1;
          if (isDueThisWeek) row.dueThisWeek += 1;
          if (item?.priority === 'High') row.highPriorityItems += 1;

          memberMap.set(key, row);
        };

        (Array.isArray(teamGoals) ? teamGoals : []).forEach((goal) => register(goal, 'goal'));
        (Array.isArray(teamTasks) ? teamTasks : []).forEach((task) => register(task, 'task'));

        (Array.isArray(recognition) ? recognition : []).forEach((award) => {
          const key = award?.employeeID || award?.employeeName || String(award?.awardID || 'award');
          recognitionMap.set(key, (recognitionMap.get(key) || 0) + 1);
        });

        const queue = Array.from(memberMap.values())
          .map((row) => {
            const focusScore = (row.overdueItems * 3) + (row.blockedItems * 3) + (row.highPriorityItems * 2) + (row.dueThisWeek ? 1 : 0);
            return {
              ...row,
              focusScore,
              openItems: row.openGoals + row.openTasks,
              recognitionCount: recognitionMap.get(row.employeeID || row.employeeName || row.key) || 0,
              nextStep: row.blockedItems > 0
                ? t('Unblock work')
                : row.overdueItems > 0
                  ? t('Replan deadlines')
                  : row.highPriorityItems > 0
                    ? t('Review priorities')
                    : t('Coach this week'),
            };
          })
          .filter((row) => row.openItems > 0)
          .sort((a, b) => b.focusScore - a.focusScore || b.openItems - a.openItems)
          .slice(0, 5);

        const contributors = memberMap.size;
        const recognitionThisMonth = (Array.isArray(recognition) ? recognition : []).filter((award) => String(award?.recognitionDate || '').slice(0, 7) === monthKey).length;
        const appreciationGaps = Array.from(memberMap.values()).filter((row) => (recognitionMap.get(row.employeeID || row.employeeName || row.key) || 0) === 0).length;
        const dueThisWeek = Array.from(memberMap.values()).reduce((sum, row) => sum + row.dueThisWeek, 0);
        const deliveryRisk = Array.from(memberMap.values()).reduce((sum, row) => sum + row.overdueItems + row.blockedItems, 0);
        const coachNow = queue.filter((row) => row.focusScore >= 4).length;

        const plays = [];
        if (deliveryRisk > 0) {
          plays.push({
            title: t('Clear delivery blockers first'),
            note: t('Start with overdue or blocked work so the team can regain momentum quickly.'),
          });
        }
        if (dueThisWeek > 0) {
          plays.push({
            title: t('Prepare this week\'s check-ins'),
            note: `${dueThisWeek} ${t('items are due soon, so short coaching check-ins can prevent last-minute slippage.')}`,
          });
        }
        if (appreciationGaps > 0) {
          plays.push({
            title: t('Spot the quiet contributors'),
            note: t('Use recognition to reinforce steady performance and keep engagement visible across the team.'),
          });
        }
        if (plays.length === 0) {
          plays.push({
            title: t('Maintain the current team rhythm'),
            note: t('No major delivery or recognition pressure is visible right now. Keep the same coaching cadence.'),
          });
        }

        setBrief({
          contributors,
          coachNow,
          deliveryRisk,
          dueThisWeek,
          recognitionThisMonth,
          appreciationGaps,
          queue,
          plays: plays.slice(0, 4),
        });
      } catch {
        if (active) setBrief(EMPTY_COACHING_BRIEF);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBrief();
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <div className="hr-surface-card" style={{ maxWidth: 1280, margin: '0 auto 18px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Leader Coaching Brief')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{t('Turn delivery signals into quick coaching, recognition, and workload decisions for the week.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/leader/team'))}>{t('nav.teamHub')}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/leader/recognition'))}>{t('nav.recognition')}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => navigate(resolvePath('/employee/tasks'))}>{t('nav.tasks')}</Btn>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 18 }}><Spinner /></div>
      ) : (
        <>
          <div className="workspace-journey-strip" style={{ marginBottom: 16 }}>
            {[
              { label: t('Active Contributors'), value: brief.contributors, note: t('Team members currently carrying open goals or tasks.'), accent: '#111827' },
              { label: t('Coach This Week'), value: brief.coachNow, note: t('People needing an immediate check-in or unblock discussion.'), accent: brief.coachNow ? '#E8321A' : '#22C55E' },
              { label: t('Delivery Risk'), value: brief.deliveryRisk, note: t('Blocked and overdue work signals now visible to the leader.'), accent: brief.deliveryRisk ? '#F59E0B' : '#22C55E' },
              { label: t('Recognition This Month'), value: brief.recognitionThisMonth, note: t('Awards and appreciation moments already shared this month.'), accent: '#7C3AED' },
            ].map((card) => (
              <div key={card.label} className="workspace-journey-card">
                <div className="workspace-journey-title">{card.label}</div>
                <div className="workspace-journey-value" style={{ color: card.accent }}>{card.value}</div>
                <div className="workspace-journey-note">{card.note}</div>
              </div>
            ))}
          </div>

          <div className="hr-panel-grid" style={{ gridTemplateColumns: '1.05fr .95fr' }}>
            <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Priority Coaching Queue')}</div>
              {brief.queue.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('No urgent coaching escalations are visible right now.')}</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {brief.queue.map((item) => (
                    <div key={item.key} className="workspace-action-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13.5 }}>{item.employeeName}</strong>
                        <Badge label={item.nextStep} color={getCoachingTone(item)} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 6 }}>{item.team || t('Team')} • {t('Open items')}: {item.openItems}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.overdueItems ? <Badge label={`${t('Overdue')} ${item.overdueItems}`} color="red" /> : null}
                        {item.blockedItems ? <Badge label={`${t('Blocked')} ${item.blockedItems}`} color="orange" /> : null}
                        {item.highPriorityItems ? <Badge label={`${t('High priority')} ${item.highPriorityItems}`} color="accent" /> : null}
                        {item.recognitionCount ? <Badge label={`${t('Recognition')} ${item.recognitionCount}`} color="green" /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hr-surface-card" style={{ padding: 16, background: '#FCFCFD' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Leader Playbook')}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {brief.plays.map((play) => (
                  <div key={play.title} className="workspace-focus-card" style={{ background: '#fff' }}>
                    <div className="workspace-focus-label">{play.title}</div>
                    <div className="workspace-focus-note">{play.note}</div>
                  </div>
                ))}
                <div className="workspace-focus-card" style={{ background: '#fff' }}>
                  <div className="workspace-focus-label">{t('Recognition gap')}</div>
                  <div className="workspace-focus-note">{brief.appreciationGaps ? `${brief.appreciationGaps} ${t('contributors have open work without recognition visibility yet.')}` : t('Recognition coverage looks healthy across the active team workload.')}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function LeaderDashboardPage() {
  return (
    <LeaderOwnedShell titleKey="nav.dashboard" variant="overview">
      <LeaderCoachingHub />
      <EmployeeDashboardPage />
    </LeaderOwnedShell>
  );
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
