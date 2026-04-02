# Troubleshooting

## 401 on `/api/user`

- This is expected when no session exists.
- Public pages should use `GET /api/user/status` if they only need a login check without console noise.

## 404 on `/favicon.ico`

- The browser requests a favicon automatically.
- A missing favicon is harmless, but it creates noisy console output.
- The backend now returns an empty response for this request.

## OTP email is not arriving

- Check that `EMAIL_USER` and `EMAIL_PASSWORD` are set before starting the server.
- For Gmail, use a Gmail App Password, not your normal Gmail password.
- Check spam or promotions folders.
- If the backend returns an email configuration error, the credentials are missing or invalid.

## Registration says email is not verified

- You must use the OTP flow on [register.html](register.html).
- Do not submit the homepage form directly unless it redirects you to OTP registration.

## Login fails after registration

- Make sure you registered with the same role you selected on login.
- Ensure the OTP step completed successfully before account creation.

## Exam page says already submitted

- The backend blocks duplicate submissions per student per exam.
- Use the review page instead of attempting to resubmit.

## Backend will not start

- Confirm MongoDB URI is reachable.
- Confirm Node.js dependencies are installed.
- Check the terminal for the first stack trace line; it usually shows the real cause.
