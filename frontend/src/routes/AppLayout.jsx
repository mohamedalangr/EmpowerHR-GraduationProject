import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/shared/Navbar';
import { Input, Modal } from '../components/shared/index.jsx';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const ROUTE_LABELS = {
  '/candidate/dashboard': 'nav.jobs',
  '/candidate/applications': 'nav.applications',
  '/employee/dashboard': 'nav.dashboard',
  '/employee/attendance': 'nav.attendance',
  '/employee/payroll': 'nav.payroll',
  '/employee/reviews': 'nav.reviews',
  '/employee/career-path': 'nav.careerPath',
  '/employee/onboarding': 'nav.onboarding',
  '/employee/shifts': 'nav.shifts',
  '/employee/goals': 'nav.goals',
  '/employee/tasks': 'nav.tasks',
  '/employee/training': 'nav.training',
  '/employee/policies': 'nav.policies',
  '/employee/recognition': 'nav.recognition',
  '/employee/benefits': 'nav.benefits',
  '/employee/expenses': 'nav.expenses',
  '/employee/documents': 'nav.documents',
  '/employee/tickets': 'nav.supportTickets',
  '/employee/feedback': 'nav.feedback',
  '/employee/profile': 'nav.profile',
  '/leader/dashboard': 'nav.dashboard',
  '/leader/attendance': 'nav.attendance',
  '/leader/payroll': 'nav.payroll',
  '/leader/reviews': 'nav.reviews',
  '/leader/career-path': 'nav.careerPath',
  '/leader/onboarding': 'nav.onboarding',
  '/leader/shifts': 'nav.shifts',
  '/leader/goals': 'nav.goals',
  '/leader/tasks': 'nav.tasks',
  '/leader/training': 'nav.training',
  '/leader/policies': 'nav.policies',
  '/leader/my-recognition': 'nav.recognition',
  '/leader/benefits': 'nav.benefits',
  '/leader/expenses': 'nav.expenses',
  '/leader/documents': 'nav.documents',
  '/leader/tickets': 'nav.supportTickets',
  '/leader/feedback': 'nav.feedback',
  '/leader/profile': 'nav.profile',
  '/leader/team': 'nav.teamHub',
  '/leader/recognition': 'nav.recognition',
  '/hr/dashboard': 'nav.dashboard',
  '/hr/approvals': 'nav.approvals',
  '/hr/employees': 'nav.employees',
  '/hr/attendance': 'nav.attendance',
  '/hr/payroll': 'nav.payroll',
  '/hr/reviews': 'nav.reviews',
  '/hr/succession': 'nav.succession',
  '/hr/onboarding': 'nav.onboarding',
  '/hr/shifts': 'nav.shifts',
  '/hr/policies': 'nav.policies',
  '/hr/benefits': 'nav.benefits',
  '/hr/expenses': 'nav.expenses',
  '/hr/documents': 'nav.documents',
  '/hr/tickets': 'nav.supportTickets',
  '/hr/training': 'nav.training',
  '/hr/forms': 'nav.forms',
  '/hr/submissions': 'nav.submissions',
  '/hr/jobs': 'nav.jobs',
  '/hr/cv-ranking': 'nav.cvRanking',
  '/hr/team': 'nav.teamHub',
  '/hr/recognition': 'nav.recognition',
  '/hr/profile': 'nav.profile',
  '/admin/dashboard': 'nav.dashboard',
  '/admin/users': 'nav.users',
  '/admin/employees': 'nav.employees',
  '/admin/approvals': 'nav.approvals',
  '/admin/attendance': 'nav.attendance',
  '/admin/payroll': 'nav.payroll',
  '/admin/reviews': 'nav.reviews',
  '/admin/succession': 'nav.succession',
  '/admin/onboarding': 'nav.onboarding',
  '/admin/shifts': 'nav.shifts',
  '/admin/policies': 'nav.policies',
  '/admin/benefits': 'nav.benefits',
  '/admin/expenses': 'nav.expenses',
  '/admin/documents': 'nav.documents',
  '/admin/tickets': 'nav.supportTickets',
  '/admin/training': 'nav.training',
  '/admin/forms': 'nav.forms',
  '/admin/submissions': 'nav.submissions',
  '/admin/jobs': 'nav.jobs',
  '/admin/cv-ranking': 'nav.cvRanking',
  '/admin/team': 'nav.teamHub',
  '/admin/recognition': 'nav.recognition',
  '/admin/profile': 'nav.profile',
};

const SECTION_LABELS = {
  candidate: 'role.Candidate',
  employee: 'role.TeamMember',
  leader: 'role.TeamLeader',
  hr: 'role.HRManager',
  admin: 'role.Admin',
};

