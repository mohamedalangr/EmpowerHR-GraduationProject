import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
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
import { HREmployeesPage  } from "./pages/hr/EmployeesPage";
import { HRAttendancePage } from "./pages/hr/AttendancePage";
import { HRPayrollPage } from "./pages/hr/PayrollPage";
import { HRTrainingPage } from "./pages/hr/TrainingPage";
import { HRReviewsPage } from "./pages/hr/ReviewsPage";
import { HRSuccessionPage } from "./pages/hr/SuccessionPage";
import { HROnboardingPage } from "./pages/hr/OnboardingPage";
import { HRShiftsPage } from "./pages/hr/ShiftsPage";
import { HRPoliciesPage } from "./pages/hr/PoliciesPage";
import { HRBenefitsPage } from "./pages/hr/BenefitsPage";
import { HRExpensesPage } from "./pages/hr/ExpensesPage";
import { HRDocumentsPage } from "./pages/hr/DocumentsPage";
import { HRTicketsPage } from "./pages/hr/TicketsPage";
import { HRApprovalCenterPage } from "./pages/hr/ApprovalCenterPage";

// Employee pages
import { EmployeeFeedbackPage } from "./pages/employee/FeedbackPage";
import { EmployeeProfilePage  } from "./pages/employee/EmployeeProfilePage";
import { EmployeeDashboardPage } from "./pages/employee/DashboardPage";
import { EmployeeAttendancePage } from "./pages/employee/AttendancePage";
import { EmployeePayrollPage } from "./pages/employee/PayrollPage";
import { EmployeeReviewsPage } from "./pages/employee/ReviewsPage";
import { EmployeeCareerPathPage } from "./pages/employee/CareerPathPage";
import { EmployeeOnboardingPage } from "./pages/employee/OnboardingPage";
import { EmployeeShiftsPage } from "./pages/employee/ShiftsPage";
import { EmployeeGoalsPage } from "./pages/employee/GoalsPage";
import { EmployeeTasksPage } from "./pages/employee/TasksPage";
import { EmployeeTrainingPage } from "./pages/employee/TrainingPage";
import { EmployeePoliciesPage } from "./pages/employee/PoliciesPage";
import { EmployeeRecognitionPage } from "./pages/employee/RecognitionPage";
import { EmployeeBenefitsPage } from "./pages/employee/BenefitsPage";
import { EmployeeExpensesPage } from "./pages/employee/ExpensesPage";
import { EmployeeDocumentsPage } from "./pages/employee/DocumentsPage";
import { EmployeeTicketsPage } from "./pages/employee/TicketsPage";
import { TeamGoalsPage } from "./pages/leader/TeamPage";
import { TeamRecognitionPage } from "./pages/leader/RecognitionPage";
import { LeaderAttendancePage, LeaderBenefitsPage, LeaderCareerPathPage, LeaderDashboardPage, LeaderDocumentsPage, LeaderExpensesPage, LeaderFeedbackPage, LeaderGoalsPage, LeaderMyRecognitionPage, LeaderOnboardingPage, LeaderPayrollPage, LeaderProfilePage, LeaderReviewsPage, LeaderShiftsPage, LeaderTasksPage, LeaderTicketsPage, LeaderTrainingPage, LeaderPoliciesPage } from "./pages/leader/WorkspacePages";
import { AdminDashboardPage } from "./pages/admin/DashboardPage";
import { AdminApprovalsPage, AdminAttendancePage, AdminBenefitsPage, AdminCVRankingPage, AdminDocumentsPage, AdminEmployeesPage, AdminExpensesPage, AdminFormsPage, AdminJobsPage, AdminOnboardingPage, AdminPayrollPage, AdminPoliciesPage, AdminProfilePage, AdminRecognitionPage, AdminReviewsPage, AdminShiftsPage, AdminSubmissionsPage, AdminSuccessionPage, AdminTeamPage, AdminTicketsPage, AdminTrainingPage, AdminUsersPage } from "./pages/admin/OperationsPages";
import { HRProfilePage, HRRecognitionPage, HRTeamPage } from "./pages/hr/SharedWorkspacePages";

