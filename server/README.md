# Time Keeping Server

Lightweight Node/Express backend using SQLite.

Quick start:

1. cd server
2. npm install
3. create a `.env` file with `JWT_SECRET=your_secret` (optional)
4. npm start

API endpoints:
- `POST /api/auth/register` { username, email, password }
- `POST /api/auth/login` { email, password }
- `GET/POST /api/time-entries` (requires `Authorization: Bearer <token>`)
