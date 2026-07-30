import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI Server-side SDK
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Persistent Database Storage File Path
const DB_FILE_PATH = path.join(process.cwd(), "data", "vitasync_db.json");

// Ensure data directory exists
const dataDir = path.dirname(DB_FILE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial Database Schema and Seed Data
const initialDB = {
  users: [
    {
      id: "USR-101",
      fullName: "Dr. Eleanor Vance, MD",
      email: "dr.vance@vitasync.med",
      password: "password123",
      role: "Attending Orthopedic Surgeon",
      department: "Joint Reconstruction & Orthopedics",
      staffId: "STAFF-8901",
      createdAt: new Date().toISOString()
    },
    {
      id: "USR-102",
      fullName: "Sarah Jenkins, RN",
      email: "nurse.sarah@vitasync.med",
      password: "password123",
      role: "Post-Op Charge Nurse",
      department: "Surgical Intensive Care Unit (SICU)",
      staffId: "STAFF-4412",
      createdAt: new Date().toISOString()
    },
    {
      id: "USR-103",
      fullName: "Dr. Marcus Sterling, MD",
      email: "dr.sterling@vitasync.med",
      password: "password123",
      role: "Chief of Cardiothoracic Surgery",
      department: "Cardiothoracic Surgery Department",
      staffId: "STAFF-1002",
      createdAt: new Date().toISOString()
    }
  ],
  vitalsLogs: [
    {
      ROWID: "DB-1005820000001001",
      PatientID: "PT-8942",
      patientName: "Eleanor Vance",
      surgeryType: "Total Knee Arthroplasty (TKA)",
      postOpDay: 2,
      Temperature: 98.6,
      HeartRate: 74,
      PainLevel: 3,
      Status: "Normal",
      message: "Vitals Stable: Patient PT-8942 is recovering within safe post-operative physiological parameters.",
      CREATEDTIME: new Date(Date.now() - 3600000 * 4).toISOString(),
      recordedBy: "Dr. Eleanor Vance, MD",
      aiAssessment: {
        summary: "Patient exhibits normal thermoregulation and hemodynamic recovery following joint arthroplasty.",
        severityScore: 12,
        clinicalFlags: ["Wound Healing Normal", "Normocardia"],
        recommendedActions: ["Continue scheduled oral analgesics", "Encourage assisted physical therapy mobility"],
        medicationAdvisory: "Acetaminophen 650mg Q6H PRN pain.",
        triageLevel: "Routine Nursing Monitor"
      }
    },
    {
      ROWID: "DB-1005820000001002",
      PatientID: "PT-1042",
      patientName: "Marcus Sterling",
      surgeryType: "Coronary Artery Bypass Graft (CABG)",
      postOpDay: 1,
      Temperature: 101.8,
      HeartRate: 118,
      PainLevel: 9,
      Status: "Critical",
      message: "CRITICAL ALERT: Immediate medical evaluation required for Patient PT-1042. Triggers: Pyrexia/High Fever (101.8°F), Tachycardia (118 BPM), Severe Breakthrough Pain (9/10).",
      CREATEDTIME: new Date(Date.now() - 3600000 * 2).toISOString(),
      recordedBy: "Sarah Jenkins, RN",
      aiAssessment: {
        summary: "High risk post-cardiac surgical pyrexia coupled with tachycardia and severe pain. Possible systemic inflammation or early sternal infection.",
        severityScore: 92,
        clinicalFlags: ["Fever > 101°F", "Tachycardia > 110 BPM", "Uncontrolled Post-Op Pain > 8"],
        recommendedActions: [
          "Stat Blood Cultures x2 & CBC",
          "Notify On-Call Cardiothoracic Surgeon immediately",
          "Administer IV antipyretics per Standing Post-CABG Protocol",
          "12-Lead ECG to rule out atrial fibrillation"
        ],
        medicationAdvisory: "IV Hydromorphone stat for severe surgical pain; IV Acetaminophen for pyrexia.",
        triageLevel: "Emergency Triage"
      }
    },
    {
      ROWID: "DB-1005820000001003",
      PatientID: "PT-3309",
      patientName: "Sophia Patel",
      surgeryType: "Laparoscopic Appendectomy",
      postOpDay: 1,
      Temperature: 98.8,
      HeartRate: 82,
      PainLevel: 4,
      Status: "Normal",
      message: "Vitals Stable: Patient PT-3309 recovering safely following minimally invasive abdominal procedure.",
      CREATEDTIME: new Date(Date.now() - 1800000).toISOString(),
      recordedBy: "Dr. Marcus Sterling, MD",
      aiAssessment: {
        summary: "Vitals within normal limits post-laparoscopy. Mild abdominal gas distension pain expected.",
        severityScore: 18,
        clinicalFlags: ["Mild Post-Lap Incisional Pain"],
        recommendedActions: ["Encourage ambulation to resolve laparoscopic gas distension", "Clear liquid diet progression"],
        medicationAdvisory: "Ibuprofen 400mg PO with meals.",
        triageLevel: "Routine Nursing Monitor"
      }
    }
  ]
};

// Database Read/Write Helper Functions
function getDatabase() {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDB, null, 2), "utf-8");
      return initialDB;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Database load error, initializing default:", err);
    return initialDB;
  }
}

