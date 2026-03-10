import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Clock, Star, ShieldCheck, CheckCircle2, 
  Search, Sparkles, Loader2, Users, UserPlus, X, 
  AlertCircle, Edit2, Save, Trash2, ListFilter, LogOut, UserCheck, Mail, QrCode, ScanLine, Printer
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, getDoc, collection, query, onSnapshot, 
  updateDoc, increment, deleteDoc, addDoc, where, orderBy, limit
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

// OPTIMIZATION: Enable Offline Persistence & Local Caching
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

// Analytics support check
isSupported().then(yes => yes ? getAnalytics(app) : null);

const GRADES = ['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];

// --- Mobile-Ready Camera Scanner Component ---
const CameraScanner = ({ onScan }) => {
  useEffect(() => {
    let scanner = null;

    const initScanner = () => {
      if (!window.Html5QrcodeScanner) return;
      
      // Initialize the scanner with settings optimized for mobile phones
      scanner = new window.Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedScanTypes: [0] // 0 = QR_CODE
        },
        false
      );

      scanner.render(
        (decodedText) => {
          if (scanner) {
            scanner.clear(); // Stop camera instantly on successful scan
          }
          onScan(decodedText);
        },
        (err) => {
          // Quietly ignore frame errors to prevent console spam
        }
      );
    };

    // Dynamically load the library to bypass build/bundler errors
    if (!window.Html5QrcodeScanner) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      script.onload = initScanner;
      document.body.appendChild(script);
    } else {
      initScanner();
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="w-full bg-black rounded-3xl overflow-hidden shadow-inner border-4 border-gray-100 relative min-h-[300px]">
      <div id="qr-reader" className="w-full h-full text-white !border-none"></div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // --- Auth Screen States ---
  const [authView, setAuthView] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupRole, setSignupRole] = useState('student'); 
  const [signupGrade, setSignupGrade] = useState('6th Grade');

  // --- Data States ---
  const [students, setStudents] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]); 
  const [adminInvites, setAdminInvites] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('students'); 
  
  // --- UI States ---
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeListId, setActiveListId] = useState('all');
  const [isGeneratingPraise, setIsGeneratingPraise] = useState(false);
  const [customPoints, setCustomPoints] = useState(10);
  const [redeemAmount, setRedeemAmount] = useState(10);
  const [customReason, setCustomReason] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentGrade, setEditStudentGrade] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanData, setScanData] = useState('');
  
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Pre-K');
  const [newListName, setNewListName] = useState('');
  const [newListStudentIds, setNewListStudentIds] = useState([]);

  // --- Print States ---
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSelection, setPrintSelection] = useState([]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Core Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const userSnap = await getDoc(doc(db, 'users', u.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Hardcoded fallback safety for original admins
            const adminEmails = ['miranda.dunkelbarger@gmail.com', 'jtselkirk85@gmail.com'];
            if (u.email && adminEmails.includes(u.email.toLowerCase()) && userData.role !== 'admin') {
              userData.role = 'admin';
              await updateDoc(doc(db, 'users', u.uid), { role: 'admin' });
            }
            
            setProfile(userData);
          } else {
            // Failsafe for missing documents
            let fallbackRole = 'pending_teacher';
            const adminEmails = ['miranda.dunkelbarger@gmail.com', 'jtselkirk85@gmail.com'];
            if (u.email && adminEmails.includes(u.email.toLowerCase())) {
              fallbackRole = 'admin';
            }
            const fallbackProfile = {
              uid: u.uid,
              email: u.email || '',
              fullName: "User",
              role: fallbackRole,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', u.uid), fallbackProfile);
            setProfile(fallbackProfile);
          }
        } catch (err) {
          console.error("Failed to fetch profile:", err);
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

    let unsubStudents = () => {};
    let unsubLists = () => {};
    let unsubHistory = () => {};
    let unsubInvites = () => {};

    if (profile.role === 'student') {
      const qHistory = query(collection(db, 'pointHistory'), where('studentId', '==', profile.uid));
      unsubHistory = onSnapshot(qHistory, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHistory(data.slice(0, 50)); 
      });
    } else if (profile.role === 'teacher' || profile.role === 'admin') {
      unsubStudents = onSnapshot(query(collection(db, 'users')), (snap) => {
        const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setStudents(data.filter(u => u.role === 'student'));
        
        if (profile.role === 'admin') {
          setPendingUsers(data.filter(u => u.role === 'pending_teacher' || u.role === 'pending_student'));
        }
      });

      unsubLists = onSnapshot(query(collection(db, 'customLists')), (snap) => {
        setCustomLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const qHistory = query(collection(db, 'pointHistory'), orderBy('createdAt', 'desc'), limit(100));
      unsubHistory = onSnapshot(qHistory, (snap) => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      if (profile.role === 'admin') {
        unsubInvites = onSnapshot(query(collection(db, 'admin_invites')), (snap) => {
           setAdminInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    }

    return () => {
      unsubStudents();
      unsubLists();
      unsubHistory();
      unsubInvites();
    };
  }, [user, profile]);

  // --- AUTHENTICATION ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Welcome back!");
    } catch (err) {
      showToast(err.message.includes('auth/') ? "Invalid email or password." : err.message);
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupName.trim()) {
      showToast("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      let finalRole = signupRole === 'teacher' ? 'pending_teacher' : 'pending_student';
      const adminEmails = ['miranda.dunkelbarger@gmail.com', 'jtselkirk85@gmail.com'];
      
      const inviteRef = doc(db, 'admin_invites', email.toLowerCase());
      const inviteSnap = await getDoc(inviteRef);

      if (adminEmails.includes(email.toLowerCase()) || inviteSnap.exists()) {
        finalRole = 'admin'; 
        if (inviteSnap.exists()) {
          await deleteDoc(inviteRef);
        }
      }

      const newProfile = {
        uid: userCredential.user.uid,
        email: email,
        fullName: signupName,
        role: finalRole,
        createdAt: new Date().toISOString()
      };

      if (finalRole === 'pending_student' || signupRole === 'student') {
        newProfile.grade = signupGrade;
        newProfile.points = 0;
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      setProfile(newProfile);
      showToast(finalRole === 'admin' ? "Admin Account Created!" : "Account created. Awaiting approval!");
    } catch (err) {
      showToast(err.message.includes('email-already') ? "Email already exists." : "Signup failed.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setEmail('');
    setPassword('');
    setAuthView('login');
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast("Please enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Password reset link sent! Check your email.");
      setAuthView('login');
    } catch (err) {
      showToast(err.message.includes('auth/user-not-found') ? "No account found with this email." : err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ADMIN ACTIONS ---
  const handleApproveUser = async (uid, currentRole) => {
    try {
      const newRole = currentRole === 'pending_teacher' ? 'teacher' : 'student';
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      showToast("User approved!");
    } catch (err) {
      showToast("Failed to approve. Check your Admin permissions.");
    }
  };

  const handleRejectUser = async (uid) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      showToast("Request removed.");
    } catch (err) {
      showToast("Failed to remove request.");
    }
  };

  const handleSendAdminInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await setDoc(doc(db, 'admin_invites', inviteEmail.toLowerCase()), {
        email: inviteEmail.toLowerCase(),
        invitedBy: profile.fullName,
        createdAt: new Date().toISOString()
      });
      setInviteEmail('');
      showToast(`Admin invite created for ${inviteEmail}`);
    } catch (err) {
      showToast("Failed to create invite.");
    }
  };

  const handleRemoveInvite = async (emailId) => {
    try {
      await deleteDoc(doc(db, 'admin_invites', emailId));
      showToast("Invite revoked.");
    } catch (err) {
      showToast("Failed to revoke invite.");
    }
  };

  // --- PRINT QR CODES ACTIONS ---
  const togglePrintSelection = (uid) => {
    setPrintSelection(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllForPrint = () => {
    if (printSelection.length === students.length) {
      setPrintSelection([]); // Deselect all if already all selected
    } else {
      setPrintSelection(students.map(s => s.uid)); // Select all
    }
  };

  const executePrint = () => {
    if (printSelection.length === 0) {
      showToast("Please select at least one student to print.");
      return;
    }
    setShowPrintModal(false);
    // Slight delay to ensure modal closes before browser triggers print dialog
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // --- TEACHER ACTIONS ---
  const handleEnrollOfflineStudent = async (e) => {
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
        isOffline: true, 
        createdAt: new Date().toISOString()
      });
      setNewStudentName('');
      setShowAddStudent(false);
      showToast(`Enrolled offline student ${newStudentName}!`);
    } catch (err) {
      showToast("Blocked! Check your permissions.");
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent || !editStudentName.trim()) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      const updates = {
        fullName: editStudentName,
        grade: editStudentGrade
      };
      
      if (profile.role === 'admin') {
        updates.email = editStudentEmail;
      }

      await updateDoc(ref, updates);
      setSelectedStudent(prev => ({...prev, ...updates}));
      setIsEditingStudent(false);
      showToast("Student profile updated!");
    } catch (e) {
      showToast("Failed to update student.");
    }
  };

  const handleDeleteStudent = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'users', confirmDelete));
      setSelectedStudent(null);
      setConfirmDelete(null);
      setIsEditingStudent(false);
      showToast("Student profile deleted.");
    } catch (e) {
      showToast("Failed to delete student. Check permissions.");
    }
  };

  const handleAward = async () => {
    if (!selectedStudent || !user) return;
    try {
      const ref = doc(db, 'users', selectedStudent.uid);
      await updateDoc(ref, { points: increment(Number(customPoints)) });
      
      await addDoc(collection(db, 'pointHistory'), {
        studentId: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        teacherId: user.uid,
        teacherName: profile.fullName,
        amount: Number(customPoints),
        reason: customReason || 'Awarded points',
        type: 'award',
        createdAt: new Date().toISOString()
      });

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
      
      await addDoc(collection(db, 'pointHistory'), {
        studentId: selectedStudent.uid,
        studentName: selectedStudent.fullName,
        teacherId: user.uid,
        teacherName: profile.fullName,
        amount: -Math.abs(Number(redeemAmount)),
        reason: customReason || 'Redeemed points',
        type: 'redeem',
        createdAt: new Date().toISOString()
      });

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

  const openStudentPanel = (student) => {
    setSelectedStudent(student);
    setIsEditingStudent(false);
    setEditStudentName(student.fullName);
    setEditStudentGrade(student.grade || 'Pre-K');
    setEditStudentEmail(student.email || '');
  };

  const handleCameraScan = (decodedText) => {
    const foundStudent = students.find(s => s.uid === decodedText);
    if (foundStudent) {
      openStudentPanel(foundStudent);
      setShowScanner(false);
      showToast(`Scanned ${foundStudent.fullName}!`);
    } else {
      showToast("Student not found in database.");
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const scannedId = scanData.trim();
    const foundStudent = students.find(s => s.uid === scannedId);
    
    if (foundStudent) {
      openStudentPanel(foundStudent);
      setShowScanner(false);
      setScanData('');
      showToast(`Scanned ${foundStudent.fullName}!`);
    } else {
      showToast("Student not found. Please try again.");
      setScanData('');
    }
  };

  const filteredStudents = useMemo(() => {
    let base = students;
    if (activeListId !== 'all') {
      const list = customLists.find(l => l.id === activeListId);
      if (list) base = students.filter(s => list.studentIds.includes(s.uid));
    }
    return base.filter(s => s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, customLists, activeListId, searchTerm]);


  // ==========================================
  // RENDER BLOCKS
  // ==========================================

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-800 mb-4" size={48} />
        <h1 className="font-black text-gray-400 uppercase tracking-widest text-xs">Loading Eminence Eels...</h1>
      </div>
    );
  }

  // ----------------------------------------
  // AUTHENTICATION SCREEN
  // ----------------------------------------
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <ShieldCheck size={64} className="text-red-500 mb-4" strokeWidth={2.5} />
          <h1 className="text-5xl font-black text-white tracking-tighter">Eminence Eels</h1>
          <p className="text-blue-200 font-bold uppercase tracking-[0.2em] text-xs mt-2">Classroom Rewards Portal</p>
        </div>

        <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative z-10">
          <h2 className="text-3xl font-black text-blue-900 mb-8 tracking-tight text-center">
            {authView === 'login' ? 'Welcome Back' : authView === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>

          <form onSubmit={authView === 'login' ? handleLogin : authView === 'signup' ? handleSignup : handlePasswordReset} className="space-y-6">
            
            {authView === 'reset' && (
              <p className="text-sm text-gray-500 font-bold mb-4 px-2 text-center animate-in fade-in duration-300">
                Enter your email address and we'll send you a secure link to reset your password.
              </p>
            )}

            {authView === 'signup' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">I am a...</label>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-[1.5rem]">
                    <button 
                      type="button" 
                      onClick={() => setSignupRole('student')}
                      className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${signupRole === 'student' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Student
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setSignupRole('teacher')}
                      className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${signupRole === 'teacher' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Full Name</label>
                  <input 
                    required type="text" placeholder="John Doe"
                    value={signupName} onChange={(e) => setSignupName(e.target.value)} 
                    className="w-full p-5 bg-gray-50 rounded-3xl border-none font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100" 
                  />
                </div>

                {signupRole === 'student' && (
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Grade</label>
                    <select 
                      value={signupGrade} onChange={(e) => setSignupGrade(e.target.value)} 
                      className="w-full p-5 bg-gray-50 rounded-3xl border-none font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100 appearance-none cursor-pointer"
                    >
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Email Address</label>
              <input 
                required type="email" placeholder="email@school.edu"
                value={email} onChange={(e) => setEmail(e.target.value)} 
                className="w-full p-5 bg-gray-50 rounded-3xl border-none font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100" 
              />
            </div>
            
            {authView !== 'reset' && (
              <div className="animate-in fade-in duration-300">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block px-2">Password</label>
                <input 
                  required type="password" placeholder="••••••••" minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)} 
                  className="w-full p-5 bg-gray-50 rounded-3xl border-none font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-100" 
                />
                {authView === 'login' && (
                  <div className="text-right mt-2 px-2">
                    <button 
                      type="button" 
                      onClick={() => setAuthView('reset')} 
                      className="text-xs font-bold text-blue-800 hover:text-blue-600 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit" 
              className={`w-full text-white py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all mt-4 ${authView === 'reset' ? 'bg-blue-800 hover:bg-blue-900 shadow-blue-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
            >
              {authView === 'login' ? 'Sign In' : authView === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8 text-center">
            {authView === 'reset' ? (
              <button 
                type="button"
                onClick={() => setAuthView('login')}
                className="text-sm font-bold text-gray-400 hover:text-blue-800 transition-colors"
              >
                Back to Log In
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}
                className="text-sm font-bold text-gray-400 hover:text-blue-800 transition-colors"
              >
                {authView === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
              </button>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 z-50">
            <AlertCircle size={20} className="text-red-400" />
            <span className="font-bold text-sm">{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------
  // PENDING USER SCREEN (Student or Teacher)
  // ----------------------------------------
  if (profile.role === 'pending_teacher' || profile.role === 'pending_student') {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative z-10 text-center">
           <Clock size={64} className="mx-auto text-blue-800 mb-6" />
           <h2 className="text-3xl font-black text-blue-900 mb-4 tracking-tight">Approval Pending</h2>
           <p className="text-gray-500 font-bold mb-8 leading-relaxed">
             Your account has been created and is waiting for an administrator to verify it. Please check back soon.
           </p>
           <button 
              onClick={handleLogout} 
              className="w-full bg-gray-100 text-gray-600 py-4 rounded-[2rem] font-black text-lg hover:bg-gray-200 transition-all"
           >
              Sign Out
           </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // APP MODE: STUDENT DASHBOARD
  // ----------------------------------------
  if (profile.role === 'student') {
    const myHistory = history.filter(h => h.studentId === profile.uid);

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <header className="bg-blue-900 text-white p-6 md:p-10 flex justify-between items-center rounded-b-[3rem] shadow-xl relative z-20">
          <div className="flex items-center gap-4">
            <ShieldCheck size={48} className="text-red-500" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter">Student Portal</h1>
              <p className="text-blue-200 font-bold text-sm uppercase tracking-widest">{profile.fullName}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="bg-blue-800 text-blue-100 p-4 rounded-2xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 font-bold shadow-inner"
          >
             <span className="hidden sm:block">Sign Out</span>
             <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full space-y-10 -mt-6 relative z-10">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-t-8 border-red-600">
             <div>
               <h2 className="text-gray-400 font-black uppercase tracking-widest mb-2 text-center md:text-left">My Reward Balance</h2>
               <div className="text-8xl font-black text-blue-900 flex items-center justify-center md:justify-start gap-4 tracking-tighter">
                  <Star size={72} className="text-red-600" fill="currentColor" />
                  {profile.points || 0}
               </div>
             </div>
             
             {/* Student's Personal QR Code */}
             <div className="bg-gray-50 border border-gray-100 p-6 rounded-[2rem] flex flex-col items-center shadow-inner">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${profile.uid}`} 
                 alt="My QR Code" 
                 className="w-32 h-32 rounded-xl mb-3 bg-white p-2 shadow-sm"
               />
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                 <QrCode size={14} /> Student ID
               </p>
             </div>
          </div>

          <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
             <h3 className="text-2xl font-black text-blue-900 mb-8 flex items-center gap-3">
                <Clock className="text-red-500" /> My Activity History
             </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-gray-400 uppercase tracking-widest text-xs">
                      <th className="pb-4 font-black px-4">Date</th>
                      <th className="pb-4 font-black px-4 text-center">Amount</th>
                      <th className="pb-4 font-black px-4">Reason / Feedback</th>
                      <th className="pb-4 font-black px-4">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myHistory.length > 0 ? myHistory.map(record => (
                      <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-5 px-4 font-bold text-sm text-gray-500 whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-5 px-4 text-center">
                          <span className={`inline-block px-4 py-2 rounded-2xl font-black text-lg ${record.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {record.amount > 0 ? '+' : ''}{record.amount}
                          </span>
                        </td>
                        <td className="py-5 px-4 font-bold text-blue-900 max-w-xs">{record.reason}</td>
                        <td className="py-5 px-4 font-bold text-gray-400 text-sm">{record.teacherName}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="py-16 text-center text-gray-400 font-bold italic bg-gray-50 rounded-2xl mt-4 block w-full">No points recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        </main>
      </div>
    );
  }

  // ----------------------------------------
  // APP MODE: TEACHER / ADMIN DASHBOARD
  // ----------------------------------------
  return (
    <>
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900 print:hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 md:w-72 bg-white border-r border-gray-200 flex flex-col py-10 px-6 shadow-2xl shadow-gray-200/50 z-20">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-blue-800 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 flex-shrink-0">
            <ShieldCheck size={28} />
          </div>
          <span className="hidden md:block font-black text-2xl tracking-tighter text-blue-900 truncate">Eminence Eels</span>
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
          <button 
            onClick={() => { setActiveTab('history'); setSelectedStudent(null); }} 
            className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
              activeTab === 'history' ? 'bg-blue-800 text-white shadow-xl shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <Clock size={24} /><span className="hidden md:block">Point History</span>
          </button>

          {profile.role === 'admin' && (
            <button 
              onClick={() => { setActiveTab('admin'); setSelectedStudent(null); }} 
              className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all mt-4 border-t border-gray-100 pt-6 ${
                activeTab === 'admin' ? 'bg-red-600 text-white shadow-xl shadow-red-200' : 'text-red-500 hover:bg-red-50'
              }`}
            >
              <UserCheck size={24} />
              <span className="hidden md:block flex-1 text-left">
                Admin Settings 
              </span>
              {pendingUsers.length > 0 && <span className="hidden md:block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-black">{pendingUsers.length}</span>}
            </button>
          )}
        </nav>

        {/* User Badge & Logout */}
        <div className="mt-auto hidden md:block">
          <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100 text-center mb-4">
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
               {profile.role === 'admin' ? 'Admin Access' : 'Signed in as'}
             </p>
             <p className="text-sm font-black text-blue-900 truncate tracking-tight">{profile.fullName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-4 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        {/* Mobile logout */}
        <button onClick={handleLogout} className="md:hidden mt-auto p-4 mx-auto text-gray-400 hover:text-red-600">
          <LogOut size={24} />
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="text-5xl font-black tracking-tight mb-2 text-blue-900">
              {activeTab === 'students' ? 'Student Directory' 
               : activeTab === 'groups' ? 'Group Management' 
               : activeTab === 'history' ? 'Transaction Log' 
               : 'Admin Dashboard'}
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

              <div className="relative flex-1 md:w-64 hidden sm:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                <input 
                  type="text" placeholder="Search..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all" 
                />
              </div>
              
              <button 
                onClick={() => setShowScanner(true)} 
                className="bg-blue-800 text-white p-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-900 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                title="Scan a Student ID"
              >
                <ScanLine size={24} /><span className="font-black">Scan</span>
              </button>

              <button 
                onClick={() => setShowAddStudent(true)} 
                className="bg-red-600 text-white p-4 rounded-2xl shadow-xl shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2 hidden sm:flex"
                title="Add a student without an account"
              >
                <UserPlus size={24} /><span className="font-black">Enroll</span>
              </button>

              {profile.role === 'admin' && (
                <button 
                  onClick={() => {
                    setPrintSelection(students.map(s => s.uid)); // Default to all students
                    setShowPrintModal(true);
                  }} 
                  className="bg-white border-2 border-gray-200 text-gray-600 p-4 rounded-2xl shadow-sm hover:bg-gray-50 hover:text-blue-800 transition-all flex items-center gap-2"
                  title="Print Student ID Cards"
                >
                  <Printer size={24} /><span className="font-black hidden lg:block">Print IDs</span>
                </button>
              )}
            </div>
          )}
        </header>

        {activeTab === 'admin' ? (
          /* --- ADMIN TAB --- */
          <div className="max-w-4xl animate-in fade-in duration-300 space-y-12">
            
            {/* Invite Admin Section */}
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
              <h3 className="text-2xl font-black text-blue-900 mb-2">Invite Administrator</h3>
              <p className="text-sm font-bold text-gray-400 mb-6">Authorize an email address to automatically become an Admin when they sign up.</p>
              
              <form onSubmit={handleSendAdminInvite} className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={20} />
                  <input 
                    required type="email"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-800 outline-none font-bold text-lg transition-all"
                    placeholder="colleague@school.edu"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="bg-blue-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-900 transition-all whitespace-nowrap">
                  Send Invite
                </button>
              </form>

              {adminInvites.length > 0 && (
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Pending Invites</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {adminInvites.map(invite => (
                      <div key={invite.id} className="flex items-center justify-between bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <span className="font-bold text-blue-900 text-sm truncate pr-4">{invite.email}</span>
                        <button onClick={() => handleRemoveInvite(invite.id)} className="text-red-500 hover:text-red-700 bg-white p-2 rounded-xl shadow-sm">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pending Approvals Section */}
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
              <h3 className="text-2xl font-black text-blue-900 mb-6">Pending User Approvals</h3>
              {pendingUsers.length > 0 ? (
                <div className="space-y-4">
                  {pendingUsers.map(pt => (
                    <div key={pt.uid} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 p-6 rounded-3xl border border-gray-100 gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-black text-blue-900 text-xl">{pt.fullName}</p>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${pt.role === 'pending_teacher' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {pt.role === 'pending_teacher' ? 'Teacher' : 'Student'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-500">{pt.email}</p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button 
                          onClick={() => handleApproveUser(pt.uid, pt.role)} 
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-black shadow-md transition-all"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleRejectUser(pt.uid)} 
                          className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 px-6 py-3 rounded-xl font-black transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                 <div className="py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4 opacity-50" />
                    <p className="text-gray-500 font-bold text-lg">No pending user requests.</p>
                 </div>
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          /* --- HISTORY TAB --- */
          <div className="max-w-6xl animate-in fade-in duration-300">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100">
              <h3 className="text-2xl font-black text-blue-900 mb-8 flex items-center gap-3">
                 <ShieldCheck className="text-red-500" /> Database Audit Log
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-gray-400 uppercase tracking-widest text-xs">
                      <th className="pb-4 font-black px-4">Date & Time</th>
                      <th className="pb-4 font-black px-4">Student</th>
                      <th className="pb-4 font-black px-4 text-center">Amount</th>
                      <th className="pb-4 font-black px-4">Reason</th>
                      <th className="pb-4 font-black px-4">Given By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length > 0 ? history.map(record => (
                      <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-5 px-4 font-bold text-sm text-gray-500 whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="py-5 px-4 font-black text-blue-900">{record.studentName}</td>
                        <td className="py-5 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-xl font-black ${record.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {record.amount > 0 ? '+' : ''}{record.amount}
                          </span>
                        </td>
                        <td className="py-5 px-4 font-bold text-gray-600 max-w-xs truncate" title={record.reason}>{record.reason}</td>
                        <td className="py-5 px-4 font-bold text-gray-400 text-sm">{record.teacherName}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="py-16 text-center text-gray-400 font-bold italic bg-gray-50 rounded-2xl block mt-4">No history recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'groups' ? (
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
                    className={`p-8 text-left rounded-[3rem] border-4 transition-all relative overflow-hidden ${
                      selectedStudent?.uid === student.uid 
                      ? 'bg-white border-blue-800 shadow-2xl scale-[1.03]' 
                      : 'bg-white border-transparent shadow-sm hover:shadow-lg'
                    }`}
                  >
                    {student.isOffline && (
                      <span className="absolute top-4 right-4 text-[10px] font-black text-gray-300 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">Offline</span>
                    )}
                    <div className="flex justify-between items-start mb-6">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl ${
                        selectedStudent?.uid === student.uid ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {student.fullName?.charAt(0)}
                      </div>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-4 py-2 rounded-2xl text-lg font-black text-blue-900 mt-2">
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
                    <p className="mt-2 text-sm font-bold">Students will appear here when they register.</p>
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
                          placeholder="Student Name"
                          className="w-full p-4 mb-3 bg-gray-50 rounded-2xl border-none font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        {profile.role === 'admin' && !selectedStudent.isOffline && (
                          <div className="mb-3">
                            <input 
                              value={editStudentEmail} onChange={(e) => setEditStudentEmail(e.target.value)} 
                              placeholder="Contact Email"
                              className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <p className="text-[10px] text-gray-400 font-bold mt-1 px-2 uppercase tracking-widest">* Updates database email, not login credentials</p>
                          </div>
                        )}
                        <select 
                          value={editStudentGrade} onChange={(e) => setEditStudentGrade(e.target.value)} 
                          className="w-full p-4 mb-4 bg-gray-50 rounded-2xl border-none font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button onClick={handleUpdateStudent} className="flex-1 bg-blue-800 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-900"><Save size={18}/> Save</button>
                            <button onClick={() => setIsEditingStudent(false)} className="flex-1 bg-gray-200 text-gray-600 py-3 rounded-xl font-black hover:bg-gray-300">Cancel</button>
                          </div>
                          <button 
                            onClick={() => setConfirmDelete(selectedStudent.uid)} 
                            className="w-full mt-2 bg-red-50 text-red-600 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={18}/> Delete Student Profile
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 truncate pr-4">
                          <h3 className="text-2xl font-black tracking-tight text-blue-900 leading-tight truncate">{selectedStudent.fullName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest truncate">{selectedStudent.grade}</span>
                            <button onClick={() => setIsEditingStudent(true)} className="text-blue-800 hover:text-blue-600 p-1 flex-shrink-0" title="Edit Student">
                              <Edit2 size={14} />
                            </button>
                          </div>
                          {profile.role === 'admin' && selectedStudent.email && (
                            <p className="text-xs font-bold text-gray-400 mt-1 truncate">{selectedStudent.email}</p>
                          )}
                        </div>
                        
                        {/* Display QR code for Teacher to see/print */}
                        <div className="flex-shrink-0 mr-4 hidden sm:block">
                           <img 
                             src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${selectedStudent.uid}`} 
                             alt="QR" 
                             className="w-16 h-16 rounded-lg border border-gray-200 shadow-sm"
                           />
                        </div>
                        
                        <button onClick={() => setSelectedStudent(null)} className="text-gray-300 hover:bg-gray-50 rounded-full p-2 flex-shrink-0 self-start"><X size={24} /></button>
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
                            Redeem
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

      {/* Print Selection Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black tracking-tight text-blue-900 flex items-center gap-2">
                <Printer className="text-blue-600" /> Print Student IDs
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPrintModal(false)} 
                className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex justify-between items-center mb-4 px-2">
               <p className="text-sm font-bold text-gray-500">Select which QR codes to print:</p>
               <button 
                 onClick={handleSelectAllForPrint}
                 className="text-sm font-black text-blue-600 hover:text-blue-800 transition-colors"
               >
                 {printSelection.length === students.length ? 'Deselect All' : 'Select All'}
               </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {students.map(s => (
                  <label key={s.uid} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border-2 ${printSelection.includes(s.uid) ? 'bg-blue-50 border-blue-800' : 'bg-white border-transparent hover:border-gray-200'}`}>
                    <input 
                      type="checkbox"
                      checked={printSelection.includes(s.uid)}
                      onChange={() => togglePrintSelection(s.uid)}
                      className="w-5 h-5 accent-blue-800 rounded"
                    />
                    <div className="truncate">
                      <span className="block font-bold text-blue-900 truncate">{s.fullName}</span>
                      <span className="block text-xs font-bold text-gray-400">{s.grade}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4">
               <button 
                 onClick={() => setShowPrintModal(false)}
                 className="px-6 py-4 rounded-2xl font-black text-gray-600 hover:bg-gray-100 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 onClick={executePrint}
                 className="bg-blue-800 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-900 transition-all flex items-center gap-2"
               >
                 <Printer size={20} /> Print {printSelection.length} IDs
               </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-black tracking-tight text-blue-900 flex items-center gap-2">
                <ScanLine className="text-blue-600" /> Scanner
              </h3>
              <button 
                type="button" 
                onClick={() => setShowScanner(false)} 
                className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Live Camera Feed */}
            <div className="flex-1 min-h-[300px] mb-4 relative">
               <CameraScanner onScan={handleCameraScan} />
            </div>

            <div className="relative flex items-center py-2 mb-4">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-black uppercase tracking-widest">Manual Input</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleScanSubmit}>
              <input 
                type="text" 
                value={scanData} 
                onChange={(e) => setScanData(e.target.value)} 
                placeholder="Hardware Scanner ID..." 
                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 font-bold text-center text-blue-900 outline-none transition-all text-sm shadow-inner" 
              />
            </form>
          </div>
        </div>
      )}

      {/* Offline Enrollment Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form 
            onSubmit={handleEnrollOfflineStudent} 
            className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 duration-300"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-black tracking-tight text-blue-900">Add Offline Student</h3>
              <button type="button" onClick={() => setShowAddStudent(false)} className="text-gray-300 hover:bg-gray-50 p-2 rounded-full">
                <X size={32} />
              </button>
            </div>
            <p className="text-sm font-bold text-gray-500 mb-10 leading-relaxed">
              Use this to add a student who won't be logging in on their own device. You can still track and award them points!
            </p>
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

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-red-600" />
            </div>
            <h3 className="text-2xl font-black text-blue-900 mb-2">Delete Student?</h3>
            <p className="text-gray-500 font-bold mb-8">This action cannot be undone. All points and data for this student will be lost.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteStudent} 
                className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-red-700 active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
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

    {/* --- PRINT-ONLY LAYOUT --- */}
    <div className="hidden print:block p-8 bg-white text-black min-h-screen">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black uppercase tracking-widest border-b-4 border-black pb-4 inline-block">Eminence Eels IDs</h1>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {students.filter(s => printSelection.includes(s.uid)).map(s => (
          <div key={s.uid} className="border-4 border-black p-6 flex flex-col items-center justify-center break-inside-avoid shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white h-72">
            <h2 className="font-black text-2xl mb-1 text-center leading-tight truncate w-full">{s.fullName}</h2>
            <p className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-widest">{s.grade}</p>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${s.uid}`} 
              alt="QR Code" 
              className="w-32 h-32"
            />
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
