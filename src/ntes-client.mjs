import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as cheerio from 'cheerio';

const BASE = 'https://enquiry.indianrail.gov.in/mntes';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const IS_WIN = process.platform === 'win32';
const CURL = IS_WIN ? 'curl.exe' : 'curl';
const NULL = IS_WIN ? 'nul' : '/dev/null';

export class NtesClient {
  constructor() {
    this.tmpDir = mkdtempSync(join(tmpdir(), 'ntes-'));
    this.cookieFile = join(this.tmpDir, 'cookies.txt');
  }

  curl(args) {
    const cmd = `${CURL} -s -b "${this.cookieFile}" -c "${this.cookieFile}" ${args} -H "User-Agent: ${UA}"`;
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, shell: IS_WIN, timeout: 20000 });
  }

  destroy() {
    try { rmSync(this.tmpDir, { recursive: true, force: true }); } catch {}

  _getCsrf() {
    this.curl(`"${BASE}/q" > ${NULL}`);
    const body = this.curl(`"${BASE}/GetCSRFToken?t=${Date.now()}"`);
    const m = body.match(/name='([^']+)' value='([^']+)'/);
    if (!m) throw new Error('Failed to get CSRF token');
    return { name: m[1], value: m[2] };
  }

  _post(endpoint, formFields) {
    const csrf = this._getCsrf();
    const params = new URLSearchParams({ lan: 'en', ...formFields, [csrf.name]: csrf.value });
    const html = this.curl(
      `-X POST "${BASE}${endpoint}" -d "${params.toString()}" -H "Content-Type: application/x-www-form-urlencoded" -H "Referer: ${BASE}/q"`
    );
    return html;
  }

  async spotTrain(trainNo, date) {
    try {
      const html = this._post('/tr?opt=TrainRunning&subOpt=FindRunningInstance', {
        jDate: date, trainNo: String(trainNo)
      });
      return this._parseSpotTrain(html, trainNo, date);
    } finally { this.destroy(); }
  }

  async liveStation(station, date) {
    try {
      const html = this._post('/q?opt=LiveStation&subOpt=show', {
        jFromStationInput: String(station).toUpperCase()
      });
      return this._parseLiveStation(html, station, date);
    } finally { this.destroy(); }
  }

  async trainSchedule(trainNo) {
    try {
      const html = this._post('/q?opt=TrainServiceSchedule&subOpt=show', {
        trainNo: String(trainNo)
      });
      return this._parseTrainSchedule(html, trainNo);
    } finally { this.destroy(); }
  }

  async trainsBetween(from, to, date) {
    try {
      const html = this._post('/q?opt=TrainsBetweenStation&subOpt=tbs', {
        jFromStationInput: String(from).toUpperCase(),
        jToStationInput: String(to).toUpperCase()
      });
      return this._parseTrainsBetween(html, from, to, date);
    } finally { this.destroy(); }
  }

  // --- Spot Train Parser (stopRow structure) ---

  _parseSpotTrain(html, trainNo, date) {
    const $ = cheerio.load(html);
    const stations = [];
    let trainName = 'Unknown';

    $('.w3-panel.w3-round.w3-blue h3').each((_i, el) => {
      const t = $(el).text().trim();
      if (/\d{5}/.test(t)) trainName = t;
    });

    const activePane = this._getDatePane($, date);
    const stopRows = activePane ? activePane.find('.stopRow') : $('.stopRow');
    stopRows.each((_i, row) => {
      stations.push(this._parseStationRow($, $(row)));
    });

    return { trainNo, trainName, startDate: date, stations,
      error: !stations.length && activePane && /No Data/i.test(activePane.text()) ? 'No data found' : null };
  }

  _getDatePane($, date) {
    const paneId = date ? `#train${date.toLowerCase()}` : null;
    let pane = paneId ? $(paneId) : null;
    if (!pane || !pane.find('.stopRow').length) {
      $('.tab-pane').each((_i, p) => {
        const $p = $(p);
        if ($p.find('.stopRow').length > 0 && !pane) pane = $p;
      });
    }
    return pane;
  }

  _parseStationRow($, $row) {
    const nameContainer = $row.children('div').filter((_i, el) =>
      ($(el).attr('style') || '').includes('float:right')
    ).children('div').filter((_i, el) =>
      ($(el).attr('style') || '').includes('float:left')
    );
    const stationName = nameContainer.find('font > b').first().text().trim();

    const codeSpan = $row.find('.w3-round.w3-orange').first();
    const platform = codeSpan.text().trim();
    const codeText = codeSpan.parent('b').text().trim();
    const stationCode = codeText.split(/\s+/)[0];

    const rightFlex = $row.children('div').filter((_i, el) =>
      ($(el).attr('style') || '').includes('float:right') && ($(el).attr('style') || '').includes('flex')
    );
    const rowText = rightFlex.text();
    let type = 'STOP';
    if (/\bSRC\b/.test(rowText)) type = 'SRC';
    else if (/DSTN|DST\b/.test(rowText)) type = 'DST';

    let distance;
    const distMatch = rowText.match(/(\d+)\s*KMs?/);
    if (distMatch) distance = parseInt(distMatch[1]);

    const leftTime = $row.children('div').filter((_i, el) =>
      ($(el).attr('style') || '').includes('float:left') && ($(el).attr('style') || '').includes('width:100px')
    ).first();

    let schedArr, actArr, delayText = '', delayMin, status = '';
    if (leftTime.length) {
      const spans = leftTime.find('> span');
      if (spans.length >= 1) {
        const sb = $(spans[0]).find('font b, b font');
        schedArr = sb.length ? sb.text().trim() : $(spans[0]).text().trim();
        if (!schedArr || schedArr === '&nbsp;') schedArr = undefined;
      }
      if (spans.length >= 2) {
        const ab = $(spans[1]).find('b');
        actArr = ab.length ? ab.first().text().trim() : undefined;
        const st = $(spans[1]).find('.w3-round');
        status = st.length ? st.text().trim() : '';
        const ds = $(spans[1]).find('span:not(.w3-round)');
        delayText = ds.length ? ds.text().trim() : '';
        if (!delayText) delayText = status;
        const dm = delayText.match(/(\d+)\s*Min/i);
        if (dm) delayMin = parseInt(dm[1]);
      }
    }

    const rightTime = rightFlex.children('div').filter((_i, el) =>
      ($(el).attr('style') || '').includes('float:right') && ($(el).attr('style') || '').includes('text-align:right')
    ).first();

    let schedDep, actDep, depStatus = '';
    if (rightTime.length) {
      const spans = rightTime.find('> span');
      if (spans.length >= 1) {
        const sb = $(spans[0]).find('font b, b font');
        schedDep = sb.length ? sb.text().trim() : $(spans[0]).text().trim();
        if (!schedDep || schedDep === '&nbsp;') schedDep = undefined;
      }
      if (spans.length >= 2) {
        const ab = $(spans[1]).find('b');
        actDep = ab.length ? ab.first().text().trim() : undefined;
        const ss = $(spans[1]).find('.w3-round');
        depStatus = ss.length ? ss.text().trim() : '';
      }
    }

    return {
      stationName: stationName || 'Unknown', stationCode, platform, distance, type,
      scheduledArrival: schedArr, actualArrival: actArr,
      delay: delayText, delayMinutes: delayMin, status,
      scheduledDeparture: schedDep, actualDeparture: actDep, departureStatus: depStatus
    };
  }

  // --- Train Schedule Parser (table structure) ---

  _parseTrainSchedule(html, trainNo) {
    const $ = cheerio.load(html);
    const stations = [];

    // Get train name from the first table
    const nameText = $('table.table-bordered tbody tr td span b').first().text().trim();
    const trainName = nameText || 'Unknown';

    // Parse route table rows (2nd table with Sr., Station, Day, etc.)
    const rows = $('table.table-bordered').last().find('tbody tr');
    rows.each((_i, row) => {
      const $row = $(row);
      const tds = $row.find('td');
      if (tds.length < 6) return;

      const sr = $(tds[0]).text().trim();
      if (!sr || !/^\d+$/.test(sr)) return;

      const stationHtml = $(tds[1]).html() || '';
      const nameMatch = stationHtml.match(/<font[^>]*>([^<]+)<\/font><br>/i);
      const codeMatch = stationHtml.match(/<font[^>]*>([A-Z0-9]+)<\/font>$/i);

      const day = parseInt($(tds[2]).text().trim()) || 1;

      const arrDepHtml = $(tds[3]).html() || '';
      const arrMatch = arrDepHtml.match(/<font[^>]*>([^<]+)<\/font><br>/i);
      const depMatch = arrDepHtml.match(/<br><font[^>]*>([^<]+)<\/font>/i);

      const halt = $(tds[4]).text().trim();

      const distText = $(tds[5]).text().trim();
      const distance = parseInt(distText) || 0;

      stations.push({
        serial: parseInt(sr),
        stationName: nameMatch ? nameMatch[1].trim() : '',
        stationCode: codeMatch ? codeMatch[1].trim() : '',
        day,
        arrival: arrMatch ? arrMatch[1].trim() : '',
        departure: depMatch ? depMatch[1].trim() : '',
        haltTime: halt || undefined,
        distance
      });
    });

    return { trainNo, trainName, stations,
      error: !stations.length ? 'No data found' : null };
  }

  // --- Live Station Parser (table-based train list) ---

  _parseLiveStation(html, station, date) {
    const $ = cheerio.load(html);
    const trains = [];

    // Get station name from summary header or input field
    let stationName = station;
    const summaryHtml = $('th font[color="#006AD5"]').first().html();
    const stnMatch = summaryHtml ? summaryHtml.match(/<b>([^<]+)<\/b>/) : null;
    if (stnMatch) stationName = stnMatch[1].trim();
    else {
      const inputVal = $('input[name="jFromStationInput"]').val();
      if (inputVal) stationName = String(inputVal);
    }

    // Parse train rows (each <tr> with serial number)
    const rows = $('tr').filter((_i, row) => {
      const $row = $(row);
      const firstTd = $row.find('> td').first().text().trim();
      return /^\d+$/.test(firstTd);
    });

    rows.each((_i, row) => {
      const $row = $(row);
      const tds = $row.find('> td');
      if (tds.length < 5) return;

      // Column 1: serial number (already checked in filter)

      // Column 2: train info (train number + name)
      const trainTd = $(tds[1]);
      const trainNoEl = trainTd.find('b').first();
      const trainNo = trainNoEl.text().trim();
      const allBs = trainTd.find('b');
      let trainName = '';
      if (allBs.length >= 2) {
        trainName = $(allBs[1]).text().trim();
      }
      const routeText = trainTd.find('font[size="2"]').first().text().trim();

      // Column 3: arrival
      const arrTd = $(tds[2]);
      let arrivalActual = '', arrivalScheduled = '', arrivalDelay = '';
      const arrFont = arrTd.find('font').first();
      if (arrFont.length) {
        arrivalActual = arrFont.text().trim();
        const delayEl = arrTd.find('.w3-round').first();
        arrivalDelay = delayEl.text().trim();
        const schedFont = arrTd.find('font[size="1"]').last();
        arrivalScheduled = schedFont.text().trim();
      } else {
        const srcText = arrTd.text().trim();
        if (/Source/i.test(srcText)) arrivalScheduled = 'Source';
      }

      // Column 4: departure
      const depTd = $(tds[3]);
      let departureActual = '', departureScheduled = '', departureDelay = '';
      const depFont = depTd.find('font').first();
      if (depFont.length) {
        departureActual = depFont.text().trim();
        const delayEl = depTd.find('.w3-round').first();
        departureDelay = delayEl.text().trim();
        const schedFont = depTd.find('font[size="1"]').last();
        departureScheduled = schedFont.text().trim();
      }

      // Column 5: platform
      const platTd = $(tds[4]);
      const platform = platTd.find('b').first().text().trim();

      trains.push({
        trainNo, trainName, route: routeText || undefined,
        arrivalActual: arrivalActual || undefined,
        arrivalScheduled: arrivalScheduled || undefined,
        arrivalDelay: arrivalDelay || undefined,
        departureActual: departureActual || undefined,
        departureScheduled: departureScheduled || undefined,
        departureDelay: departureDelay || undefined,
        platform: platform || undefined
      });
    });

    return { station, stationName, date, trains,
      error: !trains.length ? 'No data found' : null };
  }

  // --- Trains Between Stations Parser (card-style list) ---

  _parseTrainsBetween(html, from, to, date) {
    const $ = cheerio.load(html);
    const trains = [];

    // Find train count
    const summaryText = $('th font[color="#006AD5"]').first().text().trim();
    const countMatch = summaryText.match(/(\d+)\s*Trains? found/i);

    // Parse each train card (tr with class "w3-round")
    const rows = $('tr.w3-round');
    rows.each((_i, row) => {
      const $row = $(row);

      // Train number + name
      const nameSpan = $row.find('span b').first();
      const trainNo = nameSpan.text().trim();
      const nameHtml = $row.find('span').first().html() || '';
      const nameParts = nameHtml.split('<b>');
      // After <b>TRAIN_NO</b>&nbsp;&nbsp;TRAIN_NAME<br>
      const trainNameMatch = nameHtml.match(/<\/b>&nbsp;&nbsp;([^<]+)/);
      const trainName = trainNameMatch ? trainNameMatch[1].trim() : '';

      // Run days + type
      const infoText = $row.find('span').eq(1).text().trim();

      // Departure/arrival details in flex div
      const flexDiv = $row.find('div[style*="display: flex"]');
      let departureTime, departureStation, departureCode;
      let arrivalTime, arrivalStation, arrivalCode;
      let duration;

      if (flexDiv.length) {
        const spans = flexDiv.find('> span, > div');
        // Left (departure) - text-align: left
        const leftSpan = $(spans[0]);
        const depB = leftSpan.find('b').first();
        departureTime = depB.text().trim();
        const depLines = leftSpan.html() ? leftSpan.html().split('<br>') : [];
        if (depLines.length >= 2) {
          const clean = depLines[1].replace(/<[^>]*>/g, '').trim();
          departureStation = clean;
        }
        const depCodeB = leftSpan.find('b').last();
        departureCode = depCodeB.text().trim();
        if (departureCode === departureTime) departureCode = undefined;

        // Center (duration)
        const centerDiv = $(spans[1]);
        const durationText = centerDiv.text().trim();
        const durMatch = durationText.match(/--?(.+?)--?/);
        duration = durMatch ? durMatch[1].trim() : durationText;

        // Right (arrival) - text-align: right
        const rightSpan = $(spans[2]);
        const arrB = rightSpan.find('b').first();
        arrivalTime = arrB.text().trim();
        const arrLines = rightSpan.html() ? rightSpan.html().split('<br>') : [];
        if (arrLines.length >= 2) {
          const clean = arrLines[1].replace(/<[^>]*>/g, '').trim();
          arrivalStation = clean;
        }
        const arrCodeB = rightSpan.find('b').last();
        arrivalCode = arrCodeB.text().trim();
        if (arrivalCode === arrivalTime) arrivalCode = undefined;
      }

      if (trainNo) {
        trains.push({
          trainNo, trainName,
          runDays: infoText || undefined,
          departureTime: departureTime || undefined,
          departureStation: departureStation || undefined,
          departureCode: departureCode || undefined,
          arrivalTime: arrivalTime || undefined,
          arrivalStation: arrivalStation || undefined,
          arrivalCode: arrivalCode || undefined,
          duration: duration || undefined
        });
      }
    });

    return {
      from, to, date,
      totalTrains: countMatch ? parseInt(countMatch[1]) : trains.length,
      trains,
      error: !trains.length ? 'No trains found' : null
    };
  }
}
