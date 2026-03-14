import { db } from "../firebase";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { Reservation, Customer } from "../types";
import { getLayout } from './layoutRepository';
import { getRestaurantSettings } from "./settingsRepository";

const RESERVATIONS_COLLECTION = "reservations";
const CUSTOMERS_COLLECTION = "customers";

// --- Funciones para generar fechas de ejemplo ---
const getDateForToday = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const getDateForTomorrow = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

const getDateInFuture = (days: number, timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

// --- Conjunto de 10 Reservas de Ejemplo ---
const sampleReservations: Omit<Reservation, 'id'>[] = [
    // Hoy
    // FIX: Added missing 'phone' property.
    {
        name: "Elena Rodriguez",
        phone: "543421234567",
        email: "elena.r@example.com",
        date: Timestamp.fromDate(getDateForToday("20:30")),
        time: "20:30",
        guests: 2,
        status: 'confirmada',
        tableId: 't-1',
        tableName: 'Mesa 1',
        specialRequests: 'Celebración de aniversario.'
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Carlos Gomez",
        phone: "543422345678",
        email: "c.gomez@example.com",
        date: Timestamp.fromDate(getDateForToday("21:30")),
        time: "21:30",
        guests: 4,
        status: 'confirmada',
        tableId: 't-2',
        tableName: 'Mesa 2',
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Ana Torres",
        phone: "543423456789",
        email: "ana.t@example.com",
        date: Timestamp.fromDate(getDateForToday("22:30")),
        time: "22:30",
        guests: 5,
        status: 'pendiente',
        specialRequests: 'Necesita silla para bebé.'
    },
    // Mañana
    // FIX: Added missing 'phone' property.
    {
        name: "Javier Moreno",
        phone: "543424567890",
        email: "javier.m@example.com",
        date: Timestamp.fromDate(getDateForTomorrow("21:00")),
        time: "21:00",
        guests: 3,
        status: 'confirmada',
        tableId: 't-5',
        tableName: 'Patio 1'
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Lucía Fernández",
        phone: "543425678901",
        email: "lucia.f@example.com",
        date: Timestamp.fromDate(getDateForTomorrow("20:30")),
        time: "20:30",
        guests: 6,
        status: 'confirmada',
        tableId: 't-4',
        tableName: 'Mesa 4'
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Miguel Ángel Pérez",
        phone: "543426789012",
        email: "miguel.p@example.com",
        date: Timestamp.fromDate(getDateForTomorrow("13:30")),
        time: "13:30",
        guests: 8,
        status: 'pendiente',
        tableName: 'Patio 2',
        tableId: 't-6'
    },
    // Próximos días
    // FIX: Added missing 'phone' property.
    {
        name: "Sofía Martínez",
        phone: "543427890123",
        email: "sofia.m@example.com",
        date: Timestamp.fromDate(getDateInFuture(3, "21:30")),
        time: "21:30",
        guests: 2,
        status: 'confirmada',
        tableId: 't-3',
        tableName: 'Mesa 3'
    },
    // FIX: Added missing 'phone' property.
    {
        name: "David Sánchez",
        phone: "543428901234",
        email: "david.s@example.com",
        date: Timestamp.fromDate(getDateInFuture(4, "20:30")),
        time: "20:30",
        guests: 4,
        status: 'confirmada',
        specialRequests: 'Mesa cerca de la ventana, si es posible.'
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Laura Jiménez",
        phone: "543429012345",
        email: "laura.j@example.com",
        date: Timestamp.fromDate(getDateInFuture(5, "22:00")),
        time: "22:00",
        guests: 2,
        status: 'cancelada',
    },
    // FIX: Added missing 'phone' property.
    {
        name: "Pedro Navarro",
        phone: "543420123456",
        email: "pedro.n@example.com",
        date: Timestamp.fromDate(getDateInFuture(5, "21:00")),
        time: "21:00",
        guests: 7,
        status: 'confirmada',
        tableId: 't-6',
        tableName: 'Patio 2'
    }
];

const sampleCustomers: Omit<Customer, 'id'>[] = [
    {
        name: "Elena Rodriguez",
        phone: "543421234567",
        email: "elena.r@example.com",
        reservationIds: ["res-fake-1", "res-fake-2", "res-fake-3"],
        firstSeen: Timestamp.fromDate(new Date('2023-11-15T20:30:00')),
        lastSeen: Timestamp.fromDate(getDateForToday("20:30")),
        notes: "Cliente frecuente. Prefiere vinos Malbec y mesas tranquilas.",
        tags: "Habitual",
        dietaryRestrictions: [],
        reducedMobility: false,
    },
    {
        name: "Carlos Gomez",
        phone: "543422345678",
        email: "c.gomez@example.com",
        reservationIds: ["res-fake-4"],
        firstSeen: Timestamp.fromDate(getDateForToday("21:30")),
        lastSeen: Timestamp.fromDate(getDateForToday("21:30")),
        notes: "Primera visita.",
        tags: "",
        dietaryRestrictions: ["Vegetariano"],
        reducedMobility: false,
    },
    {
        name: "Javier Moreno",
        phone: "543424567890",
        email: "javier.m@example.com",
        reservationIds: ["res-fake-5", "res-fake-6"],
        firstSeen: Timestamp.fromDate(new Date('2024-01-20T21:00:00')),
        lastSeen: Timestamp.fromDate(getDateForTomorrow("21:00")),
        notes: "Alergia a los frutos secos.",
        tags: "Alergias",
        dietaryRestrictions: ["Sin TACC"],
        reducedMobility: false,
    },
    {
        name: "Lucía Fernández",
        phone: "543425678901",
        email: "lucia.f@example.com",
        reservationIds: ["res-fake-7", "res-fake-8", "res-fake-9", "res-fake-10"],
        firstSeen: Timestamp.fromDate(new Date('2023-10-05T20:30:00')),
        lastSeen: Timestamp.fromDate(getDateForTomorrow("20:30")),
        notes: "Cliente VIP. Celebró su casamiento aquí.",
        tags: "VIP,Aniversario",
        dietaryRestrictions: [],
        reducedMobility: true,
    },
    {
        name: "Mariana Lopez",
        phone: "541155556677",
        email: "mariana.l@example.com",
        reservationIds: ["res-fake-11", "res-fake-12", "res-fake-13", "res-fake-14", "res-fake-15"],
        firstSeen: Timestamp.fromDate(new Date('2023-08-01T13:00:00')),
        lastSeen: Timestamp.fromDate(getDateInFuture(5, "13:00")),
        notes: "Sommelier. Amiga de la casa. Siempre pide mesa en el patio.",
        tags: "VIP,Vino",
        dietaryRestrictions: [],
        reducedMobility: false,
    }
];

export const seedCustomers = async () => {
    try {
        const customersCollection = collection(db, CUSTOMERS_COLLECTION);
        const snapshot = await getDocs(customersCollection);
        if (snapshot.empty) {
            console.log("La colección de clientes está vacía. No se agregarán datos de ejemplo.");
            // Se ha desactivado la generación de datos de ejemplo para clientes.
            // console.log("Customer collection is empty. Seeding with sample data...");
            // for (const customerData of sampleCustomers) {
            //     await addDoc(customersCollection, customerData);
            // }
            // console.log(`${sampleCustomers.length} sample customers created successfully.`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
        if (errorMessage.includes('client is offline')) {
            console.warn("Firebase client is offline. Skipping customer seeding.");
        } else {
            console.error("Error seeding customers database:", error);
        }
    }
};

export const seedReservations = async () => {
  try {
    const reservationsCollection = collection(db, RESERVATIONS_COLLECTION);
    const snapshot = await getDocs(reservationsCollection);

    if (snapshot.empty) {
      console.log("La colección de reservas está vacía. No se agregarán datos de ejemplo según la configuración.");
      // Se ha desactivado la generación de datos de ejemplo.
      // console.log("Colección de reservas vacía. Semeando 10 registros de ejemplo...");
      // for (const reservationData of sampleReservations) {
      //   await addDoc(reservationsCollection, reservationData);
      // }
      // console.log("10 reservas de ejemplo creadas exitosamente.");
    }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
      if (errorMessage.includes('client is offline')) {
          console.warn("Firebase client is offline. Skipping reservation seeding.");
      } else {
          console.error("Error al semear la base de datos de reservas:", error);
      }
  }
};

export const seedLayout = async () => {
    try {
        await getLayout();
    } catch (error) {
        console.error("Error al verificar/semear el layout del salón:", error);
    }
};

export const seedSettings = async () => {
    try {
        await getRestaurantSettings();
    } catch (error) {
        console.error("Error al verificar/semear la configuración del restaurante:", error);
    }
};