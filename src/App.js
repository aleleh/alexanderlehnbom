import React from 'react';
import { BiLogoLinkedinSquare } from 'react-icons/bi';
import { FaStrava } from 'react-icons/fa';
import { HiOutlineMail } from 'react-icons/hi';
import Globe from './components/Globe';

const EMAIL = 'alexander.lehnbom@gmail.com';
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('hello from alexanderlehnbom.com')}`;

function App() {
  return (
    <div className="stage">
      <Globe />

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
    </div>
  );
}

export default App;
