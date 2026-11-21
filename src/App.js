import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BiLogoLinkedinSquare } from 'react-icons/bi';
import { FaStrava } from 'react-icons/fa';
import { HiOutlineMail, HiOutlineLocationMarker, HiX, HiArrowDown } from 'react-icons/hi';
import Globe from './components/Globe';
import Work from './components/Work';
import { EMAIL, HERO, LINKEDIN, RESUME_URL, STRAVA } from './profile';

const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('hello from alexanderlehnbom.com')}`;
const HINT_KEY = 'globe-hint-seen';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

// Storage can throw (private mode, blocked site data); the hint just
// shows again in that case.
const hintSeen = () => {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};
const rememberHint = () => {
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* ignore */
  }
};

// Merges clusters that share a name (Gävle shows up as two) and groups
// the named places by country, busiest first.
const groupPlaces = (clusters) => {
  const byName = new Map();
  clusters.forEach((c) => {
    if (!c.name) return;
    const p = byName.get(c.name);
    if (!p) {
      byName.set(c.name, { name: c.name, country: c.country, runs: c.runs, metres: c.metres, target: c });
      return;
    }
    p.runs += c.runs;
    p.metres += c.metres;
    if (c.runs > p.target.runs) p.target = c;
  });

  const byCountry = new Map();
  byName.forEach((p) => {
    const g = byCountry.get(p.country) || { country: p.country, runs: 0, places: [] };
    g.runs += p.runs;
    g.places.push(p);
    byCountry.set(p.country, g);
  });
  const groups = [...byCountry.values()].sort((a, b) => b.runs - a.runs);
  groups.forEach((g) => g.places.sort((a, b) => b.runs - a.runs));
  return groups;
};

// Strips the country off a place name inside its own country group.
const shortName = (name, country) => {
  const suffix = `, ${country}`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
};

function App() {
  const [place, setPlace] = useState(null);
  const [data, setData] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [showHint, setShowHint] = useState(() => !hintSeen());
  const globeRef = useRef(null);

  // Stable identity so the globe's scene effect is never torn down.
  const handleHoverPlace = useCallback((info) => setPlace(info), []);
  const handlePlaces = useCallback((d) => setData(d), []);

  const groups = useMemo(() => (data ? groupPlaces(data.clusters) : []), [data]);

  // The hint goes away the first time someone touches the globe, and
  // stays away on later visits.
  useEffect(() => {
    if (!showHint) return undefined;
    const dismiss = () => {
      setShowHint(false);
      rememberHint();
    };
    const canvas = document.querySelector('.globe-canvas');
    if (!canvas) return undefined;
    canvas.addEventListener('pointerdown', dismiss, { once: true });
    canvas.addEventListener('wheel', dismiss, { once: true, passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', dismiss);
      canvas.removeEventListener('wheel', dismiss);
    };
  }, [showHint]);

  useEffect(() => {
    if (!listOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listOpen]);

  const flyTo = (p) => {
    if (globeRef.current) globeRef.current.flyTo(p.target);
    setShowHint(false);
    rememberHint();
    // On a phone the sheet covers the globe, so get out of the way.
    if (window.matchMedia('(max-width: 600px)').matches) setListOpen(false);
  };

  return (
    <>
    <div className="stage" id="top">
      <Globe onHoverPlace={handleHoverPlace} onPlaces={handlePlaces} controlRef={globeRef} />

      <div className="overlay">
        <header className="bar">
          <span className="wordmark">alexander lehnbom</span>
          <nav className="bar-links">
            <a
              href={STRAVA}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-link"
              aria-label="Strava"
            >
              <FaStrava />
            </a>
            <a
              href={LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-link"
              aria-label="LinkedIn"
            >
              <BiLogoLinkedinSquare />
            </a>
            <a className="ghost-button" href={MAILTO}>
              <HiOutlineMail />
              <span>contact</span>
            </a>
          </nav>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">{HERO.role}</h1>
          <p className="hero-pitch">{HERO.pitch}</p>
          <div className="hero-actions">
            <a className="solid-button" href="#work">
              see my work <HiArrowDown />
            </a>
            {RESUME_URL && (
              <a className="ghost-button" href={RESUME_URL} target="_blank" rel="noopener noreferrer">
                résumé
              </a>
            )}
          </div>
          {data && (
            <p className="totals">
              <strong>{fmt(data.runs)}</strong> runs · <strong>{fmt(data.km)}</strong> km ·{' '}
              <strong>{groups.length}</strong> {groups.length === 1 ? 'country' : 'countries'}
            </p>
          )}
        </section>

        {showHint && data && (
          <p className="hint" aria-hidden="true">
            <span className="hint-fine">drag to spin · click a glow to fly there</span>
            <span className="hint-coarse">swipe sideways to spin · tap a glow</span>
          </p>
        )}
      </div>

      {data && groups.length > 0 && (
        <button
          type="button"
          className="ghost-button places-toggle"
          aria-expanded={listOpen}
          aria-controls="places-panel"
          onClick={() => setListOpen((o) => !o)}
        >
          <HiOutlineLocationMarker />
          <span>places</span>
        </button>
      )}

      {listOpen && (
        <aside id="places-panel" className="places" aria-label="Places I've run">
          <div className="places-head">
            <span>places I've run</span>
            <button
              type="button"
              className="places-close"
              aria-label="Close places"
              onClick={() => setListOpen(false)}
            >
              <HiX />
            </button>
          </div>
          <div className="places-scroll">
            {groups.map((g) => (
              <section key={g.country} className="places-group">
                <h2>{g.country}</h2>
                <ul>
                  {g.places.map((p) => (
                    <li key={p.name}>
                      <button type="button" onClick={() => flyTo(p)}>
                        <span className="places-name">{shortName(p.name, g.country)}</span>
                        <span className="places-stats">
                          {fmt(p.runs)} · {fmt(p.metres / 1000)} km
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
      )}

      {place && (
        <div
          className="place-label"
          style={{ left: `${place.x}px`, top: `${place.y}px` }}
          role="status"
        >
          {place.name && <span className="place-name">{place.name}</span>}
          <span className="place-stats">
            {fmt(place.runs)} {place.runs === 1 ? 'run' : 'runs'} · {fmt(place.km)} km
          </span>
        </div>
      )}
    </div>
    <Work />
    </>
  );
}

export default App;
