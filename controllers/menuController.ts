
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { REAL_MENU } from '../data/menuData.js';

// Fix: __dirname is not available in ES modules, so we create it manually.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al archivo de datos
const menuFilePath = path.join(__dirname, '../data/menuData.ts');

// Fixed: Use any for parameters to resolve property missing errors
export const getFullMenu = (req: any, res: any) => {
    res.json(REAL_MENU);
};

// Fixed: Use any for parameters to resolve property missing errors
export const updateMenu = (req: any, res: any) => {
    const newMenu = req.body;

    if (!newMenu || typeof newMenu !== 'object') {
        return res.status(400).json({ error: 'Formato de menú inválido.' });
    }

    try {
        // Generamos el contenido del archivo .ts manteniendo la estructura de exportación
        const fileContent = `export const REAL_MENU = ${JSON.stringify(newMenu, null, 2)};`;
        
        // Escribimos en el archivo
        fs.writeFileSync(menuFilePath, fileContent, 'utf8');
        
        console.log('[server]: Menú actualizado y guardado en menuData.ts');
        res.json({ success: true, message: 'Carta actualizada correctamente en el servidor.' });
    } catch (error) {
        console.error('Error al escribir en menuData.ts:', error);
        res.status(500).json({ error: 'No se pudo guardar la carta en el servidor.' });
    }
};
