import React, { useCallback, useState } from 'react';
import { BiLogoLinkedinSquare } from 'react-icons/bi';
import { FaStrava } from 'react-icons/fa';
import { HiOutlineMail } from 'react-icons/hi';
import Globe from './components/Globe';

const EMAIL = 'alexander.lehnbom@gmail.com';
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('hello from alexanderlehnbom.com')}`;

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function App() {
  const [place, setPlace] = useState(null);

  // Stable identity so the globe's scene effect is never torn down.
  const handleHoverPlace = useCallback((info) => setPlace(info), []);

  return (
    <div className="stage">
      <Globe onHoverPlace={handleHoverPlace} />

      <div className="overlay">
        <header className="bar">
          <span className="wordmark">alexander lehnbom</span>
          <nav className="bar-links">
            <a
              href="https://www.strava.com/athletes/alexlehnbom"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-link"
              aria-label="Strava"
            >
              <FaStrava />
            </a>
            <a
              href="https://www.linkedin.com/in/alehnbom/"
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
      </div>

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
  );
}

export default App;
