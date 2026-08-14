import React, { useEffect, useRef, useState } from 'react';
import { BiLogoLinkedinSquare } from 'react-icons/bi';
import { FaStrava } from 'react-icons/fa';
import Globe, { EARTH_CIRCUMFERENCE_KM } from './components/Globe';
import ContactPanel from './components/ContactPanel';
import useStravaStats from './useStravaStats';

// Counts a number up so the headline figure lands with the trail
// rather than just appearing.
const useCountUp = (target, duration = 2200) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    if (target == null) return undefined;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // rAF is suspended entirely in a background tab, which would leave
    // the headline figure frozen at 0. Timers still fire, so this
    // guarantees the true number regardless of animation.
    const settle = setTimeout(() => setValue(target), duration + 150);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
};

function App() {
  const { totalKm, totalRuns, totalHours, ytdKm, error } = useStravaStats();
  const [contactOpen, setContactOpen] = useState(false);

  const shownKm = useCountUp(totalKm);
  const percent = totalKm ? (totalKm / EARTH_CIRCUMFERENCE_KM) * 100 : 0;
  const shownPercent = useCountUp(percent);

  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  return (
    <div className="stage">
      <Globe totalKm={totalKm} />

      <div className="overlay">
        <header className="bar bar-top">
          <span className="wordmark">alexander lehnbom</span>
          <nav className="bar-links">
            <a href="https://www.strava.com/athletes/alexlehnbom" target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="Strava">
              <FaStrava />
            </a>
            <a href="https://www.linkedin.com/in/alehnbom/" target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="LinkedIn">
              <BiLogoLinkedinSquare />
            </a>
            <button type="button" className="ghost-button" onClick={() => setContactOpen(true)}>
              contact
            </button>
          </nav>
        </header>

        <div className="readout">
          <p className="eyebrow">tech support specialist &amp; developer · cochrane, ab</p>

          <h1 className="figure">
            {totalKm == null ? '—' : fmt(shownKm)}
            <span className="figure-unit">km</span>
          </h1>

          <p className="claim">
            {totalKm == null
              ? (error ? 'strava is being shy right now' : 'counting every step…')
              : <>that&apos;s <strong>{shownPercent.toFixed(1)}%</strong> of the way around the earth, on foot.</>}
          </p>

          <dl className="mini-stats">
            <div>
              <dt>runs</dt>
              <dd>{totalRuns == null ? '—' : fmt(totalRuns)}</dd>
            </div>
            <div>
              <dt>hours</dt>
              <dd>{totalHours == null ? '—' : fmt(totalHours)}</dd>
            </div>
            <div>
              <dt>this year</dt>
              <dd>{ytdKm == null ? '—' : `${fmt(ytdKm)} km`}</dd>
            </div>
          </dl>
        </div>
      </div>

      <ContactPanel open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

export default App;
