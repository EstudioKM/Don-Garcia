export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: 'fish' | 'meat' | 'wine';
  image: string;
}

export interface Reservation {
  id: string;
  name: string;
  email?: string;
  phone: string;
  date: any; // Se usará Firebase Timestamp
  time: string;
  guests: number;
  specialRequests?: string;
  status: 'confirmada' | 'pendiente' | 'cancelada';
  tableId?: string;
  tableName?: string;
  environmentId?: string;
  environmentName?: string;
  dietaryRestrictions?: string[];
  reducedMobility?: boolean;
  customerId?: string;
}

export interface Customer {
    id: string;
    phone: string; // Identificador único normalizado
    name: string;
    email?: string;
    reservationIds: string[];
    firstSeen: any; // Firebase Timestamp
    lastSeen: any; // Firebase Timestamp
    notes?: string;
    tags?: string; // Comma-separated tags e.g., "VIP,Alergia Nuez"
    dietaryRestrictions?: string[];
    reducedMobility?: boolean;
}


export enum Section {
  HERO = 'hero',
  MENU = 'menu',
  ABOUT = 'about',
  RESERVATION = 'reservation'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  description?: string;
  price?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  timestamp: Date;
  status: 'pending' | 'completed';
  tableId?: string;
}

// --- Tipos para el Sistema de Reservas y Layout ---

export interface Table {
  id: string;
  name: string;
  capacity: number;
}

export interface Environment {
  id: string;
  name: string;
  tables: Table[];
  maxCapacity: number;
  image?: string;
}

export interface Layout {
  environments: Environment[];
}

// --- Nuevos Tipos para Configuración del Restaurante ---

export interface SommelierSettings {
  voice: string;
  systemPrompt: string;
}

export interface Shift {
  isActive: boolean;
  activeEnvironments?: string[]; // IDs of active environments for this shift
}

export interface DaySetting {
  isOpen: boolean;
  shifts: {
    mediodia: Shift;
    noche: Shift;
  };
}

export interface SpecialDay {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // e.g., "Navidad"
  isOpen: boolean;
  shifts: {
    mediodia: Shift;
    noche: Shift;
  };
  note?: string;
}

export interface RestaurantSettings {
  sommelier: SommelierSettings;
  days: {
    lunes: DaySetting;
    martes: DaySetting;
    miercoles: DaySetting;
    jueves: DaySetting;
    viernes: DaySetting;
    sabado: DaySetting;
    domingo: DaySetting;
  };
  specialDays?: SpecialDay[];
}
