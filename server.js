const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const isEmailConfigured =
  Boolean(EMAIL_USER && EMAIL_PASSWORD) &&
  EMAIL_USER !== "your-email@gmail.com" &&
  EMAIL_PASSWORD !== "your-app-password";

// MongoDB connection
const MONGO_URI =
  "mongodb+srv://mohdsabir24bcy66_db_user:EcfoGRBk9fwa4U47@cluster0.hefvmrz.mongodb.net/?appName=Cluster0";
const DB_NAME = "secure_exam";
const COLLECTION_NAME = "User Data";

let client;
let database;

// Initialize MongoDB connection
async function initializeDatabase() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    database = client.db(DB_NAME);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

// Get collection
function getCollection() {
  return database.collection(COLLECTION_NAME);
}

// ADD THESE NEW FUNCTIONS HERE (after line 37):

// Get exams collection
function getExamsCollection() {
  return database.collection("exams");
}

// Get sessionLogs collection
function getSessionLogsCollection() {
  return database.collection("sessionLogs");
}

// Get OTP verification collection
function getOTPCollection() {
  return database.collection("otpVerification");
}

// Read all exams
async function readExams() {
  const collection = getExamsCollection();
  const exams = await collection.find({}).toArray();
  return exams;
}

// Find one exam by examId
async function findExamById(examId) {
  const collection = getExamsCollection();
  const exam = await collection.findOne({ examId: examId });
  if (!exam) return null;

  // Ensure every question has a stable questionId (fixes missing IDs from older exams)
  let changed = false;
  if (Array.isArray(exam.questions)) {
    exam.questions.forEach((q, idx) => {
      if (!q.questionId) {
        // Create a stable id based on index and timestamp to avoid collisions
        q.questionId = `q_${idx}_${Date.now()}`;
        changed = true;
      }
    });
  }

  if (changed) {
    // Persist the normalized exam back to the database
    await writeExam(exam);
  }

  return exam;
}

// Write/Update an exam
async function writeExam(examData) {
  const collection = getExamsCollection();
  await collection.updateOne(
    { examId: examData.examId },
    { $set: examData },
    { upsert: true },
  );
}

// Delete an exam
async function deleteExam(examId) {
  const collection = getExamsCollection();
  await collection.deleteOne({ examId: examId });
}

// Read users (MongoDB version)
async function readUsers() {
  const collection = getCollection();
  let data = await collection.findOne({ _id: "users_data" });
  if (!data) {
    data = {
      _id: "users_data",
      students: [],
      faculty: [],
      // exams: [],
      // sessionLogs: [],
    };
    await collection.insertOne(data);
  }
  return data;
}

// Write users (MongoDB version)
async function writeUsers(data) {
  const collection = getCollection();
  await collection.updateOne(
    { _id: "users_data" },
    { $set: data },
    { upsert: true },
  );
}

// ==================== EMAIL & OTP CONFIGURATION ====================

// Nodemailer transporter configuration
// Using Gmail SMTP (you can use any email service)
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    })
  : null;

// Alternative: Using any SMTP server
// const transporter = nodemailer.createTransport({
//   host: "smtp.example.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: "your-email@example.com",
//     pass: "your-password",
//   },
// });

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Store OTP in database
async function storeOTP(email, otp) {
  const collection = getOTPCollection();
  const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  await collection.updateOne(
    { email },
    {
      $set: {
        email,
        otp,
        createdAt: new Date(),
        expiresAt: expiryTime,
        verified: false,
      },
    },
    { upsert: true },
  );
}

// Verify OTP
async function verifyOTP(email, otp) {
  const collection = getOTPCollection();
  const record = await collection.findOne({ email });

  if (!record) {
    return { valid: false, message: "No OTP found for this email" };
  }

  if (new Date() > new Date(record.expiresAt)) {
    await collection.deleteOne({ email });
    return { valid: false, message: "OTP has expired" };
  }

  if (record.otp !== otp) {
    return { valid: false, message: "Invalid OTP" };
  }

  // Mark as verified
  await collection.updateOne({ email }, { $set: { verified: true } });
  return { valid: true, message: "OTP verified successfully" };
}

// Get verified email status
async function getVerifiedEmailStatus(email) {
  const collection = getOTPCollection();
  const record = await collection.findOne({ email });
  return record && record.verified ? true : false;
}

// Clean up verified OTP after registration
async function cleanupOTP(email) {
  const collection = getOTPCollection();
  await collection.deleteOne({ email });
}

