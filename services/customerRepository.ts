import { db } from "../firebase";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where,
    getDocs,
    Timestamp,
    arrayUnion,
    onSnapshot,
    orderBy,
    deleteDoc
} from "firebase/firestore";
import { Customer, Reservation } from "../types";

const COLLECTION_NAME = "customers";

/**
 * Normaliza un número de teléfono a un formato estándar.
 * Ej: "342 406-6887" -> "543424066887"
 * @param phone El número de teléfono a normalizar.
 * @returns El número normalizado.
 */
export const normalizePhoneNumber = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) { // Asume que es local sin código de país
        return `54${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('54')) { // Ya tiene formato correcto
        return digits;
    }
    // Para otros casos, simplemente se limpian los dígitos y se asume que el usuario sabe lo que ingresa.
    // Podría expandirse para manejar más casos (ej. remover '15' de celulares)
    return digits;
};


/**
 * Busca un cliente por su número de teléfono normalizado. Si no existe, lo crea.
 * @param phone El número de teléfono del cliente.
 * @param name El nombre del cliente.
 * @param email El email opcional del cliente.
 * @returns El ID del cliente encontrado o recién creado.
 */
export const findOrCreateCustomer = async (phone: string, name: string, email?: string): Promise<string> => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
        throw new Error("El número de teléfono proporcionado es inválido.");
    }

    const q = query(collection(db, COLLECTION_NAME), where("phone", "==", normalizedPhone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // Cliente encontrado
        const customerDoc = querySnapshot.docs[0];
        const customerId = customerDoc.id;
        
        // Actualizar datos si son diferentes
        const updates: Partial<Customer> = { lastSeen: Timestamp.now() };
        const currentData = customerDoc.data();
        if (currentData.name !== name) updates.name = name;
        if (email && currentData.email !== email) updates.email = email;

        await updateDoc(doc(db, COLLECTION_NAME, customerId), updates);
        return customerId;
    } else {
        // Cliente no encontrado, crear uno nuevo
        const newCustomerData = {
            phone: normalizedPhone,
            name,
            email: email || '',
            reservationIds: [],
            firstSeen: Timestamp.now(),
            lastSeen: Timestamp.now(),
            notes: '',
            tags: '',
            dietaryRestrictions: [],
            reducedMobility: false,
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), newCustomerData);
        return docRef.id;
    }
};

/**
 * Agrega el ID de una reserva al historial de un cliente.
 * @param customerId El ID del cliente.
 * @param reservationId El ID de la reserva a agregar.
 */
export const addReservationToCustomer = async (customerId: string, reservationId: string) => {
    try {
        const customerRef = doc(db, COLLECTION_NAME, customerId);
        await updateDoc(customerRef, {
            reservationIds: arrayUnion(reservationId),
            lastSeen: Timestamp.now()
        });
    } catch (error) {
        console.error("Error al agregar reserva al historial del cliente:", error);
        // No lanzamos error para no interrumpir el flujo de reserva, pero lo registramos.
    }
};

export const listenToCustomers = (callback: (customers: Customer[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("lastSeen", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const customers: Customer[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                firstSeen: data.firstSeen.toDate(),
                lastSeen: data.lastSeen.toDate(),
            } as Customer;
        });
        callback(customers);
    }, (error) => {
        console.error("Error listening to customers:", error);
        callback([]);
    });

    return unsubscribe;
};

export const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
    try {
        const customerRef = doc(db, COLLECTION_NAME, customerId);
        await updateDoc(customerRef, updates);
        return true;
    } catch (error) {
        console.error("Error updating customer:", error);
        throw error;
    }
};

export const createCustomer = async (customerData: Omit<Customer, 'id' | 'reservationIds' | 'firstSeen' | 'lastSeen'>) => {
    const normalizedPhone = normalizePhoneNumber(customerData.phone);
    if (!normalizedPhone) {
        throw new Error("Número de teléfono inválido.");
    }
    const q = query(collection(db, COLLECTION_NAME), where("phone", "==", normalizedPhone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        throw new Error("Ya existe un cliente con este número de teléfono.");
    }

    const newCustomer: Omit<Customer, 'id'> = {
        ...customerData,
        phone: normalizedPhone,
        reservationIds: [],
        firstSeen: Timestamp.now(),
        lastSeen: Timestamp.now(),
        notes: customerData.notes || '',
        tags: customerData.tags || '',
        dietaryRestrictions: customerData.dietaryRestrictions || [],
        reducedMobility: customerData.reducedMobility || false,
    };
    return await addDoc(collection(db, COLLECTION_NAME), newCustomer);
};

export const deleteCustomer = async (customerId: string) => {
    try {
        const customerRef = doc(db, COLLECTION_NAME, customerId);
        await deleteDoc(customerRef);
        return true;
    } catch (error) {
        console.error("Error deleting customer:", error);
        throw error;
    }
};

export const getReservationsForCustomer = async (customerId: string): Promise<Reservation[]> => {
    if (!customerId) return [];
    try {
        const q = query(collection(db, "reservations"), where("customerId", "==", customerId));
        const snapshot = await getDocs(q);
        const reservations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date.toDate()
            } as Reservation;
        });
        // Sort on the client side to avoid composite index requirement
        reservations.sort((a, b) => b.date.getTime() - a.date.getTime());
        return reservations;
    } catch (error) {
        console.error("Error getting reservations for customer:", error);
        return [];
    }
};