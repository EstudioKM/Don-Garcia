
import { Request, Response } from 'express';
import { GoogleGenAI, Chat, Type, FunctionDeclaration, Modality } from '@google/genai';

// La clave de API se lee de forma segura desde las variables de entorno del servidor
if (!process.env.API_KEY) {
    throw new Error("API_KEY de Gemini no encontrada en las variables de entorno.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Almacenamiento en memoria para las sesiones de chat. En producción se usaría Redis o similar.
const chatSessions: Map<string, Chat> = new Map();

const bookTableFunctionDeclaration: FunctionDeclaration = {
  name: 'bookTable',
  parameters: {
    type: Type.OBJECT,
    description: 'Recopila la información para una reserva de mesa en el restaurante.',
    properties: {
      date: { type: Type.STRING, description: 'La fecha de la reserva, ej. "mañana", "próximo viernes", "25 de diciembre".' },
      time: { type: Type.STRING, description: 'La hora de la reserva, ej. "9 de la noche", "21:00".' },
      guests: { type: Type.NUMBER, description: 'El número de comensales.' },
    },
    required: ['date', 'guests', 'time'],
  },
};

const getChatSession = (sessionId: string): Chat => {
    if (chatSessions.has(sessionId)) {
        return chatSessions.get(sessionId)!;
    }

    const newChat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `Eres el Sommelier y conserje digital de "Mar & Tierra", un restaurante de lujo. Tu tono es elegante, servicial y conciso.
          - Asesora sobre maridajes de vino, platos de carne y pescado.
          - Si un usuario quiere reservar, usa la herramienta 'bookTable'. No pidas el nombre o email, solo fecha, hora y comensales.
          - Siempre responde en español.`,
          tools: [{ functionDeclarations: [bookTableFunctionDeclaration] }],
        },
    });

    chatSessions.set(sessionId, newChat);
    return newChat;
}

// Fixed: Using any for req/res to resolve missing properties 'body', 'status', and 'json' due to typing environment conflicts
export const handleChat = async (req: any, res: any) => {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
        return res.status(400).json({ error: 'Faltan los parámetros "message" y "sessionId".' });
    }

    try {
        const chat = getChatSession(sessionId);
        const result = await chat.sendMessage({ message });
        // Fixed: Ensure result is handled as GenerateContentResponse and return text property
        res.json({ text: result.text });
    } catch (error) {
        console.error('Error en handleChat:', error);
        res.status(500).json({ error: 'Error al comunicarse con el asistente de IA.' });
    }
};

// Fixed: Using any for req/res to resolve missing properties
export const getLocationInfo = async (req: any, res: any) => {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitud y longitud son requeridas.' });
    }
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Describe por qué nuestra ubicación en el Barrio de Salamanca en Madrid es privilegiada y menciona puntos de interés cercanos.",
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
            },
        });
        // Fixed: Access groundingMetadata and text property correctly
        res.json({
            text: response.text,
            links: response.candidates?.[0]?.groundingMetadata?.groundingChunks
        });
    } catch (error) {
        console.error('Error en getLocationInfo:', error);
        res.status(500).json({ error: 'No se pudo obtener la información de la ubicación.' });
    }
};

// Fixed: Using any for req/res to resolve missing properties
export const generateConfirmationMessage = async (req: any, res: any) => {
    const { name, date } = req.body;
     if (!name || !date) {
        return res.status(400).json({ error: 'Nombre y fecha son requeridos.' });
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Escribe un mensaje de confirmación de reserva muy breve y extremadamente elegante para ${name} el día ${date} en el restaurante "Mar & Tierra". Usa un tono de hospitalidad de 5 estrellas.`
        });
        // Fixed: Access text property correctly
        res.json({ message: response.text });
    } catch (error) {
        console.error('Error en generateConfirmationMessage:', error);
        res.status(500).json({ error: 'No se pudo generar el mensaje de confirmación.' });
    }
};