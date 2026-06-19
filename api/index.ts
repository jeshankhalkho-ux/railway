import express from 'express';
import * as cheerio from 'cheerio';

const BASE = 'https://enquiry.indianrail.gov.in/mntes';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

class CookieJar {
  private cookies: Map<string, string> = new Map();

  setFromResponse(res: Response) {
    const h = res.headers.get('set-cookie');
    if (!h) return;
    for (const part of h.split(',')) {
      const m = part.match(/^([^=]+)=([^;]+)/);
      if (m) this.cookies.set(m[1].trim(), m[2].trim());
    }
  }

  get header(): string {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function ntesFetch(path: string, options: RequestInit = {}, jar?: CookieJar): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    ...(options.headers as Record<string, string> || {})
  };
  if (jar && jar.cookies.size > 0) {
    headers['Cookie'] = jar.header;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (jar) jar.setFromResponse(res);
  return res;
}

async function getCsrf(jar: CookieJar): Promise<{ name: string; value: string }> {
  await ntesFetch('/q', {}, jar);
  const body = await ntesFetch(`/GetCSRFToken?t=${Date.now()}`, {}, jar).then(r => r.text());
  const m = body.match(/name='([^']+)' value='([^']+)'/);
  if (!m) throw new Error('Failed to get CSRF token: ' + body.slice(0, 200));
  return { name: m[1], value: m[2] };
}

async function ntesPost(endpoint: string, formFields: Record<string, string>): Promise<string> {
  const jar = new CookieJar();
  const csrf = await getCsrf(jar);
  const params = new URLSearchParams({ lan: 'en', ...formFields, [csrf.name]: csrf.value });
  const res = await ntesFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `${BASE}/q` },
    body: params.toString()
  }, jar);
  return res.text();
}

// --- Parsers (same logic, just pure functions) ---

function getDatePane($: cheerio.CheerioAPI, date: string) {
  const paneId = date ? `#train${date.toLowerCase()}` : null;
  let pane = paneId ? $(paneId) : null;
  if (!pane || !pane.find('.stopRow').length) {
    $('.tab-pane').each((_i, p) => { const $p = $(p); if ($p.find('.stopRow').length > 0 && !pane) pane = $p; });
  }
  return pane;
}

function parseStationRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio) {
  const nc = $row.children('div').filter((_i, el) => ($(el).attr('style')||'').includes('float:right'))
    .children('div').filter((_i, el) => ($(el).attr('style')||'').includes('float:left'));
  const stationName = nc.find('font > b').first().text().trim();
  const cs = $row.find('.w3-round.w3-orange').first();
  const platform = cs.text().trim();
  const codeText = cs.parent('b').text().trim();
  const stationCode = codeText.split(/\s+/)[0];
  const rf = $row.children('div').filter((_i, el) => ($(el).attr('style')||'').includes('float:right')&&($(el).attr('style')||'').includes('flex'));
  const rt = rf.text();
  let type = 'STOP';
  if (/\bSRC\b/.test(rt)) type = 'SRC';
  else if (/DSTN|DST\b/.test(rt)) type = 'DST';
  let distance: number|undefined;
  const dm = rt.match(/(\d+)\s*KMs?/);
  if (dm) distance = parseInt(dm[1]);
  const lt = $row.children('div').filter((_i,el)=>($(el).attr('style')||'').includes('float:left')&&($(el).attr('style')||'').includes('width:100px')).first();
  let sa: string|undefined, aa: string|undefined, dt='', dmin: number|undefined, st='';
  if (lt.length) {
    const sp = lt.find('> span');
    if (sp.length>=1) { const sb=$(sp[0]).find('font b,b font'); sa=sb.length?sb.text().trim():$(sp[0]).text().trim(); if(!sa||sa==='&nbsp;')sa=undefined; }
    if (sp.length>=2) { const ab=$(sp[1]).find('b'); aa=ab.length?ab.first().text().trim():undefined; const se=$(sp[1]).find('.w3-round'); st=se.length?se.text().trim():''; const ds=$(sp[1]).find('span:not(.w3-round)'); dt=ds.length?ds.text().trim():''; if(!dt)dt=st; const dmm=dt.match(/(\d+)\s*Min/i); if(dmm)dmin=parseInt(dmm[1]); }
  }
  const rtime = rf.children('div').filter((_i,el)=>($(el).attr('style')||'').includes('float:right')&&($(el).attr('style')||'').includes('text-align:right')).first();
  let sd: string|undefined, ad: string|undefined, ds2='';
  if (rtime.length) {
    const sp=rtime.find('> span');
    if (sp.length>=1) { const sb=$(sp[0]).find('font b,b font'); sd=sb.length?sb.text().trim():$(sp[0]).text().trim(); if(!sd||sd==='&nbsp;')sd=undefined; }
    if (sp.length>=2) { const ab=$(sp[1]).find('b'); ad=ab.length?ab.first().text().trim():undefined; const se=$(sp[1]).find('.w3-round'); ds2=se.length?se.text().trim():''; }
  }
  return { stationName:stationName||'Unknown', stationCode, platform, distance, type, scheduledArrival:sa, actualArrival:aa, delay:dt, delayMinutes:dmin, status:st, scheduledDeparture:sd, actualDeparture:ad, departureStatus:ds2 };
}