// Send OTP via email
async function sendOTPEmail(email, otp) {
  try {
    if (!isEmailConfigured || !transporter) {
      return {
        success: false,
        message:
          "Email service is not configured. Set EMAIL_USER and EMAIL_PASSWORD environment variables.",
      };
    }

    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "SecureExam - Email Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">SecureExam</h1>
            <p style="margin: 5px 0 0 0;">Email Verification</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">
              Thank you for registering with SecureExam!
            </p>
            
            <p style="color: #334155; font-size: 14px; margin-bottom: 25px;">
              Please use the following One-Time Password (OTP) to verify your email address. This code will expire in 10 minutes.
            </p>
            
            <div style="background-color: #dbeafe; border: 2px solid #0284c7; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
              <p style="margin: 0; font-size: 12px; color: #0c4a6e; text-transform: uppercase; letter-spacing: 1px;">
                Your Verification Code
              </p>
              <p style="margin: 15px 0 0 0; font-size: 32px; font-weight: bold; color: #0c4a6e; letter-spacing: 5px;">
                ${otp}
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 12px; margin-bottom: 10px;">
              <strong>Security Tips:</strong>
            </p>
            <ul style="color: #64748b; font-size: 12px; margin: 0; padding-left: 20px;">
              <li>Never share this OTP with anyone</li>
              <li>SecureExam staff will never ask for your OTP</li>
              <li>This code will expire in 10 minutes</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              If you didn't request this verification, please ignore this email or contact our support team.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully" };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, message: "Failed to send OTP email" };
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true },
  }),
);

// Track active user sessions
let activeSessions = {};

// Route: Home page (landing page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Route: Serve login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Route: Serve registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

// Quietly handle browser favicon requests to avoid noisy 404 logs.
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Route: Serve dashboard page
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// Route: Register new user
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name, userType } = req.body;

    if (!email || !password || !name || !userType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email is verified
    const isEmailVerified = await getVerifiedEmailStatus(email);
    if (!isEmailVerified) {
      return res.status(400).json({
        message: "Email is not verified. Please verify your email first.",
      });
    }

    const users = await readUsers();
    const userArray = userType === "student" ? users.students : users.faculty;

    // Check if user already exists
    const userExists = userArray.some((u) => u.email === email);
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add new user
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      userType,
      createdAt: new Date().toISOString(),
      verified: true,
    };

    userArray.push(newUser);
    await writeUsers(users);

    // Clean up OTP after successful registration
    await cleanupOTP(email);

    res.status(201).json({
      message: "User registered successfully",
      user: { email, name, userType },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Send OTP to email for verification
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if email is already registered
    const users = await readUsers();
    const emailExists =
      users.students.some((u) => u.email === email) ||
      users.faculty.some((u) => u.email === email);

    if (emailExists) {
      return res.status(400).json({
        message: "This email is already registered. Please login instead.",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in database
    await storeOTP(email, otp);

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        message:
          emailResult.message || "Failed to send OTP. Please try again later.",
      });
    }

    res.json({
      message: "OTP sent successfully to your email",
      email,
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Verify OTP
    const result = await verifyOTP(email, otp);

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      message: "Email verified successfully",
      email,
      verified: true,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Login user
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
      return res
        .status(400)
        .json({ message: "Email, password, and user type are required" });
    }

    const users = await readUsers();
    const userArray = userType === "student" ? users.students : users.faculty;

    // Find user by email
    const user = userArray.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
    };

    // Track active session
    activeSessions[user.id] = {
      email: user.email,
      name: user.name,
      userType: user.userType,
      loginTime: new Date(),
    };

    res.json({ message: "Login successful", user: req.session.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Logout user
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logout successful" });
  });
});

// Route: Logout user
app.post("/api/logout", (req, res) => {
  if (req.session.user) {
    delete activeSessions[req.session.user.id];
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logout successful" });
  });
});

// Route: Get current user info
app.get("/api/user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json({ user: req.session.user });
});

// Public auth status endpoint for landing pages.
app.get("/api/user/status", (req, res) => {
  if (!req.session.user) {
    return res.json({ authenticated: false, user: null });
  }
  res.json({ authenticated: true, user: req.session.user });
});

// ===================== EXAM MANAGEMENT ROUTES =====================

