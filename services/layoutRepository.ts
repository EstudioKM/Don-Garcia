import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { Layout } from "../types";

const COLLECTION_NAME = "configuration";
const DOC_ID = "layout";

const DEFAULT_LAYOUT: Layout = {
  environments: [
    {
      id: "env-pb-centro",
      name: "PLANTA BAJA CENTRO",
      maxCapacity: 22,
      tables: [
        { id: "t-pb-c-1", name: "MESA 1", capacity: 6 },
        { id: "t-pb-c-2", name: "MESA 2", capacity: 4 },
        { id: "t-pb-c-3", name: "MESA 3", capacity: 4 },
        { id: "t-pb-c-4", name: "MESA 4", capacity: 4 },
        { id: "t-pb-c-5", name: "MESA 5", capacity: 4 },
      ],
    },
    {
      id: "env-pb-este",
      name: "PLANTA BAJA ESTE",
      maxCapacity: 16,
      tables: [
        { id: "t-pb-e-6", name: "MESA 6", capacity: 4 },
        { id: "t-pb-e-7", name: "MESA 7", capacity: 4 },
        { id: "t-pb-e-8", name: "MESA 8", capacity: 4 },
        { id: "t-pb-e-9", name: "MESA 9", capacity: 4 },
      ],
    },
    {
      id: "env-entrepiso",
      name: "ENTREPISO",
      maxCapacity: 14,
      tables: [
        { id: "t-ent-10", name: "MESA 10", capacity: 2 },
        { id: "t-ent-11", name: "MESA 11", capacity: 4 },
        { id: "t-ent-12", name: "MESA 12", capacity: 4 },
        { id: "t-ent-14", name: "MESA 14", capacity: 4 },
      ],
    },
    {
       id: "env-pa-este",
       name: "PLANTA ALTA ESTE",
       maxCapacity: 12,
       tables: [
        { id: "t-pa-e-20", name: "MESA 20", capacity: 4 },
        { id: "t-pa-e-21", name: "MESA 21", capacity: 4 },
        { id: "t-pa-e-22", name: "MESA 22", capacity: 4 },
       ]
    },
    {
       id: "env-pa-centro",
       name: "PLANTA ALTA CENTRO",
       maxCapacity: 12,
       tables: [
        { id: "t-pa-c-30", name: "MESA 30", capacity: 4 },
        { id: "t-pa-c-31", name: "MESA 31", capacity: 4 },
        { id: "t-pa-c-32", name: "MESA 32", capacity: 4 },
       ]
    },
    {
       id: "env-pa-oeste",
       name: "PLANTA ALTA OESTE",
       maxCapacity: 10,
       tables: [
        { id: "t-pa-o-40", name: "MESA 40", capacity: 4 },
        { id: "t-pa-o-41", name: "MESA 41", capacity: 4 },
        { id: "t-pa-o-42", name: "MESA 42", capacity: 2 },
       ]
    },
    {
       id: "env-pa-norte",
       name: "PLANTA ALTA NORTE",
       maxCapacity: 16,
       tables: [
        { id: "t-pa-n-50", name: "MESA 50", capacity: 4 },
        { id: "t-pa-n-51", name: "MESA 51", capacity: 4 },
        { id: "t-pa-n-52", name: "MESA 52", capacity: 4 },
        { id: "t-pa-n-53", name: "MESA 53", capacity: 4 },
       ]
    },
    {
       id: "env-pa-descanso",
       name: "PLANTA ALTA DESCANSO",
       maxCapacity: 6,
       tables: [
        { id: "t-pa-d-60", name: "MESA 60", capacity: 2 },
        { id: "t-pa-d-61", name: "MESA 61", capacity: 2 },
        { id: "t-pa-d-62", name: "MESA 62", capacity: 2 },
       ]
    },
    {
       id: "env-balcon-este",
       name: "BALCON ESTE",
       maxCapacity: 8,
       tables: [
        { id: "t-b-e-1", name: "E1", capacity: 2 },
        { id: "t-b-e-2", name: "E2", capacity: 2 },
        { id: "t-b-e-3", name: "E3", capacity: 2 },
        { id: "t-b-e-4", name: "E4", capacity: 2 },
       ]
    },
    {
       id: "env-balcon-oeste",
       name: "BALCON OESTE",
       maxCapacity: 6,
       tables: [
        { id: "t-b-o-1", name: "O1", capacity: 2 },
        { id: "t-b-o-2", name: "O2", capacity: 2 },
        { id: "t-b-o-3", name: "O3", capacity: 2 },
       ]
    },
    {
       id: "env-deck",
       name: "DECK",
       maxCapacity: 59,
       tables: [
        { id: "t-d-100", name: "100", capacity: 2 },
        { id: "t-d-101", name: "101", capacity: 8 },
        { id: "t-d-110", name: "110", capacity: 2 },
        { id: "t-d-111", name: "111", capacity: 2 },
        { id: "t-d-120", name: "120", capacity: 2 },
        { id: "t-d-121", name: "121", capacity: 4 },
        { id: "t-d-122", name: "122", capacity: 6 },
        { id: "t-d-123", name: "123", capacity: 7 },
        { id: "t-d-124", name: "124", capacity: 2 },
        { id: "t-d-130", name: "130", capacity: 4 },
        { id: "t-d-131", name: "131", capacity: 4 },
        { id: "t-d-132", name: "132", capacity: 2 },
        { id: "t-d-140", name: "140", capacity: 4 },
        { id: "t-d-141", name: "141", capacity: 4 },
        { id: "t-d-142", name: "142", capacity: 4 },
        { id: "t-d-150", name: "150", capacity: 4 },
        { id: "t-d-151", name: "151", capacity: 4 },
        { id: "t-d-152", name: "152", capacity: 4 }
       ]
    }
  ]
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

export const subscribeToLayout = (callback: (layout: Layout) => void) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_ID);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Layout);
    } else {
      callback(DEFAULT_LAYOUT);
    }
  }, (error) => {
    const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
    if (errorMessage.includes('client is offline')) {
      console.warn("Firebase client is offline. Using default layout.");
    } else {
      console.error("Error subscribing to layout:", error);
    }
    callback(DEFAULT_LAYOUT);
  });
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