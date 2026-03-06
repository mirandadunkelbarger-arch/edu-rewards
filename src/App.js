import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, Lock, LogOut, Award, Star, PlusCircle, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, onSnapshot, query, updateDoc, increment, setDoc } from 'firebase/firestore';

// 1. SET YOUR TEACHER EMAIL HERE
const TEACHER_EMAIL = "your-email@here.com"; 

// 2. YOUR EMINENCE EELS CONFIG
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
    return ()
