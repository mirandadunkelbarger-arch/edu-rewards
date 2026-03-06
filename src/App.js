import React, { useState, useEffect, useMemo } from 'react';
import './index.css';
import { 
  ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, 
  Loader2, Users, ListFilter, Search, ChevronRight, X 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment, addDoc, setDoc } from 'firebase/firestore';

const TEACHER_EMAIL = "your-actual-email@here.com"; 

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
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Teacher UI State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'points'
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
    if (role !== 'teacher') return;
    const q = query(collection(db, "students"));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [role]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert("Login Error: Check Firebase Auth."); }
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
    setNewStudent({ name: '', list: 'General' });
    setShowAddModal(false);
  };

  const givePoints = async (id, val) => {
    await updateDoc(doc(db, "students", id), { points: increment(Number(val)) });
  };

  // Sorting and Filtering Logic
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedList === 'All' || s.className === selectedList)
    );
    if (sortBy === 'name') result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (sortBy === 'points') result.sort((a, b) => b.points - a.points);
    return result;
  }, [students, searchTerm, sortBy, selectedList]);

  const classLists = ['All', ...new Set(students.map(s => s.className || 'General'))];

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md space-y-6">
          <ShieldCheck className="mx-auto text-indigo-600" size={48} />
          <h1 className="text-3xl font-black text-center uppercase tracking-tighter">Eels Portal</h1>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl outline-none font-bold" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-100 rounded-2xl outline-none font-bold" />
          <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Sign In</button>
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
          <nav className="space-y-6">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Class Lists</p>
              <div className="space-y-1">
                {classLists.map(list => (
                  <button key={list} onClick={() => setSelectedList(list)} className={`w-full text-left p-3 rounded-xl font-bold transition-all ${selectedList === list ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {list}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Award Setting</p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-2xl font-black text-indigo-600 mb-1">+{pointValue}</p>
                <input type="range" min="1" max="100" value={pointValue} onChange={e => setPointValue(e.target.value)} className="w-full accent-indigo-600" />
                <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Points per click</p>
              </div>
            </div>
          </nav>
        )}
        
        <button onClick={() => signOut(auth)} className="mt-auto flex items-center gap-2 font-bold text-slate-400 hover:text-red-500"><LogOut size={20}/> Logout</button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        {role === 'teacher' ? (
          <div className="max-w-5xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h2 className="text-4xl font-black">Roster</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                </div>
                <button onClick={() => setSortBy(sortBy === 'name' ? 'points' : 'name')} className="p-2 bg-white border rounded-xl hover:bg-slate-50"><ListFilter /></button>
                <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2"><PlusCircle size={20}/> Enroll</button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStudents.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-[2rem] flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl">{s.fullName[0]}</div>
                    <div>
                      <h4 className="font-black text-lg text-slate-800">{s.fullName}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.className || 'General'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-black text-yellow-600 flex items-center gap-1 justify-end"><Star size={20} fill="currentColor"/> {s.points}</p>
                    </div>
                    <button onClick={() => givePoints(s.id, pointValue)} className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><PlusCircle /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
             <div className="bg-indigo-600 w-full p-16 rounded-[4rem] text-white text-center shadow-2xl relative overflow-hidden">
                <Award size={100} className="absolute -top-10 -right-10 opacity-10 rotate-12" />
                <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">Great job, {studentData?.fullName || 'Student'}!</h2>
                <div className="text-[10rem] font-black leading-none my-10 tracking-tighter">{studentData?.points || 0}</div>
                <p className="text-xl font-bold text-indigo-200 uppercase tracking-widest">Your Points Balance</p>
             </div>
          </div>
        )}
      </main>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 relative shadow-2xl">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"><X /></button>
            <h3 className="text-3xl font-black mb-8">Enroll Student</h3>
            <div className="space-y-4">
              <input value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Full Name" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
              <input value={newStudent.list} onChange={e => setNewStudent({...newStudent, list: e.target.value})} placeholder="Class Name (e.g. Science 101)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
              <button onClick={addStudent} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Add to Roster</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
