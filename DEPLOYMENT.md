# Deployment Readiness Review — EmpowerHR

This document summarizes the current deployment readiness of the project and the recommended release setup.

---

## 1) Recommended hosting stack

### Frontend
- **Platform:** Vercel
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Output directory:** `build`
- **Key environment variable:**
  ```env
  REACT_APP_API_BASE_URL=https://your-backend.up.railway.app
  ```

### Backend
- **Platform:** Railway
- **Root directory:** `backend`
- **Container:** root `Dockerfile`
- **Start command:**
  ```bash
  sh -c "gunicorn core.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120 --log-file -"
  ```
- **Python version target:** `3.11.x`

---

## 2) Readiness checklist

| Item | Status | Notes |
|---|---|---|
| Django production settings via env vars | ✅ Ready | `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and CSRF settings are environment-driven |
| PostgreSQL support | ✅ Ready | `DATABASE_URL` is supported for production |
| WhiteNoise static serving | ✅ Ready | Static assets are configured for production |
| Gunicorn server dependency | ✅ Ready | Included in `requirements.txt` |
| Railway / Docker backend deployment | ✅ Ready | Root `Dockerfile` is present |
| Vercel SPA routing | ✅ Ready | `vercel.json` rewrite is configured |
| Frontend API base configuration | ✅ Ready | `REACT_APP_API_BASE_URL` is supported |
| Media storage option | 🟡 Optional | Cloudinary support is available if needed |
| Production secrets and domains | 🟡 Required before launch | Real values must be configured in the host dashboards |
| Post-deploy migrations | 🟡 Required before launch | Must run after each production deploy |

---

## 3) Required backend environment variables

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
SECURE_HSTS_PRELOAD=True
```

### Optional media storage
```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 4) Post-deploy commands

Run these on the backend service after deployment:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### Optional: load demo/sample data for presentations

If you want the live website to open with realistic demo records, run this once after migrations:

```bash
python manage.py load_sample_data
```

> Pushing to GitHub alone does **not** load sample data into the production database.
> The command above inserts editable database rows that will stay available until you remove them or reset the DB.

---

## 5) Final pre-launch checks

Before presenting or releasing publicly, confirm the following:

- [ ] Backend URL is reachable over HTTPS
- [ ] Frontend points to the deployed API URL
- [ ] PostgreSQL is used in production instead of SQLite
- [ ] CORS and CSRF origins match the real frontend domain
- [ ] Admin login works in production
- [ ] Static files load correctly after deploy
- [ ] File uploads work if Cloudinary is enabled
- [ ] `npm run build` succeeds locally before the final push

---

## 6) Deployment conclusion

**Current status:** the project is **deployment-ready from a configuration perspective**, and mainly needs final hosted environment values, production database setup, and post-deploy verification on the real domains.

