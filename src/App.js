import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, Loader2, Users } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment, addDoc } from 'firebase/firestore';

// --- EDIT ONLY THIS LINE ---
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
          const docRef = doc(db, "students", u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setStudentData(docSnap.data());
          }
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
      alert("Login Failed: Check your email/password in the Firebase Users tab.");
    }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, "students"), {
        fullName: newName,
        points: 0,
        createdAt: new Date().toISOString()
      });
      setNewName('');
    } catch (err) {
      alert("Database Error: Check your Firestore Rules.");
    }
  };

  const givePoint = async (id) => {
    try {
      await updateDoc(doc(db, "students", id), { 
        points: increment(1) 
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md space-y-6 border border-slate-100">
          <div className="text-center">
            <ShieldCheck className="mx-auto text-indigo-600 mb-4" size={48} />
            <h1 className="text-3xl font-black italic">EELS PORTAL</h1>
          </div>
          <div className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
            <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 transition-all">Sign In</button>
          </div>
        </form>
      </div>
    );
  }

  return (