// Candidate pages
import { EmployeeCareersPage } from "./pages/candidate/CareersPage";
import { CandidateApplicationsPage, CandidateDashboardPage } from "./pages/candidate/WorkspacePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
          {/* --- Public routes (no navbar) --- */}
          <Route path="/login"           element={<EmployeeLogin />} />
          <Route path="/candidate/login" element={<CandidateLogin />} />
          <Route path="/careers"         element={<EmployeeCareersPage />} />
          <Route path="/unauthorized"    element={<Unauthorized />} />

          {/* --- Protected routes (with navbar) --- */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Candidate */}
              <Route element={<RoleRoute allowed={["Candidate"]} requiredPermission="candidate.workspace.access" />}>
                <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
                <Route path="/candidate/applications" element={<CandidateApplicationsPage />} />
              </Route>

              {/* Team Member */}
              <Route element={<RoleRoute allowed={["TeamMember"]} requiredPermission="employee.workspace.access" />}>
                <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                <Route path="/employee/attendance" element={<EmployeeAttendancePage />} />
                <Route path="/employee/payroll" element={<EmployeePayrollPage />} />
                <Route path="/employee/reviews" element={<EmployeeReviewsPage />} />
                <Route path="/employee/career-path" element={<EmployeeCareerPathPage />} />
                <Route path="/employee/onboarding" element={<EmployeeOnboardingPage />} />
                <Route path="/employee/shifts" element={<EmployeeShiftsPage />} />
                <Route path="/employee/goals" element={<EmployeeGoalsPage />} />
                <Route path="/employee/tasks" element={<EmployeeTasksPage />} />
                <Route path="/employee/training" element={<EmployeeTrainingPage />} />
                <Route path="/employee/policies" element={<EmployeePoliciesPage />} />
                <Route path="/employee/recognition" element={<EmployeeRecognitionPage />} />
                <Route path="/employee/benefits" element={<EmployeeBenefitsPage />} />
                <Route path="/employee/expenses" element={<EmployeeExpensesPage />} />
                <Route path="/employee/documents" element={<EmployeeDocumentsPage />} />
                <Route path="/employee/tickets" element={<EmployeeTicketsPage />} />
                <Route path="/employee/feedback" element={<EmployeeFeedbackPage />} />
                <Route path="/employee/profile" element={<EmployeeProfilePage />} />
              </Route>

              {/* Team Leader personal workspace */}
              <Route element={<RoleRoute allowed={["TeamLeader"]} requiredPermission="employee.workspace.access" />}>
                <Route path="/leader/dashboard" element={<LeaderDashboardPage />} />
                <Route path="/leader/attendance" element={<LeaderAttendancePage />} />
                <Route path="/leader/payroll" element={<LeaderPayrollPage />} />
                <Route path="/leader/reviews" element={<LeaderReviewsPage />} />
                <Route path="/leader/career-path" element={<LeaderCareerPathPage />} />
                <Route path="/leader/onboarding" element={<LeaderOnboardingPage />} />
                <Route path="/leader/shifts" element={<LeaderShiftsPage />} />
                <Route path="/leader/goals" element={<LeaderGoalsPage />} />
                <Route path="/leader/tasks" element={<LeaderTasksPage />} />
                <Route path="/leader/training" element={<LeaderTrainingPage />} />
                <Route path="/leader/policies" element={<LeaderPoliciesPage />} />
                <Route path="/leader/my-recognition" element={<LeaderMyRecognitionPage />} />
                <Route path="/leader/benefits" element={<LeaderBenefitsPage />} />
                <Route path="/leader/expenses" element={<LeaderExpensesPage />} />
                <Route path="/leader/documents" element={<LeaderDocumentsPage />} />
                <Route path="/leader/tickets" element={<LeaderTicketsPage />} />
                <Route path="/leader/feedback" element={<LeaderFeedbackPage />} />
                <Route path="/leader/profile" element={<LeaderProfilePage />} />
              </Route>

              {/* Team Leader workspace */}
              <Route element={<RoleRoute allowed={["TeamLeader"]} requiredPermission="leader.workspace.access" />}>
                <Route path="/leader/team" element={<TeamGoalsPage />} />
                <Route path="/leader/recognition" element={<TeamRecognitionPage />} />
              </Route>

              {/* HR Manager */}
              <Route element={<RoleRoute allowed={["HRManager"]} requiredPermission="hr.workspace.access" />}>
                <Route path="/hr/dashboard" element={<HRDashboardPage />} />
                <Route path="/hr/approvals" element={<HRApprovalCenterPage />} />
                <Route path="/hr/employees" element={<HREmployeesPage />} />
                <Route path="/hr/attendance" element={<HRAttendancePage />} />
                <Route path="/hr/payroll" element={<HRPayrollPage />} />
                <Route path="/hr/reviews" element={<HRReviewsPage />} />
                <Route path="/hr/succession" element={<HRSuccessionPage />} />
                <Route path="/hr/onboarding" element={<HROnboardingPage />} />
                <Route path="/hr/shifts" element={<HRShiftsPage />} />
                <Route path="/hr/policies" element={<HRPoliciesPage />} />
                <Route path="/hr/benefits" element={<HRBenefitsPage />} />
                <Route path="/hr/expenses" element={<HRExpensesPage />} />
                <Route path="/hr/documents" element={<HRDocumentsPage />} />
                <Route path="/hr/tickets" element={<HRTicketsPage />} />
                <Route path="/hr/training" element={<HRTrainingPage />} />
                <Route path="/hr/forms" element={<HRFormsPage />} />
                <Route path="/hr/submissions" element={<HRSubmissionPage />} />
                <Route path="/hr/jobs" element={<HRJobPostingsPage />} />
                <Route path="/hr/cv-ranking" element={<HRCVRankingPage />} />
                <Route path="/hr/team" element={<HRTeamPage />} />
                <Route path="/hr/recognition" element={<HRRecognitionPage />} />
                <Route path="/hr/profile" element={<HRProfilePage />} />
              </Route>

              {/* Admin only */}
              <Route element={<RoleRoute allowed={["Admin"]} requiredPermission="admin.workspace.access" />}>
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/employees" element={<AdminEmployeesPage />} />
                <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
                <Route path="/admin/attendance" element={<AdminAttendancePage />} />
                <Route path="/admin/payroll" element={<AdminPayrollPage />} />
                <Route path="/admin/reviews" element={<AdminReviewsPage />} />
                <Route path="/admin/succession" element={<AdminSuccessionPage />} />
                <Route path="/admin/onboarding" element={<AdminOnboardingPage />} />
                <Route path="/admin/shifts" element={<AdminShiftsPage />} />
                <Route path="/admin/policies" element={<AdminPoliciesPage />} />
                <Route path="/admin/benefits" element={<AdminBenefitsPage />} />
                <Route path="/admin/expenses" element={<AdminExpensesPage />} />
                <Route path="/admin/documents" element={<AdminDocumentsPage />} />
                <Route path="/admin/tickets" element={<AdminTicketsPage />} />
                <Route path="/admin/training" element={<AdminTrainingPage />} />
                <Route path="/admin/forms" element={<AdminFormsPage />} />
                <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
                <Route path="/admin/jobs" element={<AdminJobsPage />} />
                <Route path="/admin/cv-ranking" element={<AdminCVRankingPage />} />
                <Route path="/admin/team" element={<AdminTeamPage />} />
                <Route path="/admin/recognition" element={<AdminRecognitionPage />} />
                <Route path="/admin/profile" element={<AdminProfilePage />} />
              </Route>

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
