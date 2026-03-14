
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrc_HvoJJiD1iRJyjXW6_nMbTpK2n1E9c",
  authDomain: "dongarcia-4a95d.firebaseapp.com",
  projectId: "dongarcia-4a95d",
  storageBucket: "dongarcia-4a95d.firebasestorage.app",
  messagingSenderId: "634983352288",
  appId: "1:634983352288:web:3c34c76bb9a71f739e4d85",
  measurementId: "G-13TLVZ4V72"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
