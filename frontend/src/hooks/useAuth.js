import { useAuth as useAuthContext } from "../context/AuthContext";

/**
 * Extended auth hook with role helpers.
 * Import this in components instead of the raw context hook.
 *
 * Usage:
 *   const { user, isAdmin, isHRManager, logout } = useAuth();
 */
export function useAuth() {
  const auth = useAuthContext();

  const role = auth.user?.role ?? null;

  return {
    ...auth,
    role,
    isCandidate:  role === "Candidate",
    isTeamMember: role === "TeamMember",
    isTeamLeader: role === "TeamLeader",
    isHRManager:  role === "HRManager",
    isAdmin:      role === "Admin",
    // "at least" helpers — useful for showing/hiding UI elements
    atLeastTeamLeader: ["TeamLeader", "HRManager", "Admin"].includes(role),
    atLeastHRManager:  ["HRManager", "Admin"].includes(role),
  };
}
