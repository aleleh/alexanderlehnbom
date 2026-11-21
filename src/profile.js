// ─────────────────────────────────────────────────────────────
// EDIT ME — everything a recruiter reads on the page lives here,
// taken from the résumé in public/resume.pdf. Sections with an empty
// list are hidden.
// ─────────────────────────────────────────────────────────────

export const EMAIL = 'alexander.lehnbom@gmail.com';
export const LINKEDIN = 'https://www.linkedin.com/in/alehnbom/';
export const STRAVA = 'https://www.strava.com/athletes/alexlehnbom';
export const GITHUB = 'https://github.com/aleleh';
export const REPO = 'https://github.com/aleleh/alexanderlehnbom';

// Set to null to hide the résumé buttons.
export const RESUME_URL = '/resume.pdf';

export const HERO = {
  role: 'Support & automation manager',
  pitch:
    'I build the automation behind customer support at Shakepay: an AI agent wired into live systems, n8n workflows, automated QA and the internal tools ops runs on. The globe behind this is every run I’ve logged.',
};

// Headline numbers, shown in a row right under the globe.
export const STATS = [
  { value: '20% → 50%', label: 'support conversations resolved by our AI agent, end to end' },
  { value: '< 1 min', label: 'live chat first response time, held across the team' },
  { value: '8 years', label: 'solving technical problems in fintech, SaaS, healthcare and energy' },
  { value: '100 mi', label: 'mountain ultras I race when I’m not at a keyboard' },
];

export const ABOUT = {
  photo: '/alex.jpg',
  photoAlt: 'Alexander running a trail race',
  paragraphs: [
    'Hi, I’m Alex. My title says support manager, but most of my day is code and automation. I build the systems that let support scale without scaling headcount, and I’m the technical bridge to engineering when something breaks.',
    'Before Shakepay I did technical support for a SaaS company in Denmark, hospital hardware roll-outs for Alberta Health Services, and IT for high-security energy clients in Sweden.',
    'Outside work I’m a trail runner and race 100 km and 100 mile mountain ultras. The globe at the top of this page is that training, and building it was the most fun I’ve had with code in a while.',
  ],
  location: 'Cochrane, Alberta · working remotely',
  // e.g. 'Open to support automation and AI operations roles'. null hides it.
  openTo: null,
};

// What I've built at work. Short and outcome-first.
export const BUILDS = [
  {
    title: 'AI support agent that acts, not just answers',
    detail:
      'Rebuilt the Intercom Fin content architecture, intent routing and fallbacks, then connected the agent to backend services over API so it reads live account data and executes actions. Automated resolution went from 20% to 50%.',
    stack: ['Intercom Fin', 'REST APIs', 'Prompt design'],
  },
  {
    title: 'Automated ticket QA',
    detail:
      'Reviews support conversations automatically, replacing hours of manual QA a week, and DMs managers in Slack the moment one flags a security concern.',
    stack: ['Automation', 'Slack'],
  },
  {
    title: 'Code answers in Slack for everyone',
    detail:
      'A Cursor automation that answers questions about code and app behaviour right in Slack, so ops teams get answers without their own Cursor or GitHub seats.',
    stack: ['Cursor', 'Slack', 'GitHub'],
  },
  {
    title: 'FAQ drafting plugin',
    detail: 'A Codex plugin that drafts help-centre content and answers customer questions for the ops team.',
    stack: ['Codex', 'Help centre'],
  },
  {
    title: 'Priority inbox monitor',
    detail:
      'An n8n workflow that watches the priority queue and posts structured Slack alerts when volume spikes, replacing a person watching the queue.',
    stack: ['n8n', 'Intercom', 'Slack'],
  },
  {
    title: 'Fewer failed ID checks',
    detail:
      'Extended the Onfido identity verification flow in code to accept more submission types, cutting tickets from failed verifications.',
    stack: ['Onfido', 'JavaScript'],
  },
];

// The globe itself, written up as a side project.
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
  { group: 'Automation & AI', items: ['n8n', 'Intercom Fin', 'Cursor', 'Codex', 'Agent tooling', 'API integrations'] },
  { group: 'Development', items: ['JavaScript', 'React', 'Node.js', 'three.js', 'HTML & CSS', 'REST APIs'] },
  { group: 'Support & ops', items: ['Intercom', 'Zendesk', 'Onfido', 'Asana', 'Slack', 'Automated QA'] },
];

// Most recent first.
export const EXPERIENCE = [
  {
    role: 'Customer Support Manager, Automation & AI Operations',
    org: 'Shakepay',
    where: 'Remote, Canada',
    when: 'Dec 2023 – now',
    detail:
      'Own support automation end to end: the customer AI agent, n8n workflows, automated QA and internal AI tooling. Grew from weekend support rep to manager in under two years, and previously led a team of 7.',
  },
  {
    role: 'Technical Support Specialist',
    org: 'Superb',
    where: 'Remote, Denmark',
    when: 'May 2021 – Nov 2022',
    detail:
      'Tested web and iOS releases, reproduced and documented bugs with engineering through to the fix, handled escalations first line couldn’t, and wrote the technical help centre.',
  },
  {
    role: 'System Technician',
    org: 'Computer Upgrading Specialists',
    where: 'Calgary',
    when: 'Aug 2019 – Feb 2020',
    detail: 'Consultant to Alberta Health Services, planning and running hardware roll-outs across Calgary-area hospitals.',
  },
  {
    role: 'System Administrator / IT Support',
    org: 'Xido Group',
    where: 'Sweden',
    when: 'Dec 2017 – Mar 2019',
    detail:
      'Supported high-security energy-sector clients on site and remotely, set the company record for cases resolved in a year, and built the internal help centre from scratch.',
  },
];

export const EDUCATION = [
  { what: 'Web development (React)', where: 'Sundsgården, Sweden', when: '2022 – 2023' },
  { what: 'Web development', where: 'Johns Hopkins University Online', when: '2022' },
  { what: 'Elements of AI', where: 'Linköping University', when: '2023' },
];
