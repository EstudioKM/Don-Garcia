import express, { Application, RequestHandler } from 'express';
import cors from 'cors';
import geminiRoutes from './routes/geminiRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

// Se utiliza el tipo Application para asegurar que TypeScript reconozca correctamente los métodos de Express
const app: Application = express();
const port = process.env.PORT || 3001;

// Se castea el middleware a any para evitar conflictos con las firmas de sobrecarga de app.use en entornos con desajustes de tipos
app.use(cors() as any);
app.use(express.json() as any);

// Montar las rutas de la API
app.use('/api', geminiRoutes);
app.use('/api', reservationRoutes);
app.use('/api', menuRoutes);
app.use('/api', orderRoutes);

app.listen(port, () => {
  console.log(`[server]: Servidor Mar & Tierra corriendo en http://localhost:${port}`);
});