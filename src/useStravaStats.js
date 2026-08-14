import generated from './stravaStats.json';

// Stats are fetched at build time by scripts/fetch-strava-stats.js and
// baked into this JSON. Doing it here in the browser would require the
// Strava client secret, which CRA would inline into the public bundle.
const useStravaStats = () => {
  const t = generated.totals;

  return {
    fetchedAt: generated.fetchedAt,
    error: t ? null : new Error('no stats generated'),
    totalKm: t ? t.totalKm : null,
    totalHours: t ? t.totalHours : null,
    totalRuns: t ? t.totalRuns : null,
    ytdKm: t ? t.ytdKm : null,
    ytdRuns: t ? t.ytdRuns : null,
  };
};

export default useStravaStats;
