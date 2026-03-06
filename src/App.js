import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, User, Star, Award, LogOut, ArrowRight, PlusCircle, Lock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcde"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [loggedInStudentId, setLoggedInStudentId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');

  // Listen for Teacher Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setTeacher(user));
    return () => unsub();
  }, []);

  // Listen for Student Data
  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Invalid Teacher Credentials");
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

  // If no one is logged in at all, show the Choice Screen
  if (!teacher && !loggedInStudentId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <ShieldCheck className="mx-auto text-indigo-600" size={64} />
            <h1 className="text-4xl font-black mt-4">EduRewards</h1>
          </div>
          
          <div className="grid gap-4">
            <button onClick={() => setLoggedInStudentId('selecting')} className="bg-white p-8 rounded-3xl border-2 hover:border-indigo-600 shadow-sm flex items-center justify-between group">
              <span className="text-xl font-bold">I am a Student</span>
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
            
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl border-2 space-y-4 shadow-sm">
              <h2 className="font-bold flex items-center gap-2 text-slate-500"><Lock size={18}/> Teacher Login</h2>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black">Login to Dashboard</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- TEACHER DASHBOARD ---
  if (teacher) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-black">Teacher Console</h1>
            <button onClick={() => signOut(auth)} className="flex items-center gap-2 font-bold text-slate-400 hover:text-red-500"><LogOut size={20}/> Logout</button>
          </div>
          <form onSubmit={addStudent} className="flex gap-4 bg-white p-4 rounded-2xl shadow-sm border">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Student Name" className="flex-1 p-2 outline-none font-bold" />
            <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Enroll</button>
          </form>
          <div className="grid gap-4">
            {students.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-2xl flex justify-between items-center shadow-sm">
                <span className="font-bold text-lg">{s.fullName}</span>
                <button onClick={() => givePoint(s.id)} className="flex items-center gap-4 bg-yellow-50 text-yellow-600 px-4 py-2 rounded-xl font-black group">
                  <Star size={20} fill="currentColor" /> {s.points} <PlusCircle className="text-indigo-400 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- STUDENT DASHBOARD ---
  const selected = students.find(s => s.id === loggedInStudentId);
  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      {!selected ? (
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-3xl font-black mb-8">Select Your Name</h1>
          {students.map(s => (
            <button key={s.id} onClick={() => setLoggedInStudentId(s.id)} className="w-full bg-white p-6 rounded-2xl border-2 hover:border-indigo-600 font-bold text-lg shadow-sm">{s.fullName}</button>
          ))}
          <button onClick={() => setLoggedInStudentId(null)} className="mt-8 text-slate-400 font-bold underline">Go Back</button>
        </div>
      ) : (
        <div className="w-full max-w-2xl space-y-6">
          <button onClick={() => setLoggedInStudentId(null)} className="font-bold text-slate-400 flex items-center gap-2"><LogOut size={18}/> Exit Portal</button>
          <div className="bg-indigo-600 p-12 rounded-[3rem] text-white text-center shadow-2xl">
            <Award size={80} className="mx-auto mb-6 opacity-30" />
            <h2 className="text-5xl font-black mb-2">{selected.fullName}</h2>
            <div className="text-9xl font-black my-8">{selected.points}</div>
            <p className="text-xl font-bold text-yellow-300">Total Points</p>
          </div>
        </div>
      )}
    </div>
  );
}
