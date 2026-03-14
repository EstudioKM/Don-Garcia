
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { RestaurantSettings, DaySetting, SommelierSettings } from "../types";

const COLLECTION_NAME = "configuration";
const DOC_ID = "restaurant_settings";

const DEFAULT_SOMMELIER_PROMPT = `Eres el Sommelier y Mozo de "Don García". 
Tu objetivo es TOMAR EL PEDIDO de forma eficiente y elegante y ASESORAR al cliente.

REGLAS ABSOLUTAS DE FLUJO CONVERSACIONAL:
1.  **USO DE HERRAMIENTAS DE PEDIDO**: En cuanto el usuario mencione un plato o bebida para ordenar, llama a la función 'placeOrder'. 
2.  **NO REPETICIÓN**: Cuando llames a una herramienta (placeOrder), NO respondas verbalmente en ese mismo turno. Simplemente envía la llamada a la función. 
3.  **CONFIRMACIÓN POST-HERRAMIENTA**: Una vez que recibas el resultado de la función (que los items fueron agregados), confirma verbalmente al usuario con un "Agregado el/la [plato], ¿desea algo más?". 
4.  **BÚSQUEDA AVANZADA**: Si un cliente pregunta por detalles específicos de un vino o bodega (notas de cata, premios, historia), USA TU HERRAMIENTA DE BÚSQUEDA para encontrar la información más actualizada y precisa antes de responder.
5.  **BREVEDAD**: No des discursos largos. Sé directo y servicial.
6.  **LENGUAJE**: Español rioplatense elegante.`;

const createDefaultDay = (isOpen = false): DaySetting => ({
  isOpen,
  shifts: {
    mediodia: { isActive: false, activeEnvironments: [] },
    noche: { isActive: true, activeEnvironments: [] },
  },
});

const DEFAULT_SETTINGS: RestaurantSettings = {
  sommelier: {
    voice: 'Zephyr',
    systemPrompt: DEFAULT_SOMMELIER_PROMPT,
  },
  days: {
    lunes: createDefaultDay(false),
    martes: createDefaultDay(true),
    miercoles: createDefaultDay(true),
    jueves: createDefaultDay(true),
    viernes: createDefaultDay(true),
    sabado: createDefaultDay(true),
    domingo: createDefaultDay(true),
  },
  specialDays: [],
};

export const getRestaurantSettings = async (): Promise<RestaurantSettings> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Merge with defaults to ensure new fields are present
      const dbData = docSnap.data();
      return {
        ...DEFAULT_SETTINGS,
        ...dbData,
        sommelier: { ...DEFAULT_SETTINGS.sommelier, ...dbData.sommelier },
        days: { ...DEFAULT_SETTINGS.days, ...dbData.days },
      };
    } else {
      console.log("No settings found, creating default settings document.");
      await setDoc(docRef, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
    if (errorMessage.includes('client is offline')) {
      console.warn("Firebase client is offline. Using default restaurant settings.");
    } else {
      console.error("Error fetching restaurant settings:", error);
    }
    return DEFAULT_SETTINGS;
  }
};
// FIX: Renamed function to getSettingsFromDB as it was causing import errors.
export const getSettingsFromDB = async (): Promise<SommelierSettings> => {
  const settings = await getRestaurantSettings();
  return settings.sommelier;
};

export const saveRestaurantSettings = async (settings: RestaurantSettings): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(docRef, settings);
    return true;
  } catch (error)
  {
    console.error("Error saving restaurant settings:", error);
    throw error;
  }
};
// FIX: Renamed function to saveSettingsToDB as it was causing import errors.
export const saveSettingsToDB = async (sommelierSettings: SommelierSettings): Promise<boolean> => {
    const currentSettings = await getRestaurantSettings();
    const newSettings = { ...currentSettings, sommelier: sommelierSettings };
    return await saveRestaurantSettings(newSettings);
};