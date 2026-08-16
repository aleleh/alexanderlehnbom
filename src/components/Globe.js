import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import polyline from '@mapbox/polyline';
import landTopo from 'world-atlas/land-110m.json';

const RADIUS = 1;
const EARTH_CIRCUMFERENCE_KM = 40075;
// Bright: at full-globe scale the routes occupy a few pixels, and
// additive blending turns that cluster into a visible glow.
const ROUTE_OPACITY = 0.9;

// Cochrane, AB — the city on Alex's Strava profile. Used only for the
// opening orientation and as the trail's start. Every marker on the
// globe is derived from real route data, not from a hand-written list.
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

  ctx.fillStyle = '#070c13';
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const trace = (ring) => {
    ring.forEach(([lng, lat], i) => {
      const x = ((lng + 180) / 360) * TEX_W;
      const y = ((90 - lat) / 180) * TEX_H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  ctx.beginPath();
  LAND.features.forEach((f) => {
    const { type, coordinates } = f.geometry;
    if (type === 'Polygon') coordinates.forEach(trace);
    else if (type === 'MultiPolygon') coordinates.forEach((poly) => poly.forEach(trace));
  });

  ctx.fillStyle = '#1b2a3a';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#33546e';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// Buckets every GPS point into a coarse grid so the globe can show one
// marker per place Alex actually runs, instead of 678 overlapping
// traces that vanish at planet scale.
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

const Globe = ({ totalKm }) => {
  const mountRef = useRef(null);
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    let atmosphere = null;
    // Globe-scale storytelling (trail, runner). At city zoom these are
    // hundreds of km across and would swallow the screen.
    let decor = null;
    const markers = [];

    let zoom = 1;
    const frameCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight;
      const wide = aspect > 1.1;
      const distance = (wide ? 4.0 : 6.0) * zoom;
      camera.position.set(0, 0, distance);
      world.position.set(wide ? 1.15 * zoom : 0, wide ? 0 : 0.62 * zoom, 0);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      const close = distance < 1.35;
      if (atmosphere) atmosphere.visible = !close;
      if (decor) decor.visible = !close;
      // Markers shrink with the camera so they stay a constant size on
      // screen rather than swelling into blobs as you close in.
      markers.forEach((m) => {
        m.dot.scale.setScalar(zoom);
        m.ring.scale.setScalar(zoom);
      });
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
    decor = new THREE.Group();
    world.add(decor);
    frameCamera();

    // ── The earth ────────────────────────────────────────────
    const earthTexture = buildEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 96, 64),
      new THREE.MeshBasicMaterial({ map: earthTexture })
    );
    world.add(core);

    // Vector coastlines on top of the texture: they stay crisp at any
    // zoom, where the raster starts to blur.
    const coastMat = new THREE.LineBasicMaterial({
      color: 0x4d7a99,
      transparent: true,
      opacity: 0.5,
    });
    const addRing = (ring) => {
      const pts = ring.map(([lng, lat]) => latLngToVector3(lat, lng, RADIUS * 1.0015));
      if (pts.length < 2) return;
      world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), coastMat));
    };
    LAND.features.forEach((f) => {
      const { type, coordinates } = f.geometry;
      if (type === 'Polygon') coordinates.forEach(addRing);
      else if (type === 'MultiPolygon') coordinates.forEach((poly) => poly.forEach(addRing));
    });

    // Fake atmospheric rim.
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
    const start = latLngToVector3(HOME.lat, HOME.lng, 1).normalize();
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
    const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0xfc4c02 }));
    decor.add(trail);

    const ghostGeo = new THREE.TubeGeometry(trailCurve, TRAIL_SEGMENTS, 0.0022, 6, true);
    decor.add(
      new THREE.Mesh(
        ghostGeo,
        new THREE.MeshBasicMaterial({ color: 0xfc4c02, transparent: true, opacity: 0.18 })
      )
    );

    const runner = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    decor.add(runner);

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

    // ── Routes + run markers ─────────────────────────────────
    let routeMesh = null;
    let disposed = false;
    const markerGroup = new THREE.Group();
    world.add(markerGroup);

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
            color: 0xff7a3d,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        world.add(routeMesh);

        // One marker per place he actually runs.
        const clusters = clusterRoutes(routeData.routes, precision);
        clusters.forEach((c, i) => {
          const pos = latLngToVector3(c.lat, c.lng, RADIUS * 1.012);
          const primary = i === 0;
          const colour = primary ? 0xfc4c02 : 0xffa06b;

          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(primary ? 0.017 : 0.012, 16, 16),
            new THREE.MeshBasicMaterial({ color: colour })
          );
          dot.position.copy(pos);
          dot.userData.cluster = c;
          markerGroup.add(dot);

          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.026, 0.032, 32),
            new THREE.MeshBasicMaterial({
              color: colour,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
            })
          );
          ring.position.copy(pos);
          ring.lookAt(0, 0, 0);
          markerGroup.add(ring);

          markers.push({ dot, ring, cluster: c, phase: Math.random() * Math.PI * 2 });
        });

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
    const markerUnderPointer = (e) => {
      if (!markers.length) return null;
      setPointer(e);
      const hits = raycaster.intersectObjects(markers.map((m) => m.dot), false);
      return hits.length ? hits[0].object : null;
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
      const hit = markerUnderPointer(e);
      if (!hit) return;
      const dir = hit.position.clone().applyQuaternion(world.quaternion).normalize();
      flyToDirection(dir, 0.2565);
    };

    const onHover = (e) => {
      if (dragging) return;
      renderer.domElement.style.cursor = markerUnderPointer(e) ? 'pointer' : 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      fly = null;
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
    let drawn = 0;
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

      const target = progressRef.current;
      drawn += (target - drawn) * ease(1.1);
      trailGeo.setDrawRange(0, Math.floor(trailTotalIndices * drawn));

      const headT = Math.max(drawn, 0.0001);
      runner.position.copy(trailCurve.getPointAt(headT % 1));
      runner.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.15);

      if (routeMesh && routeMesh.material.opacity < ROUTE_OPACITY) {
        routeMesh.material.opacity = Math.min(
          ROUTE_OPACITY,
          routeMesh.material.opacity + delta * 0.9
        );
      }

      markers.forEach((m) => {
        const pulse = 1 + Math.sin(elapsed * 2 + m.phase) * 0.28;
        m.ring.scale.setScalar(zoom * pulse);
        m.ring.material.opacity = 0.35 + Math.sin(elapsed * 2 + m.phase) * 0.25;
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
export { EARTH_CIRCUMFERENCE_KM };
