
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
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

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

const auth = getAuth(app);
const analytics = getAnalytics(app);
const storage = getStorage(app);

export { app, db, auth, analytics, storage };
