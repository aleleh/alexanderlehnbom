import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import polyline from '@mapbox/polyline';
import landTopo from 'world-atlas/land-110m.json';

const RADIUS = 1;
const EARTH_CIRCUMFERENCE_KM = 40075;
// Bright, because at full-globe scale every route is packed into a few
// pixels; additive blending turns that cluster into a visible glow.
const ROUTE_OPACITY = 0.85;

// Real Natural Earth coastlines, not an approximation of them.
const LAND = feature(landTopo, landTopo.objects.land);

// Equirectangular raster used purely as a land/ocean lookup, so each
// candidate dot can ask "am I on land?" in O(1).
const MASK_W = 2048;
const MASK_H = 1024;

const buildLandMask = () => {
  const canvas = document.createElement('canvas');
  canvas.width = MASK_W;
  canvas.height = MASK_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = '#fff';

  const drawRing = (ring) => {
    ring.forEach(([lng, lat], i) => {
      const x = ((lng + 180) / 360) * MASK_W;
      const y = ((90 - lat) / 180) * MASK_H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  ctx.beginPath();
  LAND.features.forEach((f) => {
    const { type, coordinates } = f.geometry;
    if (type === 'Polygon') coordinates.forEach(drawRing);
    else if (type === 'MultiPolygon') coordinates.forEach((poly) => poly.forEach(drawRing));
  });
  ctx.fill('evenodd');

  const { data } = ctx.getImageData(0, 0, MASK_W, MASK_H);
  return (lat, lng) => {
    const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lng + 180) / 360) * MASK_W)));
    const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
    return data[(y * MASK_W + x) * 4] > 128;
  };
};

// Inverse of latLngToVector3, for asking the mask about a sphere point.
const vector3ToLatLng = (v) => {
  const lat = 90 - (Math.acos(v.y / v.length()) * 180) / Math.PI;
  let lng = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return [lat, lng];
};

// ─────────────────────────────────────────────────────────────
// EDIT ME — places pinned on the globe.
// Only "Cochrane" is confirmed (it's the city on Alex's Strava
// profile). The rest are guesses inferred from the photos that
// were on the old site — correct or delete them.
// ─────────────────────────────────────────────────────────────
const PLACES = [
  { name: 'Cochrane, AB', lat: 51.19, lng: -114.47, home: true },
  { name: 'Stockholm', lat: 59.33, lng: 18.07 },
  { name: 'Kathmandu', lat: 27.72, lng: 85.32 },
  { name: 'Cusco', lat: -13.53, lng: -71.97 },
];

const latLngToVector3 = (lat, lng, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

// Evenly scatters points over a sphere. Random placement clumps;
// the golden-angle spiral does not.
const fibonacciSphere = (count, radius) => {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push(
      new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius)
    );
  }
  return points;
};

