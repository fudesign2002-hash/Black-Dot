import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const app = initializeApp({
  projectId: "your-project-id" // wait, let me just check the raw JSON output I downloaded earlier
});
