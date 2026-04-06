import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Spinner } from "../../components/shared/index.jsx";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  changePassword,
  getMyDocuments,
  getMyGoals,
  getMyTasks,
  getMyTickets,
  getMyTraining,
  hrGetDocuments,
  hrGetExpenses,
  hrGetLeaveRequests,
  hrGetTickets,
} from "../../api/index";

export function EmployeeProfilePage() {
  const { user, logout, notificationPreferences, updateNotificationPreference, resolvePath } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);
  const [snapshotCards, setSnapshotCards] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setError("New passwords do not match.");
      return;
    }
    if (form.new_password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setSuccess("Password changed successfully.");
      setForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      const data = err?.data ?? err?.response?.data;
      const msg  = data?.old_password?.[0] ?? data?.detail ?? "Failed to change password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key) => {
    updateNotificationPreference(key);
  };

  useEffect(() => {
    const loadProfileActivity = async () => {
      if (!user) {
        setSnapshotCards([]);
        setRecentActivity([]);
        setActivityLoading(false);
        return;
      }

      setActivityLoading(true);
      try {
        if (user.role === 'HRManager' || user.role === 'Admin') {
          const [leaveRequests, expenses, tickets, documents] = await Promise.all([
            hrGetLeaveRequests(),
            hrGetExpenses(),
            hrGetTickets(),
            hrGetDocuments(),
          ]);

          const pendingLeaves = leaveRequests.filter((item) => item?.status === 'Pending');
          const activeExpenses = expenses.filter((item) => ['Pending', 'Submitted'].includes(item?.status));
          const openTickets = tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status));
          const activeDocuments = documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status));

          setSnapshotCards([
            { label: t('profile.pendingApprovals'), value: pendingLeaves.length },
            { label: t('Expense claims'), value: activeExpenses.length },
            { label: t('profile.supportCases'), value: openTickets.length },
            { label: t('profile.documentUpdates'), value: activeDocuments.length },
          ]);

          setRecentActivity([
            ...pendingLeaves.slice(0, 2).map((item) => ({ id: `leave-${item.leaveRequestID}`, title: item.employeeName || item.employeeID || t('Employee'), meta: `${t('Leave requests')} • ${t(item.leaveType || 'Annual')}` })),
            ...activeExpenses.slice(0, 2).map((item) => ({ id: `expense-${item.claimID}`, title: item.title, meta: `${t('Expense claims')} • ${item.employeeName || item.employeeID || t('Employee')}` })),
            ...openTickets.slice(0, 2).map((item) => ({ id: `ticket-${item.ticketID}`, title: item.subject, meta: `${t('Support Tickets')} • ${t(item.status || 'Open')}` })),
          ].slice(0, 5));
        } else {
          const [tasks, goals, tickets, training, documents] = await Promise.all([
            getMyTasks(user.employee_id),
            getMyGoals(user.employee_id),
            getMyTickets(user.employee_id),
            getMyTraining(user.employee_id),
            getMyDocuments(user.employee_id),
          ]);

          const openTasks = tasks.filter((item) => !['Done', 'Completed'].includes(item?.status));
          const activeGoals = goals.filter((item) => item?.status !== 'Completed');
          const openTickets = tickets.filter((item) => !['Resolved', 'Closed'].includes(item?.status));
          const activeTraining = training.filter((item) => {
            const statuses = Object.values(item?.completionData || {});
            return !statuses.length || statuses.some((entry) => entry?.status !== 'Completed');
          });
          const activeDocuments = documents.filter((item) => ['Pending', 'In Progress'].includes(item?.status));

          setSnapshotCards([
            { label: t('profile.openTasks'), value: openTasks.length },
            { label: t('profile.activeGoals'), value: activeGoals.length },
            { label: t('profile.supportCases'), value: openTickets.length },
            { label: t('profile.learningItems'), value: activeTraining.length + activeDocuments.length },
          ]);

          setRecentActivity([
            ...openTasks.slice(0, 2).map((item) => ({ id: `task-${item.taskID}`, title: item.title, meta: `${t('nav.tasks')} • ${t(item.status || 'To Do')}` })),
            ...activeGoals.slice(0, 2).map((item) => ({ id: `goal-${item.goalID}`, title: item.title, meta: `${t('nav.goals')} • ${item.progress || 0}%` })),
            ...openTickets.slice(0, 1).map((item) => ({ id: `profile-ticket-${item.ticketID}`, title: item.subject, meta: `${t('Support Tickets')} • ${t(item.status || 'Open')}` })),
            ...activeTraining.slice(0, 1).map((item) => ({ id: `training-${item.courseID}`, title: item.title, meta: `${t('nav.training')} • ${t(item.category || 'Technical')}` })),
            ...activeDocuments.slice(0, 1).map((item) => ({ id: `document-${item.requestID}`, title: t(item.documentType || 'Document Type'), meta: `${t('nav.documents')} • ${t(item.status || 'Pending')}` })),
          ].slice(0, 5));
        }
      } catch {
        setSnapshotCards([]);
        setRecentActivity([]);
      } finally {
        setActivityLoading(false);
      }
    };

    loadProfileActivity();
  }, [t, user]);

  const roleLabel = user?.role ? t(`role.${user.role}`) : '';
  const attentionCount = snapshotCards.reduce((sum, card) => sum + Number(card.value || 0), 0);
  const quickActions = useMemo(() => {
    if (user?.role === 'HRManager' || user?.role === 'Admin') {
      return [
        { title: t('Open HR Dashboard'), subtitle: t('Review insights and retention signals'), path: resolvePath('/hr/dashboard'), variant: 'primary' },
        { title: t('Review Approvals'), subtitle: t('Clear pending employee requests faster'), path: resolvePath('/hr/approvals'), variant: 'outline' },
        { title: t('Open Workforce Hub'), subtitle: t('Manage employee records and people changes'), path: resolvePath('/hr/employees'), variant: 'ghost' },
        { title: t('Manage Feedback Forms'), subtitle: t('Update surveys and monitor responses'), path: resolvePath('/hr/forms'), variant: 'ghost' },
      ];
    }

    return [
      { title: t('Continue Feedback'), subtitle: t('Finish pending surveys and pulse checks'), path: resolvePath('/employee/feedback'), variant: 'primary' },
      { title: t('View My Tasks'), subtitle: t('Check work items and due progress'), path: resolvePath('/employee/tasks'), variant: 'outline' },
      { title: t('Track My Goals'), subtitle: t('Review performance and growth targets'), path: resolvePath('/employee/goals'), variant: 'ghost' },
      { title: t('Open Support & Documents'), subtitle: t('Request help or follow document updates'), path: resolvePath('/employee/tickets'), variant: 'ghost' },
    ];
  }, [resolvePath, t, user?.role]);

  return (
    <div className="profile-page profile-page-modern">

      <section className="profile-overview-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.full_name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="profile-info">
            <h2>{user?.full_name}</h2>
            <p>{user?.email}</p>
            <div className="profile-role-row">
              <span className="role-badge">{roleLabel}</span>
              <span className="profile-status-badge">{t('profile.activeAccount')}</span>
            </div>
          </div>
        </div>

        <div className="profile-kpis">
          <div className="profile-kpi">
            <span className="profile-kpi-label">{t('profile.accessLevel')}</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="profile-kpi">
            <span className="profile-kpi-label">{t('profile.lastLogin')}</span>
            <strong>Today</strong>
          </div>
          <div className="profile-kpi">
            <span className="profile-kpi-label">{t('profile.securityStatus')}</span>
            <strong>{t('profile.protected')}</strong>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 16, background: attentionCount > 0 ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${attentionCount > 0 ? '#FDEAD7' : '#D1FADF'}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: attentionCount > 0 ? '#B54708' : '#027A48', marginBottom: 6 }}>
            {t('Today Focus')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 13.5, color: '#344054' }}>
              {activityLoading
                ? t('Loading...')
                : attentionCount > 0
                  ? `${attentionCount} ${t('active items need your attention.')}`
                  : t('Everything looks on track right now.')}
            </div>
            <strong style={{ fontSize: 20, color: attentionCount > 0 ? '#B54708' : '#027A48' }}>{activityLoading ? '—' : attentionCount}</strong>
          </div>
        </div>
      </section>

      <div className="profile-layout-grid">
        <div className="profile-layout-main">
          <div className="profile-card profile-card-modern">
            <h3>{t('Quick Actions')}</h3>
            <p className="profile-card-subtitle">
              {t('Jump straight into the most common actions for your workspace.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
              {quickActions.map((action) => (
                <div key={action.path} style={{ border: '1px solid #EAECF0', borderRadius: 16, padding: 14, background: '#fff' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>{action.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: 10 }}>{action.subtitle}</div>
                  <Btn size="sm" variant={action.variant} onClick={() => navigate(action.path)}>
                    {t('Open')}
                  </Btn>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-card profile-card-modern">
            <h3>{t('page.profile.security')}</h3>
            <p className="profile-card-subtitle">
              {t('page.profile.securityText')}
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              {error   && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}

              <div className="form-group">
                <label htmlFor="old_password">{t('profile.currentPassword')}</label>
                <input
                  id="old_password"
                  type="password"
                  name="old_password"
                  value={form.old_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="new_password">{t('profile.newPassword')}</label>
                <input
                  id="new_password"
                  type="password"
                  name="new_password"
                  value={form.new_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm_password">{t('profile.confirmPassword')}</label>
                <input
                  id="confirm_password"
                  type="password"
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn-primary profile-btn-primary" disabled={loading}>
                {loading ? "Updating..." : t('profile.updatePassword')}
              </button>
            </form>
          </div>

          <div className="profile-card profile-card-modern">
            <h3>{t('page.profile.session')}</h3>
            <p className="profile-card-subtitle">{t('page.profile.sessionText')}</p>
            <div className="session-row">
              <div>
                <p className="session-title">{t('profile.currentDevice')}</p>
                <p className="session-meta">{t('profile.authenticatedActive')}</p>
              </div>
              <span className="profile-status-badge">{t('profile.nowActive')}</span>
            </div>
            <button className="btn-danger profile-btn-danger" onClick={logout}>
              {t('common.signOut')}
            </button>
          </div>
        </div>

        <aside className="profile-layout-side">
          <div className="profile-card profile-card-modern">
            <h3>{t('page.profile.notifications')}</h3>
            <p className="profile-card-subtitle">{t('page.profile.notificationsText')}</p>

            <div className="preference-list">
              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("newApplications")}
              >
                <span>{t('profile.newApplications')}</span>
                <span className={`preference-toggle ${notificationPreferences.newApplications ? "on" : "off"}`}>
                  {notificationPreferences.newApplications ? t('profile.on') : t('profile.off')}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("shortlistUpdates")}
              >
                <span>{t('profile.shortlistUpdates')}</span>
                <span className={`preference-toggle ${notificationPreferences.shortlistUpdates ? "on" : "off"}`}>
                  {notificationPreferences.shortlistUpdates ? t('profile.on') : t('profile.off')}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("interviewReminders")}
              >
                <span>{t('profile.interviewReminders')}</span>
                <span className={`preference-toggle ${notificationPreferences.interviewReminders ? "on" : "off"}`}>
                  {notificationPreferences.interviewReminders ? t('profile.on') : t('profile.off')}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("weeklyDigest")}
              >
                <span>{t('profile.weeklyDigest')}</span>
                <span className={`preference-toggle ${notificationPreferences.weeklyDigest ? "on" : "off"}`}>
                  {notificationPreferences.weeklyDigest ? t('profile.on') : t('profile.off')}
                </span>
              </button>
            </div>
            <p className="profile-card-subtitle" style={{ marginTop: 12 }}>
              {t('profile.preferencesAutosave')}
            </p>
          </div>

          <div className="profile-card profile-card-modern">
            <h3>{t('profile.workspaceSnapshot')}</h3>
            <p className="profile-card-subtitle">{t('profile.workspaceSnapshotText')}</p>
            {activityLoading ? (
              <div className="profile-activity-loading"><Spinner size={18} /></div>
            ) : (
              <div className="profile-mini-grid">
                {snapshotCards.map((card) => (
                  <div key={card.label} className="profile-mini-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-card profile-card-modern profile-security-activity">
            <h3>{t('profile.recentActivity')}</h3>
            <p className="profile-card-subtitle">{t('profile.recentActivityText')}</p>
            {activityLoading ? (
              <div className="profile-activity-loading"><Spinner size={18} /></div>
            ) : recentActivity.length === 0 ? (
              <div className="profile-activity-empty">{t('profile.noRecentActivity')}</div>
            ) : (
              <ul className="profile-activity-list">
                {recentActivity.map((item) => (
                  <li key={item.id} className="profile-activity-item">
                    <span className="profile-activity-title">{item.title}</span>
                    <span className="profile-activity-meta">{item.meta}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="profile-card profile-card-modern profile-security-activity">
            <h3>{t('page.profile.activity')}</h3>
            <p className="profile-card-subtitle">{t('page.profile.activityText')}</p>
            <ul>
              <li>{t('profile.passwordUpdatedRecently')}</li>
              <li>{t('profile.latestLoginDetected')}</li>
              <li>{t('profile.noSuspiciousActivity')}</li>
            </ul>
          </div>
        </aside>
      </div>

    </div>
  );
}
