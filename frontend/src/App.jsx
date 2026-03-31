import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./routes/Guards";
import { AppLayout } from "./routes/AppLayout";
import { HRJobPostingsPage } from "./pages/hr/JobPostingsPage";
import "./auth.css";

// Auth pages
import EmployeeLogin  from "./pages/EmployeeLogin";
import CandidateLogin from "./pages/CandidateLogin";
import Unauthorized   from "./pages/Unauthorized";

// HR pages
import { HRDashboardPage  } from "./pages/hr/DashboardPage";
import { HRFormsPage      } from "./pages/hr/FormPage";
import { HRSubmissionPage } from "./pages/hr/SubmissionPage";
import { HRCVRankingPage  } from "./pages/hr/CVRankingPage";


// Employee pages
import { EmployeeFeedbackPage } from "./pages/employee/FeedbackPage";
import { EmployeeProfilePage  } from "./pages/employee/EmployeeProfilePage";

// Candidate pages
import { EmployeeCareersPage  } from "./pages/candidate/CareersPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* --- Public routes (no navbar) --- */}
          <Route path="/login"           element={<EmployeeLogin />} />
          <Route path="/candidate/login" element={<CandidateLogin />} />
          <Route path="/unauthorized"    element={<Unauthorized />} />

          {/* --- Protected routes (with navbar) --- */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Candidate */}
              <Route element={<RoleRoute allowed={["Candidate"]} />}>
                <Route path="/candidate/dashboard"    element={<EmployeeCareersPage />} />
                <Route path="/candidate/applications" element={<EmployeeCareersPage />} />
              </Route>

              {/* All internal employees */}
              <Route element={<RoleRoute allowed={["TeamMember", "TeamLeader", "HRManager", "Admin"]} />}>
                <Route path="/employee/dashboard" element={<EmployeeFeedbackPage />} />
                <Route path="/employee/feedback"  element={<EmployeeFeedbackPage />} />
                <Route path="/employee/profile"   element={<EmployeeProfilePage />} />
              </Route>

              {/* Team Leader and above */}
              <Route element={<RoleRoute allowed={["TeamLeader", "HRManager", "Admin"]} />}>
                <Route path="/leader/team" element={<EmployeeFeedbackPage />} />
              </Route>

              {/* HR Manager and above */}
              <Route element={<RoleRoute allowed={["HRManager", "Admin"]} />}>
                <Route path="/hr/dashboard"   element={<HRDashboardPage />} />
                <Route path="/hr/forms"       element={<HRFormsPage />} />
                <Route path="/hr/submissions" element={<HRSubmissionPage />} />
                <Route path="/hr/jobs"        element={<HRJobPostingsPage />} />
                <Route path="/hr/cv-ranking"  element={<HRCVRankingPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<RoleRoute allowed={["Admin"]} />}>
                <Route path="/admin/dashboard" element={<HRDashboardPage />} />
                <Route path="/admin/users"     element={<HRDashboardPage />} />
              </Route>

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