function saveDatabase(db: any) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Database save error:", err);
  }
}

// Helper to generate AI medical analysis via Gemini
async function generateAIMedicalAssessment(
  patientId: string,
  temperature: number,
  heartRate: number,
  painLevel: number,
  status: "Critical" | "Normal"
) {
  if (!ai || !process.env.GEMINI_API_KEY) {
    return {
      summary: status === "Critical" 
        ? "Post-operative vitals exceed safe physiological thresholds requiring urgent clinical review." 
        : "Post-operative vitals within acceptable physiological recovery ranges.",
      severityScore: status === "Critical" ? 88 : 15,
      clinicalFlags: status === "Critical" ? ["Elevated Vitals Alert"] : ["Stable Post-Op Trajectory"],
      recommendedActions: status === "Critical" 
        ? ["Alert attending physician immediately", "Re-check vitals in 15 mins", "Assess surgical wound site"]
        : ["Continue routine vitals charting Q4H", "Support early mobilization"],
      medicationAdvisory: status === "Critical" 
        ? "Review analgesic order set and initiate antipyretic protocol if temp > 101°F."
        : "Administer prescribed oral analgesics PRN.",
      triageLevel: status === "Critical" ? "Emergency Triage" : "Routine Nursing Monitor"
    };
  }

  try {
    const prompt = `You are a Senior Post-Operative Clinical Specialist AI assisting a hospital care team.
    
Analyze these post-surgery patient vitals:
- Patient ID: ${patientId}
- Temperature: ${temperature}°F (Normal: 97.5 - 99.5°F, Critical: >101.0°F)
- Heart Rate: ${heartRate} BPM (Normal: 60 - 100 BPM, Critical: >110 BPM)
- Pain Level: ${painLevel}/10 (Normal/Manageable: <= 8, Critical: >8)
- Computed Rule Status: ${status}

Provide a concise JSON response strictly formatted as:
{
  "summary": "2-sentence clinical assessment of the patient's immediate post-op state",
  "severityScore": number between 1 and 100,
  "clinicalFlags": ["array", "of", "clinical", "findings"],
  "recommendedActions": ["array", "of", "3-4", "immediate", "nursing/doctor", "actions"],
  "medicationAdvisory": "1-sentence medication or pain management advisory",
  "triageLevel": "Emergency Triage" or "Physician Notification" or "Routine Nursing Monitor"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      summary: parsed.summary || (status === "Critical" ? "Immediate clinical evaluation required." : "Patient recovering safely."),
      severityScore: parsed.severityScore || (status === "Critical" ? 85 : 15),
      clinicalFlags: parsed.clinicalFlags || [status === "Critical" ? "Vitals Exceed Safe Limits" : "Stable Trajectory"],
      recommendedActions: parsed.recommendedActions || [status === "Critical" ? "Notify physician immediately" : "Standard care plan"],
      medicationAdvisory: parsed.medicationAdvisory || "Review post-op pain management orders.",
      triageLevel: parsed.triageLevel || (status === "Critical" ? "Emergency Triage" : "Routine Nursing Monitor")
    };
  } catch (err) {
    console.error("Gemini AI Assessment Error:", err);
    return {
      summary: status === "Critical" ? "Critical vitals alert triggered. Urgent medical review recommended." : "Vitals within normal limits.",
      severityScore: status === "Critical" ? 85 : 15,
      clinicalFlags: [status === "Critical" ? "Critical Boundary Reached" : "Normal Recovery"],
      recommendedActions: [status === "Critical" ? "Immediate bedside clinical assessment" : "Routine monitoring"],
      medicationAdvisory: "Follow standard post-operative pain protocols.",
      triageLevel: status === "Critical" ? "Emergency Triage" : "Routine Nursing Monitor"
    };
  }
}

// --- API ROUTES ---

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "VitaSync Clinical Database Server" });
});

// AUTHENTICATION ROUTES

// POST /api/auth/login - Sign in user
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required." });
      return;
    }

    const db = getDatabase();
    const user = db.users.find(
      (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      res.status(401).json({ success: false, error: "User not found with this email." });
      return;
    }

    if (user.password && user.password !== password) {
      res.status(401).json({ success: false, error: "Incorrect password." });
      return;
    }

    // Return user without password field
    const { password: _, ...userSafe } = user;
    res.json({
      success: true,
      message: "Authentication successful",
      user: userSafe
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Authentication error" });
  }
});

// POST /api/auth/register - Register new user in Database
app.post("/api/auth/register", (req, res) => {
  try {
    const { fullName, email, password, role, department, staffId } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ success: false, error: "Full Name, Email, and Password are required." });
      return;
    }

    const db = getDatabase();
    const existing = db.users.find(
      (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (existing) {
      res.status(400).json({ success: false, error: "User with this email already exists." });
      return;
    }

    const newUser = {
      id: "USR-" + Date.now(),
      fullName: fullName.trim(),
      email: email.trim(),
      password: password,
      role: role || "Attending Physician",
      department: department || "General Surgery",
      staffId: staffId || "STAFF-" + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    saveDatabase(db);

    const { password: _, ...userSafe } = newUser;
    res.json({
      success: true,
      message: "User account created and saved in Database",
      user: userSafe
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Registration error" });
  }
});

// GET /api/auth/users - List registered users in database
app.get("/api/auth/users", (req, res) => {
  const db = getDatabase();
  const safeUsers = db.users.map(({ password, ...u }: any) => u);
  res.json({ success: true, users: safeUsers });
});

// VITALS LOGS ROUTES

// GET /api/vitals - Retrieve all logs from Database
app.get("/api/vitals", (req, res) => {
  const db = getDatabase();
  res.json({
    success: true,
    data: db.vitalsLogs || [],
    totalCount: (db.vitalsLogs || []).length
  });
});

// POST /api/vitals - Evaluate patient vitals & persist in Database
app.post("/api/vitals", async (req, res) => {
  try {
    const {
      patientId,
      temperature,
      heartRate,
      painLevel,
      patientName,
      surgeryType,
      postOpDay,
      recordedBy
    } = req.body;

    const pId = patientId || "PT-" + Math.floor(1000 + Math.random() * 9000);
    const temp = parseFloat(temperature);
    const hr = parseInt(heartRate, 10);
    const pain = parseInt(painLevel, 10);

    if (isNaN(temp) || isNaN(hr) || isNaN(pain)) {
      res.status(400).json({
        success: false,
        error: "Invalid numeric parameters for temperature, heartRate, or painLevel."
      });
      return;
    }

    // Core Medical Rule:
    // Temp > 101 OR HeartRate > 110 OR Pain > 8 -> Critical, else Normal
    const isCritical = temp > 101.0 || hr > 110 || pain > 8;
    const status: "Critical" | "Normal" = isCritical ? "Critical" : "Normal";

    // Formulate clinical summary message
    let message = "";
    if (status === "Critical") {
      const triggers: string[] = [];
      if (temp > 101.0) triggers.push(`Pyrexia/Fever (${temp}°F > 101°F)`);
      if (hr > 110) triggers.push(`Tachycardia (${hr} BPM > 110 BPM)`);
      if (pain > 8) triggers.push(`Severe Breakthrough Pain (${pain}/10 > 8)`);
      message = `CRITICAL ALERT: Immediate medical evaluation required for Patient ${pId}. Triggers: ${triggers.join(", ")}. Notify attending physician!`;
    } else {
      message = `Vitals Normal: Patient ${pId} is recovering within safe post-operative physiological parameters (Temp: ${temp}°F, HR: ${hr} BPM, Pain: ${pain}/10).`;
    }

    // Generate AI Medical Assessment via Gemini
    const aiAssessment = await generateAIMedicalAssessment(pId, temp, hr, pain, status);

    const db = getDatabase();
    const rowId = "DB-100582000000" + (db.vitalsLogs.length + 1004);
    
    const newRecord = {
      ROWID: rowId,
      PatientID: pId,
      patientName: patientName || `Patient ${pId}`,
      surgeryType: surgeryType || "Post-Op Recovery",
      postOpDay: postOpDay || 1,
      Temperature: temp,
      HeartRate: hr,
      PainLevel: pain,
      Status: status,
      message: message,
      recordedBy: recordedBy || "Dr. Eleanor Vance, MD",
      aiAssessment: aiAssessment,
      CREATEDTIME: new Date().toISOString()
    };

    // Store in Database File
    db.vitalsLogs.unshift(newRecord);
    saveDatabase(db);

    res.json({
      success: true,
      status: status,
      patientId: pId,
      vitals: {
        temperature: temp,
        heartRate: hr,
        painLevel: pain
      },
      message: message,
      aiAssessment: aiAssessment,
      rowId: rowId,
      createdTime: newRecord.CREATEDTIME
    });
  } catch (err: any) {
    console.error("Error evaluating vitals:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to evaluate patient vitals" });
  }
});

// Vite Middleware setup for dev vs production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VitaSync Clinical Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
