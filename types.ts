export type VitalStatus = 'Critical' | 'Normal';

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: string; // e.g. 'Attending Physician', 'Post-Op Charge Nurse', 'Surgical Resident'
  department: string; // e.g. 'Cardiothoracic Surgery', 'Orthopedic Recovery'
  staffId: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AIClinicalAssessment {
  summary: string;
  severityScore: number; // 1 to 100
  clinicalFlags: string[];
  recommendedActions: string[];
  medicationAdvisory: string;
  triageLevel: 'Emergency Triage' | 'Physician Notification' | 'Routine Nursing Monitor';
}

export interface VitalsLog {
  id: string;
  patientId: string;
  patientName: string;
  surgeryType: string;
  postOpDay: number;
  temperature: number; // in °F
  heartRate: number; // BPM
  painLevel: number; // 1-10
  status: VitalStatus;
  message: string;
  timestamp: string;
  rowId?: string;
  recordedBy?: string;
  aiAssessment?: AIClinicalAssessment;
}

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  surgery: string;
  surgeryDate: string;
  postOpDay: number;
  attendingPhysician: string;
  roomNumber: string;
  baselineVitals: {
    temp: number;
    hr: number;
    pain: number;
  };
}
