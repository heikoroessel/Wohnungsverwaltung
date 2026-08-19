import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/pool.js';

import objekteRoutes from './routes/objekte.js';
import mieterRoutes from './routes/mieter.js';
import dokumenteRoutes from './routes/dokumente.js';
import nkAbrechnungRoutes from './routes/nkAbrechnung.js';
import steuerReportRoutes from './routes/steuerReport.js';
import vermoegensReportRoutes from './routes/vermoegensReport.js';
import reminderRoutes from './routes/reminder.js';
import objektMedienRoutes from './routes/objektMedien.js';
import mietvertragDokumenteRoutes from './routes/mietvertragDokumente.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/objekte', objekteRoutes);
app.use('/api/objekte', objektMedienRoutes); // /:objektId/fotos, /:objektId/stammdokumente
app.use('/api/mieter', mieterRoutes);
app.use('/api/mieter', mietvertragDokumenteRoutes); // /:mieterId/dokumente
app.use('/api/dokumente', dokumenteRoutes);
app.use('/api/nk-abrechnung', nkAbrechnungRoutes);
app.use('/api/steuer-report', steuerReportRoutes);
app.use('/api/vermoegensreport', vermoegensReportRoutes);
app.use('/api/reminder', reminderRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Statisches Frontend-Build ausliefern (Production)
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Zentrale Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Interner Serverfehler' });
});

async function start() {
  await runMigrations();
  app.listen(PORT, () => console.log(`[server] läuft auf Port ${PORT}`));
}

start().catch((err) => {
  console.error('[server] Start fehlgeschlagen:', err);
  process.exit(1);
});