const Globe = ({ totalKm }) => {
  const mountRef = useRef(null);
  // Held in a ref so the animation loop reads fresh values without restarting.
  const progressRef = useRef(0);

  useEffect(() => {
    progressRef.current = totalKm ? Math.min(totalKm / EARTH_CIRCUMFERENCE_KM, 1) : 0;
  }, [totalKm]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    // near must be tiny: the globe has radius 1, so a default near of
    // 0.1 would clip everything within ~640km of the surface and make
    // close zoom impossible.
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.0015, 100);

    // Wide screens put the globe right of centre to clear the readout;
    // narrow ones centre it and pull back so it still fits the frame.
    // Assigned further down, but frameCamera runs before that, so they
    // start null rather than sitting in the temporal dead zone.
    let atmosphere = null;
    let landDots = null;
    // Globe-scale storytelling (trail, runner, place pins). At city zoom
    // these are hundreds of km across and would swallow the screen.
    let decor = null;

    let zoom = 1;
    const frameCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight;
      const wide = aspect > 1.1;
      const distance = (wide ? 4.0 : 6.0) * zoom;
      camera.position.set(0, 0, distance);
      // The offset shrinks as you zoom in, so a close-up centres itself
      // instead of drifting off the edge of the screen.
      world.position.set(wide ? 1.15 * zoom : 0, wide ? 0 : 0.62 * zoom, 0);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      // Close in, the camera passes inside the atmosphere shell (radius
      // 1.16) and the land dots balloon under size attenuation. Both are
      // globe-scale decoration, so they drop away and let the coastlines
      // and routes carry the close view.
      const close = distance < 1.35;
      if (atmosphere) atmosphere.visible = !close;
      if (landDots) landDots.visible = !close;
      if (decor) decor.visible = !close;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Everything rotates together, so drag/auto-rotate moves one object.
    const world = new THREE.Group();

    // Open facing home. Almost all the route data sits within ~50km of
    // Cochrane, so a default orientation anywhere else shows an empty
    // ocean and the runs appear to be missing.
    const homePlace = PLACES.find((p) => p.home) || PLACES[0];
    world.quaternion.setFromUnitVectors(
      latLngToVector3(homePlace.lat, homePlace.lng, 1).normalize(),
      new THREE.Vector3(0, 0, 1)
    );
    world.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.18)
    );

    scene.add(world);
    decor = new THREE.Group();
    world.add(decor);
    frameCamera();

    // Solid core, slightly smaller than the dots so they read as a shell.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.985, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x0d1117 })
    );
    world.add(core);

    // Land dots — sample an even sphere distribution, keep only what
    // falls on a continent. The dots themselves draw the world map.
    const isLand = buildLandMask();
    const landPoints = fibonacciSphere(46000, RADIUS).filter((p) => {
      const [lat, lng] = vector3ToLatLng(p);
      return isLand(lat, lng);
    });
    const dotGeo = new THREE.BufferGeometry().setFromPoints(landPoints);
    landDots = new THREE.Points(
      dotGeo,
      new THREE.PointsMaterial({ color: 0x9fb3c8, size: 0.0085, sizeAttenuation: true })
    );
    world.add(landDots);

    // Coastline outlines, so the continents have crisp edges rather
    // than only a dot texture.
    const coastMat = new THREE.LineBasicMaterial({
      color: 0x5b7086,
      transparent: true,
      opacity: 0.55,
    });
    const addRing = (ring) => {
      const pts = ring.map(([lng, lat]) => latLngToVector3(lat, lng, RADIUS * 1.004));
      if (pts.length < 2) return;
      world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), coastMat));
    };
    LAND.features.forEach((f) => {
      const { type, coordinates } = f.geometry;
      if (type === 'Polygon') coordinates.forEach(addRing);
      else if (type === 'MultiPolygon') coordinates.forEach((poly) => poly.forEach(addRing));
    });

    // ── Real routes ──────────────────────────────────────────
    // Loaded as its own chunk so ~175kB of GPS traces never blocks the
    // first paint — the globe appears immediately and the runs land on
    // it a moment later. Merged into a single LineSegments so 678
    // traces cost one draw call, with additive blending so overlapping
    // runs burn brighter. That is what makes it read as a heatmap.
    let routeMesh = null;
    let disposed = false;

    import('../stravaRoutes.json')
      .then(({ default: routeData }) => {
        if (disposed || !routeData.routes.length) return;
        const precision = routeData.precision || 5;
        const verts = [];
        routeData.routes.forEach((encoded) => {
          const pts = polyline.decode(encoded, precision);
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
            color: 0xff6a2b,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        world.add(routeMesh);
      })
      .catch((err) => console.error('Failed to load routes', err));

    // Faint graticule for depth while spinning.
    const gridMat = new THREE.LineBasicMaterial({ color: 0x263445, transparent: true, opacity: 0.5 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      const r = RADIUS * Math.cos((lat * Math.PI) / 180);
      const y = RADIUS * Math.sin((lat * Math.PI) / 180);
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
      }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // Fake atmospheric rim: a larger inside-out sphere.
    atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.16, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfc4c02,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
      })
    );
    world.add(atmosphere);

    // ── The run trail ────────────────────────────────────────
    // A great circle starting at home and heading east. Its drawn
    // length is the fraction of the Earth Alex has actually run.
    const home = PLACES.find((p) => p.home) || PLACES[0];
    const start = latLngToVector3(home.lat, home.lng, 1).normalize();
    const tangent = new THREE.Vector3().crossVectors(start, new THREE.Vector3(0, 1, 0)).normalize();

    const TRAIL_SEGMENTS = 600;
    const trailPoints = [];
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      const t = (i / TRAIL_SEGMENTS) * Math.PI * 2;
      trailPoints.push(
        new THREE.Vector3()
          .addScaledVector(start, Math.cos(t))
          .addScaledVector(tangent, Math.sin(t))
          .multiplyScalar(RADIUS * 1.022)
      );
    }
    const trailCurve = new THREE.CatmullRomCurve3(trailPoints, true);
    const trailGeo = new THREE.TubeGeometry(trailCurve, TRAIL_SEGMENTS, 0.007, 8, true);
    const trailTotalIndices = trailGeo.index.count;
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Mesh(
      trailGeo,
      new THREE.MeshBasicMaterial({ color: 0xfc4c02 })
    );
    decor.add(trail);

    // Faint full ring showing the whole lap, so the trail reads as progress.
    const ghostGeo = new THREE.TubeGeometry(trailCurve, TRAIL_SEGMENTS, 0.0022, 6, true);
    decor.add(
      new THREE.Mesh(
        ghostGeo,
        new THREE.MeshBasicMaterial({ color: 0xfc4c02, transparent: true, opacity: 0.18 })
      )
    );

    // Marker that rides the leading edge of the trail.
    const runner = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    decor.add(runner);

    // ── Place markers ────────────────────────────────────────
    const markers = [];
    PLACES.forEach((place) => {
      const pos = latLngToVector3(place.lat, place.lng, RADIUS * 1.01);
      const color = place.home ? 0xfc4c02 : 0x63b3ed;

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(place.home ? 0.019 : 0.014, 16, 16),
        new THREE.MeshBasicMaterial({ color })
      );
      dot.position.copy(pos);
      decor.add(dot);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.028, 0.034, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      ring.position.copy(pos);
      ring.lookAt(0, 0, 0);
      decor.add(ring);

      markers.push({ ring, phase: Math.random() * Math.PI * 2 });
    });

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

    // ── Drag to spin ─────────────────────────────────────────
    // Rotation is quaternion-based, not Euler. The globe now starts
    // pre-oriented towards home, and driving that with Euler angles
    // gimbals as soon as you drag past the poles.
    const AXIS_Y = new THREE.Vector3(0, 1, 0);
    const AXIS_X = new THREE.Vector3(1, 0, 0);
    const spinBy = (angle, axis) => {
      world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velocity = 0;

    const onPointerDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      velocity = dx * 0.005;
      spinBy(velocity, AXIS_Y);
      spinBy(dy * 0.004, AXIS_X);
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    // Which point on the globe is under the pointer, as a world-space
    // direction from the globe's centre. Null when the pointer is off
    // the globe entirely.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const surfaceUnderPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(core, false);
      if (!hits.length) return null;
      return hits[0].point.clone().sub(world.position).normalize();
    };

    const onWheel = (e) => {
      e.preventDefault();
      // Per-event factor is clamped so one trackpad fling can't jump the
      // whole zoom range.
      const factor = THREE.MathUtils.clamp(1 + e.deltaY * 0.0012, 0.9, 1.12);
      const before = zoom;
      // 0.2565 puts the camera ~0.026 above a radius-1 globe: roughly a
      // 170km-wide view, close enough to read individual routes.
      zoom = THREE.MathUtils.clamp(zoom * factor, 0.2565, 1.5);
      if (zoom === before) return;

      // Zooming in rotates whatever is under the cursor towards the
      // centre of view, so you close in on the place you're pointing at
      // instead of always diving at the middle of the globe.
      if (zoom < before) {
        const hit = surfaceUnderPointer(e);
        if (hit) {
          const centre = camera.position.clone().sub(world.position).normalize();
          const delta = new THREE.Quaternion().setFromUnitVectors(hit, centre);
          const target = delta.multiply(world.quaternion);
          const strength = THREE.MathUtils.clamp((1 - zoom / before) * 2.5, 0, 0.5);
          world.quaternion.slerp(target, strength);
        }
      }
      frameCamera();
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
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
    let drawn = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      // Clamped so a backgrounded tab doesn't resume with one huge jump.
      const delta = Math.min(clock.getDelta(), 0.1);
      // Frame-rate independent smoothing: same motion at 60Hz and 120Hz.
      const ease = (rate) => 1 - Math.exp(-delta * rate);

      if (!dragging) {
        if (Math.abs(velocity) > 0.0002) {
          spinBy(velocity * delta * 60, AXIS_Y);
          velocity *= Math.exp(-delta * 3.7);
        } else if (!prefersReduced) {
          // Slow: the opening view is aimed at home, and a brisk spin
          // would carry the route data out of sight before you saw it.
          spinBy(0.045 * delta, AXIS_Y);
        }
      }

      // Ease the trail out to its true length.
      const target = progressRef.current;
      drawn += (target - drawn) * ease(1.1);
      trailGeo.setDrawRange(0, Math.floor(trailTotalIndices * drawn));

      const headT = Math.max(drawn, 0.0001);
      runner.position.copy(trailCurve.getPointAt(headT % 1));
      runner.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.15);

      // Fade the routes in once their chunk arrives.
      if (routeMesh && routeMesh.material.opacity < ROUTE_OPACITY) {
        routeMesh.material.opacity = Math.min(
          ROUTE_OPACITY,
          routeMesh.material.opacity + delta * 0.9
        );
      }

      markers.forEach((m, i) => {
        const pulse = 1 + Math.sin(elapsed * 2 + m.phase) * 0.25;
        m.ring.scale.setScalar(pulse);
        m.ring.material.opacity = 0.35 + Math.sin(elapsed * 2 + m.phase) * 0.25;
        if (i === 0) m.ring.material.opacity = 0.6;
      });

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
export { EARTH_CIRCUMFERENCE_KM, PLACES };