function parseSpotTrain(html: string, trainNo: string, date: string) {
  const $ = cheerio.load(html);
  const stations: any[] = [];
  let trainName = 'Unknown';
  $('.w3-panel.w3-round.w3-blue h3').each((_i,el)=>{const t=$(el).text().trim(); if(/\d{5}/.test(t))trainName=t;});
  const ap = getDatePane($, date);
  const rows = ap ? ap.find('.stopRow') : $('.stopRow');
  rows.each((_i,r)=>stations.push(parseStationRow($,$(r))));
  return { trainNo, trainName, startDate:date, stations, error:!stations.length&&ap&&/No Data/i.test(ap.text())?'No data found':null };
}

function parseTrainSchedule(html: string, trainNo: string) {
  const $ = cheerio.load(html);
  const stations: any[] = [];
  const trainName = $('table.table-bordered tbody tr td span b').first().text().trim()||'Unknown';
  $('table.table-bordered').last().find('tbody tr').each((_i,row)=>{
    const tds=$(row).find('td');
    if(tds.length<6)return;
    const sr=$(tds[0]).text().trim();
    if(!sr||!/^\d+$/.test(sr))return;
    const h=$(tds[1]).html()||'';
    const nm=h.match(/<font[^>]*>([^<]+)<\/font><br>/i);
    const cm=h.match(/<font[^>]*>([A-Z0-9]+)<\/font>$/i);
    const day=parseInt($(tds[2]).text().trim())||1;
    const ah=$(tds[3]).html()||'';
    const am=ah.match(/<font[^>]*>([^<]+)<\/font><br>/i);
    const dpm=ah.match(/<br><font[^>]*>([^<]+)<\/font>/i);
    stations.push({ serial:parseInt(sr), stationName:nm?nm[1].trim():'', stationCode:cm?cm[1].trim():'', day, arrival:am?am[1].trim():'', departure:dpm?dpm[1].trim():'', haltTime:$(tds[4]).text().trim()||undefined, distance:parseInt($(tds[5]).text().trim())||0 });
  });
  return { trainNo, trainName, stations, error:!stations.length?'No data found':null };
}

function parseLiveStation(html: string, station: string, date: string) {
  const $ = cheerio.load(html);
  const trains: any[] = [];
  const sh=$('th font[color="#006AD5"]').first().html();
  const sm=sh?sh.match(/<b>([^<]+)<\/b>/):null;
  const stationName=sm?sm[1].trim():String($('input[name="jFromStationInput"]').val()||station);
  $('tr').filter((_i,r): boolean =>/^\d+$/.test($(r).find('>td').first().text().trim())).each((_i,row)=>{
    const tds=$(row).find('>td');
    if(tds.length<5)return;
    const t2=$(tds[1]); const b=t2.find('b'); const tn=b.first().text().trim(); const nm=b.length>=2?$(b[1]).text().trim():''; const rt=t2.find('font[size="2"]').first().text().trim();
    const attd=$(tds[2]); let aa='',as2='',adel=''; const af=attd.find('font').first(); if(af.length){aa=af.text().trim(); const de=attd.find('.w3-round').first(); adel=de.text().trim(); const sf=attd.find('font[size="1"]').last(); as2=sf.text().trim(); } else if(/Source/i.test(attd.text()))as2='Source';
    const dtd=$(tds[3]); let da='',ds3='',ddel=''; const df=dtd.find('font').first(); if(df.length){da=df.text().trim(); const de=dtd.find('.w3-round').first(); ddel=de.text().trim(); const sf=dtd.find('font[size="1"]').last(); ds3=sf.text().trim(); }
    const pt=$(tds[4]); const pf=pt.find('b').first().text().trim();
    trains.push({ trainNo:tn, trainName:nm, route:rt||undefined, arrivalActual:aa||undefined, arrivalScheduled:as2||undefined, arrivalDelay:adel||undefined, departureActual:da||undefined, departureScheduled:ds3||undefined, departureDelay:ddel||undefined, platform:pf||undefined });
  });
  return { station, stationName, date, trains, error:!trains.length?'No data found':null };
}

