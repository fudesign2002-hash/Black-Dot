// Import the functions you need from the SDKs you need
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage"; 

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDeTZMsZH-mp72FAhKPl37-P-TGVEXJtlO",
  authDomain: "blackdot-1890a.firebaseapp.com",
  projectId: "blackdot-1890a",
  storageBucket: "blackdot-1890a.firebasestorage.app",
  messagingSenderId: "1013007895406",
  appId: "1:1013007895406:web:75a13429882b37b3b88f7f",
  measurementId: "G-HQ8FQMBQ7P"
};

// Initialize Firebase
// FIX: Use Firebase v8 compat syntax
const app = firebase.initializeApp(firebaseConfig);
// FIX: Use Firebase v8 compat syntax
export const db = firebase.firestore(); // Initialize and export Firestore
export const storage = firebase.storage(); // NEW: Initialize and export Firebase Storage