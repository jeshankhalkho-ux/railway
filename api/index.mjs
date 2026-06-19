import express from 'express';
import * as cheerio from 'cheerio';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const BASE = 'https://enquiry.indianrail.gov.in/mntes';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CURL = 'curl';
const TIMEOUT = 25000;

function curl(args) {
  const tmp = join(tmpdir(), 'ntes-' + randomBytes(4).toString('hex'));
  mkdirSync(tmp, { recursive: true });
  const cj = join(tmp, 'cookies.txt');
  try {
    const allArgs = ['-s', '-b', cj, '-c', cj, ...args];
    const proc = spawnSync(CURL, allArgs, { timeout: TIMEOUT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (proc.error) throw new Error(proc.error.message);
    if (proc.status !== 0) throw new Error('curl exited ' + proc.status + ': ' + (proc.stderr || '').slice(0, 200));
    return proc.stdout;
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

function ntesGet(path) {
  curl(['-H', 'User-Agent: ' + UA, BASE + path]);
}

function ntesPost(endpoint, form) {
  ntesGet('/q');
  const csrfBody = curl(['-H', 'User-Agent: ' + UA, BASE + '/GetCSRFToken?t=' + Date.now()]);
  const m = csrfBody.match(/name='([^']+)' value='([^']+)'/);
  if (!m) throw new Error('CSRF token not found. Response: ' + csrfBody.slice(0, 300));
  const params = new URLSearchParams({ lan: 'en', ...form, [m[1]]: m[2] });
  return curl(['-X', 'POST', '-H', 'User-Agent: ' + UA, '-H', 'Content-Type: application/x-www-form-urlencoded', '-H', 'Referer: ' + BASE + '/q', '--data-binary', params.toString(), BASE + endpoint]);
}

function getDatePane($, date) {
  const paneId = date ? '#train' + date.toLowerCase() : null;
  let pane = paneId ? $(paneId) : null;
  if (!pane || !pane.find('.stopRow').length) {
    $('.tab-pane').each(function() { const $p = $(this); if ($p.find('.stopRow').length > 0 && !pane) pane = $p; });
  }
  return pane;
}

function parseStationRow($, $row) {
  const nc = $row.children('div').filter(function() { return ($(this).attr('style')||'').includes('float:right'); })
    .children('div').filter(function() { return ($(this).attr('style')||'').includes('float:left'); });
  const stationName = nc.find('font > b').first().text().trim();
  const cs = $row.find('.w3-round.w3-orange').first();
  const platform = cs.text().trim();
  const codeText = cs.parent('b').text().trim();
  const stationCode = codeText.split(/\s+/)[0];
  const rf = $row.children('div').filter(function() { return ($(this).attr('style')||'').includes('float:right')&&($(this).attr('style')||'').includes('flex'); });
  const rt = rf.text();
  let type = 'STOP';
  if (/\bSRC\b/.test(rt)) type = 'SRC';
  else if (/DSTN|DST\b/.test(rt)) type = 'DST';
  let distance;
  const dm = rt.match(/(\d+)\s*KMs?/);
  if (dm) distance = parseInt(dm[1]);
  const lt = $row.children('div').filter(function() { return ($(this).attr('style')||'').includes('float:left')&&($(this).attr('style')||'').includes('width:100px'); }).first();
  let sa, aa, dt='', dmin, st='';
  if (lt.length) {
    const sp = lt.find('> span');
    if (sp.length>=1) { const sb=$(sp[0]).find('font b,b font'); sa=sb.length?sb.text().trim():$(sp[0]).text().trim(); if(!sa||sa==='&nbsp;')sa=undefined; }
    if (sp.length>=2) { const ab=$(sp[1]).find('b'); aa=ab.length?ab.first().text().trim():undefined; const se=$(sp[1]).find('.w3-round'); st=se.length?se.text().trim():''; const ds=$(sp[1]).find('span:not(.w3-round)'); dt=ds.length?ds.text().trim():''; if(!dt)dt=st; const dmm=dt.match(/(\d+)\s*Min/i); if(dmm)dmin=parseInt(dmm[1]); }
  }
  const rtime = rf.children('div').filter(function() { return ($(this).attr('style')||'').includes('float:right')&&($(this).attr('style')||'').includes('text-align:right'); }).first();
  let sd, ad, ds2='';
  if (rtime.length) {
    const sp=rtime.find('> span');
    if (sp.length>=1) { const sb=$(sp[0]).find('font b,b font'); sd=sb.length?sb.text().trim():$(sp[0]).text().trim(); if(!sd||sd==='&nbsp;')sd=undefined; }
    if (sp.length>=2) { const ab=$(sp[1]).find('b'); ad=ab.length?ab.first().text().trim():undefined; const se=$(sp[1]).find('.w3-round'); ds2=se.length?se.text().trim():''; }
  }
  return { stationName:stationName||'Unknown', stationCode, platform, distance, type, scheduledArrival:sa, actualArrival:aa, delay:dt, delayMinutes:dmin, status:st, scheduledDeparture:sd, actualDeparture:ad, departureStatus:ds2 };
}

function parseSpotTrain(html, trainNo, date) {
  const $ = cheerio.load(html);
  const stations = [];
  let trainName = 'Unknown';
  $('.w3-panel.w3-round.w3-blue h3').each(function() { const t=$(this).text().trim(); if (/\d{5}/.test(t)) trainName=t; });
  const ap = getDatePane($, date);
  const rows = ap ? ap.find('.stopRow') : $('.stopRow');
  rows.each(function() { stations.push(parseStationRow($, $(this))); });
  return { trainNo, trainName, startDate:date, stations, error:!stations.length&&ap&&/No Data/i.test(ap.text())?'No data found':null };
}

function parseTrainSchedule(html, trainNo) {
  const $ = cheerio.load(html);
  const stations = [];
  const trainName = $('table.table-bordered tbody tr td span b').first().text().trim()||'Unknown';
  $('table.table-bordered').last().find('tbody tr').each(function() {
    const tds = $(this).find('td');
    if (tds.length < 6) return;
    const sr = $(tds[0]).text().trim();
    if (!sr || !/^\d+$/.test(sr)) return;
    const h = $(tds[1]).html() || '';
    const nm = h.match(/<font[^>]*>([^<]+)<\/font><br>/i);
    const cm = h.match(/<font[^>]*>([A-Z0-9]+)<\/font>$/i);
    const day = parseInt($(tds[2]).text().trim()) || 1;
    const ah = $(tds[3]).html() || '';
    const am = ah.match(/<font[^>]*>([^<]+)<\/font><br>/i);
    const dpm = ah.match(/<br><font[^>]*>([^<]+)<\/font>/i);
    stations.push({ serial:parseInt(sr), stationName:nm?nm[1].trim():'', stationCode:cm?cm[1].trim():'', day, arrival:am?am[1].trim():'', departure:dpm?dpm[1].trim():'', haltTime:$(tds[4]).text().trim()||undefined, distance:parseInt($(tds[5]).text().trim())||0 });
  });
  return { trainNo, trainName, stations, error:!stations.length?'No data found':null };
}

function parseLiveStation(html, station, date) {
  const $ = cheerio.load(html);
  const trains = [];
  const sh = $('th font[color="#006AD5"]').first().html();
  const sm = sh ? sh.match(/<b>([^<]+)<\/b>/) : null;
  const stationName = sm ? sm[1].trim() : String($('input[name="jFromStationInput"]').val()||station);
  $('tr').filter(function() { return /^\d+$/.test($(this).find('>td').first().text().trim()); }).each(function() {
    const tds = $(this).find('>td');
    if (tds.length < 5) return;
    const t2 = $(tds[1]); const b = t2.find('b'); const tn = b.first().text().trim(); const nm = b.length>=2 ? $(b[1]).text().trim() : ''; const rt = t2.find('font[size="2"]').first().text().trim();
    const attd = $(tds[2]); let aa='',as2='',adel=''; const af = attd.find('font').first(); if (af.length) { aa = af.text().trim(); const de = attd.find('.w3-round').first(); adel = de.text().trim(); const sf = attd.find('font[size="1"]').last(); as2 = sf.text().trim(); } else if (/Source/i.test(attd.text())) as2 = 'Source';
    const dtd = $(tds[3]); let da='',ds3='',ddel=''; const df = dtd.find('font').first(); if (df.length) { da = df.text().trim(); const de = dtd.find('.w3-round').first(); ddel = de.text().trim(); const sf = dtd.find('font[size="1"]').last(); ds3 = sf.text().trim(); }
    const pt = $(tds[4]); const pf = pt.find('b').first().text().trim();
    trains.push({ trainNo:tn, trainName:nm, route:rt||undefined, arrivalActual:aa||undefined, arrivalScheduled:as2||undefined, arrivalDelay:adel||undefined, departureActual:da||undefined, departureScheduled:ds3||undefined, departureDelay:ddel||undefined, platform:pf||undefined });
  });
  return { station, stationName, date, trains, error:!trains.length?'No data found':null };
}

function parseTrainsBetween(html, from, to, date) {
  const $ = cheerio.load(html);
  const trains = [];
  const st = $('th font[color="#006AD5"]').first().text().trim();
  const cm = st.match(/(\d+)\s*Trains? found/i);
  $('tr.w3-round').each(function() {
    const r = $(this);
    const tn = r.find('span b').first().text().trim();
    const h = r.find('span').first().html() || '';
    const tnm = h.match(/<\/b>&nbsp;&nbsp;([^<]+)/);
    const tname = tnm ? tnm[1].trim() : '';
    const info = r.find('span').eq(1).text().trim();
    const fd = r.find('div[style*="display: flex"]');
    let dt, ds, dc, at, asc, ac, dur;
    if (fd.length) {
      const sp = fd.find('> span, > div');
      const ls = $(sp[0]); const db = ls.find('b').first(); dt = db.text().trim(); const ll = ls.html() ? ls.html().split('<br>') : []; if (ll.length>=2) ds = ll[1].replace(/<[^>]*>/g,'').trim(); const dcb = ls.find('b').last(); dc = dcb.text().trim(); if (dc===dt) dc = undefined;
      const cd = $(sp[1]); const dt2 = cd.text().trim(); const dmm = dt2.match(/--?(.+?)--?/); dur = dmm ? dmm[1].trim() : dt2;
      const rs = $(sp[2]); const ab = rs.find('b').first(); at = ab.text().trim(); const al = rs.html() ? rs.html().split('<br>') : []; if (al.length>=2) asc = al[1].replace(/<[^>]*>/g,'').trim(); const acb = rs.find('b').last(); ac = acb.text().trim(); if (ac===at) ac = undefined;
    }
    if (tn) trains.push({ trainNo:tn, trainName:tname, runDays:info||undefined, departureTime:dt||undefined, departureStation:ds||undefined, departureCode:dc||undefined, arrivalTime:at||undefined, arrivalStation:asc||undefined, arrivalCode:ac||undefined, duration:dur||undefined });
  });
  return { from, to, date, totalTrains:cm?parseInt(cm[1]):trains.length, trains, error:!trains.length?'No trains found':null };
}

const app = express();

app.get('/api/spot-train', (req, res) => {
  const { trainNo, date } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  try {
    const html = ntesPost('/tr?opt=TrainRunning&subOpt=FindRunningInstance', { jDate: String(date||''), trainNo: String(trainNo) });
    res.json(parseSpotTrain(html, String(trainNo), String(date||'')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/live-station', (req, res) => {
  const { station, date } = req.query;
  if (!station) { res.status(400).json({ error: 'station is required' }); return; }
  try {
    const html = ntesPost('/q?opt=LiveStation&subOpt=show', { jFromStationInput: String(station).toUpperCase() });
    res.json(parseLiveStation(html, String(station), String(date||'')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/train-schedule', (req, res) => {
  const { trainNo } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  try {
    const html = ntesPost('/q?opt=TrainServiceSchedule&subOpt=show', { trainNo: String(trainNo) });
    res.json(parseTrainSchedule(html, String(trainNo)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trains-between', (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }
  try {
    const html = ntesPost('/q?opt=TrainsBetweenStation&subOpt=tbs', { jFromStationInput: String(from).toUpperCase(), jToStationInput: String(to).toUpperCase() });
    res.json(parseTrainsBetween(html, String(from), String(to), String(date||'')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (_req, res) => { res.json({ status:'ok', service:'ntes-api' }); });

app.get('/debug', (req, res) => {
  const info = {};
  try {
    const p = spawnSync('curl', ['--version'], { timeout: 5000, encoding: 'utf8', env: { ...process.env, HOME: process.env.HOME || '/tmp' } });
    info.curl = p.error ? false : true;
    info.curlVer = p.error ? p.error.message : (p.stdout || '').split('\n')[0];
  } catch(e) { info.curl = false; info.curlVer = e.message; }
  try {
    const p = spawnSync('sh', ['-c', 'command -v curl'], { timeout: 5000, encoding: 'utf8' });
    info.curlPath = (p.stdout || '').trim() || 'not found';
  } catch(e) { info.curlPath = e.message; }
  info.platform = process.platform;
  info.node = process.version;
  res.json(info);
});

export default app;
