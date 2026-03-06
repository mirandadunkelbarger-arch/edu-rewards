import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, User, Star, Award, LogOut, ArrowRight, Users, PlusCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';

// --- PASTE YOUR FIREBASE CONFIG HERE ---
// Ensure every line ends with ",
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:12345:web:abcde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [view, setView] = useState('teacher'); 
  const [students, setStudents] = useState([]);
  const [newName, setNewName] = useState('');
  const [loggedInStudentId, setLoggedInStudentId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

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
    const studentRef = doc(db, "students", id);
    await updateDoc(studentRef, {
      points: increment(1)
    });
  };

  const currentStudent = students.find(s => s.id === loggedInStudentId);

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
          <div className="space-y-8">
            <h1 className="text-3xl font-black">Teacher Dashboard</h1>
            <form onSubmit={addStudent} className="bg-white p-6 rounded-2xl shadow-sm border flex gap-4">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New Student Name..." className="flex-1 bg-slate-50 border-none rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded-xl font-bold">Enroll</button>
            </form>
            <div className="grid gap-4">
              {students.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl border flex justify-between items-center shadow-sm">
                  <span className="font-bold text-lg">{s.fullName}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl">{s.points} pts</span>
                    <button onClick={() => givePoint(s.id)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
                      <PlusCircle size={24} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {!loggedInStudentId ? (
              <div className="text-center space-y-6">
                <h1 className="text-3xl font-black">Student Portal: Select Your Name</h1>
                <div className="grid gap-4 max-w-sm mx-auto">
                  {students.map(s => (
                    <button key={s.id} onClick={() => setLoggedInStudentId(s.id)} className="bg-white p-5 rounded-2xl border-2 border-transparent hover:border-indigo-600 hover:shadow-lg transition-all text-left flex justify-between items-center group">
                      <span className="font-bold text-lg">{s.fullName}</span>
                      <ArrowRight className="text-slate-300 group-hover:text-indigo-600" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <button onClick={() => setLoggedInStudentId(null)} className="text-slate-400 font-bold flex items-center gap-2 hover:text-slate-600">
                  <LogOut size={18} /> Exit Student View
                </button>
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white text-center shadow-2xl">
                  <Award size={64} className="mx-auto mb-6 opacity-40" />
                  <h2 className="text-4xl font-black mb-2">Hey, {currentStudent?.fullName}!</h2>
                  <div className="text-8xl font-black mt-8 mb-4">{currentStudent?.points || 0}</div>
                  <div className="flex justify-center gap-2 items-center text-yellow-300 font-bold text-xl">
                    <Star fill="currentColor" /> Total Points Earned
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
