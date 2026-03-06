import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Clock, User, PlusCircle, Star, ShieldCheck, 
  CheckCircle2, Search, Sparkles, Loader2, Users, 
  ListFilter, BookOpen, Calendar, LogOut, ChevronRight,
  UserPlus, X
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, onSnapshot, updateDoc, increment, deleteDoc
} from 'firebase/firestore';

/**
 * ==========================================
 * 1. FIREBASE CONFIGURATION (UPDATED)
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

// Initialize Analytics conditionally
isSupported().then(yes => yes ? getAnalytics(app) : null);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Database States
  const [students, setStudents] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // UI Control States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListId, setActiveListId] = useState('all');
  const [isGeneratingPraise, setIsGeneratingPraise] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);
  const [customReason, setCustomReason] = useState('');
  
  // Modal States
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('6th Grade');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Auth Logic (RULE 3: Auth Before Queries) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
        if (err.code === 'auth/admin-restricted-operation') {
          showToast("Error: Enable 'Anonymous' Auth in Firebase Console.");
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          const defaultProfile = {
            uid: u.uid,
            fullName: "Classroom Teacher",
            role: "teacher",
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, defaultProfile);
          setProfile(defaultProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Sync (Guarded by user) ---
  useEffect(() => {
    if (!user) return;

    const qStudents = query(collection(db, 'users'));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(allUsers.filter(u => u.role === 'student'));
    }, (error) => console.error("Firestore Error:", error));

    const qLists = query(collection(db, 'customLists'));
    const unsubLists = onSnapshot(qLists, (snap) => {
      setCustomLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Firestore Error:", error));

    return () => {
      unsubStudents();
      unsubLists();
    };
  }, [user]);

  // --- Actions ---
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim() || !user) return;

    try {
      const newStudentRef = doc(collection(db, 'users'));
      await setDoc(newStudentRef, {
        uid: newStudentRef.id,
        fullName: newStudentName,
        grade: newStudentGrade,
        role: 'student',
        points: 0,
        createdAt: new Date().toISOString()
      });
      
      setNewStudentName('');
      setShowAddStudent(false);
      showToast(`Enrolled ${newStudentName}!`);
    } catch (err) {
      showToast("Permission error. Check Firestore Rules.");
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedStudent || !customPoints || !user) return;
    
    try {
      const studentRef = doc(db, 'users', selectedStudent.uid);
      await updateDoc(studentRef, {
        points: increment(Number(customPoints))
      });
      
      showToast(`Awarded ${customPoints} points!`);
      setCustomReason('');
      setSelectedStudent(null);
    } catch (e) {
      showToast("Check your Firebase Rules!");
    }
  };

  const generateAIPraise = async () => {
    if (!selectedStudent) return;
    setIsGeneratingPraise(true);
    try {
      const prompt = `Write a short praise for student ${selectedStudent.fullName} getting points for effort.`;
      const response = await fetch(``https://generativelanguage.googleapis.com/...generateContent?key=AIzaSyAP7VdnUIydWPtZ4TZUktZYqJWJP3hseZE`
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      setCustomReason(data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/"/g, '') || "Great work today!");
    } catch (e) {
      setCustomReason("Keep up the fantastic effort in class!");
    } finally {
      setIsGeneratingPraise(false);
    }
  };

  const displayStudents = useMemo(() => {
    let base = students;
    if (activeListId !== 'all') {
      const list = customLists.find(l => l.id === activeListId);
      if (list) base = students.filter(s => list.studentIds.includes(s.uid));
    }
    return base.filter(s => s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, customLists, activeListId, searchTerm]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
      <Loader2 className="animate-spin mr-3" /> Initializing...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-20 md:w-72 bg-white border-r border-slate-200 flex flex-col py-10 px-6">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100">
            <ShieldCheck size={28} strokeWidth={2.5} />
          </div>
          <span className="hidden md:block font-black text-2xl tracking-tight">EduRewards</span>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: 'students', label: 'Student Directory', icon: Users },
            { id: 'classes', label: 'Custom Groups', icon: ListFilter },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-[1.25rem] font-bold transition-all ${
                activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <item.icon size={24} />
              <span className="hidden md:block">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="mt-auto p-5 bg-slate-50 rounded-[1.5rem] hidden md:block border border-slate-100 text-sm">
          <p className="font-bold text-slate-700 truncate">{profile?.fullName || "Staff"}</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Logged In</p>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">
              {activeTab === 'students' ? 'Roster' : 'Groups'}
            </h2>
            <p className="text-slate-500 font-medium">Classroom management synced with Firebase.</p>
          </div>

          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="relative flex-1 xl:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" placeholder="Search students..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none"
              />
            </div>
            <button 
              onClick={() => setShowAddStudent(true)}
              className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <UserPlus size={24} />
              <span className="hidden sm:block font-bold">Enroll Student</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {displayStudents.length > 0 ? displayStudents.map(student => (
                <button 
                  key={student.uid}
                  onClick={() => setSelectedStudent(student)}
                  className={`p-8 text-left rounded-[2.5rem] border-4 transition-all group ${
                    selectedStudent?.uid === student.uid 
                    ? 'bg-white border-indigo-600 shadow-2xl scale-[1.03]' 
                    : 'bg-white border-transparent shadow-sm hover:shadow-xl'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl bg-slate-100 text-slate-400">
                      {student.fullName?.charAt(0)}
                    </div>
                    <div className="flex items-center gap-2 bg-yellow-400/10 text-yellow-600 px-4 py-2 rounded-2xl text-lg font-black">
                      <Star size={18} fill="currentColor" /> {student.points || 0}
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-800 truncate leading-tight">{student.fullName}</h4>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">{student.grade}</p>
                </button>
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-400">
                  <p className="font-bold text-xl">Your roster is empty.</p>
                  <p className="mt-2 text-sm">Click "Enroll Student" to add to Firebase.</p>
                </div>
              )}
            </div>
          </div>

          {/* Award Panel */}
          <div className="space-y-6">
            {selectedStudent ? (
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 sticky top-10 animate-in slide-in-from-bottom-10 duration-500">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-slate-900">Award</h3>
                  <button onClick={() => setSelectedStudent(null)} className="text-slate-300 hover:text-slate-600"><X size={24} /></button>
                </div>

                <div className="space-y-10">
                  <div className="bg-slate-50 p-8 rounded-[2rem]">
                    <div className="flex justify-between items-end mb-6">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Points</label>
                      <span className="text-4xl font-black text-indigo-600">{customPoints}</span>
                    </div>
                    <input 
                      type="range" min="1" max="100" 
                      value={customPoints}
                      onChange={(e) => setCustomPoints(e.target.value)}
                      className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Reason</label>
                    <textarea 
                      rows="4"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Recognize good behavior..."
                      className="w-full p-6 bg-slate-50 rounded-[2rem] border-none text-slate-700 font-bold text-lg leading-relaxed resize-none shadow-inner"
                    />
                    <button 
                      onClick={generateAIPraise}
                      disabled={isGeneratingPraise}
                      className="absolute right-4 bottom-4 p-4 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all text-indigo-500 disabled:opacity-50"
                    >
                      {isGeneratingPraise ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    </button>
                  </div>

                  <button 
                    onClick={handleAwardPoints}
                    className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                  >
                    Confirm Award
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-600 p-12 rounded-[3rem] shadow-2xl text-white">
                <Award size={48} className="mb-8 opacity-40" />
                <h3 className="text-3xl font-black mb-6">Class Management</h3>
                <p className="text-indigo-100 font-bold leading-relaxed opacity-70">Enroll students and award points to keep your class engaged. All data is saved automatically in real-time.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enrollment Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddStudent}
            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black">Enroll Student</h3>
              <button type="button" onClick={() => setShowAddStudent(false)} className="text-slate-300 hover:text-slate-600"><X size={28} /></button>
            </div>
            <div className="space-y-8">
              <input required value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Full Name..." className="w-full p-6 bg-slate-50 rounded-3xl border-none font-bold text-lg" />
              <select value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} className="w-full p-6 bg-slate-50 rounded-3xl border-none font-bold text-lg appearance-none">
                {['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700">Add to Roster</button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-[150]">
          <CheckCircle2 className="text-green-400" size={24} />
          <span className="font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}

