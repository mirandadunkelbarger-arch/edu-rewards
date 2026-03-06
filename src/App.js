import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Clock, Star, ShieldCheck, CheckCircle2, 
  Search, Sparkles, Loader2, Users, UserPlus, X, AlertCircle
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, onSnapshot, updateDoc, increment
} from 'firebase/firestore';

/**
 * ==========================================
 * FIREBASE CONFIGURATION (eminence-eels)
 * ==========================================
 */
const firebaseConfig = {
  apiKey: "AIzaSyA5JZdbYZPbP14rBRuRvKshPvmaYB7y8R8",
  authDomain: "eminence-eels.firebaseapp.com",
  projectId: "eminence-eels",
  storageBucket: "eminence-eels.firebasestorage.app",
  messagingSenderId: "5594483209",
  appId: "1:5594483209:web:4910be7d25dd5383c346d8",
  measurementId: "G-G39HM9LYRZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Analytics support check (runs only if browser supports it)
isSupported().then(yes => yes ? getAnalytics(app) : null);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data States
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // UI Control States
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPraise, setIsGeneratingPraise] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);
  const [redeemAmount, setRedeemAmount] = useState(10);
  const [customReason, setCustomReason] = useState('');
  
  // Modal States
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Pre-K');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Auth & Teacher Profile Bootstrap
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Use standard anonymous auth for your local/GitHub deployment
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'users', u.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setProfile(userSnap.data());
          } else {
            // Satisfy rules by creating your own teacher profile on first login
            const newProfile = {
              uid: u.uid,
              fullName: "Admin Teacher",
              role: "teacher",
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Profile Bootstrap Error:", err);
          showToast("Rules Error: Make sure your Firestore rules are updated!");
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Roster Listener (Guarded by user state)
  useEffect(() => {
    if (!user || !profile) return;

    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(data.filter(u => u.role === 'student'));
    }, (err) => {
      console.error("Roster Sync Error:", err);
      if (err.code === 'permission-denied') showToast("Rules Permission Denied.");
    });

    return () => unsub();
  }, [user, profile]);

  // 3. Actions
  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim() || !user) return;

    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        uid: newRef.id,
        fullName: newStudentName,
        grade: newStudentGrade,
        role: 'student',
        points: 0,
        createdAt: new Date().toISOString()
      });
      
      setNewStudentName('');
      setShowAddStudent(false);
      showToast(`Successfully enrolled ${newStudentName}!`);
    } catch (err) {
      console.error("Enrollment error:", err);
      showToast("Blocked! Ensure your profile has 'teacher' role.");
    }
  };

  const handleAward = async () => {
    if (!selectedStudent || !user) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, { 
        points: increment(Number(customPoints)) 
      });
      showToast(`Success! +${customPoints} to ${selectedStudent.fullName}`);
      setSelectedStudent(null);
      setCustomReason('');
    } catch (e) {
      showToast("Award failed. Check permissions.");
    }
  };

  const handleRedeem = async () => {
    if (!selectedStudent || !redeemAmount || !user) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, { 
        points: increment(-Math.abs(Number(redeemAmount))) 
      });
      showToast(`Redeemed ${redeemAmount} points from ${selectedStudent.fullName}`);
      setSelectedStudent(null);
      setCustomReason('');
    } catch (e) {
      showToast("Redeem failed. Check permissions.");
    }
  };

  const generateAI = async () => {
    if (!selectedStudent) return;
    setIsGeneratingPraise(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `One short encouraging praise for student ${selectedStudent.fullName}` }] }] })
      });
      const data = await res.json();
      setCustomReason(data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/"/g, '') || "Great work today!");
    } catch (e) {
      setCustomReason("Doing a fantastic job in class!");
    } finally {
      setIsGeneratingPraise(false);
    }
  };

  const filtered = useMemo(() => {
    return students.filter(s => s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, searchTerm]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
      <h1 className="font-black text-slate-400 uppercase tracking-widest text-xs">Syncing School Data...</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <aside className="w-20 md:w-72 bg-white border-r border-slate-200 flex flex-col py-10 px-6 shadow-2xl shadow-slate-200/50 z-20">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <ShieldCheck size={28} />
          </div>
          <span className="hidden md:block font-black text-2xl tracking-tighter text-indigo-950">EduRewards</span>
        </div>
        
        <nav className="flex-1 space-y-3">
          <button onClick={() => setActiveTab('students')} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Users size={24} /><span className="hidden md:block">Student Directory</span>
          </button>
        </nav>

        {/* Diagnostics Status Box */}
        <div className="mt-auto p-5 bg-slate-50 rounded-3xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Cloud Diagnostics</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Connection</span>
              <div className={`w-2.5 h-2.5 rounded-full ${user ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Permissions</span>
              <div className={`w-2.5 h-2.5 rounded-full ${profile?.role === 'teacher' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-orange-500'}`}></div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
             <p className="text-xs font-black text-slate-700 truncate uppercase tracking-tight">{profile?.fullName || "Staff"}</p>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="text-5xl font-black tracking-tight mb-2">Class Roster</h2>
            <div className="flex items-center gap-2 text-slate-400 font-bold text-sm uppercase tracking-widest">
              <Clock size={16} /> <span>Real-time Sync Active</span>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" placeholder="Search..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-100 shadow-sm transition-all" 
              />
            </div>
            <button 
              onClick={() => setShowAddStudent(true)} 
              className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <UserPlus size={24} /><span className="hidden sm:block font-black">ENROLL</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Student Grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filtered.length > 0 ? filtered.map(student => (
                <button 
                  key={student.uid} 
                  onClick={() => setSelectedStudent(student)} 
                  className={`p-8 text-left rounded-[3rem] border-4 transition-all ${
                    selectedStudent?.uid === student.uid 
                    ? 'bg-white border-indigo-600 shadow-2xl scale-[1.03]' 
                    : 'bg-white border-transparent shadow-sm hover:shadow-lg'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl ${
                      selectedStudent?.uid === student.uid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'
                    }`}>
                      {student.fullName?.charAt(0)}
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-400/10 text-yellow-600 px-4 py-2 rounded-2xl text-lg font-black">
                      <Star size={18} fill="currentColor" className="mr-1" /> {student.points || 0}
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-800 truncate tracking-tight">{student.fullName}</h4>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">{student.grade}</p>
                </button>
              )) : (
                <div className="col-span-full py-24 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100 text-slate-300">
                  <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-black text-xl uppercase tracking-widest">Roster Empty</p>
                  <p className="mt-2 text-sm font-bold">Use the Enroll button to add students to your Firebase database.</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Panel */}
          <div className="space-y-6">
            {selectedStudent ? (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-50 sticky top-10 animate-in slide-in-from-bottom-10 duration-500">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black tracking-tight uppercase">Manage Points</h3>
                  <button onClick={() => setSelectedStudent(null)} className="text-slate-300 p-2 hover:bg-slate-50 rounded-full"><X size={24} /></button>
                </div>

                <div className="space-y-8">
                  {/* Award Section */}
                  <div>
                    <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 px-2">Award Points</h4>
                    <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] space-y-4">
                      <select 
                        value={customPoints} 
                        onChange={(e) => setCustomPoints(e.target.value)} 
                        className="w-full p-4 bg-white rounded-2xl border-none font-black text-2xl text-indigo-600 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100 appearance-none cursor-pointer text-center"
                      >
                        {Array.from({length: 100}, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>+{num} Points</option>
                        ))}
                      </select>
                      
                      <div className="relative">
                        <textarea 
                          rows="3" 
                          value={customReason} 
                          onChange={(e) => setCustomReason(e.target.value)} 
                          placeholder="Reason for recognition..." 
                          className="w-full p-5 bg-white rounded-[2rem] border-none text-slate-700 font-bold text-sm resize-none shadow-sm outline-none focus:ring-4 focus:ring-indigo-100" 
                        />
                        <button 
                          onClick={generateAI} 
                          disabled={isGeneratingPraise} 
                          className="absolute right-3 bottom-3 p-3 bg-indigo-50 rounded-xl shadow-sm hover:bg-indigo-100 transition-all text-indigo-500 disabled:opacity-50"
                        >
                          {isGeneratingPraise ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        </button>
                      </div>
                      <button 
                        onClick={handleAward} 
                        className="w-full bg-indigo-600 text-white py-4 rounded-[2rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                      >
                        Give Points
                      </button>
                    </div>
                  </div>

                  {/* Redeem Section */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-black text-red-400 uppercase tracking-widest mb-4 px-2">Redeem Points</h4>
                    <div className="bg-red-50/50 p-6 rounded-[2.5rem] flex flex-col gap-4">
                      <input 
                        type="number" 
                        min="1" max="1000" 
                        value={redeemAmount} 
                        onChange={(e) => setRedeemAmount(e.target.value)} 
                        placeholder="Amount (1-1000)"
                        className="w-full p-4 bg-white rounded-2xl border-none font-black text-2xl text-red-500 shadow-sm outline-none focus:ring-4 focus:ring-red-100 text-center"
                      />
                      <button 
                        onClick={handleRedeem} 
                        className="w-full bg-red-500 text-white py-4 rounded-[2rem] font-black text-lg hover:bg-red-600 transition-all shadow-xl shadow-red-200 active:scale-95"
                      >
                        Redeem / Subtract
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-600 p-12 rounded-[3.5rem] shadow-2xl text-white">
                <Award size={64} className="mb-8 opacity-20" />
                <h3 className="text-3xl font-black mb-6 tracking-tight leading-tight">Classroom Success Dashboard</h3>
                <p className="text-indigo-100 font-bold leading-relaxed opacity-60">Enroll students and reward effort. Every update is instantly synced to your project: eminence-eels.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enrollment Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form 
            onSubmit={handleEnroll} 
            className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black tracking-tight">Enroll Student</h3>
              <button type="button" onClick={() => setShowAddStudent(false)} className="text-slate-300 hover:bg-slate-50 p-2 rounded-full">
                <X size={32} />
              </button>
            </div>
            <div className="space-y-8">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Student Name</label>
                <input 
                  required 
                  value={newStudentName} 
                  onChange={(e) => setNewStudentName(e.target.value)} 
                  placeholder="Full Name..." 
                  className="w-full p-8 bg-slate-50 rounded-[2rem] border-none font-black text-xl shadow-inner outline-none focus:ring-4 focus:ring-indigo-100" 
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Grade Level</label>
                <select 
                  value={newStudentGrade} 
                  onChange={(e) => setNewStudentGrade(e.target.value)} 
                  className="w-full p-8 bg-slate-50 rounded-[2rem] border-none font-black text-xl shadow-inner outline-none focus:ring-4 focus:ring-indigo-100 appearance-none cursor-pointer"
                >
                  {['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Add to Cloud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-6 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-[150]">
          <CheckCircle2 className="text-green-400" size={28} />
          <span className="font-black tracking-tight text-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}