const FALLBACK_SEGMENT_LABELS = {
  dashboard: 'nav.dashboard',
  applications: 'nav.applications',
  attendance: 'nav.attendance',
  payroll: 'nav.payroll',
  reviews: 'nav.reviews',
  'career-path': 'nav.careerPath',
  onboarding: 'nav.onboarding',
  shifts: 'nav.shifts',
  goals: 'nav.goals',
  tasks: 'nav.tasks',
  training: 'nav.training',
  policies: 'nav.policies',
  recognition: 'nav.recognition',
  'my-recognition': 'nav.recognition',
  benefits: 'nav.benefits',
  expenses: 'nav.expenses',
  documents: 'nav.documents',
  tickets: 'nav.supportTickets',
  feedback: 'nav.feedback',
  profile: 'nav.profile',
  team: 'nav.teamHub',
  approvals: 'nav.approvals',
  employees: 'nav.employees',
  succession: 'nav.succession',
  forms: 'nav.forms',
  submissions: 'nav.submissions',
  jobs: 'nav.jobs',
  'cv-ranking': 'nav.cvRanking',
  users: 'nav.users',
};

const ROLE_ROUTE_PREFIXES = {
  Candidate: ['/candidate/'],
  TeamMember: ['/employee/'],
  TeamLeader: ['/leader/'],
  HRManager: ['/hr/'],
  Admin: ['/admin/'],
};

const ROLE_WORKSPACE_COPY = {
  Candidate: {
    eyebrow: 'Candidate journey',
    summary: 'Discover open roles, follow your progress, and keep every next step clear and inviting.',
  },
  TeamMember: {
    eyebrow: 'Employee workspace',
    summary: 'Keep daily work, requests, and growth tools organized in one focused place.',
  },
  TeamLeader: {
    eyebrow: 'Leadership hub',
    summary: 'Guide team priorities, coach progress, and move faster between the actions that matter most.',
  },
  HRManager: {
    eyebrow: 'HR operations',
    summary: 'Review people workflows with cleaner sections, faster navigation, and better visual clarity.',
  },
  Admin: {
    eyebrow: 'Admin control center',
    summary: 'Oversee governance, approvals, and cross-team activity from a sharper command-style workspace.',
  },
};

const FOCUS_MODE_STORAGE_KEY = 'empowerhr-focus-mode';
const COMPACT_MODE_STORAGE_KEY = 'empowerhr-compact-mode';

const humanizeSegment = (segment = '') => segment
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getPageLabelFromPath = (path, t) => {
  const exactKey = ROUTE_LABELS[path];
  if (exactKey) return t(exactKey);

  const parts = path.split('/').filter(Boolean);
  const lastSegment = parts[parts.length - 1] || 'dashboard';
  return t(FALLBACK_SEGMENT_LABELS[lastSegment] || humanizeSegment(lastSegment));
};

