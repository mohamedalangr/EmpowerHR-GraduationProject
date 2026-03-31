import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { registerCandidate } from "../api/index";

export default function CandidateLogin() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [mode, setMode]     = useState("login"); // "login" | "register"
  const [form, setForm]     = useState({ email: "", full_name: "", password: "" });
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const redirectTo = await login(form.email, form.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail ?? "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await registerCandidate({
  email:     form.email,
  full_name: form.full_name,
  password:  form.password,
});
      setSuccess("Account created! You can now sign in.");
      setMode("login");
    } catch (err) {
      const data = err.response?.data;
      const msg  = data?.email?.[0] ?? data?.detail ?? "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Candidate Portal</h1>
          <p>{mode === "login" ? "Sign in to track your applications" : "Create a candidate account"}</p>
        </div>

        {/* Toggle tabs */}
        <div className="login-tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
          >
            Sign In
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
          >
            Register
          </button>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="login-form">
          {error   && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>
              <input
                id="full_name"
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Your full name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
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
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Are you an employee?{" "}
            <a href="/login">Employee portal →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
