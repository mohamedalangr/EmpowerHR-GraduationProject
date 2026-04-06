import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute
 * Wraps any route that requires authentication.
 * Redirects to /login if the user is not logged in.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <div className="auth-loading">Loading...</div>;
  if (!user)   return <Navigate to="/login" replace />;

  return <Outlet />;
}

/**
 * RoleRoute
 * Wraps routes that require specific roles.
 * Redirects to /unauthorized if the user's role is not in the allowed list.
 *
 * Usage:
 *   <Route element={<RoleRoute allowed={["Admin", "HRManager"]} />}>
 *     <Route path="/admin/dashboard" element={<AdminDashboard />} />
 *   </Route>
 */
export function RoleRoute({ allowed = [], requiredPermission, requiredAnyPermissions = [] }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return <div className="auth-loading">Loading...</div>;
  if (!user)   return <Navigate to="/login" replace />;

  const roleBlocked = Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(user.role);
  const permissionBlocked = requiredPermission && !hasPermission(requiredPermission);
  const anyPermissionBlocked = Array.isArray(requiredAnyPermissions)
    && requiredAnyPermissions.length > 0
    && !hasPermission(requiredAnyPermissions);

  if (roleBlocked || permissionBlocked || anyPermissionBlocked) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
