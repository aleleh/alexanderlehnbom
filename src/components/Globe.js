import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { feature } from 'topojson-client';
import polyline from '@mapbox/polyline';
import landTopo from 'world-atlas/land-110m.json';

const RADIUS = 1;
// Bright: at full-globe scale the routes occupy a few pixels, and
// additive blending turns that cluster into a visible glow.
const ROUTE_OPACITY = 0.9;

// Cochrane, AB — the city on Alex's Strava profile. Used only to aim
// the opening view; everything drawn on the globe comes from the route
// data itself, not from a hand-written list of places.
const HOME = { lat: 51.19, lng: -114.47 };

// Real Natural Earth coastlines, not an approximation of them.
const LAND = feature(landTopo, landTopo.objects.land);

const TEX_W = 2048;
const TEX_H = 1024;

const latLngToVector3 = (lat, lng, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

// ── Procedural surface detail ────────────────────────────────
// No satellite imagery is fetched (the page ships no external assets),
// so the variation is generated: value noise for mottling, latitude for
// climate bands. A single flat fill reads as plastic; this gives the
// land something to catch the light.
// Math.imul throughout: the usual `n * n * 15731` formulation silently
// overflows into float arithmetic in JS and loses the low bits, which
// made this return a near-constant — the noise had a standard deviation
// of zero and the whole planet came out one flat green.
const lattice = (ix, iy, seed) => {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 362437);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Bilinear value noise, wrapping in x so the texture has no seam.
const valueNoise = (fx, fy, cols, seed) => {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const wrap = (v) => ((v % cols) + cols) % cols;
  const a = lattice(wrap(x0), y0, seed);
  const b = lattice(wrap(x0 + 1), y0, seed);
  const c = lattice(wrap(x0), y0 + 1, seed);
  const d = lattice(wrap(x0 + 1), y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

const fbm = (u, v, baseCols, seed) => {
  let sum = 0;
  let amp = 0.5;
  let cols = baseCols;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(u * cols, v * (cols / 2), cols, seed + o) * amp;
    amp *= 0.5;
    cols *= 2;
  }
  return sum;
};

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const buildEarthTexture = () => {
  // Land is rasterised to a mask first so every pixel can ask "land or
  // ocean?" while the colour is computed procedurally.
  const mask = document.createElement('canvas');
  mask.width = TEX_W;
  mask.height = TEX_H;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, TEX_W, TEX_H);

  // Longitudes are unwrapped so a ring crossing the antimeridian stays
  // continuous instead of snapping from +180 to -180. Left as-is, that
  // snap draws a straight horizontal line across the whole texture,
  // which wraps onto the sphere as a false latitude circle.
  const trace = (ring, offsetPx) => {
    let prev = null;
    let wrap = 0;
    ring.forEach(([lng, lat], i) => {
      if (prev !== null) {
        const d = lng - prev;
        if (d > 180) wrap -= 360;
        else if (d < -180) wrap += 360;
      }
      prev = lng;
      const x = ((lng + wrap + 180) / 360) * TEX_W + offsetPx;
      const y = ((90 - lat) / 180) * TEX_H;
      if (i === 0) mctx.moveTo(x, y);
      else mctx.lineTo(x, y);
    });
    mctx.closePath();
  };

  mctx.beginPath();
  // Drawn three times so shapes that run off one edge reappear on the
  // other rather than being clipped.
  [-TEX_W, 0, TEX_W].forEach((offsetPx) => {
    LAND.features.forEach((f) => {
      const { type, coordinates } = f.geometry;
      if (type === 'Polygon') coordinates.forEach((r) => trace(r, offsetPx));
      else if (type === 'MultiPolygon') {
        coordinates.forEach((poly) => poly.forEach((r) => trace(r, offsetPx)));
      }
    });
  });
  mctx.fillStyle = '#fff';
  mctx.fill('evenodd');
  const maskData = mctx.getImageData(0, 0, TEX_W, TEX_H).data;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(TEX_W, TEX_H);

  // Height data doubles as a bump map. Colour variation alone still
  // reads as one flat green from a distance — it takes relief shading
  // for the surface to look like terrain rather than paint.
  const bump = document.createElement('canvas');
  bump.width = TEX_W;
  bump.height = TEX_H;
  const bctx = bump.getContext('2d');
  const bumpOut = bctx.createImageData(TEX_W, TEX_H);

  for (let y = 0; y < TEX_H; y++) {
    const v = y / TEX_H;
    const lat = 90 - v * 180;
    const absLat = Math.abs(lat);

    for (let x = 0; x < TEX_W; x++) {
      const u = x / TEX_W;
      const i = (y * TEX_W + x) * 4;
      const land = maskData[i] > 128;

      let r;
      let g;
      let b;
      let height;

      if (land) {
        // Two scales: broad regions, plus fine detail so it holds up
        // when you zoom in.
        const broad = fbm(u, v, 7, 1);
        const fine = fbm(u, v, 28, 13);
        const relief = clamp01(broad * 0.75 + fine * 0.45);
        const arid = fbm(u, v, 4, 7);

        // Vegetation vs rock, driven by the noise rather than latitude
        // alone — this is what breaks up the single-green look.
        let br = mix(0.10, 0.32, clamp01(relief * 1.5));
        let bg = mix(0.28, 0.50, clamp01(relief * 1.2));
        let bb = mix(0.12, 0.24, clamp01(relief * 1.3));

        // Deserts through the arid latitudes, widened and strengthened.
        const desert = clamp01(1 - Math.abs(absLat - 26) / 18) * clamp01(arid * 2.0 - 0.45);
        br = mix(br, 0.60, desert);
        bg = mix(bg, 0.50, desert);
        bb = mix(bb, 0.30, desert);

        const tropic = clamp01(1 - absLat / 16);
        br = mix(br, 0.13, tropic * 0.75);
        bg = mix(bg, 0.34, tropic * 0.75);
        bb = mix(bb, 0.14, tropic * 0.75);

        // Ice from ~68 degrees. Deliberately below the bloom threshold:
        // at full white the caps bloomed into a spotlight at the pole.
        const ice = clamp01((absLat - 68) / 12);
        br = mix(br, 0.62, ice);
        bg = mix(bg, 0.67, ice);
        bb = mix(bb, 0.73, ice);

        // Wide multiplier so highlands and lowlands read differently.
        const shade = 0.7 + relief * 0.62;
        r = br * shade;
        g = bg * shade;
        b = bb * shade;
        height = relief;
      } else {
        const n = fbm(u, v, 6, 3);
        const shade = 0.8 + n * 0.45;
        r = 0.06 * shade;
        g = 0.17 * shade;
        b = 0.31 * shade;

        const ice = clamp01((absLat - 74) / 11);
        r = mix(r, 0.54, ice);
        g = mix(g, 0.6, ice);
        b = mix(b, 0.68, ice);
        // Oceans stay flat so only continents catch relief.
        height = 0.5;
      }

      out.data[i] = r * 255;
      out.data[i + 1] = g * 255;
      out.data[i + 2] = b * 255;
      out.data[i + 3] = 255;

      const h = height * 255;
      bumpOut.data[i] = h;
      bumpOut.data[i + 1] = h;
      bumpOut.data[i + 2] = h;
      bumpOut.data[i + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  bctx.putImageData(bumpOut, 0, 0);


  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
};

// Density heatmap of every GPS point, baked into an equirectangular
// texture that overlays the globe with additive blending.
//
// Built on a coarse float grid rather than by drawing ~170k radial
// gradients: accumulate, blur, then colourise. Same result, and it
// runs in milliseconds instead of locking the main thread.
const HEAT_W = 1024;
const HEAT_H = 512;

// Colour ramp, cold to hot. Alpha climbs with intensity so empty ocean
// stays fully transparent.
const HEAT_RAMP = [
  { t: 0.0, c: [10, 12, 60], a: 0 },
  { t: 0.12, c: [62, 24, 140], a: 0.55 },
  { t: 0.32, c: [150, 30, 150], a: 0.78 },
  { t: 0.55, c: [226, 62, 47], a: 0.9 },
  { t: 0.78, c: [255, 150, 30], a: 0.96 },
  { t: 1.0, c: [255, 240, 170], a: 1 },
];

const sampleRamp = (t) => {
  for (let i = 1; i < HEAT_RAMP.length; i++) {
    const b = HEAT_RAMP[i];
    if (t <= b.t || i === HEAT_RAMP.length - 1) {
      const a = HEAT_RAMP[i - 1];
      const k = Math.min(Math.max((t - a.t) / (b.t - a.t), 0), 1);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * k,
        a.c[1] + (b.c[1] - a.c[1]) * k,
        a.c[2] + (b.c[2] - a.c[2]) * k,
        a.a + (b.a - a.a) * k,
      ];
    }
  }
  return [0, 0, 0, 0];
};

// Separable box blur — a few passes approximate a gaussian closely
// enough and keep the cost linear.
const blurGrid = (grid, w, h, radius, passes) => {
  let src = grid;
  let dst = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let d = -radius; d <= radius; d++) {
          // Wrap in longitude so the heat doesn't seam at the antimeridian
          const xx = (x + d + w) % w;
          sum += src[y * w + xx];
          n++;
        }
        dst[y * w + x] = sum / n;
      }
    }
    [src, dst] = [dst, src];
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sum = 0;
        let n = 0;
        for (let d = -radius; d <= radius; d++) {
          const yy = Math.min(h - 1, Math.max(0, y + d));
          sum += src[yy * w + x];
          n++;
        }
        dst[y * w + x] = sum / n;
      }
    }
    [src, dst] = [dst, src];
  }
  return src;
};

