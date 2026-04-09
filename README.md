# EmpowerHR Graduation Project

EmpowerHR is a full-stack HR and recruitment platform built with **Django + Django REST Framework** on the backend and **React** on the frontend. It supports role-based workspaces for **Candidates, Employees, Team Leaders, HR Managers, and Admins**.

---

## ✨ Key capabilities

- Authentication and role-based access control
- Employee directory and workforce records
- Attendance, leave, payroll, reviews, training, goals, and tasks
- Succession, onboarding, shifts, policies, and recognition
- Benefits, expenses, document requests, and support tickets
- Recruitment workflows, CV ranking, and attrition insights

---

## 🧱 Project structure

- `backend/` — Django API and business logic
- `frontend/` — React application and role-based UI
- `USER_GUIDE.md` — short guide for HR, Employee, Candidate, and related roles
- `DEPLOYMENT.md` — deployment steps and readiness review

---

## 🚀 Local setup

### 1) Backend
```powershell
cd backend
C:/Python314/python.exe -m pip install -r requirements.txt
copy .env.example .env
C:/Python314/python.exe manage.py migrate
C:/Python314/python.exe manage.py runserver
```

Backend runs at:
- `http://127.0.0.1:8000/`
- API base: `http://127.0.0.1:8000/api/`

### 2) Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm start
```

Frontend runs at:
- `http://localhost:3000/`

---

## 🔐 Environment files

### `backend/.env`
Use `backend/.env.example` as the starting point.

Important values include:
- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- optional Cloudinary media credentials

### `frontend/.env`
Use `frontend/.env.example` as the starting point.

Important value:
- `REACT_APP_API_BASE_URL=http://127.0.0.1:8000`

---

## 👥 Short role guide

### Candidate
- Browse open jobs
- Apply and upload a CV
- Track application progress

### Employee
- Use the dashboard for daily work
- Manage attendance, payroll, training, goals, and requests
- Access benefits, expenses, documents, and support tickets

### HR Manager
- Run people operations and approvals
- Manage employees, payroll, attendance, reviews, and service queues
- Oversee recruitment, forms, submissions, and CV ranking

For the full short guide, see [`USER_GUIDE.md`](./USER_GUIDE.md).

---

## ✅ Verification commands

### Backend
```powershell
cd backend
C:/Python314/python.exe manage.py check
C:/Python314/python.exe manage.py test feedback.tests
```

### Frontend
```powershell
cd frontend
npm run build
```

---

## 📦 Deployment readiness snapshot

| Area | Status | Notes |
|---|---|---|
| Backend env-based settings | ✅ Ready | Uses environment variables for hosts, CORS, CSRF, security, and database |
| PostgreSQL support | ✅ Ready | `DATABASE_URL` is supported for production |
| Static file serving | ✅ Ready | WhiteNoise is configured |
| Frontend production build | ✅ Ready | React build completes successfully |
| Vercel SPA routing | ✅ Ready | `vercel.json` rewrite is present |
| Backend containerization | ✅ Ready | Root `Dockerfile` is available |
| Media hosting | 🟡 Optional | Cloudinary support is available if enabled |
| Project-specific deployment values | 🟡 Needed | Real domains, secrets, DB URL, and hosted env vars must be set |

For deployment details and the readiness review, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 🧪 Demo data on a live deployment

Pushing the code to GitHub **does not automatically insert sample data into the live database**.
The production database is separate from the repository, so demo records only appear if you explicitly run:

```powershell
cd backend
C:/Python314/python.exe manage.py migrate
C:/Python314/python.exe manage.py load_sample_data
```

Important behavior:
- once seeded, the demo data is stored in the database like normal records
- it **can be edited, approved, deleted, and updated** from the app or admin tools
- future code pushes do **not** wipe it unless the host resets or recreates the database

## 📝 Notes

- Use **SQLite** for local development and **PostgreSQL** for production.
- Replace all default secrets before public deployment.
- Keep frontend and backend environment variables aligned with the final deployed domains.
- The mobile app, if used, should call the hosted API rather than connecting directly to the database.

