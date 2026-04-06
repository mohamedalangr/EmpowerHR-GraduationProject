import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser, logoutUser } from "../api/index";

const AuthContext = createContext(null);

const ROLE_HOME = {
  Candidate: "/candidate/dashboard",
  TeamMember: "/employee/dashboard",
  TeamLeader: "/leader/dashboard",
  HRManager: "/hr/dashboard",
  Admin: "/admin/dashboard",
};

const ROLE_PATH_ALIASES = {
  TeamLeader: {
    '/employee/dashboard': '/leader/dashboard',
    '/employee/attendance': '/leader/attendance',
    '/employee/payroll': '/leader/payroll',
    '/employee/reviews': '/leader/reviews',
    '/employee/career-path': '/leader/career-path',
    '/employee/onboarding': '/leader/onboarding',
    '/employee/shifts': '/leader/shifts',
    '/employee/goals': '/leader/goals',
    '/employee/tasks': '/leader/tasks',
    '/employee/training': '/leader/training',
    '/employee/policies': '/leader/policies',
    '/employee/recognition': '/leader/my-recognition',
    '/employee/benefits': '/leader/benefits',
    '/employee/expenses': '/leader/expenses',
    '/employee/documents': '/leader/documents',
    '/employee/tickets': '/leader/tickets',
    '/employee/feedback': '/leader/feedback',
    '/employee/profile': '/leader/profile',
  },
  HRManager: {
    '/employee/profile': '/hr/profile',
    '/leader/team': '/hr/team',
    '/leader/recognition': '/hr/recognition',
  },
  Admin: {
    '/employee/profile': '/admin/profile',
    '/leader/team': '/admin/team',
    '/leader/recognition': '/admin/recognition',
    '/hr/dashboard': '/admin/dashboard',
    '/hr/approvals': '/admin/approvals',
    '/hr/employees': '/admin/employees',
    '/hr/attendance': '/admin/attendance',
    '/hr/payroll': '/admin/payroll',
    '/hr/reviews': '/admin/reviews',
    '/hr/succession': '/admin/succession',
    '/hr/onboarding': '/admin/onboarding',
    '/hr/shifts': '/admin/shifts',
    '/hr/policies': '/admin/policies',
    '/hr/benefits': '/admin/benefits',
    '/hr/expenses': '/admin/expenses',
    '/hr/documents': '/admin/documents',
    '/hr/tickets': '/admin/tickets',
    '/hr/training': '/admin/training',
    '/hr/forms': '/admin/forms',
    '/hr/submissions': '/admin/submissions',
    '/hr/jobs': '/admin/jobs',
    '/hr/cv-ranking': '/admin/cv-ranking',
  },
};

const REVERSE_ROLE_PATH_ALIASES = Object.values(ROLE_PATH_ALIASES).reduce((acc, aliases) => {
  Object.entries(aliases).forEach(([sourcePath, aliasedPath]) => {
    acc[aliasedPath] = sourcePath;
  });
  return acc;
}, {});

const TEAM_MEMBER_PERMISSIONS = [
  'employee.workspace.access',
  'employee.dashboard.view',
  'employee.attendance.manage',
  'employee.payroll.view',
  'employee.reviews.view',
  'employee.career.view',
  'employee.onboarding.view',
  'employee.shifts.view',
  'employee.goals.manage',
  'employee.tasks.manage',
  'employee.training.view',
  'employee.policies.view',
  'employee.recognition.view',
  'employee.benefits.manage',
  'employee.expenses.manage',
  'employee.documents.manage',
  'employee.tickets.manage',
  'employee.feedback.submit',
  'employee.profile.manage',
];

const TEAM_LEADER_PERMISSIONS = [
  'leader.workspace.access',
  'leader.team.manage',
  'leader.recognition.manage',
  'leader.team.analytics.view',
];

const HR_MANAGER_PERMISSIONS = [
  'hr.workspace.access',
  'hr.dashboard.view',
  'hr.approvals.manage',
  'hr.employees.manage',
  'hr.attendance.oversight',
  'hr.payroll.manage',
  'hr.reviews.manage',
  'hr.succession.manage',
  'hr.onboarding.manage',
  'hr.shifts.manage',
  'hr.policies.manage',
  'hr.benefits.manage',
  'hr.expenses.manage',
  'hr.documents.manage',
  'hr.tickets.manage',
  'hr.training.manage',
  'hr.forms.manage',
  'hr.submissions.manage',
  'hr.jobs.manage',
  'hr.cvRanking.manage',
];

const CANDIDATE_PERMISSIONS = [
  'candidate.workspace.access',
  'candidate.jobs.browse',
  'candidate.applications.track',
];

const ROLE_PERMISSIONS = {
  Candidate: CANDIDATE_PERMISSIONS,
  TeamMember: TEAM_MEMBER_PERMISSIONS,
  TeamLeader: [...TEAM_MEMBER_PERMISSIONS, ...TEAM_LEADER_PERMISSIONS],
  HRManager: [...TEAM_MEMBER_PERMISSIONS, ...TEAM_LEADER_PERMISSIONS, ...HR_MANAGER_PERMISSIONS],
  Admin: ['*'],
};

