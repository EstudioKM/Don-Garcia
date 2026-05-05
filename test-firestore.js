import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const docRef = doc(db, "configuration", "layout");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log("LAYOUT EXISTS IN DB:");
    console.log(JSON.stringify(docSnap.data(), null, 2).substring(0, 500) + "...");
  } else {
    console.log("LAYOUT DOES NOT EXIST IN DB.");
  }
  
  const settingsRef = doc(db, "configuration", "restaurant_settings");
  const settingsSnap = await getDoc(settingsRef);
  if (settingsSnap.exists()) {
    console.log("SETTINGS EXISTS IN DB");
  } else {
    console.log("SETTINGS DOES NOT EXIST IN DB");
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
