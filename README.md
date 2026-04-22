# Gift Store (MERN)

This project is configured as a MERN stack app:

- MongoDB: database
- Express + Node.js: backend API in `backend`
- React: frontend app in `frontend`

## Project Structure

- `backend`: Express + Mongoose API
- `frontend`: React application
- `package.json` (root): scripts to run full stack

## Setup

1. Install all dependencies:

```bash
npm run install:all
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env` with your MongoDB URI if needed.
# Configure ENV Variables
## PORT=
## MONGO_URI=
## SMTP_HOST= Infer SMTP host from email domain if not explicitly set via SMTP_HOST env var. This allows OTP email functionality to work out-of-the-box with common email providers by just setting SMTP_USER and SMTP_PASS env vars.
## SMTP_USER = Ensure SMTP_USER is set for OTP email functionality, or it will be disabled. The host will be inferred from this email if SMTP_HOST is not set.
## SMTP_PORT=
## SMTP_SECURE=
## SMTP_PASS=
## SMTP_FROM=
## OTP_SECRET=
## OTP_TTL_MINUTES=10
## OTP_RESEND_COOLDOWN_SECONDS=30
## OTP_MAX_VERIFY_ATTEMPTS=5


## Run (Full MERN)

From project root:

```bash
npm run dev
```

This starts:

- Backend on `http://localhost:5001`
- Frontend on `http://localhost:3000`

## Useful Scripts

- `npm run server`: run backend only (nodemon)
- `npm run client`: run frontend only
- `npm run build`: build frontend production bundle
- `npm start`: run backend in production mode
