
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/auth";

// Use explicit config (replace with env vars if you prefer)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDeTZMsZH-mp72FAhKPl37-P-TGVEXJtlE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "blackdot-1890a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blackdot-1890a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blackdot-1890a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1013007895406",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1013007895406:web:83f203390e1565efb88f7f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DS504MHHHY"
};

const app = firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();
export const storage = firebase.storage();
export const auth = firebase.auth();