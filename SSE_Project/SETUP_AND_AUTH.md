# Setup and Authentication

This file explains how to run the app and how registration/login works.

## Run the project

1. Install dependencies:

```powershell
npm install
```

2. Set email variables before starting the server:

```powershell
$env:EMAIL_USER="yourgmail@gmail.com"
$env:EMAIL_PASSWORD="your_gmail_app_password"
npm start
```

3. Open the app in the browser:

- http://localhost:3000/

## Registration flow

1. User opens [register.html](register.html).
2. The form collects role, name, email, password, and confirmation.
3. Frontend calls `POST /api/send-otp`.
4. Backend generates a 6-digit OTP and stores it in MongoDB with a 10-minute expiry.
5. Backend sends the OTP email with Nodemailer.
6. User enters the OTP.
7. Frontend calls `POST /api/verify-otp`.
8. If valid, frontend calls `POST /api/register`.
9. Backend hashes the password with bcrypt and stores the account.
10. User is redirected to login.

## Login flow

1. User submits email, password, and role on [login.html](login.html).
2. Frontend calls `POST /api/login`.
3. Backend checks the stored bcrypt hash.
4. If correct, a session is created and the user is redirected to the dashboard.

## Important email requirement

- Gmail App Password is required when using Gmail SMTP.
- Normal Gmail passwords usually do not work for app SMTP login.
- If email is not configured, OTP sending will fail with a clear backend message.
