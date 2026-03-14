import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Layout } from "../types";

const COLLECTION_NAME = "configuration";
const DOC_ID = "layout";

const DEFAULT_LAYOUT: Layout = {
  environments: [
    {
      id: "env-1",
      name: "Salón Principal",
      maxCapacity: 40,
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000",
      tables: [
        { id: "t-1", name: "Mesa 1", capacity: 4 },
        { id: "t-2", name: "Mesa 2", capacity: 4 },
        { id: "t-3", name: "Mesa 3", capacity: 2 },
        { id: "t-4", name: "Mesa 4", capacity: 6 },
      ],
    },
    {
      id: "env-2",
      name: "Patio Beltrame",
      maxCapacity: 25,
      image: "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&q=80&w=1000",
      tables: [
        { id: "t-5", name: "Patio 1", capacity: 4 },
        { id: "t-6", name: "Patio 2", capacity: 8 },
      ],
    },
  ],
};

export const getLayout = async (): Promise<Layout> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Layout;
    } else {
      console.log("No layout found, seeding with default layout.");
      await setDoc(docRef, DEFAULT_LAYOUT);
      return DEFAULT_LAYOUT;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
    if (errorMessage.includes('client is offline')) {
      console.warn("Firebase client is offline. Using default layout.");
    } else {
      console.error("Error fetching layout:", error);
    }
    return DEFAULT_LAYOUT;
  }
};

export const saveLayout = async (layoutData: Layout): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(docRef, layoutData);
    return true;
  } catch (error) {
    console.error("Error saving layout:", error);
    throw error;
  }
};