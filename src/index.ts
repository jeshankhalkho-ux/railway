import express from 'express';
import cors from 'cors';
import { NtesClient } from './ntes-client.js';

const app = express();

app.use(cors());
app.use(express.json());

function withClient(fn: (client: NtesClient, req: express.Request, res: express.Response) => Promise<void>) {
  return async (req: express.Request, res: express.Response) => {
    const client = new NtesClient();
    try {
      await fn(client, req, res);
    } catch (err: any) {
      console.error(`${req.path} error:`, err.message);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  };
}

app.get('/api/spot-train', withClient(async (client, req, res) => {
  const { trainNo, date } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  const data = await client.spotTrain(String(trainNo), String(date || ''));
  res.json(data);
}));

app.get('/api/live-station', withClient(async (client, req, res) => {
  const { station, date } = req.query;
  if (!station) { res.status(400).json({ error: 'station is required' }); return; }
  const data = await client.liveStation(String(station), String(date || ''));
  res.json(data);
}));

app.get('/api/train-schedule', withClient(async (client, req, res) => {
  const { trainNo } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  const data = await client.trainSchedule(String(trainNo));
  res.json(data);
}));

app.get('/api/trains-between', withClient(async (client, req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }
  const data = await client.trainsBetween(String(from), String(to), String(date || ''));
  res.json(data);
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ntes-api' });
});

// Vercel serverless export
export default app;

// Local development
const PORT = process.env.PORT || 3001;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`NTES API running on http://localhost:${PORT}`);
  });
}
