# EmpowerHR Graduation Project

A full-stack HR platform built with **Django + DRF + SQLite** on the backend and **React** on the frontend.

## Features
- Authentication and role-based access
- Employee directory and workforce records
- Attendance, leave, payroll, reviews, training, goals, tasks
- Succession, onboarding, shifts, policies, recognition
- Benefits, expenses, document requests, and support tickets
- Recruitment / CV ranking and attrition insights

---

## Project Structure
- `backend/` — Django API
- `frontend/` — React app

---

## Backend Setup
```powershell
cd backend
C:/Python314/python.exe -m pip install -r requirements.txt
copy .env.example .env
C:/Python314/python.exe manage.py migrate
C:/Python314/python.exe manage.py runserver
```

Backend runs at:
- `http://127.0.0.1:8000/`
- API root prefixes under `http://127.0.0.1:8000/api/`

## Frontend Setup
```powershell
cd frontend
npm install
copy .env.example .env
npm start
```

Frontend runs at:
- `http://localhost:3000/`

---

## Environment Files
### `backend/.env`
Use `backend/.env.example` as a starting point.

Key values:
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`

### `frontend/.env`
Use `frontend/.env.example` as a starting point.

Key value:
- `REACT_APP_API_BASE=http://127.0.0.1:8000/api`

---

## Verification Commands
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

## Production Notes
- Replace the default Django secret key
- Set `DJANGO_DEBUG=False`
- Restrict `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
- Serve Django static files from `staticfiles/`
- Consider moving from SQLite to PostgreSQL for production

## Low-Cost Deployment (Recommended)
### Stack
- **Frontend**: Vercel
- **Backend API**: Hetzner VPS + Nginx + Gunicorn
- **Database**: Neon PostgreSQL
- **DNS / SSL**: Cloudflare + Let's Encrypt

### Backend deployment outline
```bash
# on the VPS
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv nginx git certbot python3-certbot-nginx -y

cd /var/www
git clone <your-repo-url> empowerhr
cd empowerhr/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend/.env` with your hosted settings, especially:
```env
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.example.com,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://app.example.com,https://api.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Then run:
```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

Start the API with Gunicorn behind Nginx and point your domain to it:
- `api.example.com` -> Hetzner VPS
- `app.example.com` -> Vercel frontend

### Frontend deployment outline
Set `frontend/.env` or the Vercel environment variable:
```env
REACT_APP_API_BASE=https://api.example.com/api
```
Then deploy the `frontend/` folder to Vercel with:
```bash
npm install
npm run build
```

### Mobile app note
The mobile app should call the same Django API domain (`https://api.example.com/api`).
It should **not** connect directly to PostgreSQL.
