// Zona horaria de Argentina (ART) es UTC-3
const ARGENTINA_OFFSET = -3;

/**
 * Obtiene la fecha y hora actual en la zona horaria de Argentina.
 * @returns Un objeto Date que representa la hora actual en Argentina.
 */
export const getArgentinaTime = (): Date => {
    const now = new Date();
    // Obtiene la hora en UTC
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    // Aplica el offset de Argentina
    return new Date(utc + (3600000 * ARGENTINA_OFFSET));
};

/**
 * Devuelve el inicio del día (00:00:00) para una fecha dada, en la zona horaria de Argentina.
 * @param date El objeto Date para el cual calcular el inicio del día.
 * @returns Un nuevo objeto Date representando el inicio del día en Argentina.
 */
export const getStartOfDayArgentina = (date: Date): Date => {
    // Usar los componentes de la fecha local para evitar saltos de día por zona horaria
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    // Construir la fecha como un string ISO con el offset de Argentina para evitar ambigüedades
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return new Date(`${dateString}T00:00:00.000-03:00`);
};

/**
 * Devuelve el final del día (23:59:59) para una fecha dada, en la zona horaria de Argentina.
 * @param date El objeto Date para el cual calcular el final del día.
 * @returns Un nuevo objeto Date representando el final del día en Argentina.
 */
export const getEndOfDayArgentina = (date: Date): Date => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return new Date(`${dateString}T23:59:59.999-03:00`);
};