// Route: Create new exam
app.post("/api/exams/create", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can create exams" });
    }

    const {
      examName,
      examDescription,
      duration,
      totalMarks,
      questions,
      availableFromTime,
      availableToTime,
      examDate,
      allowReview,
    } = req.body;

    if (!examName || !duration || !totalMarks) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const users = await readUsers();
    const examId = Date.now().toString();

    const newExam = {
      examId,
      examName,
      examDescription: examDescription || "",
      duration, // in minutes
      totalMarks,
      facultyId: req.session.user.id,
      facultyName: req.session.user.name,
      questions: questions || [],
      students: [], // Array of student IDs assigned to this exam
      submissions: [], // Array of student submissions
      availableFromTime: availableFromTime || null, // HH:MM format
      availableToTime: availableToTime || null, // HH:MM format
      examDate: examDate || new Date().toISOString().split("T")[0], // YYYY-MM-DD format
      allowReview: allowReview || false, // Whether students can review after submission
      createdAt: new Date().toISOString(),
      status: "draft", // draft, active, closed
    };

    // users.exams.push(newExam);   // removed
    await writeExam(newExam); // replaced

    res.status(201).json({ message: "Exam created successfully", examId });
  } catch (error) {
    console.error("Exam creation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get all exams for a faculty
app.get("/api/exams/faculty", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const allExams = await readExams();
    const exams = allExams.filter(
      (exam) => exam.facultyId === req.session.user.id,
    );

    res.json({ exams });
  } catch (error) {
    console.error("Fetch exams error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get exam details
app.get("/api/exams/:examId", async (req, res) => {
  try {
    // const users = await readUsers();     // removed
    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json({ exam });
  } catch (error) {
    console.error("Fetch exam error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Update exam
app.put("/api/exams/:examId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can update exams" });
    }

    // const users = await readUsers();                     // removed
    const exam = await findExamById(req.params.examId); //replaced

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    const {
      examName,
      examDescription,
      duration,
      totalMarks,
      questions,
      status,
    } = req.body;

    if (examName) exam.examName = examName;
    if (examDescription) exam.examDescription = examDescription;
    if (duration) exam.duration = duration;
    if (totalMarks) exam.totalMarks = totalMarks;
    if (questions) exam.questions = questions;
    if (status) exam.status = status;

    await writeExam(exam);

    res.json({ message: "Exam updated successfully" });
  } catch (error) {
    console.error("Update exam error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Delete exam
app.delete("/api/exams/:examId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can delete exams" });
    }

    // const users = await readUsers();
    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // const exam = users.exams[examIndex];   // removed
    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only delete your own exams" });
    }

    await deleteExam(req.params.examId);
    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    console.error("Delete exam error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Add question to exam
app.post("/api/exams/:examId/questions", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res
        .status(403)
        .json({ message: "Only faculty can add questions" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    const {
      questionText,
      questionType,
      marks,
      options,
      correctAnswer,
      imageUrl,
    } = req.body;

    if (!questionText || !marks) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const question = {
      questionId: Date.now().toString(),
      questionText,
      questionType: questionType || "mcq", // mcq, shortAnswer, essay
      marks,
      options: options || [],
      correctAnswer: correctAnswer || "",
      imageUrl: imageUrl || "",
      createdAt: new Date().toISOString(),
    };

    exam.questions.push(question);
    await writeExam(exam); // changed

    res.status(201).json({
      message: "Question added successfully",
      questionId: question.questionId,
    });
  } catch (error) {
    console.error("Add question error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Update question
app.put("/api/exams/:examId/questions/:questionId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res
        .status(403)
        .json({ message: "Only faculty can update questions" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    const question = exam.questions.find(
      (q) => q.questionId === req.params.questionId,
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const {
      questionText,
      questionType,
      marks,
      options,
      correctAnswer,
      imageUrl,
    } = req.body;

    if (questionText) question.questionText = questionText;
    if (questionType) question.questionType = questionType;
    if (marks) question.marks = marks;
    if (options) question.options = options;
    if (correctAnswer) question.correctAnswer = correctAnswer;
    if (imageUrl !== undefined) question.imageUrl = imageUrl;

    await writeExam(exam);

    res.json({ message: "Question updated successfully" });
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Delete question
app.delete("/api/exams/:examId/questions/:questionId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res
        .status(403)
        .json({ message: "Only faculty can delete questions" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    const questionIndex = exam.questions.findIndex(
      (q) => q.questionId === req.params.questionId,
    );

    if (questionIndex === -1) {
      return res.status(404).json({ message: "Question not found" });
    }

    exam.questions.splice(questionIndex, 1);
    await writeExam(exam);

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===================== STUDENT MANAGEMENT ROUTES =====================

// Route: Get all logged-in students
app.get("/api/students/active", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const users = await readUsers();
    const studentsWithSessions = users.students.map((student) => ({
      ...student,
      isActive: !!activeSessions[student.id],
    }));

    res.json({ students: studentsWithSessions });
  } catch (error) {
    console.error("Fetch students error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Search students by email
app.get("/api/students/search", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email query parameter required" });
    }

    const users = await readUsers();
    const results = users.students.filter((student) =>
      student.email.toLowerCase().includes(email.toLowerCase()),
    );

    res.json({ students: results });
  } catch (error) {
    console.error("Search students error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Add students to exam
app.post("/api/exams/:examId/add-students", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can manage exams" });
    }

    const { studentIds } = req.body;

    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ message: "studentIds must be an array" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    // Add students to exam if not already added
    studentIds.forEach((studentId) => {
      if (!exam.students.includes(studentId)) {
        exam.students.push(studentId);
      }
    });

    await writeExam(exam);

    res.json({ message: "Students added to exam successfully" });
  } catch (error) {
    console.error("Add students error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Remove student from exam
app.delete("/api/exams/:examId/remove-student/:studentId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can manage exams" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only update your own exams" });
    }

    const index = exam.students.indexOf(req.params.studentId);
    if (index > -1) {
      exam.students.splice(index, 1);
    }

    await writeExam(exam);

    res.json({ message: "Student removed from exam successfully" });
  } catch (error) {
    console.error("Remove student error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get exams for a student
app.get("/api/student/my-exams", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "student") {
      return res.status(403).json({ message: "Only students can access this" });
    }

    const allExams = await readExams();
    const myExams = allExams.filter((exam) =>
      exam.students.includes(req.session.user.id),
    );

    res.json({ exams: myExams });
  } catch (error) {
    console.error("Fetch student exams error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get all students (for faculty management)
app.get("/api/students/all", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const users = await readUsers();
    const studentsWithStatus = users.students.map((student) => ({
      id: student.id,
      email: student.email,
      name: student.name,
      isActive: !!activeSessions[student.id],
      createdAt: student.createdAt,
    }));

    res.json({ students: studentsWithStatus });
  } catch (error) {
    console.error("Fetch all students error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===================== EXAM SUBMISSION & REVIEW ROUTES =====================

// Route: Submit exam answers
app.post("/api/exams/:examId/submit", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "student") {
      return res
        .status(403)
        .json({ message: "Only students can submit exams" });
    }

    const { answers, timeSpent } = req.body;
    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (!exam.students.includes(req.session.user.id)) {
      return res
        .status(403)
        .json({ message: "You are not assigned to this exam" });
    }

    // Check if already submitted
    if (
      exam.submissions &&
      exam.submissions.find((s) => s.studentId === req.session.user.id)
    ) {
      return res
        .status(400)
        .json({ message: "You have already submitted this exam" });
    }

    // Calculate marks
    let marksObtained = 0;
    const evaluatedAnswers = exam.questions.map((question) => {
      const studentAnswer = answers[question.questionId] || "";
      let isCorrect = false;
      let marks = 0;

      if (question.questionType === "mcq") {
        isCorrect =
          studentAnswer.trim().toLowerCase() ===
          question.correctAnswer.trim().toLowerCase();
        marks = isCorrect ? question.marks : 0;
        marksObtained += marks;
      } else {
        // For short answer and essay, mark as pending for manual review
        marks = 0;
      }

      return {
        questionId: question.questionId,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        marksObtained: marks,
        questionType: question.questionType,
      };
    });

    const submission = {
      submissionId: Date.now().toString(),
      studentId: req.session.user.id,
      studentName: req.session.user.name,
      examId: req.params.examId,
      answers: evaluatedAnswers,
      marksObtained,
      totalMarks: exam.totalMarks,
      timeSpent,
      submittedAt: new Date().toISOString(),
      status: "submitted", // submitted, reviewed
    };

    if (!exam.submissions) {
      exam.submissions = [];
    }

    exam.submissions.push(submission);
    await writeExam(exam);

    res.json({
      message: "Exam submitted successfully",
      submissionId: submission.submissionId,
      marksObtained,
      totalMarks: exam.totalMarks,
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get student submission
app.get("/api/exams/:examId/submission", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(403).json({ message: "Not authenticated" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (!exam.submissions) {
      return res.status(404).json({ message: "No submission found" });
    }

    const submission = exam.submissions.find(
      (s) => s.studentId === req.session.user.id,
    );

    if (!submission) {
      return res
        .status(404)
        .json({ message: "No submission found for this student" });
    }

    // Get full exam questions for review
    const submissionWithDetails = {
      ...submission,
      exam: {
        examName: exam.examName,
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        questions: exam.questions,
      },
    };

    res.json({ submission: submissionWithDetails });
  } catch (error) {
    console.error("Fetch submission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Check if student already submitted exam
app.get("/api/exams/:examId/check-submission", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "student") {
      return res.status(403).json({ message: "Only students can access this" });
    }

    const exam = await findExamById(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const submission = exam.submissions
      ? exam.submissions.find((s) => s.studentId === req.session.user.id)
      : null;

    res.json({ hasSubmitted: !!submission, submission });
  } catch (error) {
    console.error("Check submission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get all student responses for an exam (Faculty)
app.get("/api/exams/:examId/responses", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.facultyId !== req.session.user.id) {
      return res
        .status(403)
        .json({ message: "You can only access your own exams" });
    }

    const submissions = exam.submissions || [];
    const response = {
      examId: exam.examId,
      examName: exam.examName,
      totalMarks: exam.totalMarks,
      totalQuestions: exam.questions.length,
      totalStudents: exam.students.length,
      submissionsCount: submissions.length,
      submissions: submissions.map((sub) => ({
        submissionId: sub.submissionId,
        studentId: sub.studentId,
        studentName: sub.studentName,
        marksObtained: sub.marksObtained,
        totalMarks: exam.totalMarks,
        percentage: Math.round((sub.marksObtained / exam.totalMarks) * 100),
        timeSpent: sub.timeSpent,
        submittedAt: sub.submittedAt,
        answers: sub.answers,
      })),
      questions: exam.questions,
    };

    res.json(response);
  } catch (error) {
    console.error("Get responses error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Get individual student submission (for faculty review)
app.get("/api/exams/:examId/submission/:submissionId", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can access this" });
    }

    const exam = await findExamById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const submission = exam.submissions?.find(
      (s) => s.submissionId === req.params.submissionId,
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Add answer details with question information
    const submissionWithDetails = {
      ...submission,
      exam: {
        examId: exam.examId,
        examName: exam.examName,
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        questions: exam.questions,
        allowReview: exam.allowReview,
      },
    };

    res.json({ submission: submissionWithDetails });
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route: Grade a subjective question (manual grading by faculty)
app.put(
  "/api/exams/:examId/submission/:submissionId/grade",
  async (req, res) => {
    try {
      if (!req.session.user || req.session.user.userType !== "faculty") {
        return res.status(403).json({ message: "Only faculty can grade" });
      }

      const { questionIndex, marksObtained } = req.body;

      const exam = await findExamById(req.params.examId);

      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const submission = exam.submissions?.find(
        (s) => s.submissionId === req.params.submissionId,
      );

      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const question = exam.questions[questionIndex];
      if (!question) {
        return res.status(400).json({ message: "Question not found" });
      }

      // Update marks for this answer
      if (!submission.answers[questionIndex]) {
        submission.answers[questionIndex] = {};
      }

      submission.answers[questionIndex].marksObtained = Math.min(
        marksObtained,
        question.marks,
      );

      // Recalculate total marks
      let totalMarks = 0;
      submission.answers.forEach((answer) => {
        if (answer && typeof answer.marksObtained === "number") {
          totalMarks += answer.marksObtained;
        }
      });
      submission.marksObtained = totalMarks;

      await writeExam(exam);

      res.json({
        message: "Grade saved successfully",
        submission,
      });
    } catch (error) {
      console.error("Grade submission error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Admin: Normalize all exams to ensure each question has a questionId
app.post("/api/admin/normalize-exams", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.userType !== "faculty") {
      return res.status(403).json({ message: "Only faculty can run this" });
    }

    const collection = getExamsCollection();
    const exams = await collection.find({}).toArray();
    let updated = 0;

    for (const exam of exams) {
      let changed = false;
      if (Array.isArray(exam.questions)) {
        exam.questions.forEach((q, idx) => {
          if (!q.questionId) {
            q.questionId = `q_${idx}_${Date.now()}`;
            changed = true;
          }
        });
      }
      if (changed) {
        await writeExam(exam);
        updated++;
      }
    }

    res.json({
      message: "Normalization complete",
      total: exams.length,
      updated,
    });
  } catch (error) {
    console.error("Normalization error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
