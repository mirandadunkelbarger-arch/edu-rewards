import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Clock, Star, ShieldCheck, CheckCircle2, 
  Search, Sparkles, Loader2, Users, UserPlus, X, 
  AlertCircle, Edit2, Save, Trash2, ListFilter
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, onSnapshot, updateDoc, increment, deleteDoc
} from 'firebase/firestore';

/**
 * ==========================================
 * FIREBASE CONFIGURATION (eminence-eels)
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

// Analytics support check
isSupported().then(yes => yes ? getAnalytics(app) : null);

const GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data States
  const [students, setStudents] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'groups'
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // UI Control States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListId, setActiveListId] = useState('all');
  const [isGeneratingPraise, setIsGeneratingPraise] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);
  const [redeemAmount, setRedeemAmount] = useState(10);
  const [customReason, setCustomReason] = useState('');
  
  // Edit Student States
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentGrade, setEditStudentGrade] = useState('');

  // Modal / Group States
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Pre-K');
  const [newListName, setNewListName] = useState('');
  const [newListStudentIds, setNewListStudentIds] = useState([]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Auth & Teacher Profile Bootstrap
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
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setProfile(userSnap.data());
          } else {
            const newProfile = {
              uid: u.uid,
              fullName: "Admin Teacher",
              role: "teacher",
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Profile Bootstrap Error:", err);
          showToast("Rules Error: Make sure your Firestore rules are updated!");
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Listeners
  useEffect(() => {
    if (!user || !profile) return;

    // Students
    const qStudents = query(collection(db, 'users'));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(data.filter(u => u.role === 'student'));
    });

    // Custom Lists
    const qLists = query(collection(db, 'customLists'));
    const unsubLists = onSnapshot(qLists, (snap) => {
      setCustomLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubLists();
    };
  }, [user, profile]);

  // 3. Actions - Students
  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim() || !user) return;

    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        uid: newRef.id,
        fullName: newStudentName,
        grade: newStudentGrade,
        role: 'student',
        points: 0,
        createdAt: new Date().toISOString()
      });
      
      setNewStudentName('');
      setShowAddStudent(false);
      showToast(`Successfully enrolled ${newStudentName}!`);
    } catch (err) {
      showToast("Blocked! Ensure your profile has 'teacher' role.");
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent || !editStudentName.trim()) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, {
        fullName: editStudentName,
        grade: editStudentGrade
      });
      // Update local selection to reflect changes immediately
      setSelectedStudent(prev => ({...prev, fullName: editStudentName, grade: editStudentGrade}));
      setIsEditingStudent(false);
      showToast("Student profile updated!");
    } catch (e) {
      showToast("Failed to update student.");
    }
  };

  const handleAward = async () => {
    if (!selectedStudent || !user) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, { points: increment(Number(customPoints)) });
      showToast(`Success! +${customPoints} to ${selectedStudent.fullName}`);
      setSelectedStudent(null);
      setCustomReason('');
    } catch (e) {
      showToast("Award failed. Check permissions.");
    }
  };

  const handleRedeem = async () => {
    if (!selectedStudent || !redeemAmount || !user) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, { points: increment(-Math.abs(Number(redeemAmount))) });
      showToast(`Redeemed ${redeemAmount} points from ${selectedStudent.fullName}`);
      setSelectedStudent(null);
      setCustomReason('');
    } catch (e) {
      showToast("Redeem failed. Check permissions.");
    }
  };

  const generateAI = async () => {
    if (!selectedStudent) return;
    setIsGeneratingPraise(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `One short encouraging praise for student ${selectedStudent.fullName}` }] }] })
      });
      const data = await res.json();
      setCustomReason(data.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/"/g, '') || "Great work today!");
    } catch (e) {
      setCustomReason("Doing a fantastic job in class!");
    } finally {
      setIsGeneratingPraise(false);
    }
  };

  // 4. Actions - Custom Lists
  const handleCreateList = async () => {
    if (!newListName.trim() || newListStudentIds.length === 0) {
      showToast("Enter a name and select at least one student.");
      return;
    }
    try {
      const newRef = doc(collection(db, 'customLists'));
      await setDoc(newRef, {
        id: newRef.id,
        name: newListName,
        studentIds: newListStudentIds,
        teacherId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewListName('');
      setNewListStudentIds([]);
      showToast(`Created group: ${newListName}`);
    } catch (e) {
      showToast("Error creating group.");
    }
  };

  const handleDeleteList = async (listId) => {
    try {
      await deleteDoc(doc(db, 'customLists', listId));
      if (activeListId === listId) setActiveListId('all');
      showToast("Group deleted.");
    } catch (e) {
      showToast("Error deleting group.");
    }
  };

  // Select student handler (resets edit state)
  const openStudentPanel = (student) => {
    setSelectedStudent(student);
    setIsEditingStudent(false);
    setEditStudentName(student.fullName);
    setEditStudentGrade(student.grade || 'Pre-K');
  };

  const filteredStudents = useMemo(() => {
    let base = students;
    if (activeListId !== 'all') {
      const list = customLists.find(l => l.id === activeListId);
      if (list) base = students.filter(s => list.studentIds.includes(s.uid));
    }
    return base.filter(s => s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, customLists, activeListId, searchTerm]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-blue-800 mb-4" size={48} />
      <h1 className="font-black text-gray-400 uppercase tracking-widest text-xs">Syncing Eels Data...</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      {/* Sidebar Navigation */}
      <aside className="w-20 md:w-72 bg-white border-r border-gray-200 flex flex-col py-10 px-6 shadow-2xl shadow-gray-200/50 z-20">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-blue-800 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
            <ShieldCheck size={28} />
          </div>
          <span className="hidden md:block font-black text-2xl tracking-tighter text-blue-900">Eminence Eels</span>
        </div>
        
        <nav className="flex-1 space-y-3">
          <button 
            onClick={() => setActiveTab('students')} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
              activeTab === 'students' ? 'bg-blue-800 text-white shadow-xl shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Users size={24} /><span className="hidden md:block">Class Roster</span>
          </button>
          <button 
            onClick={() => { setActiveTab('groups'); setSelectedStudent(null); }} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
              activeTab === 'groups' ? 'bg-blue-800 text-white shadow-xl shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <ListFilter size={24} /><span className="hidden md:block">Manage Groups</span>
          </button>
        </nav>

        {/* Diagnostics Status Box */}
        <div className="mt-auto p-5 bg-gray-50 rounded-3xl border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 text-center">System Status</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Cloud</span>
              <div className={`w-2.5 h-2.5 rounded-full ${user ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
             <p className="text-xs font-black text-blue-900 truncate uppercase tracking-tight">{profile?.fullName || "Staff"}</p>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="text-5xl font-black tracking-tight mb-2 text-blue-900">
              {activeTab === 'students' ? 'Student Directory' : 'Group Management'}
            </h2>
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase tracking-widest">
              <Clock size={16} /> <span>Real-time Sync Active</span>
            </div>
          </div>
          
          {activeTab === 'students' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <select 
                value={activeListId}
                onChange={(e) => setActiveListId(e.target.value)}
                className="w-full sm:w-auto p-4 bg-white border border-gray-200 rounded-2xl font-bold text-blue-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer"
              >
                <option value="all">All Students</option>
                {customLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>

              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                <input 
                  type="text" placeholder="Search..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all" 
                />
              </div>
              <button 
                onClick={() => setShowAddStudent(true)} 
                className="bg-red-600 text-white p-4 rounded-2xl shadow-xl shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <UserPlus size={24} /><span className="hidden sm:block font-black">ENROLL</span>
              </button>
            </div>
          )}
        </header>

        {activeTab === 'groups' ? (
          /* --- MANAGE GROUPS TAB --- */
          <div className="max-w-4xl animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 mb-12">
              <h3 className="text-2xl font-black text-blue-900 mb-6">Create New Group</h3>
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <input 
                  className="flex-1 px-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-800 outline-none font-bold text-lg transition-all"
                  placeholder="Group Name (e.g. Reading Group A)"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
                <button 
                  onClick={handleCreateList} 
                  className="bg-blue-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-900 transition-all"
                >
                  Save Group
                </button>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Select Students for Group</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                {students.map(s => (
                  <label key={s.uid} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-colors border-2 ${newListStudentIds.includes(s.uid) ? 'bg-blue-50 border-blue-800' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                    <input 
                      type="checkbox"
                      checked={newListStudentIds.includes(s.uid)}
                      onChange={(e) => {
                        if (e.target.checked) setNewListStudentIds([...newListStudentIds, s.uid]);
                        else setNewListStudentIds(newListStudentIds.filter(id => id !== s.uid));
                      }}
                      className="w-5 h-5 accent-blue-800 rounded"
                    />
                    <div>
                      <span className="block font-bold text-blue-900">{s.fullName}</span>
                      <span className="block text-xs font-bold text-gray-400">{s.grade}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <h3 className="text-2xl font-black text-blue-900 mb-6">Existing Groups</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {customLists.length > 0 ? customLists.map(list => (
                <div key={list.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-black text-lg text-blue-900">{list.name}</h4>
                    <p className="text-sm font-bold text-gray-400">{list.studentIds.length} Students</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteList(list.id)}
                    className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    title="Delete Group"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )) : (
                <p className="text-gray-400 font-bold italic col-span-full">No custom groups created yet.</p>
              )}
            </div>
          </div>
        ) : (
          /* --- STUDENTS ROSTER TAB --- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in fade-in duration-300">
            {/* Student Grid */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <button 
                    key={student.uid} 
                    onClick={() => openStudentPanel(student)} 
                    className={`p-8 text-left rounded-[3rem] border-4 transition-all ${
                      selectedStudent?.uid === student.uid 
                      ? 'bg-white border-blue-800 shadow-2xl scale-[1.03]' 
                      : 'bg-white border-transparent shadow-sm hover:shadow-lg'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl ${
                        selectedStudent?.uid === student.uid ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {student.fullName?.charAt(0)}
                      </div>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-4 py-2 rounded-2xl text-lg font-black text-blue-900">
                        <Star size={18} className="text-red-600" fill="currentColor" /> {student.points || 0}
                      </div>
                    </div>
                    <h4 className="text-2xl font-black text-blue-900 truncate tracking-tight">{student.fullName}</h4>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">{student.grade}</p>
                  </button>
                )) : (
                  <div className="col-span-full py-24 text-center bg-white rounded-[4rem] border-4 border-dashed border-gray-200 text-gray-400">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-black text-xl uppercase tracking-widest">Roster Empty</p>
                    <p className="mt-2 text-sm font-bold">Use the Enroll button to add students.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Panel */}
            <div className="space-y-6">
              {selectedStudent ? (
                <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-gray-50 sticky top-10 animate-in slide-in-from-bottom-10 duration-500">
                  <div className="flex justify-between items-start mb-8">
                    {isEditingStudent ? (
                      <div className="w-full">
                        <h3 className="text-lg font-black tracking-tight text-blue-900 uppercase mb-4">Edit Profile</h3>
                        <input 
                          value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} 
                          className="w-full p-4 mb-3 bg-gray-50 rounded-2xl border-none font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <select 
                          value={editStudentGrade} onChange={(e) => setEditStudentGrade(e.target.value)} 
                          className="w-full p-4 mb-4 bg-gray-50 rounded-2xl border-none font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button onClick={handleUpdateStudent} className="flex-1 bg-blue-800 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-900"><Save size={18}/> Save</button>
                          <button onClick={() => setIsEditingStudent(false)} className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-black hover:bg-gray-300">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-2xl font-black tracking-tight text-blue-900 leading-tight">{selectedStudent.fullName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedStudent.grade}</span>
                            <button onClick={() => setIsEditingStudent(true)} className="text-blue-800 hover:text-blue-600 p-1" title="Edit Student">
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </div>
                        <button onClick={() => setSelectedStudent(null)} className="text-gray-300 hover:bg-gray-50 rounded-full p-2"><X size={24} /></button>
                      </>
                    )}
                  </div>

                  {!isEditingStudent && (
                    <div className="space-y-8">
                      {/* Award Section */}
                      <div>
                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3 px-2">Award Points</h4>
                        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] space-y-4 border border-blue-100">
                          <select 
                            value={customPoints} 
                            onChange={(e) => setCustomPoints(e.target.value)} 
                            className="w-full p-4 bg-white rounded-2xl border-none font-black text-2xl text-blue-800 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer text-center"
                          >
                            {Array.from({length: 100}, (_, i) => i + 1).map(num => (
                              <option key={num} value={num}>+{num} Points</option>
                            ))}
                          </select>
                          
                          <div className="relative">
                            <textarea 
                              rows="3" 
                              value={customReason} 
                              onChange={(e) => setCustomReason(e.target.value)} 
                              placeholder="Reason for recognition..." 
                              className="w-full p-5 bg-white rounded-[2rem] border-none text-gray-700 font-bold text-sm resize-none shadow-sm outline-none focus:ring-4 focus:ring-blue-100" 
                            />
                            <button 
                              onClick={generateAI} 
                              disabled={isGeneratingPraise} 
                              className="absolute right-3 bottom-3 p-3 bg-blue-50 rounded-xl shadow-sm hover:bg-blue-100 transition-all text-blue-800 disabled:opacity-50"
                            >
                              {isGeneratingPraise ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            </button>
                          </div>
                          <button 
                            onClick={handleAward} 
                            className="w-full bg-blue-800 text-white py-4 rounded-[2rem] font-black text-lg hover:bg-blue-900 transition-all shadow-xl shadow-blue-200 active:scale-95"
                          >
                            Give Points
                          </button>
                        </div>
                      </div>

                      {/* Redeem Section */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-3 px-2">Redeem Points</h4>
                        <div className="bg-red-50/50 p-6 rounded-[2.5rem] flex flex-col gap-4 border border-red-100">
                          <input 
                            type="number" 
                            min="1" max="1000" 
                            value={redeemAmount} 
                            onChange={(e) => setRedeemAmount(e.target.value)} 
                            placeholder="Amount (1-1000)"
                            className="w-full p-4 bg-white rounded-2xl border-none font-black text-2xl text-red-600 shadow-sm outline-none focus:ring-4 focus:ring-red-100 text-center"
                          />
                          <button 
                            onClick={handleRedeem} 
                            className="w-full bg-red-600 text-white py-4 rounded-[2rem] font-black text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-200 active:scale-95"
                          >
                            Redeem / Subtract
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-blue-800 p-12 rounded-[3.5rem] shadow-2xl text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><Award size={120} /></div>
                  <h3 className="text-3xl font-black mb-4 tracking-tight leading-tight relative z-10">Eels Dashboard</h3>
                  <p className="text-blue-100 font-bold leading-relaxed opacity-80 relative z-10">Select a student from the roster to edit their profile, award points, or redeem rewards.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Enrollment Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form 
            onSubmit={handleEnroll} 
            className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black tracking-tight text-blue-900">Enroll Student</h3>
              <button type="button" onClick={() => setShowAddStudent(false)} className="text-gray-300 hover:bg-gray-50 p-2 rounded-full">
                <X size={32} />
              </button>
            </div>
            <div className="space-y-8">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Student Name</label>
                <input 
                  required 
                  value={newStudentName} 
                  onChange={(e) => setNewStudentName(e.target.value)} 
                  placeholder="Full Name..." 
                  className="w-full p-8 bg-gray-50 rounded-[2rem] border-none font-black text-xl text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100" 
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Grade Level</label>
                <select 
                  value={newStudentGrade} 
                  onChange={(e) => setNewStudentGrade(e.target.value)} 
                  className="w-full p-8 bg-gray-50 rounded-[2rem] border-none font-black text-xl text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100 appearance-none cursor-pointer"
                >
                  {GRADES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-red-600 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all"
              >
                Add to Roster
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-blue-900 text-white px-10 py-6 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-[150]">
          <CheckCircle2 className="text-green-400" size={28} />
          <span className="font-black tracking-tight text-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}
