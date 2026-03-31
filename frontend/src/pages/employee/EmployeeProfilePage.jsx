import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { changePassword } from "../../api/index";

export function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  const [form, setForm]       = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    newApplications: true,
    shortlistUpdates: true,
    interviewReminders: true,
    weeklyDigest: false,
  });

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
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const roleLabel = {
    TeamMember: "Employee",
    TeamLeader: "Team Leader",
    HRManager: "HR Manager",
    Admin: "Administrator",
    Candidate: "Candidate",
  }[user?.role] ?? user?.role;

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
              <span className="profile-status-badge">Active Account</span>
            </div>
          </div>
        </div>

        <div className="profile-kpis">
          <div className="profile-kpi">
            <span className="profile-kpi-label">Access Level</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="profile-kpi">
            <span className="profile-kpi-label">Last Login</span>
            <strong>Today</strong>
          </div>
          <div className="profile-kpi">
            <span className="profile-kpi-label">Security Status</span>
            <strong>Protected</strong>
          </div>
        </div>
      </section>

      <div className="profile-layout-grid">
        <div className="profile-layout-main">
          <div className="profile-card profile-card-modern">
            <h3>Security Settings</h3>
            <p className="profile-card-subtitle">
              Update your password and keep your account protected.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              {error   && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}

              <div className="form-group">
                <label htmlFor="old_password">Current Password</label>
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
                <label htmlFor="new_password">New Password</label>
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
                <label htmlFor="confirm_password">Confirm New Password</label>
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
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>

          <div className="profile-card profile-card-modern">
            <h3>Session Management</h3>
            <p className="profile-card-subtitle">Manage active session access on this device.</p>
            <div className="session-row">
              <div>
                <p className="session-title">Current Device</p>
                <p className="session-meta">Authenticated and active</p>
              </div>
              <span className="profile-status-badge">Now Active</span>
            </div>
            <button className="btn-danger profile-btn-danger" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>

        <aside className="profile-layout-side">
          <div className="profile-card profile-card-modern">
            <h3>Notification Preferences</h3>
            <p className="profile-card-subtitle">Choose the updates you want to receive.</p>

            <div className="preference-list">
              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("newApplications")}
              >
                <span>New applications</span>
                <span className={`preference-toggle ${preferences.newApplications ? "on" : "off"}`}>
                  {preferences.newApplications ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("shortlistUpdates")}
              >
                <span>Shortlist updates</span>
                <span className={`preference-toggle ${preferences.shortlistUpdates ? "on" : "off"}`}>
                  {preferences.shortlistUpdates ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("interviewReminders")}
              >
                <span>Interview reminders</span>
                <span className={`preference-toggle ${preferences.interviewReminders ? "on" : "off"}`}>
                  {preferences.interviewReminders ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                className="preference-item"
                onClick={() => handlePreferenceChange("weeklyDigest")}
              >
                <span>Weekly digest</span>
                <span className={`preference-toggle ${preferences.weeklyDigest ? "on" : "off"}`}>
                  {preferences.weeklyDigest ? "On" : "Off"}
                </span>
              </button>
            </div>
          </div>

          <div className="profile-card profile-card-modern profile-security-activity">
            <h3>Security Activity</h3>
            <p className="profile-card-subtitle">Recent account security events.</p>
            <ul>
              <li>Password last updated recently</li>
              <li>Latest successful login detected</li>
              <li>No suspicious sign-in activity</li>
            </ul>
          </div>
        </aside>
      </div>

    </div>
  );
}
