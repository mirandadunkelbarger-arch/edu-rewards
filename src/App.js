import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment, addDoc } from 'firebase/firestore';

// --- EDIT YOUR EMAIL HERE ---
const TEACHER_EMAIL = "your-actual-email@here.com"; 

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

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [studentData, setStudentData] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        if (u.email === TEACHER_EMAIL) {
          setRole('teacher');
        } else {
          setRole('student');
          const docSnap = await getDoc(doc(db, "students", u.uid));
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
      alert("Login Error: Check Firebase Users tab.");
    }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addDoc(collection(db, "students"), {
      fullName: newName,
      points: 0,
      createdAt: new Date().toISOString()
    });
    setNewName('');
  };

  const givePoint = async (id) => {
    await updateDoc(doc(db, "students", id), { points: increment(1) });
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md space-y-6">
          <div className="text-center">
            <ShieldCheck className="mx-auto text-indigo-600 mb-4" size={48} />
            <h1 className="text-3xl font-black uppercase tracking-tighter">Eels Portal</h1>
          </div>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
          <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Sign In</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div className="text-indigo-600 font-black text-2xl tracking-tighter uppercase">Eels Console</div>
          <button onClick={() => signOut(auth)} className="font-bold text-slate-400 hover:text-red-500 flex items-center gap-2"><LogOut size={20}/> Logout</button>
        </div>

        {role === 'teacher' ? (
          <div className="space-y-6">
            <h2 className="text-3xl font-black">Teacher Dashboard</h2>
            <form onSubmit={addStudent} className="flex gap-4 bg-white p-4 rounded-2xl border">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New Student..." className="flex-1 p-2 outline-none font-bold" />
              <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Add</button>
            </form>
            <div className="grid gap-4">
              {allStudents.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl flex justify-between items-center border">
                  <span className="font-bold text-xl">{s.fullName}</span>
                  <button onClick={() => givePoint(s.id)} className="flex items-center gap-4 bg-yellow-50 text-yellow-600 px-6 py-3 rounded-2xl font-black">
                    <Star size={20} fill="currentColor" /> {s.points} <PlusCircle className="text-indigo-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-indigo-600 p-16 rounded-[4rem] text-white text-center shadow-2xl relative overflow-hidden">
            <Award size={100} className="absolute -top-10 -right-10 opacity-10 rotate-12" />
            <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">Great job, {studentData?.fullName || 'Student'}!</h2>
            <div className="text-[10rem] font-black leading-none my-10 tracking-tighter">{studentData?.points || 0}</div>
            <p className="text-xl font-bold text-indigo-200 uppercase tracking-widest">Total Points Earned</p>
          </div>
        )}
      </div>
    </div>
  );
}
