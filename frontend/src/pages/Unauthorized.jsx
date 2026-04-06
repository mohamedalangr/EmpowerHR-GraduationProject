import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Unauthorized() {
  const { user, logout, ROLE_HOME } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const goHome = () => {
    if (user) navigate(ROLE_HOME[user.role] ?? "/login");
    else navigate("/login");
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>403</h1>
        <h2>{t('unauthorized.title')}</h2>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          {t('unauthorized.message')}
        </p>
        <button className="btn-primary" onClick={goHome}>
          {t('unauthorized.dashboard')}
        </button>
        {user && (
          <button
            className="btn-secondary"
            onClick={logout}
            style={{ marginTop: "0.75rem" }}
          >
            {t('common.signOut')}
          </button>
        )}
      </div>
    </div>
  );
}