const PATH_PERMISSION_MAP = {
  '/candidate/dashboard': 'candidate.jobs.browse',
  '/candidate/applications': 'candidate.applications.track',
  '/employee/dashboard': 'employee.dashboard.view',
  '/employee/attendance': 'employee.attendance.manage',
  '/employee/payroll': 'employee.payroll.view',
  '/employee/reviews': 'employee.reviews.view',
  '/employee/career-path': 'employee.career.view',
  '/employee/onboarding': 'employee.onboarding.view',
  '/employee/shifts': 'employee.shifts.view',
  '/employee/goals': 'employee.goals.manage',
  '/employee/tasks': 'employee.tasks.manage',
  '/employee/training': 'employee.training.view',
  '/employee/policies': 'employee.policies.view',
  '/employee/recognition': 'employee.recognition.view',
  '/employee/benefits': 'employee.benefits.manage',
  '/employee/expenses': 'employee.expenses.manage',
  '/employee/documents': 'employee.documents.manage',
  '/employee/tickets': 'employee.tickets.manage',
  '/employee/feedback': 'employee.feedback.submit',
  '/employee/profile': 'employee.profile.manage',
  '/leader/team': 'leader.team.manage',
  '/leader/recognition': 'leader.recognition.manage',
  '/hr/dashboard': 'hr.dashboard.view',
  '/hr/approvals': 'hr.approvals.manage',
  '/hr/employees': 'hr.employees.manage',
  '/hr/attendance': 'hr.attendance.oversight',
  '/hr/payroll': 'hr.payroll.manage',
  '/hr/reviews': 'hr.reviews.manage',
  '/hr/succession': 'hr.succession.manage',
  '/hr/onboarding': 'hr.onboarding.manage',
  '/hr/shifts': 'hr.shifts.manage',
  '/hr/policies': 'hr.policies.manage',
  '/hr/benefits': 'hr.benefits.manage',
  '/hr/expenses': 'hr.expenses.manage',
  '/hr/documents': 'hr.documents.manage',
  '/hr/tickets': 'hr.tickets.manage',
  '/hr/training': 'hr.training.manage',
  '/hr/forms': 'hr.forms.manage',
  '/hr/submissions': 'hr.submissions.manage',
  '/hr/jobs': 'hr.jobs.manage',
  '/hr/cv-ranking': 'hr.cvRanking.manage',
  '/admin/dashboard': 'admin.workspace.access',
  '/admin/users': 'admin.workspace.access',
};

const roleHasPermission = (role, permission) => {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
};

const resolvePathForRole = (role, path) => {
  if (!role || !path) return path;
  return ROLE_PATH_ALIASES[role]?.[path] || path;
};

const roleCanAccessPath = (role, path) => {
  if (!role || !path) return false;
  const canonicalPath = REVERSE_ROLE_PATH_ALIASES[path] || path;
  const permission = PATH_PERMISSION_MAP[path] || PATH_PERMISSION_MAP[canonicalPath];
  return permission ? roleHasPermission(role, permission) : true;
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  newApplications: true,
  shortlistUpdates: true,
  interviewReminders: true,
  weeklyDigest: false,
};

const getNotificationPreferencesKey = (email) => `empowerhr-notification-preferences:${String(email || '').toLowerCase()}`;

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);

  // Rehydrate session from localStorage on app load
  useEffect(() => {
    const stored = localStorage.getItem("user");
    const access = localStorage.getItem("access");
    if (stored && access) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    try {
      const stored = localStorage.getItem(getNotificationPreferencesKey(user.email));
      if (!stored) {
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        return;
      }

      const parsed = JSON.parse(stored);
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(parsed || {}) });
    } catch {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    }
  }, [user?.email]);

  const updateNotificationPreference = useCallback((key) => {
    setNotificationPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      if (user?.email) {
        localStorage.setItem(getNotificationPreferencesKey(user.email), JSON.stringify(next));
      }
      return next;
    });
  }, [user?.email]);

  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });

    if (data.detail) throw new Error(data.detail); // surface Django error messages

    const { access, refresh, role, full_name, employee_id } = data;
    const userData = { email, role, full_name, employee_id };

    localStorage.setItem("access",  access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("user",    JSON.stringify(userData));

    setUser(userData);
    return ROLE_HOME[role] ?? "/login";
  }, []);

  const rolePermissions = user?.role ? (ROLE_PERMISSIONS[user.role] || []) : [];

  const hasPermission = useCallback((permission) => {
    if (!permission) return true;
    if (!user?.role) return false;

    if (Array.isArray(permission)) {
      return permission.some((entry) => roleHasPermission(user.role, entry));
    }

    return roleHasPermission(user.role, permission);
  }, [user?.role]);

  const canAccessPath = useCallback((path) => {
    if (!path || !user?.role) return false;
    return roleCanAccessPath(user.role, path);
  }, [user?.role]);

  const resolvePath = useCallback((path) => {
    if (!path) return path;
    if (!user?.role) return path;
    return resolvePathForRole(user.role, path);
  }, [user?.role]);

  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem("refresh");
      if (refresh) await logoutUser(refresh);
    } catch {
      // blacklist call failed — clear locally anyway
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      ROLE_HOME,
      ROLE_PERMISSIONS,
      rolePermissions,
      hasPermission,
      canAccessPath,
      resolvePath,
      notificationPreferences,
      updateNotificationPreference,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}