function parseTrainsBetween(html: string, from: string, to: string, date: string) {
  const $ = cheerio.load(html);
  const trains: any[] = [];
  const st=$('th font[color="#006AD5"]').first().text().trim();
  const cm=st.match(/(\d+)\s*Trains? found/i);
  $('tr.w3-round').each((_i,row)=>{
    const r=$(row);
    const tn=r.find('span b').first().text().trim();
    const h=r.find('span').first().html()||'';
    const tnm=h.match(/<\/b>&nbsp;&nbsp;([^<]+)/);
    const tname=tnm?tnm[1].trim():'';
    const info=r.find('span').eq(1).text().trim();
    const fd=r.find('div[style*="display: flex"]');
    let dt: string|undefined, ds: string|undefined, dc: string|undefined, at: string|undefined, asc: string|undefined, ac: string|undefined, dur: string|undefined;
    if(fd.length){
      const sp=fd.find('> span, > div');
      const ls=$(sp[0]); const db=ls.find('b').first(); dt=db.text().trim(); const ll=ls.html()?ls.html().split('<br>'):[]; if(ll.length>=2)ds=ll[1].replace(/<[^>]*>/g,'').trim(); const dcb=ls.find('b').last(); dc=dcb.text().trim(); if(dc===dt)dc=undefined;
      const cd=$(sp[1]); const dt2=cd.text().trim(); const dmm=dt2.match(/--?(.+?)--?/); dur=dmm?dmm[1].trim():dt2;
      const rs=$(sp[2]); const ab=rs.find('b').first(); at=ab.text().trim(); const al=rs.html()?rs.html().split('<br>'):[]; if(al.length>=2)asc=al[1].replace(/<[^>]*>/g,'').trim(); const acb=rs.find('b').last(); ac=acb.text().trim(); if(ac===at)ac=undefined;
    }
    if(tn) trains.push({ trainNo:tn, trainName:tname, runDays:info||undefined, departureTime:dt||undefined, departureStation:ds||undefined, departureCode:dc||undefined, arrivalTime:at||undefined, arrivalStation:asc||undefined, arrivalCode:ac||undefined, duration:dur||undefined });
  });
  return { from, to, date, totalTrains:cm?parseInt(cm[1]):trains.length, trains, error:!trains.length?'No trains found':null };
}

// --- Express routes ---
const app = express();

app.get('/api/spot-train', async (req, res) => {
  const { trainNo, date } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  try {
    const html = await ntesPost('/tr?opt=TrainRunning&subOpt=FindRunningInstance', { jDate: String(date||''), trainNo: String(trainNo) });
    res.json(parseSpotTrain(html, String(trainNo), String(date||'')));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/live-station', async (req, res) => {
  const { station, date } = req.query;
  if (!station) { res.status(400).json({ error: 'station is required' }); return; }
  try {
    const html = await ntesPost('/q?opt=LiveStation&subOpt=show', { jFromStationInput: String(station).toUpperCase() });
    res.json(parseLiveStation(html, String(station), String(date||'')));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/train-schedule', async (req, res) => {
  const { trainNo } = req.query;
  if (!trainNo) { res.status(400).json({ error: 'trainNo is required' }); return; }
  try {
    const html = await ntesPost('/q?opt=TrainServiceSchedule&subOpt=show', { trainNo: String(trainNo) });
    res.json(parseTrainSchedule(html, String(trainNo)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trains-between', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }
  try {
    const html = await ntesPost('/q?opt=TrainsBetweenStation&subOpt=tbs', { jFromStationInput: String(from).toUpperCase(), jToStationInput: String(to).toUpperCase() });
    res.json(parseTrainsBetween(html, String(from), String(to), String(date||'')));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (_req, res) => { res.json({ status:'ok', service:'ntes-api' }); });

export default app;
