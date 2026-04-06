import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { confirmPasswordReset, registerCandidate, requestPasswordResetOtp } from "../api/index";

const candidateHighlights = [
  'auth.candidateHighlight1',
  'auth.candidateHighlight2',
  'auth.candidateHighlight3',
];

export default function CandidateLogin() {
  const { login } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [resetStep, setResetStep] = useState("request");
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [resetForm, setResetForm] = useState({ email: "", otp: "", new_password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleResetChange = (e) =>
    setResetForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await registerCandidate({
        email: form.email,
        full_name: form.full_name,
        password: form.password,
      });
      setSuccess(t('auth.registerSuccess'));
      setMode("login");
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.email?.[0] ?? err.message ?? data?.detail ?? "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    const email = (resetForm.email || form.email).trim();
    if (!email) {
      setError(t('auth.enterEmailFirst'));
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await requestPasswordResetOtp({ email });
      setResetForm((prev) => ({ ...prev, email }));
      setResetStep("confirm");
      setSuccess(t('auth.resetEmailSent'));
    } catch (err) {
      setError(err.message || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await confirmPasswordReset(resetForm);
      setForm((prev) => ({ ...prev, email: resetForm.email, password: "" }));
      setResetForm((prev) => ({ ...prev, otp: "", new_password: "" }));
      setMode("login");
      setResetStep("request");
      setSuccess(t('auth.resetSuccess'));
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-showcase login-showcase-candidate">
          <div className="login-showcase-content">
            <span className="login-eyebrow">{t('auth.candidateEyebrow')}</span>
            <h1 className="login-showcase-title">{t('auth.candidateTitle')}</h1>
            <p className="login-showcase-text">
              {t('auth.candidateText')}
            </p>

            <div className="login-showcase-list">
              {candidateHighlights.map((item) => (
                <div key={item} className="login-showcase-item">
                  <span className="login-showcase-icon">✓</span>
                  <span>{t(item)}</span>
                </div>
              ))}
            </div>

            <div className="login-showcase-metrics">
              <div>
                <strong>{t('auth.oneAccount')}</strong>
                <span>{t('auth.forAllApplications')}</span>
              </div>
              <div>
                <strong>{t('auth.cleanFlow')}</strong>
                <span>{t('auth.fromSignupToFollowUp')}</span>
              </div>
              <div>
                <strong>{t('auth.simpleTracking')}</strong>
                <span>{t('auth.forEverySubmittedCv')}</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="login-card login-card-elevated">
          <div className="login-brand">
            <div className="login-brand-mark">EH</div>
            <div>
              <span className="login-badge">{t('auth.candidateBadge')}</span>
              <h2>{t('auth.candidateWelcome')}</h2>
            </div>
            <button type="button" className="auth-lang-toggle" onClick={toggleLanguage}>
              {t('language.switch')}
            </button>
          </div>

          <div className="login-header">
            <h1>
              {mode === "login"
                ? t('auth.signInCandidate')
                : mode === "register"
                  ? t('auth.registerTitle')
                  : resetStep === "request"
                    ? t('auth.requestResetTitle')
                    : t('auth.confirmResetTitle')}
            </h1>
            <p>
              {mode === "login"
                ? t('auth.candidateTextShort')
                : mode === "register"
                  ? t('auth.registerText')
                  : resetStep === "request"
                    ? t('auth.candidateResetText')
                    : t('auth.confirmResetText')}
            </p>
          </div>

          <div className="login-tabs" role="tablist" aria-label="Candidate authentication options">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "tab active" : "tab"}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
            >
              {t('auth.signIn')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "tab active" : "tab"}
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
              }}
            >
              {t('auth.register')}
            </button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : resetStep === "request" ? handleResetRequest : handleResetConfirm} className="login-form" aria-busy={loading}>
            {error && <div className="login-error" role="alert" aria-live="assertive">{error}</div>}
            {success && <div className="login-success" role="status" aria-live="polite">{success}</div>}

            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="full_name">{t('auth.fullName')}</label>
                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder={t('auth.fullNamePlaceholder')}
                  required
                  autoComplete="name"
                  aria-invalid={Boolean(error)}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                name="email"
                value={mode === "reset" ? resetForm.email : form.email}
                onChange={mode === "reset" ? handleResetChange : handleChange}
                placeholder={t('auth.emailPlaceholder')}
                required
                autoComplete="email"
                aria-invalid={Boolean(error)}
              />
            </div>

            {mode !== "reset" && (
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
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  aria-invalid={Boolean(error)}
                />
                <span className="form-helper">
                  {mode === "login" ? t('auth.candidateTextShort') : t('auth.useSecurePassword')}
                </span>
              </div>
            )}

            {mode === "reset" && resetStep === "confirm" && (
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
                </div>
              </>
            )}

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading
                ? t('auth.pleaseWait')
                : mode === "login"
                  ? t('auth.signIn')
                  : mode === "register"
                    ? t('auth.createAccount')
                    : resetStep === "request"
                      ? t('common.sendOtp')
                      : t('common.resetPassword')}
            </button>

            {mode === "login" && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setMode("reset");
                  setResetStep("request");
                  setError("");
                  setSuccess("");
                  setResetForm((prev) => ({ ...prev, email: form.email || prev.email }));
                }}
              >
                {t('common.forgotPassword')}
              </button>
            )}

            {mode === "reset" && (
              <>
                {resetStep === "request" ? (
                  <button type="button" className="btn-secondary" onClick={() => setResetStep("confirm")}>
                    {t('common.haveCode')}
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => setResetStep("request")}>
                    {t('auth.sendAnotherCode')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setMode("login");
                    setResetStep("request");
                    setError("");
                  }}
                >
                  {t('common.backToSignIn')}
                </button>
              </>
            )}
          </form>

          <div className="login-footer">
            <p>
              {t('auth.employeeQuestion')}{" "}
              <Link to="/login" className="login-inline-link">
                {t('auth.employeePortalLink')}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
