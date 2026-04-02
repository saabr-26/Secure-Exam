# Project Overview

SecureExam is a web-based examination platform built with Express, MongoDB, sessions, bcrypt password hashing, and a browser-based UI.

## What the system does

- Registers students and faculty with email OTP verification.
- Authenticates users with session-based login.
- Lets faculty create, edit, activate, close, and delete exams.
- Lets faculty add or remove students from specific exams.
- Lets students view assigned exams and take them in a timed interface.
- Automatically grades MCQ questions on submission.
- Stores subjective answers for manual grading by faculty.
- Lets students review their own submissions when review is enabled.
- Lets faculty inspect all submissions and grade individual answers.

## Roles

- Student: sees assigned exams, submits answers, and reviews results.
- Faculty: creates exams, manages students, and reviews/grads submissions.

## Data storage

- Users are stored in the `User Data` MongoDB document as `students` and `faculty` arrays.
- Exams are stored in the `exams` collection.
- OTP verification records are stored in the `otpVerification` collection.

## Core flow

1. User opens the site and registers.
2. System sends OTP to email.
3. User verifies OTP.
4. Account is created.
5. User logs in and receives a session.
6. Faculty creates exams and assigns students.
7. Student takes exam within the allowed time window.
8. Backend grades MCQs and stores submission.
9. Faculty reviews and grades subjective answers.
