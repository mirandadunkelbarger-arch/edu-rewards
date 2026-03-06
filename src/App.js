import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import { 
  Award, Clock, User, PlusCircle, Star, ShieldCheck, 
  CheckCircle2, Search, Sparkles, Loader2, Users, 
  ListFilter, BookOpen, Calendar, LogOut, ChevronRight,
  UserPlus, X
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, onSnapshot, updateDoc, increment
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA5JZdbYZPbP14rBRuRvKshPvmaYB7y8R8",
  authDomain: "eminence-eels.firebaseapp.com",
  projectId: "eminence-eels",
  storageBucket: "eminence-eels.firebasestorage.app",
  messagingSenderId: "5594483209",
  appId: "1:5594483209:web:4910be7d25dd5383c346d8",
  measurementId: "G-G39HM9LYRZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

isSupported().then(yes => yes ? getAnalytics(app) : null);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [students, setStudents] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListId, setActiveListId] = useState('all');
  const [isGeneratingPraise, setIsGeneratingPraise] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);
  const [customReason, setCustomReason] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('6th Grade');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
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
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          const defaultProfile = {
            uid: u.uid,
            fullName: "Teacher",
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

  useEffect(() => {
    if (!user) return;
    const qStudents = query(collection(db, 'users'));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(allUsers.filter(u => u.role === 'student'));
    });
    const qLists = query(collection(db, 'customLists'));
    const unsubLists = onSnapshot(qLists, (snap) => {
      setCustomLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubStudents();
      unsubLists();
    };
  }, [user]);

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
      showToast("Check Database Rules");
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedStudent || !user) return;
    try {
      const studentRef = doc(db, 'users', selectedStudent.uid);
      await updateDoc(studentRef, {
        points: increment(Number(customPoints))
      });
      showToast(`Awarded ${customPoints} points!`);
      setCustomReason('');
      setSelectedStudent(null);
    } catch (e) {
      showToast("Check Database Rules");
    }
  };

  const generateAIPraise = async () => {
    if (!selectedStudent) return;
    setIsGeneratingPraise(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=YOUR_GEMINI_KEY_HERE`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Write a short praise for ${selectedStudent.fullName}` }] }] })
      });
      const data = await response.json();
      setCustomReason(data.candidates?.[0]?.content?.parts?.[0]?.text || "Great work!");
    } catch (e) {
      setCustomReason("Keep up the great effort!");
    } finally {
      setIsGeneratingPraise(false);
    }
  };

  const displayStudents = useMemo(() => {
    return students.filter(s => s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, searchTerm]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin mr-3" /> Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <aside className="w-20 md:w-72 bg-white border-r border-slate-200 flex flex-col py-10 px-6">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100"><ShieldCheck size={28} /></div>
          <span className="hidden md:block font-black text-2xl tracking-tight">EduRewards</span>
        </div>
        <nav className="flex-1 space-y-3">
          <button onClick={() => setActiveTab('students')} className={`w-full flex items-center gap-4 p-4 rounded-[1.25rem] font-bold ${activeTab === 'students' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            <Users size={24} /><span className="hidden md:block">Students</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-black">Roster</h2>
          <button onClick={() => setShowAddStudent(true)} className="bg-indigo-600 text-white p-4 rounded-2xl flex items-center gap-2 font-bold">
            <UserPlus size={24} /> Enroll
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {displayStudents.map(student => (
              <button key={student.uid} onClick={() => setSelectedStudent(student)} className={`p-8 text-left rounded-[2.5rem] border-4 bg-white ${selectedStudent?.uid === student.uid ? 'border-indigo-600' : 'border-transparent'}`}>
                <div className="flex justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold">{student.fullName?.charAt(0)}</div>
                  <div className="flex items-center gap-2 text-yellow-600 font-black"><Star size={18} fill="currentColor" /> {student.points || 0}</div>
                </div>
                <h4 className="text-xl font-black">{student.fullName}</h4>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {selectedStudent ? (
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl">
                <h3 className="text-2xl font-black mb-10">Award Points</h3>
                <input type="range" min="1" max="100" value={customPoints} onChange={(e) => setCustomPoints(e.target.value)} className="w-full mb-6" />
                <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl mb-6" placeholder="Reason..." />
                <button onClick={handleAwardPoints} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">Confirm</button>
              </div>
            ) : <div className="bg-indigo-600 p-10 rounded-[3rem] text-white font-bold">Select a student to award points.</div>}
          </div>
        </div>
      </main>

      {showAddStudent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[100]">
          <form onSubmit={handleAddStudent} className="bg-white w-full max-w-lg rounded-[3rem] p-10">
            <h3 className="text-3xl font-black mb-8">Enroll Student</h3>
            <input required value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Name" className="w-full p-4 bg-slate-50 rounded-2xl mb-4" />
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">Add Student</button>
            <button type="button" onClick={() => setShowAddStudent(false)} className="w-full mt-4 text-slate-400">Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}
