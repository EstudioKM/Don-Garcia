import { db } from "../firebase";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy, 
    Timestamp, 
    where,
    deleteDoc,
    getDocs
} from "firebase/firestore";
import { Reservation } from "../types";
import { addReservationToCustomer } from "./customerRepository";
import { getStartOfDayArgentina, getEndOfDayArgentina } from "../utils/dateUtils";

const COLLECTION_NAME = "reservations";

export const getAllReservations = async (): Promise<Reservation[]> => {
    // Nota: Para aplicaciones a gran escala, obtener todos los documentos puede ser costoso.
    // Para este caso, es una solución viable. Se elimina el orderBy para evitar fallos por falta de índice.
    const q = query(collection(db, COLLECTION_NAME));
    try {
        const snapshot = await getDocs(q);
        const reservations: Reservation[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate()
            } as Reservation;
        });
        // Ordenar en el cliente para mayor robustez
        reservations.sort((a, b) => b.date.getTime() - a.date.getTime());
        return reservations;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
        if (errorMessage.includes('client is offline')) {
            console.warn("Firebase client is offline. Returning empty reservations list.");
        } else {
            console.error("Error getting all reservations:", error);
        }
        return [];
    }
};

export const getReservationsForDate = async (date: Date): Promise<Reservation[]> => {
    const startOfDay = getStartOfDayArgentina(date);
    const endOfDay = getEndOfDayArgentina(date);

    const q = query(
        collection(db, COLLECTION_NAME),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay))
    );

    try {
        const snapshot = await getDocs(q);
        const reservations: Reservation[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate()
            } as Reservation;
        });
        return reservations;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
        if (errorMessage.includes('client is offline')) {
            console.warn("Firebase client is offline. Returning empty reservations for date.");
        } else {
            console.error("Error getting reservations for date:", error);
        }
        return [];
    }
};


export const listenToReservationsForDate = (date: Date, callback: (reservations: Reservation[]) => void) => {
    const startOfDay = getStartOfDayArgentina(date);
    const endOfDay = getEndOfDayArgentina(date);

    const q = query(
        collection(db, COLLECTION_NAME),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay)),
        orderBy("date", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reservations: Reservation[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate()
            } as Reservation;
        });
        callback(reservations);
    }, (error) => {
        console.error("Error escuchando las reservas en tiempo real:", error);
        // En caso de error (ej. offline), limpiamos la lista para no mostrar datos desactualizados.
        callback([]);
    });

    return unsubscribe;
};

export const listenToAllReservations = (callback: (reservations: Reservation[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reservations: Reservation[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate()
            } as Reservation;
        });
        callback(reservations);
    }, (error) => {
        console.error("Error listening to all reservations:", error);
        callback([]);
    });

    return unsubscribe;
};

export const createReservation = async (reservationData: Omit<Reservation, 'id'>, customerId: string) => {
    try {
        const dataWithCustomer = { ...reservationData, customerId };
        
        // Remove any undefined fields to prevent Firestore errors
        const cleanData = Object.fromEntries(
            Object.entries(dataWithCustomer).filter(([_, v]) => v !== undefined)
        );

        const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanData);
        
        // Link this reservation back to the customer
        await addReservationToCustomer(customerId, docRef.id);

        return docRef;
    } catch (error) {
        console.error("Error creating reservation:", error);
        throw error;
    }
};

export const updateReservation = async (reservationId: string, updates: Partial<Reservation>) => {
    try {
        const reservationRef = doc(db, COLLECTION_NAME, reservationId);
        
        // Remove any undefined fields to prevent Firestore errors
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        await updateDoc(reservationRef, cleanUpdates);
        return true;
    } catch (error) {
        console.error("Error updating reservation:", error);
        throw error;
    }
};

export const deleteReservation = async (reservationId: string) => {
    if (!reservationId) {
        console.error("Error: el ID de la reserva es nulo o indefinido al intentar eliminar.");
        throw new Error("No se puede eliminar una reserva sin un ID válido.");
    }
    try {
        const reservationRef = doc(db, COLLECTION_NAME, reservationId);
        await deleteDoc(reservationRef);
        return true;
    } catch (error) {
        console.error("Error al eliminar la reserva en Firebase:", error);
        throw error;
    }
};
