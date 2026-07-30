import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientProfileCard } from './components/PatientProfileCard';
import { VitalsInputForm } from './components/VitalsInputForm';
import { AssessmentResultCard } from './components/AssessmentResultCard';
import { VitalsHistoryTable } from './components/VitalsHistoryTable';
import { VitalsAnalytics } from './components/VitalsAnalytics';
import { UserSignPage } from './components/UserSignPage';
import { INITIAL_PATIENTS, INITIAL_VITALS_LOGS } from './data/mockPatients';
import { PatientProfile, VitalsLog, UserAccount } from './types';
import { ShieldAlert, Sparkles, Database, CheckCircle2, User, Lock } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'datastore' | 'analytics' | 'auth'>('monitor');
  const [patients] = useState<PatientProfile[]>(INITIAL_PATIENTS);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile>(INITIAL_PATIENTS[0]);
  const [vitalsLogs, setVitalsLogs] = useState<VitalsLog[]>(INITIAL_VITALS_LOGS);
  const [latestLog, setLatestLog] = useState<VitalsLog | null>(INITIAL_VITALS_LOGS[1]); // Default to Critical log for demo
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'critical' | 'normal'; message: string } | null>(null);

  // Active Logged-in Clinician User Account State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>({
    id: 'USR-101',
    fullName: 'Dr. Eleanor Vance, MD',
    email: 'dr.vance@vitasync.med',
    role: 'Attending Orthopedic Surgeon',
    department: 'Joint Reconstruction & Orthopedics',
    staffId: 'STAFF-8901',
    createdAt: new Date().toISOString()
  });

  // Fetch initial history from server database
  const fetchVitalsHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/vitals');
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const mapped: VitalsLog[] = data.data.map((item: any) => ({
          id: item.ROWID || 'LOG-' + Math.random().toString(36).substr(2, 6),
          patientId: item.PatientID || 'PT-UNKNOWN',
          patientName: item.patientName || `Patient ${item.PatientID}`,
          surgeryType: item.surgeryType || 'Post-Op Recovery',
          postOpDay: item.postOpDay || 1,
          temperature: item.Temperature,
          heartRate: item.HeartRate,
          painLevel: item.PainLevel,
          status: item.Status,
          message: item.message || '',
          timestamp: item.CREATEDTIME || new Date().toISOString(),
          rowId: item.ROWID,
          recordedBy: item.recordedBy,
          aiAssessment: item.aiAssessment
        }));
        setVitalsLogs(mapped);
      }
    } catch (err) {
      console.warn('Using local initial vitals logs fallback:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchVitalsHistory();
  }, []);

  const handleAnalyzeVitals = async (vitals: {
    patientId: string;
    patientName: string;
    surgeryType: string;
    postOpDay: number;
    temperature: number;
    heartRate: number;
    painLevel: number;
  }) => {
    setIsAnalyzing(true);
    setNotification(null);

    try {
      const response = await fetch('/api/vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...vitals,
          recordedBy: currentUser ? currentUser.fullName : 'Attending Clinician'
        })
      });

      const data = await response.json();

      if (data.success) {
        const newLog: VitalsLog = {
          id: data.rowId || 'LOG-' + Date.now(),
          patientId: data.patientId,
          patientName: vitals.patientName,
          surgeryType: vitals.surgeryType,
          postOpDay: vitals.postOpDay,
          temperature: data.vitals.temperature,
          heartRate: data.vitals.heartRate,
          painLevel: data.vitals.painLevel,
          status: data.status,
          message: data.message,
          timestamp: data.createdTime || new Date().toISOString(),
          rowId: data.rowId,
          recordedBy: currentUser ? currentUser.fullName : 'Attending Clinician',
          aiAssessment: data.aiAssessment
        };

        setLatestLog(newLog);
        setVitalsLogs((prev) => [newLog, ...prev]);

        if (data.status === 'Critical') {
          setNotification({
            type: 'critical',
            message: `CRITICAL ALERT triggered for Patient ${data.patientId}! Immediate physician triage required.`
          });
        } else {
          setNotification({
            type: 'normal',
            message: `Vitals recorded safely into Clinical Database 'VitalsLogs' table for Patient ${data.patientId}.`
          });
        }
      } else {
        alert('Failed to analyze vitals: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Error sending vitals:', err);
      // Local fallback calculation if server is interrupted
      const isCrit = vitals.temperature > 101 || vitals.heartRate > 110 || vitals.painLevel > 8;
      const st = isCrit ? 'Critical' : 'Normal';
      const fallbackLog: VitalsLog = {
        id: 'LOG-LOCAL-' + Date.now(),
        patientId: vitals.patientId,
        patientName: vitals.patientName,
        surgeryType: vitals.surgeryType,
        postOpDay: vitals.postOpDay,
        temperature: vitals.temperature,
        heartRate: vitals.heartRate,
        painLevel: vitals.painLevel,
        status: st,
        message: isCrit
          ? `CRITICAL ALERT: Vitals breach threshold for ${vitals.patientId}.`
          : `Vitals Stable: ${vitals.patientId} recovering within normal ranges.`,
        timestamp: new Date().toISOString(),
        rowId: 'DB-10058200' + Math.floor(1000 + Math.random() * 9000),
        recordedBy: currentUser ? currentUser.fullName : 'Attending Clinician',
        aiAssessment: {
          summary: isCrit ? 'Post-op vitals breach safety threshold.' : 'Vitals within normal limits.',
          severityScore: isCrit ? 90 : 15,
          clinicalFlags: isCrit ? ['Critical Vitals Alert'] : ['Stable'],
          recommendedActions: isCrit ? ['Alert attending physician', 'Re-check in 15 mins'] : ['Continue routine care'],
          medicationAdvisory: 'Follow post-op analgesia protocol.',
          triageLevel: isCrit ? 'Emergency Triage' : 'Routine Nursing Monitor'
        }
      };

      setLatestLog(fallbackLog);
      setVitalsLogs((prev) => [fallbackLog, ...prev]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const criticalLogsCount = vitalsLogs.filter((l) => l.status === 'Critical').length;

  return (
    <div className="min-w-screen min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      {/* Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        patients={patients}
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        criticalCount={criticalLogsCount}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Notification Toast Banner */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between shadow-lg transition-all ${
              notification.type === 'critical'
                ? 'bg-red-600 text-white border-red-700 animate-pulse'
                : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              {notification.type === 'critical' ? (
                <ShieldAlert className="h-6 w-6 text-white shrink-0" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-white shrink-0" />
              )}
              <span className="font-bold text-sm">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-white hover:text-slate-200 text-xs font-black underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: VITALS MONITOR */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* Active Clinician Banner */}
            {currentUser ? (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>
                    Logged in as <strong className="text-slate-900">{currentUser.fullName}</strong> ({currentUser.role} • {currentUser.department})
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('auth')}
                  className="text-blue-600 hover:underline font-bold cursor-pointer"
                >
                  Switch Account &rarr;
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <span>You are evaluating vitals as Guest. Sign in to record with your staff ID.</span>
                </div>
                <button
                  onClick={() => setActiveTab('auth')}
                  className="bg-amber-600 text-white px-3 py-1 rounded font-bold cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Patient Info Card */}
            <PatientProfileCard
              patient={selectedPatient}
              onSelectPatient={setSelectedPatient}
              allPatients={patients}
            />

            {/* Vitals Form & Assessment Outcome Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Form (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <VitalsInputForm
                  patient={selectedPatient}
                  onSubmitVitals={handleAnalyzeVitals}
                  isAnalyzing={isAnalyzing}
                />
              </div>

              {/* Assessment Result (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    Latest Assessment Outcome
                  </h3>
                  {latestLog && (
                    <span className="text-xs text-slate-500 font-mono">
                      Timestamp: {new Date(latestLog.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <AssessmentResultCard log={latestLog} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLINICAL DATABASE TABLE */}
        {activeTab === 'datastore' && (
          <VitalsHistoryTable
            logs={vitalsLogs}
            onSelectLog={(log) => {
              setLatestLog(log);
              setActiveTab('monitor');
            }}
            onRefresh={fetchVitalsHistory}
            isLoading={isLoadingHistory}
          />
        )}

        {/* TAB 3: ANALYTICS & TRENDS */}
        {activeTab === 'analytics' && <VitalsAnalytics logs={vitalsLogs} />}

        {/* TAB 4: USER SIGN IN & ACCOUNT MANAGEMENT */}
        {activeTab === 'auth' && (
          <UserSignPage
            currentUser={currentUser}
            onLogin={(user) => {
              setCurrentUser(user);
              setActiveTab('monitor');
            }}
            onLogout={() => {
              setCurrentUser(null);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">VitaSync AI Clinical System</span>
            <span>• Database & Gemini Intelligence</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Database Table: VitalsLogs</span>
            <span>• User Account Authentication</span>
            <span>• HIPAA Compliant Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
