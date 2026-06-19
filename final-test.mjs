const BASE = 'http://localhost:3001';
const results = {};

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  return r.json();
}

// Test each endpoint
results['Spot Train'] = await get('/api/spot-train?trainNo=12301&date=19-Jun-2026');
results['Train Schedule'] = await get('/api/train-schedule?trainNo=12301');
results['Live Station'] = await get('/api/live-station?station=NDLS&date=19-Jun-2026');
results['Trains Between'] = await get('/api/trains-between?from=NDLS&to=HWH&date=19-Jun-2026');

for (const [name, data] of Object.entries(results)) {
  console.log(`\n=== ${name} ===`);
  if (data.error) { console.log('  ERROR:', data.error); continue; }
  if (data.trainName) console.log('  Train:', data.trainName);
  if (data.stations) console.log('  Stations:', data.stations.length);
  if (data.trains) console.log('  Trains:', data.trains.length);
  if (data.totalTrains) console.log('  Total:', data.totalTrains);
  if (data.stationName) console.log('  Station:', data.stationName);
}

console.log('\nAll endpoints working!');
