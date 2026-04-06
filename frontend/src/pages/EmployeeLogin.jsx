import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { confirmPasswordReset, requestPasswordResetOtp } from "../api/index";

const employeeHighlights = [
  'auth.employeeHighlight1',
  'auth.employeeHighlight2',
  'auth.employeeHighlight3',
];

export default function EmployeeLogin() {
  const { login } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [resetForm, setResetForm] = useState({ email: "", otp: "", new_password: "" });
  const [authView, setAuthView] = useState("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleResetChange = (e) =>
    setResetForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetToLogin = () => {
    setAuthView("login");
    setError("");
    setSuccess("");
    setResetForm((prev) => ({ ...prev, otp: "", new_password: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const redirectTo = await login(form.email, form.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    const email = (resetForm.email || form.email).trim();
    if (!email) {
      setError(t('auth.enterWorkEmailFirst'));
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await requestPasswordResetOtp({ email });
      setResetForm((prev) => ({ ...prev, email }));
      setSuccess(t('auth.otpEmailSent'));
      setAuthView("confirm-reset");
    } catch (err) {
      setError(err.message || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await confirmPasswordReset(resetForm);
      setForm((prev) => ({ ...prev, email: resetForm.email, password: "" }));
      setSuccess(t('auth.passwordUpdated'));
      setAuthView("login");
      setResetForm((prev) => ({ ...prev, otp: "", new_password: "" }));
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-showcase login-showcase-employee">
          <div className="login-showcase-content">
            <span className="login-eyebrow">{t('auth.employeeEyebrow')}</span>
            <h1 className="login-showcase-title">{t('auth.employeeTitle')}</h1>
            <p className="login-showcase-text">
              {t('auth.employeeText')}
            </p>

            <div className="login-showcase-list">
              {employeeHighlights.map((item) => (
                <div key={item} className="login-showcase-item">
                  <span className="login-showcase-icon">✓</span>
                  <span>{t(item)}</span>
                </div>
              ))}
            </div>

            <div className="login-showcase-metrics">
              <div>
                <strong>{t('auth.secure')}</strong>
                <span>{t('auth.employeeSignInFlow')}</span>
              </div>
              <div>
                <strong>{t('auth.unified')}</strong>
                <span>{t('auth.withHrDashboardUi')}</span>
              </div>
              <div>
                <strong>{t('auth.focused')}</strong>
                <span>{t('auth.onSpeedAndClarity')}</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="login-card login-card-elevated">
          <div className="login-brand">
            <div className="login-brand-mark">EH</div>
            <div>
              <span className="login-badge">{t('auth.employeeBadge')}</span>
              <h2>{t('auth.welcomeBack')}</h2>
            </div>
            <button type="button" className="auth-lang-toggle" onClick={toggleLanguage}>
              {t('language.switch')}
            </button>
          </div>

          <div className="login-header">
            <h1>
              {authView === "login"
                ? t('auth.signInEmployee')
                : authView === "request-reset"
                  ? t('auth.requestResetTitle')
                  : t('auth.confirmResetTitle')}
            </h1>
            <p>
              {authView === "login"
                ? t('auth.employeeTextShort')
                : authView === "request-reset"
                  ? t('auth.requestResetText')
                  : t('auth.confirmResetText')}
            </p>
          </div>

          <form onSubmit={authView === "login" ? handleSubmit : authView === "request-reset" ? handleRequestReset : handleConfirmReset} className="login-form" aria-busy={loading}>
            {error && <div className="login-error" role="alert" aria-live="assertive">{error}</div>}
            {success && <div className="login-success" role="status" aria-live="polite">{success}</div>}

            <div className="form-group">
              <label htmlFor="email">{t('auth.workEmail')}</label>
              <input
                id="email"
                type="email"
                name="email"
                value={authView === "login" ? form.email : resetForm.email}
                onChange={authView === "login" ? handleChange : handleResetChange}
                placeholder={t('auth.workEmailPlaceholder')}
                required
                autoComplete="email"
                aria-invalid={Boolean(error)}
              />
            </div>

            {authView === "login" ? (
              <>
                <div className="form-group">
                  <label htmlFor="password">{t('auth.password')}</label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    aria-invalid={Boolean(error)}
                  />
                  <span className="form-helper">{t('auth.useWorkCreds')}</span>
                </div>

                <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                  {loading ? t('auth.signingIn') : t('auth.signIn')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setAuthView("request-reset");
                    setError("");
                    setSuccess("");
                    setResetForm((prev) => ({ ...prev, email: form.email || prev.email }));
                  }}
                >
                  {t('common.forgotPassword')}
                </button>
              </>
            ) : authView === "request-reset" ? (
              <>
                <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                  {loading ? t('common.loading') : t('common.sendOtp')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setAuthView("confirm-reset")}>
                  {t('common.haveCode')}
                </button>
                <button type="button" className="btn-secondary" onClick={resetToLogin}>
                  {t('common.backToSignIn')}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="otp">{t('auth.otp')}</label>
                  <input
                    id="otp"
                    type="text"
                    name="otp"
                    value={resetForm.otp}
                    onChange={handleResetChange}
                    placeholder={t('auth.otpPlaceholder')}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    aria-invalid={Boolean(error)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new_password">{t('auth.newPassword')}</label>
                  <input
                    id="new_password"
                    type="password"
                    name="new_password"
                    value={resetForm.new_password}
                    onChange={handleResetChange}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-invalid={Boolean(error)}
                  />
                  <span className="form-helper">{t('auth.useSecurePassword')}</span>
                </div>
                <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                  {loading ? t('auth.updatingPassword') : t('common.resetPassword')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setAuthView("request-reset")}>
                  {t('common.sendAnotherCode')}
                </button>
                <button type="button" className="btn-secondary" onClick={resetToLogin}>
                  {t('common.backToSignIn')}
                </button>
              </>
            )}
          </form>

          <div className="login-footer">
            <p>
              {t('auth.applyingQuestion')}{" "}
              <Link to="/candidate/login" className="login-inline-link">
                {t('auth.jobPortalLink')}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
