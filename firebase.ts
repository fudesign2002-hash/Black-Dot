
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/auth";

// Use explicit config (replace with env vars if you prefer)
const firebaseConfig = {
  apiKey: "AIzaSyDeTZMsZH-mp72FAhKPl37-P-TGVEXJtlE",
  authDomain: "blackdot-1890a.firebaseapp.com",
  projectId: "blackdot-1890a",
  storageBucket: "blackdot-1890a.firebasestorage.app",
  messagingSenderId: "1013007895406",
  appId: "1:1013007895406:web:83f203390e1565efb88f7f",
  measurementId: "G-DS504MHHHY"
};

const app = firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();
export const storage = firebase.storage();
export const auth = firebase.auth();