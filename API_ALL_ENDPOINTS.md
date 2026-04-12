# EmpowerHR API: All GET & POST Endpoints

## Authentication & User Management
- **POST** `/api/auth/login/` — Login, get JWT tokens
- **POST** `/api/auth/logout/` — Logout
- **POST** `/api/auth/token/refresh/` — Refresh JWT token
- **GET/PATCH** `/api/auth/me/` — Get/update user profile
- **POST** `/api/auth/change-password/` — Change password
- **POST** `/api/auth/candidate/register/` — Register as candidate
- **POST** `/api/auth/password-reset/request/` — Request password reset
- **POST** `/api/auth/password-reset/confirm/` — Confirm password reset
- **POST** `/api/auth/employees/create/` — Create employee (Admin)
- **GET** `/api/auth/demo-access/` — Demo credentials

---

## Mobile App Endpoints (`/api/mobile/`)
- **GET** `/api/mobile/notifications/` — List notifications
- **GET** `/api/mobile/dashboard/` — Employee dashboard stats
- **GET** `/api/mobile/hr/dashboard/` — HR manager dashboard
- **GET** `/api/mobile/hr/attendance-analytics/` — HR attendance analytics
- **GET** `/api/mobile/hr/employees/` — HR employee list
- **POST** `/api/mobile/attendance/clock-in/` — Employee clock in/out
- **POST** `/api/mobile/leave-requests/` — Employee leave request
- **POST** `/api/mobile/tickets/` — Employee helpdesk ticket
- **GET** `/api/mobile/tasks/` — Employee tasks
- **POST** `/api/mobile/manager/leave-requests/{id}/action/` — Manager approve/reject leave
- **POST** `/api/mobile/manager/attendance-corrections/{id}/action/` — Manager approve/reject attendance correction

---

## Feedback (Surveys, Approvals)
- **GET/POST** `/api/feedback/hr/forms/` — List/create feedback forms (HR)
- **GET/PUT/DELETE** `/api/feedback/hr/forms/<form_id>/` — Manage a form (HR)
- **POST** `/api/feedback/hr/forms/<form_id>/activate/` — Activate a form (HR)
- **POST** `/api/feedback/hr/forms/<form_id>/deactivate/` — Deactivate a form (HR)
- **GET/POST** `/api/feedback/hr/forms/<form_id>/questions/` — List/add questions (HR)
- **PUT/DELETE** `/api/feedback/hr/questions/<question_id>/` — Update/delete question (HR)
- **GET** `/api/feedback/hr/approvals/snapshot/` — Approval queue (HR)
- **GET** `/api/feedback/hr/submissions/` — List submissions (HR)
- **GET** `/api/feedback/hr/submissions/insights/` — Insights for a form (HR)
- **GET** `/api/feedback/hr/forms/response-snapshot/` — Survey health (HR)
- **GET** `/api/feedback/hr/insights/` — Workforce analytics (HR)
- **GET** `/api/feedback/hr/intelligence/` — People intelligence (HR)
- **GET** `/api/feedback/forms/` — List forms (Employee)
- **GET** `/api/feedback/forms/<form_id>/` — Get form details (Employee)
- **POST** `/api/feedback/forms/<form_id>/submit/` — Submit feedback (Employee)

---

## Attrition (AI)
- **POST** `/api/attrition/run/` — Run attrition prediction (HR)
- **GET** `/api/attrition/predictions/` — List predictions (HR)
- **GET** `/api/attrition/predictions/latest/` — Latest prediction per employee (HR)
- **GET** `/api/attrition/governance/` — Governance snapshot (HR)

---

## Recruitment / Resume Pipeline
- **GET/POST** `/api/recruitment/jobs/` — List/create jobs
- **GET** `/api/recruitment/jobs/health/` — Hiring funnel (HR)
- **GET/POST** `/api/recruitment/jobs/<id>/weights/` — Get/update job weights (HR)
- **GET** `/api/recruitment/jobs/<id>/` — Job details
- **GET** `/api/recruitment/jobs/<id>/submissions/` — List submissions for a job (HR)
- **GET** `/api/recruitment/jobs/<id>/ranking/` — Get CV ranking (HR)
- **POST** `/api/recruitment/submit/` — Submit resume
- **GET** `/api/recruitment/applications/` — List candidate applications
- **GET** `/api/recruitment/submissions/<id>/` — Submission details (HR/Candidate)
- **PATCH** `/api/recruitment/submissions/<id>/stage/` — Update submission stage (HR)

---

- All endpoints end with a `/` (trailing slash).
- Use the correct HTTP method (GET, POST, PATCH, PUT, DELETE) as shown.
- For endpoints with `{id}` or `<form_id>`, replace with the actual object ID.
- Mobile and web must send authentication tokens for protected endpoints.
