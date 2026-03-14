
import { GoogleGenAI } from "@google/genai";
import { getMenuFromDB } from "./menuRepository";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const chatSessions = new Map<string, any>();

export const sendChatMessage = async (message: string, sessionId: string) => {
  try {
    const ai = getAI();
    let chat = chatSessions.get(sessionId);

    if (!chat) {
      // Fetch latest menu data for context
      const menuData = await getMenuFromDB();
      const menuContext = JSON.stringify(menuData);

      chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `Eres el Sommelier y conserje digital de "Don García - La Casona 1930", un restaurante de lujo ubicado en Riobamba 8180, Barrio Guadalupe, Santa Fe, Argentina. 
          TU CARTA ACTUALIZADA ES: ${menuContext}.
          
          REGLAS DE ORO:
          - Eres especialista en Fuegos (carnes a la estaca) y Pescados de Río (Surubí, Pacú, Boga).
          - Si un cliente pregunta por detalles de un vino o bodega (notas de cata, historia, premios), USA TU HERRAMIENTA DE BÚSQUEDA para dar una respuesta informada y completa.
          - Tono: Sofisticado, servicial, cálido.
          - Si el cliente quiere ver fotos, invítalo a visitar nuestro Instagram oficial: https://www.instagram.com/dongarcia.sf/
          - Menciona que estamos frente al río, en una de las zonas más bellas de Guadalupe.
          - Idioma: Castellano rioplatense elegante.`,
          tools: [{googleSearch: {}}]
        },
      });
      chatSessions.set(sessionId, chat);
    }

    const response = await chat.sendMessage({ message });
    return { text: response.text };
  } catch (error) {
    console.error("Error en el chat de Gemini:", error);
    return { text: 'Mis disculpas, estoy consultando nuestra cava. ¿En qué más puedo asistirle? También puede ver nuestras novedades en @dongarcia.sf' };
  }
};

export const getMapsInfo = async (latitude: number, longitude: number) => {
  try {
    const ai = getAI();
    // Use Gemini 2.5 Flash for Google Maps Grounding as it is a supported feature for 2.5 series
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Explica por qué la ubicación de Don García en Riobamba 8180, Santa Fe, Argentina, es icónica para el barrio Guadalupe y la gastronomía de río.",
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
      },
    });
    return { text: response.text, links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
  } catch (error) {
    // Silenciosamente fallar si la herramienta no está habilitada o el modelo no la soporta
    return { text: "Ubicados en la histórica Casona de Riobamba 8180, el corazón de Guadalupe frente al río en Santa Fe.", links: [] };
  }
};

export const generateReservationConfirmation = async (name: string, date: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Mensaje de confirmación extremadamente elegante para ${name} el ${date} en Don García (Santa Fe). Menciona que los esperamos en la Casona de 1930.`
  });
  return response.text;
};