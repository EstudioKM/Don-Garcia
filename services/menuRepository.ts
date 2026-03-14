
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { REAL_MENU } from "../data/menuData";

const COLLECTION_NAME = "restaurants";
const DOC_ID = "don_garcia_menu";

// Obtiene el menú de Firebase. Si no existe, lo crea usando los datos locales (Seeding)
export const getMenuFromDB = async () => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No menu found in DB, seeding from local data...");
      await setDoc(docRef, REAL_MENU);
      return REAL_MENU;
    }
  } catch (error) {
    console.error("Error fetching menu from Firebase:", error);
    // Fallback to local data if offline or error
    return REAL_MENU;
  }
};

export const saveMenuToDB = async (newMenuData: any) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(docRef, newMenuData);
    return true;
  } catch (error) {
    console.error("Error saving menu to Firebase:", error);
    throw error;
  }
};
