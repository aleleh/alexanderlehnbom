/* eslint-disable no-console */
// Fetches Strava totals at build time and writes them into src/.
//
// Why build time: Create React App inlines every REACT_APP_* variable
// into the public JS bundle, so a client-side token exchange would ship
// the Strava client secret to anyone who views source. Running here
// keeps the secret in the build environment only.
//
// Deliberately never fails the build — a Strava outage should not stop
// a deploy, so it warns and leaves the previous values in place.

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const OUT_FILE = path.join(__dirname, '..', 'src', 'stravaStats.json');

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  STRAVA_ATHLETE_ID,
} = process.env;

const writeOut = (payload) => {
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
};

const keepExisting = (reason) => {
  console.warn(`[strava] ${reason}`);
  if (fs.existsSync(OUT_FILE)) {
    console.warn('[strava] keeping previously generated stats');
    return;
  }
  console.warn('[strava] writing empty placeholder stats');
  writeOut({ fetchedAt: null, totals: null });
};

const main = async () => {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN || !STRAVA_ATHLETE_ID) {
    keepExisting('missing STRAVA_* env vars (see .env)');
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
  const { access_token: accessToken } = await tokenRes.json();

  const statsRes = await fetch(
    `https://www.strava.com/api/v3/athletes/${STRAVA_ATHLETE_ID}/stats`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!statsRes.ok) throw new Error(`stats request failed (${statsRes.status})`);
  const stats = await statsRes.json();

  const all = stats.all_run_totals;
  const ytd = stats.ytd_run_totals;
  if (!all || !ytd) throw new Error('response missing run totals');

  writeOut({
    fetchedAt: new Date().toISOString(),
    totals: {
      totalKm: all.distance / 1000,
      totalHours: all.moving_time / 3600,
      totalRuns: all.count,
      ytdKm: ytd.distance / 1000,
      ytdRuns: ytd.count,
    },
  });

  console.log(
    `[strava] ${Math.round(all.distance / 1000).toLocaleString('en-US')} km / ${all.count} runs written to src/stravaStats.json`
  );
};

main().catch((err) => keepExisting(err.message));
