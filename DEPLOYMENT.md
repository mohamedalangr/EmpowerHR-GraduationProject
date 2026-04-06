# Deploying EmpowerHR

## Frontend (Vercel)
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `build`
- Environment variable: `REACT_APP_API_BASE_URL=https://your-backend.up.railway.app`

## Backend (Railway)
- Root directory: `backend`
- Builder: use the repo `Dockerfile` / `backend/Dockerfile` (smaller than the default image builder for this project)
- Start command: `gunicorn core.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --log-file -`
- Python version: `3.11.9`
- Run after deploy: `python manage.py migrate`
- Optional: `python manage.py createsuperuser`
- Build optimization: the Docker setup installs only the backend dependencies, uses no pip cache, and keeps the Railway image smaller without changing app logic

## Required backend environment variables
```env
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-backend.up.railway.app
CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app,https://your-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
DATABASE_URL=postgresql://...
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
```

## Notes
- Use Railway PostgreSQL, not local SQLite, for public deployment.
- Uploaded media should move to persistent cloud storage later if you want long-term public file hosting.
- Vercel SPA rewrites are configured in `frontend/vercel.json`.
