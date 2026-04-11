# API Reference

This is a short reference for the main backend routes used by the UI.

## Auth and user routes

- `GET /api/user` - returns the current session user or 401.
- `GET /api/user/status` - returns `{ authenticated, user }` for public pages.
- `POST /api/login` - signs a user in.
- `POST /api/logout` - destroys the session.
- `POST /api/send-otp` - generates and emails an OTP.
- `POST /api/verify-otp` - verifies the OTP.
- `POST /api/register` - creates the account after OTP verification.

## Exam routes

- `POST /api/exams/create` - create an exam as faculty.
- `GET /api/exams/faculty` - list exams owned by the logged-in faculty.
- `GET /api/exams/:examId` - fetch exam details.
- `PUT /api/exams/:examId` - update exam metadata or status.
- `DELETE /api/exams/:examId` - delete an exam.

## Question routes

- `POST /api/exams/:examId/questions` - add a question.
- `PUT /api/exams/:examId/questions/:questionId` - edit a question.
- `DELETE /api/exams/:examId/questions/:questionId` - remove a question.

## Student management routes

- `GET /api/students/all` - list all students with active state.
- `GET /api/students/search?email=...` - search students by email.
- `POST /api/exams/:examId/add-students` - assign students to an exam.
- `DELETE /api/exams/:examId/remove-student/:studentId` - remove a student from an exam.
- `GET /api/student/my-exams` - list exams assigned to the current student.

## Submission and review routes

- `POST /api/exams/:examId/submit` - submit answers and auto-grade MCQs.
- `GET /api/exams/:examId/check-submission` - check whether a student already submitted.
- `GET /api/exams/:examId/submission` - fetch the current student submission.
- `GET /api/exams/:examId/responses` - faculty view of all submissions.
- `GET /api/exams/:examId/submission/:submissionId` - fetch one submission for review.
- `PUT /api/exams/:examId/submission/:submissionId/grade` - manually grade a subjective answer.
