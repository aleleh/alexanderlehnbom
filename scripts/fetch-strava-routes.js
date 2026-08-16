/* eslint-disable no-console */
// Fetches every run's GPS trace at build time and bakes them into
// src/stravaRoutes.json, so the globe can draw Alex's real routes.
//
// Runs here rather than in the browser for two reasons: the Strava
// client secret must never reach the bundle, and this needs several
// paginated requests that would be slow and rate-limited per visitor.
//
// PRIVACY: a summary_polyline starts and ends at the door you left
// from. TRIM_METERS clips both ends of every trace before it is ever
// written to disk, so the published data never points at home.

const fs = require('fs');
const path = require('path');
const polyline = require('@mapbox/polyline');

require('dotenv').config();

const OUT_FILE = path.join(__dirname, '..', 'src', 'stravaRoutes.json');

const TRIM_METERS = 400; // clipped from each end of every route
// ~11m accuracy. At maximum zoom the globe still shows roughly 10km per
// pixel, so finer precision only doubles the payload for detail that
// can never be seen. Halves the gzipped size versus the default of 5.
const PRECISION = 4;
const MIN_POINTS = 8; // drop traces too short to be worth drawing
const MAX_AGE_HOURS = 24; // skip refetch if the cache is newer than this
const PER_PAGE = 200;

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
} = process.env;

const haversine = ([lat1, lng1], [lat2, lng2]) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Walks in from both ends until TRIM_METERS of the route is discarded.
const trimEnds = (points) => {
  let startIdx = 0;
  let acc = 0;
  while (startIdx < points.length - 1 && acc < TRIM_METERS) {
    acc += haversine(points[startIdx], points[startIdx + 1]);
    startIdx += 1;
  }

  let endIdx = points.length - 1;
  acc = 0;
  while (endIdx > startIdx && acc < TRIM_METERS) {
    acc += haversine(points[endIdx], points[endIdx - 1]);
    endIdx -= 1;
  }

  return points.slice(startIdx, endIdx + 1);
};

const isFresh = () => {
  if (process.env.FORCE_ROUTES === '1') return false;
  if (!fs.existsSync(OUT_FILE)) return false;
  try {
    const { fetchedAt } = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    if (!fetchedAt) return false;
    return Date.now() - new Date(fetchedAt).getTime() < MAX_AGE_HOURS * 3600 * 1000;
  } catch {
    return false;
  }
};

const keepExisting = (reason) => {
  console.warn(`[routes] ${reason}`);
  if (fs.existsSync(OUT_FILE)) {
    console.warn('[routes] keeping previously generated routes');
    return;
  }
  console.warn('[routes] writing empty placeholder');
  fs.writeFileSync(
    OUT_FILE,
    `${JSON.stringify({ fetchedAt: null, trimMeters: TRIM_METERS, routes: [] }, null, 2)}\n`
  );
};

const main = async () => {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    keepExisting('missing STRAVA_* env vars (see .env)');
    return;
  }
  if (isFresh()) {
    console.log(`[routes] cache is under ${MAX_AGE_HOURS}h old — skipping (FORCE_ROUTES=1 to override)`);
    return;
  }

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
  const { access_token: accessToken, scope } = await tokenRes.json();

  if (scope && !scope.includes('activity:read')) {
    throw new Error(`token scope is "${scope}" — needs activity:read_all (re-authorize)`);
  }

  const routes = [];
  let skippedNoGps = 0;
  let skippedTooShort = 0;

  for (let page = 1; ; page += 1) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status === 429) throw new Error('rate limited by Strava — try again in 15 minutes');
    if (!res.ok) throw new Error(`activities page ${page} failed (${res.status})`);

    const batch = await res.json();
    if (!batch.length) break;

    batch
      .filter((a) => a.type === 'Run' || a.sport_type === 'TrailRun')
      .forEach((a) => {
        const encoded = a.map && a.map.summary_polyline;
        if (!encoded) {
          skippedNoGps += 1;
          return;
        }
        const trimmed = trimEnds(polyline.decode(encoded));
        if (trimmed.length < MIN_POINTS) {
          skippedTooShort += 1;
          return;
        }
        // Re-encoding keeps the payload compact; raw arrays would be
        // several times larger in the bundle. `d` is Strava's own
        // distance for the activity in metres — the trimmed polyline
        // would understate it by ~800m per run.
        routes.push({
          p: polyline.encode(trimmed, PRECISION),
          d: Math.round(a.distance || 0),
        });
      });

    console.log(`[routes] page ${page}: ${batch.length} activities, ${routes.length} routes so far`);
    if (batch.length < PER_PAGE) break;
  }

  fs.writeFileSync(
    OUT_FILE,
    `${JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        trimMeters: TRIM_METERS,
        precision: PRECISION,
        routes,
      },
      null,
      2
    )}\n`
  );

  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(
    `[routes] wrote ${routes.length} routes (${kb} kB), trimmed ${TRIM_METERS}m from each end`
  );
  console.log(`[routes] skipped: ${skippedNoGps} without GPS, ${skippedTooShort} too short after trim`);
};

main().catch((err) => keepExisting(err.message));
