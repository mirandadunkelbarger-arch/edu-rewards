import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, User, Star, Award, LogOut, ArrowRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  const firebaseConfig = {
  apiKey: "AIzaSy...", // Check for the " at the end here!
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:6789"
};
  const [view, setView] = useState('teacher'); 
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [loggedInStudent, setLoggedInStudent] = useState(null); // Tracks the individual student

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addStudent = async (e) => {
    e.preventDefault();
    if (!name) return;
    await addDoc(collection(db, "students"), {
      fullName: name,
      points: 0,
      createdAt: new Date().toISOString()
    });
    setName('');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b p-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 text-indigo-600 font-black text-xl">
          <ShieldCheck /> EduRewards
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView('teacher')} className={`px-4 py-2 rounded-md font-bold text-sm ${view === 'teacher' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Teacher</button>
          <button onClick={() => setView('student')} className={`px-4 py-2 rounded-md font-bold text-sm ${view === 'student' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Student</button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto">
        {view === 'teacher' ? (
          /* --- TEACHER VIEW --- */
          <div className="space-y-8">
            <h1 className="text-3xl font-black">Teacher Dashboard</h1>
            <form onSubmit={addStudent} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Student Name..." className="flex-1 bg-slate-50 border-none rounded-xl p-4 font-bold" />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded-xl font-bold">Enroll</button>
            </form>
            <div className="grid gap-4">
              {students.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl border flex justify-between items-center">
                  <span className="font-bold text-lg">{s.fullName}</span>
                  <span className="font-black text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl">{s.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- STUDENT VIEW --- */
          <div className="space-y-8">
            {!loggedInStudent ? (
              /* Step 1: Student "Login" (Selection) */
              <div className="text-center space-y-6">
                <h1 className="text-3xl font-black">Who are you?</h1>
                <div className="grid gap-4 max-w-sm mx-auto">
                  {students.map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => setLoggedInStudent(s)}
                      className="bg-white p-5 rounded-2xl border-2 border-transparent hover:border-indigo-600 hover:shadow-lg transition-all text-left flex justify-between items-center group"
                    >
                      <span className="font-bold text-lg">{s.fullName}</span>
                      <ArrowRight className="text-slate-300 group-hover:text-indigo-600" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Step 2: The Individual Student Dashboard */
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button onClick={() => setLoggedInStudent(null)} className="text-slate-400 font-bold flex items-center gap-2 hover:text-slate-600">
                    <LogOut size={18} /> Not {loggedInStudent.fullName}?
                  </button>
                </div>
                
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white text-center shadow-2xl shadow-indigo-200">
                  <Award size={64} className="mx-auto mb-6 opacity-40" />
                  <h2 className="text-4xl font-black mb-2">Welcome, {loggedInStudent.fullName}!</h2>
                  <p className="text-indigo-100 font-bold uppercase tracking-widest">Your Current Progress</p>
                  <div className="text-8xl font-black mt-8 mb-4">{students.find(s => s.id === loggedInStudent.id)?.points || 0}</div>
                  <div className="flex justify-center gap-2 items-center text-yellow-300 font-bold text-xl">
                    <Star fill="currentColor" /> Total Points
                  </div>
                </div>

                <div className="bg-
