import React from 'react';
import { BiLogoLinkedinSquare } from 'react-icons/bi';
import { FaGithub } from 'react-icons/fa';
import { HiOutlineMail, HiArrowRight, HiOutlineDocumentText } from 'react-icons/hi';
import {
  ABOUT,
  EMAIL,
  EXPERIENCE,
  FEATURED,
  GITHUB,
  LINKEDIN,
  PROJECTS,
  RESUME_URL,
  SKILLS,
} from '../profile';

const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('hello from alexanderlehnbom.com')}`;

const Chips = ({ items }) => (
  <ul className="chips">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

// Everything below the globe: the part a recruiter actually reads.
const Work = () => (
  <main id="work" className="work">
    <section className="about" aria-labelledby="about-title">
      <img className="about-photo" src={ABOUT.photo} alt={ABOUT.photoAlt} loading="lazy" />
      <div>
        <h2 id="about-title" className="eyebrow">about</h2>
        {ABOUT.paragraphs.map((p) => (
          <p key={p} className="about-text">
            {p}
          </p>
        ))}
        <p className="about-meta">
          {ABOUT.location}
          {ABOUT.openTo && <> · {ABOUT.openTo}</>}
        </p>
      </div>
    </section>

    <section className="featured" aria-labelledby="featured-title">
      <h2 className="eyebrow">featured build</h2>
      <h3 id="featured-title">{FEATURED.title}</h3>
      <p className="featured-summary">{FEATURED.summary}</p>
      <ul className="featured-points">
        {FEATURED.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <Chips items={FEATURED.stack} />
      <div className="featured-links">
        <a href="#top" className="text-link">
          try it at the top of the page
        </a>
        {FEATURED.links.map((l) => (
          <a key={l.href} href={l.href} className="text-link" target="_blank" rel="noopener noreferrer">
            {l.label} <HiArrowRight />
          </a>
        ))}
      </div>
    </section>

    {PROJECTS.length > 0 && (
      <section aria-labelledby="projects-title">
        <h2 id="projects-title" className="eyebrow">other projects</h2>
        <div className="projects">
          {PROJECTS.map((p) => (
            <a key={p.title} className="project" href={p.href} target="_blank" rel="noopener noreferrer">
              <span className="project-title">
                {p.title} <HiArrowRight />
              </span>
              <span className="project-desc">{p.description}</span>
              <Chips items={p.stack} />
            </a>
          ))}
        </div>
      </section>
    )}

    <div className="two-col">
      {EXPERIENCE.length > 0 && (
        <section aria-labelledby="exp-title">
          <h2 id="exp-title" className="eyebrow">experience</h2>
          <ol className="timeline">
            {EXPERIENCE.map((e) => (
              <li key={`${e.role}-${e.org}-${e.when}`}>
                <div className="timeline-head">
                  <span className="timeline-role">
                    {e.role} <span className="timeline-org">· {e.org}</span>
                  </span>
                  <span className="timeline-when">{e.when}</span>
                </div>
                <p>{e.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {SKILLS.length > 0 && (
        <section aria-labelledby="skills-title">
          <h2 id="skills-title" className="eyebrow">skills</h2>
          {SKILLS.map((g) => (
            <div key={g.group} className="skill-group">
              <h3>{g.group}</h3>
              <Chips items={g.items} />
            </div>
          ))}
        </section>
      )}
    </div>

    <section className="cta" aria-labelledby="cta-title">
      <h2 id="cta-title">Let’s work together.</h2>
      <p>Email is the fastest way to reach me.</p>
      <div className="cta-actions">
        <a className="solid-button" href={MAILTO}>
          <HiOutlineMail /> {EMAIL}
        </a>
        <a className="ghost-button" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
          <BiLogoLinkedinSquare /> LinkedIn
        </a>
        <a className="ghost-button" href={GITHUB} target="_blank" rel="noopener noreferrer">
          <FaGithub /> GitHub
        </a>
        {RESUME_URL && (
          <a className="ghost-button" href={RESUME_URL} target="_blank" rel="noopener noreferrer">
            <HiOutlineDocumentText /> résumé
          </a>
        )}
      </div>
    </section>

    <footer className="footer">© {new Date().getFullYear()} Alexander Lehnbom</footer>
  </main>
);

export default Work;
