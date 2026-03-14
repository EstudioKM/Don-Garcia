import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, Timestamp, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Order, OrderItem } from "../types";

const COLLECTION_NAME = "orders";
const SESSION_COLLECTION_NAME = "tableSessions";

// --- Gestión de Sesiones de Comanda en Progreso ---

export const getInProgressOrder = async (tableId: string): Promise<OrderItem[]> => {
  try {
    const docRef = doc(db, SESSION_COLLECTION_NAME, tableId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().items || [];
    }
    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
    if (errorMessage.includes('client is offline')) {
      console.warn("Firebase client is offline. Returning empty in-progress order.");
    } else {
      console.error("Error fetching in-progress order:", error);
    }
    return [];
  }
};

export const updateInProgressOrder = async (tableId: string, items: OrderItem[]) => {
  try {
    const docRef = doc(db, SESSION_COLLECTION_NAME, tableId);
    await setDoc(docRef, { items, lastUpdated: Timestamp.now() });
  } catch (error) {
    console.error("Error updating in-progress order:", error);
  }
};

export const clearInProgressOrder = async (tableId: string) => {
  try {
    const docRef = doc(db, SESSION_COLLECTION_NAME, tableId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error clearing in-progress order:", error);
  }
};


// --- Gestión de Comandas Finalizadas ---

export const listenToOrders = (callback: (orders: Order[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const orders: Order[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        items: data.items,
        status: data.status,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
        tableId: data.tableId
      } as Order;
    });
    callback(orders);
  }, (error) => {
      console.error("Error escuchando las comandas en tiempo real:", error);
      callback([]);
  });

  return unsubscribe;
};

export const createOrder = async (items: OrderItem[], tableId: string = 'Mesa 4') => {
  try {
    const newOrder = {
      items,
      tableId,
      status: 'pending',
      timestamp: Timestamp.now()
    };
    await addDoc(collection(db, COLLECTION_NAME), newOrder);
    return true;
  } catch (error) {
    console.error("Error creating order in Firebase:", error);
    return false;
  }
};

export const updateOrderState = async (orderId: string, status: 'pending' | 'completed') => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, { status });
    return true;
  } catch (error) {
    console.error("Error updating order status:", error);
    return false;
  }
};

export const updateOrderItems = async (orderId: string, items: OrderItem[]) => {
  try {
    const orderRef = doc(db, COLLECTION_NAME, orderId);
    await updateDoc(orderRef, { items });
    return true;
  } catch (error) {
    console.error("Error updating order items:", error);
    return false;
  }
};