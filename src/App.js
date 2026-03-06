import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment } from 'firebase/firestore';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'teacher' or 'student'
  const [studentData, setStudentData] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Check if user is the teacher (update this email to yours!)
        if (u.email === 'teacher@school.edu') {
          setRole('teacher');
        } else {
          setRole('student');
          // Fetch this specific student's data
          const docRef = doc(db, "students", u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setStudentData(docSnap.data());
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Teacher only: Listen to all students
  useEffect(() => {
    if (role !== 'teacher') return;
    const q = query(collection(db, "students"));
    const unsub = onSnapshot(q, (snap) => {
      setAllStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [role]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login Failed: Check credentials");
    }
  };

  const givePoint = async (id) => {
    if (role !== 'teacher') return;
    await updateDoc(doc(db, "students", id), { points: increment(1) });
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md space-y-6 border border-slate-100">
          <div className="text-center">
            <ShieldCheck className="mx-auto text-indigo-600 mb-4" size={48} />
            <h1 className="text-3xl font-black">EduRewards Login</h1>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-2">Secure Portal</p>
          </div>
          <div className="space-y-4">
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
            <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100">Sign In</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-2xl"><ShieldCheck /> EduRewards</div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 font-bold text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20}/> Logout</button>
        </div>

        {role === 'teacher' ? (
          /* --- TEACHER CONSOLE --- */
          <div className="space-y-6">
            <h2 className="text-3xl font-black">Teacher Console</h2>
            <div className="grid gap-4">
              {allStudents.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                  <span className="font-bold text-xl">{s.fullName}</span>
                  <button onClick={() => givePoint(s.id)} className="flex items-center gap-4 bg-yellow-50 text-yellow-600 px-6 py-3 rounded-2xl font-black">
                    <Star size={20} fill="currentColor" /> {s.points} <PlusCircle className="text-indigo-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- INDIVIDUAL STUDENT VIEW --- */
          <div className="bg-indigo-600 p-16 rounded-[4rem] text-white text-center shadow-2xl relative overflow-hidden">
            <Award size={120} className="absolute -top-10 -right-10 opacity-10 rotate-12" />
            <h2 className="text-5xl font-black mb-4">Great job, {studentData?.fullName}!</h2>
            <div className="text-[10rem] font-black leading-none my-10 tracking-tighter">{studentData?.points || 0}</div>
            <p className="text-2xl font-bold text-indigo-200">Your Current Reward Points</p>
          </div>
        )}
      </div>
    </div>
  );
}
