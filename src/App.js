import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import { 
  ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, 
  Loader2, Users, ListFilter, Search, X, Clock, History, Calendar
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment, addDoc, orderBy, limit } from 'firebase/firestore';

// Add as many emails as you need inside the square brackets, separated by commas
const APPROVED_TEACHERS = [
  "miranda.dunkelbarger@gmail.com",
  "nickdunkelbarger@gmail.com",
  "jtselkirk85@gmail.com"
];

const firebaseConfig = {
  apiKey: "AIzaSyA5JZdbYZPbP14rBRuRvKshPvmaYB7y8R8",
  authDomain: "eminence-eels.firebaseapp.com",
  projectId: "eminence-eels",
  storageBucket: "eminence-eels.firebasestorage.app",
  messagingSenderId: "5594483209",
  appId: "1:5594483209:web:4910be7d25dd5383c346d8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' or 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [pointValue, setPointValue] = useState(10);
  const [selectedList, setSelectedList] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', list: 'General' });

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
    if (!user) return;
    
    // Listen to Students
    const qS = query(collection(db, "students"));
    const unsubS = onSnapshot(qS, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Logs (Last 50 entries)
    const qL = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubL = onSnapshot(qL, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubS(); unsubL(); };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert("Login Failed"); }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    await addDoc(collection(db, "students"), {
      fullName: newStudent.name,
      className: newStudent.list,
      points: 0,
      createdAt: new Date().toISOString()
    });
    setShowAddModal(false);
  };

  const givePoints = async (id, name, val) => {
    // 1. Update Student Total
    await updateDoc(doc(db, "students", id), { points: increment(Number(val)) });
    
    // 2. Create Audit Log
    await addDoc(collection(db, "logs"), {
      studentId: id,
      studentName: name,
      amount: Number(val),
      timestamp: new Date().toISOString(),
      teacherEmail: user.email
    });
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedList === 'All' || s.className === selectedList)
    ).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, searchTerm, selectedList]);

  const classLists = ['All', ...new Set(students.map(s => s.className || 'General'))];

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md space-y-6">
          <ShieldCheck className="mx-auto text-indigo-600" size={48} />
          <h1 className="text-3xl font-black text-center uppercase">Eels Login</h1>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl outline-none font-bold" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl outline-none font-bold" />
          <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">Sign In</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 p-8 flex flex-col space-y-8">
        <div className="text-indigo-600 font-black text-2xl uppercase tracking-tighter flex items-center gap-2">
          <ShieldCheck /> Console
        </div>
        
        {role === 'teacher' && (
          <nav className="space-y-2">
            <button onClick={() => setActiveTab('roster')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === 'roster' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Users size={20} /> Roster
            </button>
            <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
              <History size={20} /> Audit Log
            </button>
          </nav>
        )}

        {role === 'teacher' && activeTab === 'roster' && (
          <div className="pt-6 border-t mt-4">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Award Power</p>
             <div className="bg-slate-50 p-4 rounded-2xl border">
                <p className="text-2xl font-black text-indigo-600 mb-1">+{pointValue}</p>
                <input type="range" min="1" max="100" value={pointValue} onChange={e => setPointValue(e.target.value)} className="w-full accent-indigo-600" />
             </div>
          </div>
        )}
        
        <button onClick={() => signOut(auth)} className="mt-auto flex items-center gap-2 font-bold text-slate-400 hover:text-red-500"><LogOut size={20}/> Logout</button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        {role === 'teacher' ? (
          activeTab === 'roster' ? (
            /* --- ROSTER VIEW --- */
            <div className="max-w-5xl mx-auto space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <h2 className="text-4xl font-black italic">Roster</h2>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold" />
                  </div>
                  <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-indigo-100">+ Enroll</button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredStudents.map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-[2rem] flex items-center justify-between border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl">{s.fullName[0]}</div>
                      <div>
                        <h4 className="font-black text-lg">{s.fullName}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.className}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-black text-yellow-600 flex items-center gap-1"><Star size={20} fill="currentColor"/> {s.points}</p>
                      <button onClick={() => givePoints(s.id, s.fullName, pointValue)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-all"><PlusCircle /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* --- HISTORY VIEW --- */
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-4xl font-black">Audit Log</h2>
              <div className="bg-white rounded-[2rem] border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-6 font-black text-slate-400 uppercase text-xs">Student</th>
                      <th className="p-6 font-black text-slate-400 uppercase text-xs text-center">Amount</th>
                      <th className="p-6 font-black text-slate-400 uppercase text-xs text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 font-bold">{log.studentName}</td>
                        <td className="p-6 text-center">
                          <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full font-black">+{log.amount}</span>
                        </td>
                        <td className="p-6 text-right text-slate-400 font-bold flex items-center justify-end gap-2">
                           <Clock size={14} /> {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* --- STUDENT VIEW --- */
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
             <div className="bg-indigo-600 w-full p-16 rounded-[4rem] text-white text-center shadow-2xl relative overflow-hidden">
                <Award size={100} className="absolute -top-10 -right-10 opacity-10 rotate-12" />
                <h2 className="text-4xl font-black mb-4 uppercase">Great job, {studentData?.fullName}!</h2>
                <div className="text-[10rem] font-black leading-none my-10 tracking-tighter">{studentData?.points || 0}</div>
                <p className="text-xl font-bold text-indigo-200">Current Points</p>
             </div>
          </div>
        )}
      </main>

      {/* Enroll Modal Code (Same as before) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 relative shadow-2xl">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-slate-400"><X /></button>
            <h3 className="text-3xl font-black mb-8">Enroll Student</h3>
            <div className="space-y-4">
              <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Full Name" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
              <input value={newStudent.list} onChange={e => setNewStudent({...newStudent, list: e.target.value})} placeholder="Class (e.g. Clinical B)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
              <button onClick={addStudent} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">Add to Roster</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
