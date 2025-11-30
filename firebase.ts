import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage"; 

const firebaseConfig = {
  apiKey: "AIzaSyDeTZMsZH-mp72FAhKPl37-P-TGVEXJtlO",
  authDomain: "blackdot-1890a.firebaseapp.com",
  projectId: "blackdot-1890a",
  storageBucket: "blackdot-1890a.firebasestorage.app",
  messagingSenderId: "1013007895406",
  appId: "1:1013007895406:web:75a13429882b37b3b88f7f",
  measurementId: "G-HQ8FQMBQ7P"
};

const app = firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();
export const storage = firebase.storage();