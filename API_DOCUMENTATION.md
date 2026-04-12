# EmpowerHR API Documentation

---

## Accounts (Authentication & User Management)

### Public (Candidate/Anyone)
- **POST** `/api/auth/candidate/register/` — Register as candidate
- **POST** `/api/auth/password-reset/request/` — Request password reset
- **POST** `/api/auth/password-reset/confirm/` — Confirm password reset
- **GET** `/api/auth/demo-access/` — Demo credentials

### Authenticated Users (Employee, HR, Admin)
- **POST** `/api/auth/login/` — Login, get JWT tokens
- **POST** `/api/auth/logout/` — Logout
- **POST** `/api/auth/token/refresh/` — Refresh JWT token
- **GET/PATCH** `/api/auth/me/` — Get/update user profile
- **POST** `/api/auth/change-password/` — Change password

### Admin Only
- **POST** `/api/auth/employees/create/` — Create employee

---

## Feedback (HR, Employee)

### HR Manager
- **GET/POST** `/api/feedback/hr/forms/` — List/create feedback forms
- **GET/PUT/DELETE** `/api/feedback/hr/forms/<form_id>/` — Manage a form
- **POST** `/api/feedback/hr/forms/<form_id>/activate/` — Activate a form
- **POST** `/api/feedback/hr/forms/<form_id>/deactivate/` — Deactivate a form
- **GET/POST** `/api/feedback/hr/forms/<form_id>/questions/` — List/add questions
- **PUT/DELETE** `/api/feedback/hr/questions/<question_id>/` — Update/delete question
- **GET** `/api/feedback/hr/approvals/snapshot/` — Approval queue
- **GET** `/api/feedback/hr/submissions/` — List submissions
- **GET** `/api/feedback/hr/submissions/insights/` — Insights for a form
- **GET** `/api/feedback/hr/forms/response-snapshot/` — Survey health
- **GET** `/api/feedback/hr/insights/` — Workforce analytics
- **GET** `/api/feedback/hr/intelligence/` — People intelligence

### Employee
- **GET** `/api/feedback/forms/` — List forms
- **GET** `/api/feedback/forms/<form_id>/` — Get form details
- **POST** `/api/feedback/forms/<form_id>/submit/` — Submit feedback

---

## Attrition (HR)
- **POST** `/api/attrition/run/` — Run attrition prediction
- **GET** `/api/attrition/predictions/` — List predictions
- **GET** `/api/attrition/predictions/latest/` — Latest prediction per employee
- **GET** `/api/attrition/governance/` — Governance snapshot

---

## Recruitment / Resume Pipeline

### Public (Candidates)
- **GET** `/api/recruitment/jobs/` — List jobs
- **GET** `/api/recruitment/jobs/<id>/` — Job details
- **POST** `/api/recruitment/submit/` — Submit resume
- **GET** `/api/recruitment/applications/` — List candidate applications

### HR Manager
- **PATCH** `/api/recruitment/jobs/<id>/weights/` — Update job weights
- **GET** `/api/recruitment/jobs/health/` — Hiring funnel
- **GET** `/api/recruitment/jobs/<id>/weights/` — Get job weights
- **GET** `/api/recruitment/jobs/<id>/submissions/` — List submissions for a job
- **GET** `/api/recruitment/jobs/<id>/ranking/` — Get CV ranking
- **GET** `/api/recruitment/submissions/<id>/` — Submission details
- **PATCH** `/api/recruitment/submissions/<id>/stage/` — Update submission stage

---

## Notes
- Endpoints with `<id>`, `<form_id>`, or `<question_id>` require the actual object ID.
- Each endpoint is protected by role-based permissions (HR, Employee, Candidate, Admin, or Public).
- For request/response fields, see the corresponding serializer in your code.
