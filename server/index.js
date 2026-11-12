import dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config({ path: process.env.ENV_FILE || '.env.local' });

const port = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Backend Punto a Punto disponible en http://localhost:${port}`);
});
