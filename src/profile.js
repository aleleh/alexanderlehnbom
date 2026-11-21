// ─────────────────────────────────────────────────────────────
// EDIT ME — everything a recruiter reads on the page lives here.
// Anything in [square brackets] is a placeholder that still needs
// your real details. Sections with an empty list are hidden.
// ─────────────────────────────────────────────────────────────

export const EMAIL = 'alexander.lehnbom@gmail.com';
export const LINKEDIN = 'https://www.linkedin.com/in/alehnbom/';
export const STRAVA = 'https://www.strava.com/athletes/alexlehnbom';
export const GITHUB = 'https://github.com/aleleh';
export const REPO = 'https://github.com/aleleh/alexanderlehnbom';

// Drop a PDF at public/resume.pdf and set this to '/resume.pdf'.
// While it is null, the résumé buttons are hidden.
export const RESUME_URL = null;

export const HERO = {
  role: 'Developer & tech support specialist',
  pitch:
    'I build web apps with React and Node.js, and I’m the person teams call when something breaks. The globe behind this text is every run I’ve logged, drawn from Strava data I pipe in myself.',
};

export const ABOUT = {
  photo: '/alex.jpg',
  photoAlt: 'Alexander running a trail race',
  paragraphs: [
    'Hi, I’m Alex. I work where support and development meet: I like taking a problem someone is stuck on, finding the real cause, and shipping the fix, whether that’s a config, a script or a feature.',
    'Outside work I run. A lot. The globe at the top of this page is my training history, and building it was the most fun I’ve had with code in a while.',
  ],
  location: 'Cochrane, Alberta',
  openTo: '[What you’re looking for, e.g. “Open to full-stack or support engineering roles, remote or Calgary”]',
};

// The globe itself, written up as a case study. It is the strongest
// proof of skill on the page, so it gets the most room.
export const FEATURED = {
  title: 'This site: every run on one globe',
  summary:
    'A WebGL globe that turns every run I’ve logged on Strava into a heatmap you can spin, zoom and fly around, built with React and three.js and deployed on every merge.',
  points: [
    'A build-time Node.js pipeline pulls every run from the Strava API, so the secret never reaches the browser and visitors never hit Strava’s rate limits.',
    'Privacy by design: the first and last 400 m of every route are cut off before anything is written to disk, so no trace points at home.',
    'Routes are re-encoded as compact polylines, halving the download, then decoded once and reused for lines, heatmap and click targets.',
    'The heatmap is accumulated on a float grid and blurred with a separable box blur in milliseconds instead of drawing 170,000 gradients.',
    'Zoom in on a city and a sharper coastline is loaded on demand and drawn as a regional patch, so the globe stays crisp from orbit to street level.',
    'GitHub Actions builds every pull request to a Firebase preview link and ships to production on merge.',
  ],
  stack: ['React', 'three.js / WebGL', 'Node.js', 'Strava API', 'GitHub Actions', 'Firebase Hosting'],
  links: [{ label: 'source on GitHub', href: REPO }],
};

export const PROJECTS = [
  {
    title: 'Investment analysis web app',
    description: 'A React web app for an investment analysis platform.',
    stack: ['React', 'Firebase'],
    href: 'https://deepstone-1eefc.web.app/',
  },
  {
    title: 'E-commerce store',
    description: 'A React storefront with product data loaded from a JSON API.',
    stack: ['React', 'REST'],
    href: 'https://e-commerce-store-rwkdt95lx-alexs-projects-952b1d70.vercel.app/',
  },
  {
    title: 'Consultancy website',
    description: 'A company website for a consulting firm, in plain HTML, CSS and JavaScript.',
    stack: ['HTML', 'CSS', 'JavaScript'],
    href: 'https://xido.se/',
  },
];

export const SKILLS = [
  { group: 'Build', items: ['JavaScript', 'React', 'Node.js', 'three.js / WebGL', 'HTML & CSS'] },
  { group: 'Ship', items: ['Git & GitHub', 'GitHub Actions', 'Firebase', 'Vercel', 'REST APIs'] },
  { group: 'Support', items: ['Troubleshooting', 'Root-cause analysis', 'Customer communication', '[Ticketing tools you use]'] },
];

// Most recent first.
export const EXPERIENCE = [
  {
    role: '[Job title]',
    org: '[Company]',
    when: '[2023 – now]',
    detail: '[One line on what you did and the result, e.g. “Resolved 40+ tickets a week and cut repeat issues by writing internal fixes in Node.js.”]',
  },
  {
    role: '[Job title]',
    org: '[Company]',
    when: '[2021 – 2023]',
    detail: '[One line on what you did and the result.]',
  },
];
