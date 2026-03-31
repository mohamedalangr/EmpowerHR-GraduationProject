import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Unauthorized() {
  const { user, logout, ROLE_HOME } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    if (user) navigate(ROLE_HOME[user.role] ?? "/login");
    else navigate("/login");
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>403</h1>
        <h2>Access Denied</h2>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          You don't have permission to view this page.
        </p>
        <button className="btn-primary" onClick={goHome}>
          Go to my dashboard
        </button>
        {user && (
          <button
            className="btn-secondary"
            onClick={logout}
            style={{ marginTop: "0.75rem" }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