const buildHeatTexture = (points) => {
  let grid = new Float32Array(HEAT_W * HEAT_H);

  points.forEach(([lat, lng]) => {
    const x = Math.floor(((lng + 180) / 360) * HEAT_W);
    const y = Math.floor(((90 - lat) / 180) * HEAT_H);
    if (x < 0 || x >= HEAT_W || y < 0 || y >= HEAT_H) return;
    grid[y * HEAT_W + x] += 1;
  });

  // Four passes: a single box blur leaves visibly square hot spots,
  // and three or more passes converge on a gaussian.
  grid = blurGrid(grid, HEAT_W, HEAT_H, 4, 4);

  // Log scale: Cochrane has ~15x the samples of Costa Rica, and on a
  // linear ramp every travel run would vanish next to it.
  let max = 0;
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.log1p(grid[i]);
    if (grid[i] > max) max = grid[i];
  }

  const canvas = document.createElement('canvas');
  canvas.width = HEAT_W;
  canvas.height = HEAT_H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(HEAT_W, HEAT_H);

  for (let i = 0; i < grid.length; i++) {
    const t = max > 0 ? grid[i] / max : 0;
    if (t <= 0.005) continue;
    const [r, g, b, a] = sampleRamp(Math.min(t * 1.35, 1));
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// Inverse of latLngToVector3, for turning a click on the globe back
// into coordinates.
const vector3ToLatLng = (v) => {
  const lat = 90 - (Math.acos(THREE.MathUtils.clamp(v.y / v.length(), -1, 1)) * 180) / Math.PI;
  let lng = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return [lat, lng];
};

// ─────────────────────────────────────────────────────────────
// EDIT ME — names for the places the route data lands in.
// These are read off the coordinates the clusters fall on, not from
// any record of where Alex actually was, so a few are the nearest
// recognisable town rather than the exact spot. Correct freely; any
// cluster without a match within ~0.8 degrees just shows no name.
// ─────────────────────────────────────────────────────────────
const PLACE_NAMES = [
  // Alberta
  { lat: 51.16, lng: -114.49, name: 'Cochrane, AB' },
  { lat: 51.07, lng: -114.11, name: 'Calgary, AB' },
  { lat: 51.09, lng: -115.34, name: 'Canmore, AB' },
  { lat: 51.16, lng: -115.56, name: 'Banff, AB' },
  { lat: 49.73, lng: -112.85, name: 'Lethbridge, AB' },
  { lat: 53.29, lng: -110.64, name: 'Vermilion, AB' },
  // British Columbia
  { lat: 49.03, lng: -119.48, name: 'Osoyoos, BC' },
  { lat: 49.07, lng: -119.71, name: 'Oliver, BC' },
  { lat: 49.17, lng: -122.66, name: 'Surrey, BC' },
  // Prairies
  { lat: 52.12, lng: -106.66, name: 'Saskatoon, SK' },
  { lat: 50.78, lng: -101.29, name: 'Russell, MB' },
  { lat: 49.78, lng: -94.46, name: 'Kenora, ON' },
  // Southern Ontario
  { lat: 43.44, lng: -79.7, name: 'Oakville, ON' },
  { lat: 43.65, lng: -79.42, name: 'Toronto, ON' },
  { lat: 43.62, lng: -79.53, name: 'Etobicoke, ON' },
  { lat: 43.0, lng: -81.26, name: 'London, ON' },
  { lat: 44.31, lng: -79.44, name: 'Innisfil, ON' },
  { lat: 44.8, lng: -79.7, name: 'Georgian Bay, ON' },
  { lat: 44.54, lng: -80.35, name: 'Collingwood, ON' },
  { lat: 44.72, lng: -78.34, name: 'Kawartha Lakes, ON' },
  { lat: 44.46, lng: -76.59, name: 'Rideau Lakes, ON' },
  { lat: 44.23, lng: -76.49, name: 'Kingston, ON' },
  { lat: 45.37, lng: -75.73, name: 'Ottawa, ON' },
  // Quebec + Atlantic
  { lat: 45.5, lng: -73.59, name: 'Montréal, QC' },
  { lat: 45.89, lng: -74.16, name: 'Laurentides, QC' },
  { lat: 45.91, lng: -74.18, name: 'Saint-Sauveur, QC' },
  { lat: 44.54, lng: -64.32, name: 'Nova Scotia' },
  // United States
  { lat: 33.68, lng: -112.01, name: 'Phoenix, AZ' },
  { lat: 40.74, lng: -73.99, name: 'New York, NY' },
  // Sweden
  { lat: 60.71, lng: 17.2, name: 'Gävle, Sweden' },
  { lat: 60.69, lng: 17.1, name: 'Gävle, Sweden' },
  { lat: 59.41, lng: 18.0, name: 'Stockholm, Sweden' },
  // Rest of Europe
  { lat: 52.36, lng: 4.91, name: 'Amsterdam, Netherlands' },
  // Latin America + Caribbean
  { lat: 20.52, lng: -86.94, name: 'Cozumel, Mexico' },
  { lat: 21.81, lng: -72.16, name: 'Providenciales, Turks & Caicos' },
  { lat: 19.63, lng: -69.9, name: 'Samaná, Dominican Republic' },
  { lat: 10.06, lng: -84.25, name: 'Alajuela, Costa Rica' },
  { lat: 9.32, lng: -83.96, name: 'Puntarenas, Costa Rica' },
  { lat: 8.58, lng: -79.79, name: 'Panamá' },
  { lat: -12.12, lng: -77.04, name: 'Lima, Peru' },
  { lat: -13.51, lng: -71.98, name: 'Cusco, Peru' },
  // Morocco
  { lat: 33.6, lng: -7.64, name: 'Casablanca, Morocco' },
  { lat: 31.64, lng: -8.01, name: 'Marrakesh, Morocco' },
  { lat: 30.53, lng: -9.69, name: 'Agadir, Morocco' },
  { lat: 35.16, lng: -5.27, name: 'Chefchaouen, Morocco' },
  // Japan
  { lat: 35.72, lng: 139.78, name: 'Tokyo, Japan' },
  { lat: 35.36, lng: 139.57, name: 'Kamakura, Japan' },
  { lat: 34.78, lng: 135.61, name: 'Osaka, Japan' },
];

const nameFor = (lat, lng) => {
  let best = null;
  let bestDist = Infinity;
  PLACE_NAMES.forEach((p) => {
    const dLat = p.lat - lat;
    const dLng = (((p.lng - lng + 540) % 360) - 180) * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(dLat, dLng);
    if (d < bestDist) {
      bestDist = d;
      best = p.name;
    }
  });
  return bestDist < 0.8 ? best : null;
};

// Groups the routes into the places they were run, and totals runs and
// distance for each so a hovered hot spot can say what it actually is.
// Distance comes from Strava's own per-activity figure; measuring the
// trimmed polyline would understate every run by ~800m.
const clusterRoutes = (decoded, distances) => {
  const CELL_DEG = 0.6; // ~65km
  const cells = new Map();

  decoded.forEach((pts) => {
    pts.forEach(([lat, lng]) => {
      const key = `${Math.round(lat / CELL_DEG)}:${Math.round(lng / CELL_DEG)}`;
      const cell = cells.get(key) || { lat: 0, lng: 0, n: 0 };
      cell.lat += lat;
      cell.lng += lng;
      cell.n += 1;
      cells.set(key, cell);
    });
  });

  const clusters = [...cells.values()]
    .filter((c) => c.n >= 40)
    .map((c) => ({
      lat: c.lat / c.n,
      lng: c.lng / c.n,
      n: c.n,
      runs: 0,
      metres: 0,
    }))
    .sort((a, b) => b.n - a.n);

  // Each route counts once, against whichever cluster its centre is
  // nearest — otherwise a single run spanning two cells is double
  // counted.
  decoded.forEach((pts, i) => {
    let sumLat = 0;
    let sumLng = 0;
    pts.forEach(([lat, lng]) => {
      sumLat += lat;
      sumLng += lng;
    });
    const cLat = sumLat / pts.length;
    const cLng = sumLng / pts.length;

    let best = null;
    let bestDist = Infinity;
    clusters.forEach((c) => {
      const dLat = c.lat - cLat;
      const dLng = (((c.lng - cLng + 540) % 360) - 180) * Math.cos((cLat * Math.PI) / 180);
      const d = Math.hypot(dLat, dLng);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    });
    if (best && bestDist < 2) {
      best.runs += 1;
      best.metres += distances[i] || 0;
    }
  });

  return clusters
    .filter((c) => c.runs > 0)
    .map((c) => ({ ...c, name: nameFor(c.lat, c.lng) }));
};

const Globe = ({ onHoverPlace }) => {
  const mountRef = useRef(null);
  // Held in a ref so the scene effect never has to re-run when the
  // parent re-renders.
  const hoverCbRef = useRef(onHoverPlace);
  useEffect(() => {
    hoverCbRef.current = onHoverPlace;
  }, [onHoverPlace]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    // near must be tiny: the globe has radius 1, so a default near of
    // 0.1 would clip everything within ~640km of the surface and make
    // close zoom impossible.
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.0015, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);

    // Bloom, so the hot spots actually emit light instead of just being
    // bright pixels. The threshold is high enough that only the heat
    // layer and the atmospheric rim pass it — the land stays crisp.
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(mount.clientWidth, mount.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(mount.clientWidth, mount.clientHeight),
        0.85, // strength
        0.55, // radius
        0.72 // threshold — keeps land and ice out of the bloom
      )
    );
    mount.appendChild(renderer.domElement);

    let atmosphere = null;
    // Populated once the routes load; used only for click targeting.
    let clusters = [];

    // Heat and routes trade places with distance: the heatmap is what
    // you can read from orbit, the individual traces are what you can
    // read up close, and showing both at once is mud. These are applied
    // on creation too, so a tab loading in the background still paints
    // a correct first frame instead of a blank globe.
    const heatTargetFor = (dist) => THREE.MathUtils.clamp((dist - 1.35) / 0.55, 0, 1);
    const routeTargetFor = (dist) =>
      ROUTE_OPACITY * THREE.MathUtils.clamp((1.95 - dist) / 0.5, 0.22, 1);

    // Limits are expressed as camera distance, not as a zoom factor:
    // the framing distance changes with viewport shape, so a fixed zoom
    // floor would put the camera inside the globe on some screens.
    const MIN_DIST = 1.026; // ~0.026 above a radius-1 surface, ~170km across

    // Centred with room around it. Narrow screens pull back further
    // because the globe is width-limited in portrait.
    const baseDistance = () => {
      const aspect = mount.clientWidth / mount.clientHeight;
      return aspect > 1.1 ? 3.8 : 3.8 / Math.min(aspect, 1);
    };
    // Relative to the framing distance, not absolute: a fixed ceiling
    // clamps portrait framing before it can pull back far enough and
    // crops the globe against the viewport edges.
    const maxDistance = () => baseDistance() * 1.45;

    let zoom = 1;
    const frameCamera = () => {
      // A zero-sized container makes aspect 0/0, and that NaN propagates
      // into the camera distance and the projection matrix, blanking the
      // scene permanently. Happens whenever the globe mounts before
      // layout or inside a collapsed/hidden pane; the ResizeObserver
      // below re-frames it once real dimensions arrive.
      if (!mount.clientWidth || !mount.clientHeight) return;

      const aspect = mount.clientWidth / mount.clientHeight;
      const distance = THREE.MathUtils.clamp(baseDistance() * zoom, MIN_DIST, maxDistance());
      camera.position.set(0, 0, distance);
      world.position.set(0, 0, 0);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      const close = distance < 1.35;
      if (atmosphere) atmosphere.visible = !close;
    };

    const world = new THREE.Group();

    // Open facing home. Almost all the route data sits within ~50km of
    // Cochrane, so a default orientation anywhere else shows an empty
    // ocean and the runs appear to be missing.
    world.quaternion.setFromUnitVectors(
      latLngToVector3(HOME.lat, HOME.lng, 1).normalize(),
      new THREE.Vector3(0, 0, 1)
    );
    world.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.18)
    );

    scene.add(world);
    frameCamera();

    // ── The earth ────────────────────────────────────────────
    const { map: earthTexture, bumpMap: earthBump } = buildEarthTexture();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    earthTexture.anisotropy = maxAniso;
    earthBump.anisotropy = maxAniso;
    // Lit rather than flat-shaded: a real light source gives the globe a
    // terminator and a bright limb, which is most of what separates a
    // planet from a coloured ball.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 128, 96),
      new THREE.MeshStandardMaterial({
        map: earthTexture,
        bumpMap: earthBump,
        bumpScale: 1.6,
        roughness: 0.95,
        metalness: 0,
      })
    );
    world.add(core);

    const sun = new THREE.DirectionalLight(0xfff4e6, 3.1);
    sun.position.set(-0.75, 0.85, 3.0);
    scene.add(sun);
    // Keeps the night side readable instead of crushing it to black.
    scene.add(new THREE.AmbientLight(0x486a8c, 2.4));

    // Vector coastlines on top of the texture: they stay crisp at any
    // zoom, where the raster starts to blur.
    const coastMat = new THREE.LineBasicMaterial({
      color: 0x6f9fbd,
      transparent: true,
      opacity: 0.35,
    });
    // Rings are split wherever they cross the antimeridian. Joining a
    // point at lng 179 to one at lng -179 draws a chord the long way
    // round the sphere, which was throwing giant arcs across the Arctic
    // between Siberia and Alaska.
    const addRing = (ring) => {
      if (ring.length < 2) return;
      const closed = [...ring, ring[0]];
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(run), coastMat));
        }
        run = [];
      };

      closed.forEach(([lng, lat], i) => {
        if (i > 0 && Math.abs(lng - closed[i - 1][0]) > 180) flush();
        run.push(latLngToVector3(lat, lng, RADIUS * 1.0015));
      });
      flush();
    };
    LAND.features.forEach((f) => {
      const { type, coordinates } = f.geometry;
      if (type === 'Polygon') coordinates.forEach(addRing);
      else if (type === 'MultiPolygon') coordinates.forEach((poly) => poly.forEach(addRing));
    });

    // Atmospheric glow.
    //
    // A fresnel term is the usual trick, but on a shell it peaks at that
    // shell's own silhouette and then stops dead — which is precisely a
    // hard ring. Instead each fragment measures how far its view ray
    // passes from the globe's centre (the impact parameter) and fades
    // exponentially with distance outside the surface. The result is
    // brightest where it touches the planet and dissolves outward, with
    // no edge of its own.
    //
    // The shell is deliberately much larger than the falloff so the glow
    // has already reached zero long before its geometry ends.
    atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.9, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x5aa9f5) },
          uFalloff: { value: 6.5 },
          uStrength: { value: 0.5 },
          uRadius: { value: RADIUS },
        },
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uFalloff;
          uniform float uStrength;
          uniform float uRadius;
          varying vec3 vWorld;
          void main() {
            vec3 dir = normalize(vWorld - cameraPosition);
            vec3 toCentre = -cameraPosition;
            // Closest approach of this view ray to the globe's centre.
            float along = dot(toCentre, dir);
            float impact = length(toCentre - along * dir);
            // How far outside the surface that ray passes.
            float outside = max(impact - uRadius, 0.0);
            float a = exp(-outside * uFalloff) * uStrength;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    );
    world.add(atmosphere);

    // ── Starfield ────────────────────────────────────────────
    const starPts = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2)
      );
      if (v.length() < 0.2) continue;
      starPts.push(v.normalize().multiplyScalar(THREE.MathUtils.randFloat(6, 18)));
    }
    scene.add(
      new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(starPts),
        new THREE.PointsMaterial({ color: 0x8899aa, size: 0.035, transparent: true, opacity: 0.7 })
      )
    );

    // ── Routes + heatmap ─────────────────────────────────────
    let routeMesh = null;
    let disposed = false;
    let heatMesh = null;

    import('../stravaRoutes.json')
      .then(({ default: routeData }) => {
        if (disposed || !routeData.routes.length) return;
        const precision = routeData.precision || 5;

        // Decode once and reuse for the lines, the heatmap and the
        // click targets — decoding 678 polylines three times would be
        // the slowest thing on the page.
        const decoded = routeData.routes.map((r) => polyline.decode(r.p, precision));
        const distances = routeData.routes.map((r) => r.d || 0);

        const verts = [];
        decoded.forEach((pts) => {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = latLngToVector3(pts[i][0], pts[i][1], RADIUS * 1.0028);
            const b = latLngToVector3(pts[i + 1][0], pts[i + 1][1], RADIUS * 1.0028);
            verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        });
        const routeGeo = new THREE.BufferGeometry();
        routeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        routeMesh = new THREE.LineSegments(
          routeGeo,
          new THREE.LineBasicMaterial({
            color: 0xffb27a,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        world.add(routeMesh);

        // ── Heatmap ──────────────────────────────────────────
        const allPoints = [];
        decoded.forEach((pts) => pts.forEach((p) => allPoints.push(p)));
        const heatTexture = buildHeatTexture(allPoints);

        const heatMat = new THREE.MeshBasicMaterial({
          map: heatTexture,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        // Hugs the surface. Anything meaningfully above it detaches at
        // the limb and reads as blobs hovering off the horizon — which
        // is what a second, larger copy of this texture used to do
        // before UnrealBloomPass made it unnecessary.
        heatMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.0015, 128, 96), heatMat);
        world.add(heatMesh);

        // Clusters are no longer drawn — they're only click targets now.
        clusters = clusterRoutes(decoded, distances);

        const d0 = camera.position.z;
        heatMesh.material.opacity = heatTargetFor(d0);
        routeMesh.material.opacity = routeTargetFor(d0);

        frameCamera();
      })
      .catch((err) => console.error('Failed to load routes', err));

    // ── Drag to spin ─────────────────────────────────────────
    const AXIS_Y = new THREE.Vector3(0, 1, 0);
    const AXIS_X = new THREE.Vector3(1, 0, 0);
    const spinBy = (angle, axis) => {
      world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    };

    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;
    let lastY = 0;
    let velocity = 0;
    let fly = null;

    const onPointerDown = (e) => {
      dragging = true;
      dragMoved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      velocity = dx * 0.005;
      fly = null;
      spinBy(velocity, AXIS_Y);
      spinBy(dy * 0.004, AXIS_X);
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const surfaceUnderPointer = (e) => {
      setPointer(e);
      const hits = raycaster.intersectObject(core, false);
      if (!hits.length) return null;
      return hits[0].point.clone().sub(world.position).normalize();
    };
    // With the pins gone, click targets come from the cluster list:
    // find the hottest place near wherever the globe was clicked.
    const clusterUnderPointer = (e) => {
      if (!clusters.length) return null;
      const dirWorld = surfaceUnderPointer(e);
      if (!dirWorld) return null;
      const local = dirWorld.clone().applyQuaternion(world.quaternion.clone().invert());
      const [lat, lng] = vector3ToLatLng(local);

      let best = null;
      let bestDist = Infinity;
      clusters.forEach((c) => {
        const dLat = c.lat - lat;
        const dLng = (((c.lng - lng + 540) % 360) - 180) * Math.cos((lat * Math.PI) / 180);
        const d = Math.hypot(dLat, dLng);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      });
      return bestDist < 4 ? best : null;
    };

    // Animates the globe so a place rotates to face the camera while
    // the camera closes in — the fastest way from "somewhere I ran" to
    // reading the actual streets.
    const flyToDirection = (dirWorld, targetZoom) => {
      const centre = camera.position.clone().sub(world.position).normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(dirWorld, centre);
      fly = { quat: delta.multiply(world.quaternion.clone()), zoom: targetZoom };
    };

    // Where a cluster currently sits on screen, so the label can be
    // anchored to the hot spot rather than trailing the cursor.
    const screenPositionOf = (c) => {
      const p = latLngToVector3(c.lat, c.lng, RADIUS)
        .applyQuaternion(world.quaternion)
        .add(world.position)
        .project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((p.x + 1) / 2) * rect.width,
        y: ((1 - p.y) / 2) * rect.height,
      };
    };

    const report = (c) => {
      if (!hoverCbRef.current) return;
      if (!c) {
        hoverCbRef.current(null);
        return;
      }
      const { x, y } = screenPositionOf(c);
      hoverCbRef.current({
        name: c.name,
        runs: c.runs,
        km: c.metres / 1000,
        x,
        y,
      });
    };

    const onClick = (e) => {
      if (dragMoved > 6) return; // that was a drag, not a click
      const c = clusterUnderPointer(e);
      if (!c) return;
      // Also reports on click so the label is reachable on touch, where
      // there is no hover.
      report(c);
      const dir = latLngToVector3(c.lat, c.lng, 1)
        .applyQuaternion(world.quaternion)
        .normalize();
      flyToDirection(dir, MIN_DIST / baseDistance());
    };

    const onHover = (e) => {
      if (dragging) return;
      const c = clusterUnderPointer(e);
      renderer.domElement.style.cursor = c ? 'pointer' : 'grab';
      report(c);
    };

    const onLeave = () => report(null);

    const onWheel = (e) => {
      e.preventDefault();
      fly = null;
      const factor = THREE.MathUtils.clamp(1 + e.deltaY * 0.0012, 0.9, 1.12);
      const before = zoom;
      const base = baseDistance();
      zoom = THREE.MathUtils.clamp(zoom * factor, MIN_DIST / base, 1.45);
      if (zoom === before) return;

      // Zooming in rotates whatever is under the cursor towards the
      // centre of view, so you close in on the place you're pointing at
      // instead of always diving at the middle of the globe.
      if (zoom < before) {
        const hit = surfaceUnderPointer(e);
        if (hit) {
          const centre = camera.position.clone().sub(world.position).normalize();
          const delta = new THREE.Quaternion().setFromUnitVectors(hit, centre);
          const target = delta.multiply(world.quaternion.clone());
          const strength = THREE.MathUtils.clamp((1 - zoom / before) * 2.5, 0, 0.5);
          world.quaternion.slerp(target, strength);
        }
      }
      frameCamera();
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('pointermove', onHover);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      frameCamera();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Catches the container gaining size after mount, which a window
    // resize listener alone would miss.
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // ── Loop ─────────────────────────────────────────────────
    let frame;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const ease = (rate) => 1 - Math.exp(-delta * rate);

      if (fly) {
        world.quaternion.slerp(fly.quat, ease(3.5));
        zoom += (fly.zoom - zoom) * ease(3.0);
        frameCamera();
        if (Math.abs(zoom - fly.zoom) < 0.002 && world.quaternion.angleTo(fly.quat) < 0.01) {
          fly = null;
        }
      } else if (!dragging) {
        if (Math.abs(velocity) > 0.0002) {
          spinBy(velocity * delta * 60, AXIS_Y);
          velocity *= Math.exp(-delta * 3.7);
        } else if (!prefersReduced && zoom > 0.9) {
          // Only idles when zoomed out; drifting while someone is
          // reading their own streets would be maddening.
          spinBy(0.045 * delta, AXIS_Y);
        }
      }

      const dist = camera.position.z;
      const heatTarget = heatTargetFor(dist);
      const routeTarget = routeTargetFor(dist);

      if (heatMesh) {
        const k = ease(3);
        heatMesh.material.opacity += (heatTarget - heatMesh.material.opacity) * k;
      }
      if (routeMesh) {
        routeMesh.material.opacity += (routeTarget - routeMesh.material.opacity) * ease(2.5);
      }

      composer.render();
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('pointermove', onHover);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      earthTexture.dispose();
      earthBump.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="globe-canvas" ref={mountRef} />;
};

export default Globe;
