import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeamGoals, getTeamRecognition, getTeamTasks, hrGetEmployees, hrGetLeaveRequests, hrGetTickets } from '../../api/index.js';
import { Btn, Spinner } from '../../components/shared/index.jsx';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { EmployeeProfilePage } from '../employee/EmployeeProfilePage';
import { TeamGoalsPage } from '../leader/TeamPage';
import { TeamRecognitionPage } from '../leader/RecognitionPage';

const EMPTY_SUMMARY = {
  followUpEmployees: 0,
  pendingLeaves: 0,
  openTickets: 0,
  activeGoals: 0,
  activeTasks: 0,
  recognitionAwards: 0,
  recognizedEmployees: 0,
};

const HR_VARIANT_CONTENT = {
  team: {
    badge: 'People Operations',
    note: 'Keep employee follow-up, tasks, and service queues moving with clear ownership.',
    actions: ['Review employees', 'Watch approvals', 'Check review readiness'],
  },
  recognition: {
    badge: 'Engagement Coverage',
    note: 'Track appreciation activity and watch for people signals needing a follow-up.',
    actions: ['Review recognition pulse', 'Check team activity', 'Monitor support load'],
  },
  profile: {
    badge: 'Service Delivery',
    note: 'Stay close to workforce readiness, leave pressure, and employee service signals.',
    actions: ['Monitor employee records', 'Keep leave queue clear', 'Track support cases'],
  },
};

function HROwnedShell({ titleKey, variant = 'team', children }) {
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
        const [employees, leaveRequests, tickets, goals, tasks, awards] = await Promise.all([
          hrGetEmployees().catch(() => []),
          hrGetLeaveRequests().catch(() => []),
          hrGetTickets().catch(() => []),
          getTeamGoals().catch(() => []),
          getTeamTasks().catch(() => []),
          getTeamRecognition().catch(() => []),
        ]);

        if (!active) return;

        const followUpEmployees = (Array.isArray(employees) ? employees : []).filter((employee) => !employee?.department || !employee?.jobTitle || !employee?.team).length;
        const pendingLeaves = (Array.isArray(leaveRequests) ? leaveRequests : []).filter((item) => item?.status === 'Pending').length;
        const openTickets = (Array.isArray(tickets) ? tickets : []).filter((item) => !['Resolved', 'Closed'].includes(item?.status)).length;
        const activeGoals = (Array.isArray(goals) ? goals : []).filter((item) => item?.status !== 'Completed').length;
        const activeTasks = (Array.isArray(tasks) ? tasks : []).filter((item) => item?.status !== 'Done').length;
        const recognitionAwards = Array.isArray(awards) ? awards.length : 0;
        const recognizedEmployees = new Set((Array.isArray(awards) ? awards : []).map((item) => item?.employeeID).filter(Boolean)).size;

        setSummary({
          followUpEmployees,
          pendingLeaves,
          openTickets,
          activeGoals,
          activeTasks,
          recognitionAwards,
          recognizedEmployees,
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
      team: [
        { label: t('Follow-up Employees'), value: summary.followUpEmployees, accent: '#E8321A' },
        { label: t('Open Tasks'), value: summary.activeTasks, accent: '#7C3AED' },
        { label: t('Active Goals'), value: summary.activeGoals, accent: '#2563EB' },
      ],
      recognition: [
        { label: t('Awards Shared'), value: summary.recognitionAwards, accent: '#111827' },
        { label: t('Recognized Teammates'), value: summary.recognizedEmployees, accent: '#E8321A' },
        { label: t('Open tickets'), value: summary.openTickets, accent: '#2563EB' },
      ],
      profile: [
        { label: t('Pending Leave Requests'), value: summary.pendingLeaves, accent: '#E8321A' },
        { label: t('Follow-up Employees'), value: summary.followUpEmployees, accent: '#2563EB' },
        { label: t('Support Tickets'), value: summary.openTickets, accent: '#7C3AED' },
      ],
    };

    return map[variant] || map.team;
  }, [summary, t, variant]);

  const quickLinks = useMemo(() => {
    const map = {
      team: [
        { label: t('nav.employees'), path: resolvePath('/hr/employees') },
        { label: t('nav.approvals'), path: resolvePath('/hr/approvals') },
        { label: t('nav.reviews'), path: resolvePath('/hr/reviews') },
      ],
      recognition: [
        { label: t('nav.recognition'), path: resolvePath('/leader/recognition') },
        { label: t('nav.teamHub'), path: resolvePath('/leader/team') },
        { label: t('nav.supportTickets'), path: resolvePath('/hr/tickets') },
      ],
      profile: [
        { label: t('nav.profile'), path: resolvePath('/employee/profile') },
        { label: t('nav.dashboard'), path: resolvePath('/hr/dashboard') },
        { label: t('nav.employees'), path: resolvePath('/hr/employees') },
      ],
    };

    return map[variant] || map.team;
  }, [resolvePath, t, variant]);

  const variantContent = HR_VARIANT_CONTENT[variant] || HR_VARIANT_CONTENT.team;

  return (
    <div>
      <div className="hr-surface-card workspace-shell-card workspace-shell-hr" style={{ maxWidth: 1280, margin: '0 auto 18px', padding: '18px 20px' }}>
        <div className="workspace-shell-topline">{t('HR Operations')}</div>
        <div className="workspace-shell-header">
          <div className="workspace-shell-copy">
            <div className="workspace-shell-title">{t(titleKey)}</div>
            <div className="workspace-shell-subtitle">{t('People operations, compliance, and service delivery.')}</div>
            <div className="workspace-shell-meta">
              <span>{t(variantContent.badge)}</span>
              <span>{t('Follow-up Employees')}: {summary.followUpEmployees}</span>
              <span>{t('Open tickets')}: {summary.openTickets}</span>
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
            <div className="workspace-focus-label">{t('Operations Focus')}</div>
            <div className="workspace-focus-note">{t(variantContent.note)}</div>
          </div>
          <div className="workspace-focus-card">
            <div className="workspace-focus-label">{t('HR Checklist')}</div>
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

export function HRTeamPage() {
  return <HROwnedShell titleKey="nav.teamHub" variant="team"><TeamGoalsPage /></HROwnedShell>;
}

export function HRRecognitionPage() {
  return <HROwnedShell titleKey="nav.recognition" variant="recognition"><TeamRecognitionPage /></HROwnedShell>;
}

export function HRProfilePage() {
  return <HROwnedShell titleKey="nav.profile" variant="profile"><EmployeeProfilePage /></HROwnedShell>;
}
