import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
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

// Paints the continents as solid landmasses on an equirectangular
// canvas, which becomes the globe's surface. This replaces the old dot
// shell: dots now mean "Alex ran here", so the land itself has to be
// drawn rather than implied by a scatter of points.
const buildEarthTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');

  // Deep ocean blue rather than near-black: with a light source above,
  // this reads as a planet instead of a dark UI sphere.
  ctx.fillStyle = '#0b2137';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Longitudes are unwrapped so a ring crossing the antimeridian stays
  // continuous instead of snapping from +180 to -180. Left as-is, that
  // snap draws a straight horizontal line across the whole texture,
  // which wraps onto the sphere as a false latitude circle — the
  // mystery rings that were sitting over the Arctic.
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
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  ctx.beginPath();
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

  ctx.fillStyle = '#2f4a38';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#5c7f63';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

const clusterRoutes = (routes, precision) => {
  const CELL_DEG = 0.6; // ~65km
  const cells = new Map();

  routes.forEach((encoded) => {
    polyline.decode(encoded, precision).forEach(([lat, lng]) => {
      const key = `${Math.round(lat / CELL_DEG)}:${Math.round(lng / CELL_DEG)}`;
      const cell = cells.get(key) || { lat: 0, lng: 0, n: 0 };
      cell.lat += lat;
      cell.lng += lng;
      cell.n += 1;
      cells.set(key, cell);
    });
  });

  return [...cells.values()]
    .filter((c) => c.n >= 40)
    .map((c) => ({ lat: c.lat / c.n, lng: c.lng / c.n, n: c.n }))
    .sort((a, b) => b.n - a.n);
};

const Globe = () => {
  const mountRef = useRef(null);

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
    const MAX_DIST = 4.3;

    // Centred and filling the frame: with the readout gone there is
    // nothing to clear, so the globe is the whole composition. Narrow
    // screens pull back because the sphere is height-limited there.
    const baseDistance = () => {
      const aspect = mount.clientWidth / mount.clientHeight;
      return aspect > 1.1 ? 2.85 : 2.85 / Math.min(aspect, 1);
    };

    let zoom = 1;
    const frameCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight;
      const distance = THREE.MathUtils.clamp(baseDistance() * zoom, MIN_DIST, MAX_DIST);
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
    const earthTexture = buildEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // Lit rather than flat-shaded: a real light source gives the globe a
    // terminator and a bright limb, which is most of what separates a
    // planet from a coloured ball.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 128, 96),
      new THREE.MeshStandardMaterial({ map: earthTexture, roughness: 1, metalness: 0 })
    );
    world.add(core);

    const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
    sun.position.set(-1.6, 1.1, 2.4);
    scene.add(sun);
    // Keeps the night side readable instead of crushing it to black.
    scene.add(new THREE.AmbientLight(0x2a3f57, 1.1));

    // Vector coastlines on top of the texture: they stay crisp at any
    // zoom, where the raster starts to blur.
    const coastMat = new THREE.LineBasicMaterial({
      color: 0x4d7a99,
      transparent: true,
      opacity: 0.5,
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

    // Atmospheric rim. Blue and tight to the surface: the old orange
    // shell read as a brown smudge around the planet rather than air.
    atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.055, 64, 48),
      new THREE.MeshBasicMaterial({
        color: 0x5fa8e8,
        transparent: true,
        opacity: 0.13,
        side: THREE.BackSide,
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
    let heatGlow = null;

    import('../stravaRoutes.json')
      .then(({ default: routeData }) => {
        if (disposed || !routeData.routes.length) return;
        const precision = routeData.precision || 5;

        // Decode once and reuse for the lines, the heatmap and the
        // click targets — decoding 678 polylines three times would be
        // the slowest thing on the page.
        const decoded = routeData.routes.map((encoded) => polyline.decode(encoded, precision));

        const verts = [];
        decoded.forEach((pts) => {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = latLngToVector3(pts[i][0], pts[i][1], RADIUS * 1.006);
            const b = latLngToVector3(pts[i + 1][0], pts[i + 1][1], RADIUS * 1.006);
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
        heatMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.003, 128, 96), heatMat);
        world.add(heatMesh);

        // A slightly larger, fainter copy fakes a bloom so the hot
        // spots bleed light past the surface.
        heatGlow = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS * 1.03, 96, 64),
          new THREE.MeshBasicMaterial({
            map: heatTexture,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        world.add(heatGlow);

        // Clusters are no longer drawn — they're only click targets now.
        clusters = clusterRoutes(routeData.routes, precision);

        const d0 = camera.position.z;
        heatMesh.material.opacity = heatTargetFor(d0);
        heatGlow.material.opacity = heatTargetFor(d0) * 0.4;
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

    const onClick = (e) => {
      if (dragMoved > 6) return; // that was a drag, not a click
      const c = clusterUnderPointer(e);
      if (!c) return;
      const dir = latLngToVector3(c.lat, c.lng, 1)
        .applyQuaternion(world.quaternion)
        .normalize();
      flyToDirection(dir, MIN_DIST / baseDistance());
    };

    const onHover = (e) => {
      if (dragging) return;
      renderer.domElement.style.cursor = clusterUnderPointer(e) ? 'pointer' : 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      fly = null;
      const factor = THREE.MathUtils.clamp(1 + e.deltaY * 0.0012, 0.9, 1.12);
      const before = zoom;
      const base = baseDistance();
      zoom = THREE.MathUtils.clamp(zoom * factor, MIN_DIST / base, MAX_DIST / base);
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
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!mount.clientWidth) return;
      frameCamera();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Loop ─────────────────────────────────────────────────
    let frame;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
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
        heatGlow.material.opacity += (heatTarget * 0.4 - heatGlow.material.opacity) * k;
        // Slow breathing so the hot spots feel alive rather than printed.
        const pulse = 1 + Math.sin(elapsed * 0.9) * 0.06;
        heatGlow.scale.setScalar(pulse);
      }
      if (routeMesh) {
        routeMesh.material.opacity += (routeTarget - routeMesh.material.opacity) * ease(2.5);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('pointermove', onHover);
      earthTexture.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="globe-canvas" ref={mountRef} />;
};

export default Globe;