const getSectionLabelFromPath = (path, t) => {
  const parts = path.split('/').filter(Boolean);
  const firstSegment = parts[0] || 'employee';
  return t(SECTION_LABELS[firstSegment] || humanizeSegment(firstSegment));
};

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, ROLE_HOME, canAccessPath } = useAuth();
  const { t, language } = useLanguage();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === 'true';
  });
  const [isCompactMode, setIsCompactMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COMPACT_MODE_STORAGE_KEY) === 'true';
  });

  const currentPageLabel = useMemo(
    () => getPageLabelFromPath(location.pathname, t),
    [location.pathname, t],
  );

  const sectionLabel = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const firstSegment = parts[0] || user?.role?.toLowerCase() || 'employee';
    return t(SECTION_LABELS[firstSegment] || humanizeSegment(firstSegment));
  }, [location.pathname, t, user?.role]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date()), [language]);

  const shortcutLabel = useMemo(() => {
    if (typeof window !== 'undefined' && /Mac|iPhone|iPad/i.test(window.navigator.platform || '')) {
      return '⌘ K';
    }
    return 'Ctrl K';
  }, []);

  const workspaceCopy = useMemo(
    () => ROLE_WORKSPACE_COPY[user?.role] || ROLE_WORKSPACE_COPY.TeamMember,
    [user?.role],
  );

  const workspaceHighlights = useMemo(() => ([
    user?.role ? t(`role.${user.role}`) : sectionLabel,
    sectionLabel,
    isCompactMode ? t('layout.compactView') : t('layout.comfortView'),
    isFocusMode ? t('layout.focusMode') : t('layout.quickActions'),
  ]), [isCompactMode, isFocusMode, sectionLabel, t, user?.role]);

  const handleOpenHome = () => {
    if (!user?.role) return;
    navigate(ROLE_HOME[user.role] || '/login');
  };

  const quickActions = useMemo(() => {
    const homePath = user?.role ? (ROLE_HOME[user.role] || '/login') : '/login';
    const prefixes = ROLE_ROUTE_PREFIXES[user?.role] || [];
    const routeItems = Object.keys(ROUTE_LABELS)
      .filter((path) => prefixes.some((prefix) => path.startsWith(prefix)) && path !== homePath && canAccessPath(path))
      .map((path) => ({
        id: path,
        title: getPageLabelFromPath(path, t),
        meta: `${getSectionLabelFromPath(path, t)} · ${path}`,
        onSelect: () => navigate(path),
        active: path === location.pathname,
      }));

    const baseItems = [
      {
        id: 'quick-back',
        title: t('layout.back'),
        meta: t('layout.quickBackHint'),
        onSelect: () => navigate(-1),
        active: false,
      },
      {
        id: 'quick-home',
        title: t('layout.homeAction'),
        meta: t('layout.quickHomeHint'),
        onSelect: () => {
          if (user?.role) navigate(ROLE_HOME[user.role] || '/login');
        },
        active: homePath === location.pathname,
      },
      {
        id: 'quick-density',
        title: isCompactMode ? t('layout.comfortView') : t('layout.compactView'),
        meta: t('layout.quickDensityHint'),
        onSelect: () => setIsCompactMode((current) => !current),
        active: isCompactMode,
      },
    ];

    if (user?.role) {
      routeItems.unshift({
        id: `${homePath}-primary`,
        title: getPageLabelFromPath(homePath, t),
        meta: `${sectionLabel} · ${homePath}`,
        onSelect: () => navigate(homePath),
        active: homePath === location.pathname,
      });
    }

    const signOutItem = user
      ? [{
        id: 'quick-signout',
        title: t('common.signOut'),
        meta: t('layout.quickSignOutHint'),
        onSelect: async () => {
          await logout();
          navigate('/login');
        },
        tone: 'danger',
        active: false,
      }]
      : [];

    return [...baseItems, ...routeItems, ...signOutItem];
  }, [ROLE_HOME, canAccessPath, isCompactMode, location.pathname, logout, navigate, sectionLabel, t, user?.role]);

  const filteredQuickActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return quickActions;

    return quickActions.filter((action) => `${action.title} ${action.meta}`.toLowerCase().includes(query));
  }, [commandQuery, quickActions]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      setIsCommandOpen((current) => !current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isCommandOpen) setCommandQuery('');
  }, [isCommandOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(isFocusMode));
  }, [isFocusMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(isCompactMode));
  }, [isCompactMode]);

  const handleSelectAction = async (action) => {
    setIsCommandOpen(false);
    setCommandQuery('');
    await Promise.resolve(action.onSelect());
  };

  return (
    <div className={`app-shell${isFocusMode ? ' is-sidebar-hidden' : ''}${isCompactMode ? ' is-compact' : ''}`}>
      {!isFocusMode && <Navbar />}
      <main className="app-main hr-main-area">
        <div className="app-topbar">
          <div className="app-topbar-copy">
            <div className="app-topbar-breadcrumb">
              {t('layout.home')} / {sectionLabel} / {currentPageLabel}
            </div>
            <div className="app-topbar-eyebrow">{workspaceCopy.eyebrow}</div>
            <h1 className="app-topbar-title">{currentPageLabel}</h1>
            <p className="app-topbar-subtitle">{workspaceCopy.summary}</p>
            <div className="app-topbar-pills">
              {workspaceHighlights.map((item, index) => (
                <span key={`${item}-${index}`} className="app-topbar-pill">{item}</span>
              ))}
            </div>
          </div>

          <div className="app-topbar-actions">
            <span className="app-topbar-date">{dateLabel}</span>
            <button type="button" className="app-topbar-btn" onClick={() => setIsFocusMode((current) => !current)}>
              {isFocusMode ? t('layout.showSidebar') : t('layout.focusMode')}
            </button>
            <button type="button" className="app-topbar-btn" onClick={() => setIsCompactMode((current) => !current)}>
              {isCompactMode ? t('layout.comfortView') : t('layout.compactView')}
            </button>
            <button type="button" className="app-topbar-btn accent" onClick={() => setIsCommandOpen(true)}>
              <span>{t('layout.quickActions')}</span>
              <span className="app-topbar-shortcut">{shortcutLabel}</span>
            </button>
            <button type="button" className="app-topbar-btn" onClick={() => navigate(-1)}>
              {t('layout.back')}
            </button>
            <button type="button" className="app-topbar-btn primary" onClick={handleOpenHome}>
              {t('layout.homeAction')}
            </button>
          </div>
        </div>

        <Outlet />

        <Modal
          open={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          title={t('layout.quickActions')}
          maxWidth={720}
        >
          <div className="app-command-palette">
            <p className="app-command-hint">{t('layout.quickHint')}</p>
            <Input
              autoFocus
              placeholder={t('layout.quickPlaceholder')}
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
            />

            <div className="app-command-list">
              {filteredQuickActions.length ? filteredQuickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`app-command-item${action.active ? ' is-active' : ''}${action.tone === 'danger' ? ' is-danger' : ''}`}
                  onClick={() => handleSelectAction(action)}
                >
                  <div>
                    <strong>{action.title}</strong>
                    <div className="app-command-meta">{action.meta}</div>
                  </div>
                  <span className="app-command-open">
                    {action.active ? t('layout.currentPage') : t('layout.quickOpen')}
                  </span>
                </button>
              )) : (
                <div className="app-command-empty">{t('layout.quickEmpty')}</div>
              )}
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
