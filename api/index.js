import express from 'express';

const KEY = process.env.RAPIDAPI_KEY || '255d4b80f6msh4a2c4dd5b983df7p19efc5jsnf5cc963acaa4';
const HOST = process.env.RAPIDAPI_HOST || 'irctc1.p.rapidapi.com';
const HEADERS = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

async function rapidGet(path) {
  const res = await fetch(`https://${HOST}${path}`, { headers: HEADERS });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
  return body;
}

function fmt(m) {
  if (m == null) return undefined;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

function transformSpotTrain(raw) {
  const d = raw.data || raw;
  const stations = [];
  if (d.source_stn_name) stations.push({ stationName: d.source_stn_name, stationCode: d.source_station_code||d.source||'', platform: String(d.platform_number||''), type:'SRC', scheduledDeparture: fmt(d.std) });
  const route = d.route || d.stations || [];
  for (const s of route) {
    if (!s.stop) continue;
    stations.push({
      stationName: s.station_name||s.name||'',
      stationCode: s.station_code||s.code||'',
      platform: String(s.platform_number||s.platform||''),
      distance: s.distance_from_source?parseFloat(s.distance_from_source):undefined,
      type: s.day===1&&!s.sta?'SRC':s.day===999?'DST':'STOP',
      scheduledArrival: fmt(s.sta), actualArrival: fmt(s.act_arr),
      scheduledDeparture: fmt(s.std), actualDeparture: fmt(s.act_dep),
    });
  }
  if (d.dest_stn_name) stations.push({ stationName: d.dest_stn_name, stationCode: d.destination_station_code||d.destination||'', type:'DST', scheduledArrival: fmt(d.sta) });
  return { trainNo: d.train_number||d.train_no||'', trainName: d.train_name||'', startDate: d.train_start_date||'', stations, error: null };
}

function transformSchedule(raw) {
  const d = raw.data || raw;
  const route = d.route || d.stations || [];
  const stations = route.filter(s=>s.stop).map(s=>({
    serial: s.sr_no||s.sr||0, stationName: s.station_name||s.name||'', stationCode: s.station_code||s.code||'',
    day: s.day||1, arrival: fmt(s.sta)||'', departure: fmt(s.std)||'',
    haltTime: s.halt?`${s.halt} min`:undefined, distance: s.distance_from_source?parseFloat(s.distance_from_source):0,
  }));
  return { trainNo: d.trainNumber||d.train_number||'', trainName: d.trainName||d.train_name||'', stations, error: null };
}

function transformBetween(raw) {
  const list = raw.data||raw.trains||raw.data?.trains||raw.data?.data||raw||[];
  const trains = (Array.isArray(list)?list:[]).filter(t=>t.train_number||t.train_no||t.trainNumber).map(t=>({
    trainNo: t.train_number||t.train_no||t.trainNumber||'',
    trainName: t.train_name||t.trainName||'',
    departureTime: t.departure_time||t.departureTime||t.std||'',
    arrivalTime: t.arrival_time||t.arrivalTime||t.sta||'',
    duration: t.travel_time||t.travelTime||t.duration||'',
    runDays: t.run_days||t.runningDays||'',
  }));
  return { from: '', to: '', totalTrains: trains.length, trains, error: null };
}

const app = express();

app.get('/api/spot-train', async (req, res) => {
  const { trainNo, date } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo required' }); return; }
  try {
    const r = await rapidGet(`/api/v1/liveTrainStatus?trainNo=${trainNo}&startDay=0`);
    res.json(transformSpotTrain(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/train-schedule', async (req, res) => {
  const { trainNo } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo required' }); return; }
  try {
    const r = await rapidGet(`/api/v1/getTrainSchedule?trainNo=${trainNo}`);
    res.json(transformSchedule(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trains-between', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) { res.status(400).json({ error: 'from and to required' }); return; }
  try {
    const r = await rapidGet(`/api/v3/trainBetweenStations?fromStationCode=${from.toUpperCase()}&toStationCode=${to.toUpperCase()}&date=${date||'2026-06-20'}`);
    res.json(transformBetween(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/live-station', async (_req, res) => {
  res.json({ error: 'Live station is not available via this RapidAPI. Use /api/spot-train instead.' });
});

app.get('/health', (_req, res) => { res.json({ status:'ok', service:'ntes-api', source:'rapidapi' }); });

export default app;
