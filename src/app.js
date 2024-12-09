import express from 'express';
import InflowTransactionRoute from './routes/InflowTransactionRoute.js';
import OutflowTransactionRoute from './routes/OutflowTransactionRoute.js';
import BalanceRoute from './routes/BalanceRoute.js';
import JournalRoute from './routes/JournalRoute.js';
import UserRoute from './routes/UserRoute.js';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: '50mb' }));
app.use(InflowTransactionRoute, OutflowTransactionRoute, BalanceRoute, JournalRoute, UserRoute);
app.use(express.static(path.join(__dirname, '../public')));

app.get(/^((?!\/api\/).)*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
})

export default app;
