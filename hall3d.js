// 3D-зал. Модель собрана в Blender (models/hall.glb), сцена — three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const view = document.getElementById('hall-view');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
if (view && webgl()) start().catch((e) => { console.warn(e); document.dispatchEvent(new CustomEvent('hall:ready')); });
else document.dispatchEvent(new CustomEvent('hall:ready'));

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const backOut = (x) => { x = clamp01(x); const c = 1.8; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

const THEMES = {
  gold: { Ribbon: '#D9A84A', Flower: '#F1E2CC', Backdrop: '#6B1420' },
  blue: { Ribbon: '#3D7CC9', Flower: '#EAF0F7', Backdrop: '#15365F' },
  wine: { Ribbon: '#9E2436', Flower: '#D0546B', Backdrop: '#3E0B14' }
};
const LIGHTS = {
  day: { env: 0.4, sun: 1.05, glow: 0.4, lamps: 0, exposure: 0.82, dust: 0.25 },
  evening: { env: 0.1, sun: 0.12, glow: 4.0, lamps: 22, exposure: 1.0, dust: 0.9 }
};

async function start() {
  const gltf = await new GLTFLoader().loadAsync(new URL('models/hall.glb', import.meta.url).href);
  const root = gltf.scene;
  const mats = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !/Floor|Dance|Wall|Backdrop/.test(o.name);
    o.receiveShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m && m.name) mats[m.name] = m; });
  });
  if (mats.Floor) { mats.Floor.roughness = 0.14; mats.Floor.metalness = 0.05; }
  if (mats.Dance) { mats.Dance.roughness = 0.08; }
  if (mats.Glow) mats.Glow.emissive.set(0xffc982);

  const tables = [];
  root.traverse((o) => { if (/^Table_\d+$/.test(o.name)) tables.push(o); });
  tables.sort((a, b) => a.name.localeCompare(b.name));
  tables.forEach((t) => { t.userData.y = t.position.y; t.userData.k = 1; t.userData.want = 1; t.userData.t0 = 0; });

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x0b0807, 1);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Трёхмерный банкетный зал. Потяните, чтобы повернуть.');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0807, 40, 90);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(root);

  const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sun.position.set(26, 20, 6);
  sun.target.position.set(14.5, 0, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // тёплые лампы под люстрами (вечер)
  const lamps = [];
  root.traverse((o) => { if (/^ChandGlow_/.test(o.name)) { const l = new THREE.PointLight(0xffc27a, 0, 14, 1.6); o.getWorldPosition(l.position); l.position.y -= 0.4; scene.add(l); lamps.push(l); } });

  // золотая пыль
  const N = 520, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = 3 + Math.random() * 26; pos[i * 3 + 1] = 0.5 + Math.random() * 5; pos[i * 3 + 2] = -Math.random() * 16; seed[i] = Math.random() * 100; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dm = new THREE.PointsMaterial({ color: 0xf3d58e, size: 0.06, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
  const dust = new THREE.Points(dg, dm); scene.add(dust);

  // камера
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const target = new THREE.Vector3(15.5, 0.6, -8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  Object.assign(controls, { enablePan: false, enableZoom: false, enableDamping: true, dampingFactor: 0.07, rotateSpeed: 0.5,
    minAzimuthAngle: 0.35, maxAzimuthAngle: 1.75, minPolarAngle: 0.55, maxPolarAngle: 1.25 });
  const DIST = 44, POL = 0.98, AZ = 1.08;
  const finalPos = new THREE.Vector3().setFromSphericalCoords(DIST, POL, AZ).add(target);
  const introPos = new THREE.Vector3().setFromSphericalCoords(DIST * 1.65, 0.42, AZ + 0.9).add(target);
  camera.position.copy(reduce ? finalPos : introPos);
  controls.update();

  let lastTouch = -1e9, baseAz = AZ;
  controls.addEventListener('start', () => { lastTouch = Infinity; intro = null; });
  controls.addEventListener('end', () => { lastTouch = performance.now(); baseAz = controls.getAzimuthalAngle(); });

  function resize() {
    const w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 46 : 32;
    if (w > 760) camera.setViewOffset(w, h, -w * 0.16, h * 0.04, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // --- состояние, плавные переходы ---
  const now = () => performance.now();
  let intro = null;
  const colorTw = []; // {mat, from, to, t0}
  let lightFrom = { ...LIGHTS.day }, lightTo = LIGHTS.day, lightT0 = -1e9;

  function setGuests(g, instant) {
    const n = Math.ceil(g / 10), t = now();
    let order = 0;
    tables.forEach((tb, i) => {
      const want = i < n ? 1 : 0;
      if (want !== tb.userData.want) { tb.userData.want = want; tb.userData.from = tb.userData.k; tb.userData.t0 = t + (instant ? -1e5 : (want ? order++ : 0) * 45); }
    });
  }
  function setTheme(name, instant) {
    const th = THEMES[name]; if (!th) return;
    Object.entries(th).forEach(([m, c]) => { if (mats[m]) colorTw.push({ mat: mats[m], from: mats[m].color.clone(), to: new THREE.Color(c), t0: instant ? -1e5 : now() }); });
  }
  function setLight(name) { lightFrom = currentLight(); lightTo = LIGHTS[name]; lightT0 = now(); }
  function currentLight() {
    const k = ease((now() - lightT0) / 900), o = {};
    for (const key in lightTo) o[key] = lightFrom[key] + (lightTo[key] - lightFrom[key]) * k;
    return o;
  }

  setTheme('gold', true);
  setGuests(200, true);
  // до интро все столы спрятаны — потом «вырастают»
  if (!reduce) tables.forEach((tb) => { tb.userData.k = 0; tb.userData.want = 0; });

  document.addEventListener('hall:guests', (e) => setGuests(e.detail.guests));
  document.addEventListener('hall:theme', (e) => setTheme(e.detail.value));
  document.addEventListener('hall:light', (e) => setLight(e.detail.value));
  const runIntro = () => {
    if (reduce) return;
    intro = { t0: now(), from: camera.position.clone() };
    const g = +(document.getElementById('guests') || { value: 200 }).value;
    setTimeout(() => setGuests(g), 700);
  };
  document.addEventListener('hall:intro', runIntro, { once: true });
  if (document.body.classList.contains('is-open')) runIntro();

  view.appendChild(renderer.domElement);
  resize();
  new ResizeObserver(resize).observe(view);
  let visible = true;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(view);

  const sph = new THREE.Spherical();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const t = now();

    if (intro) {
      const k = clamp01((t - intro.t0) / 2600), e = 1 - Math.pow(1 - k, 4);
      const a = new THREE.Spherical().setFromVector3(intro.from.clone().sub(target));
      const b = new THREE.Spherical().setFromVector3(finalPos.clone().sub(target));
      sph.set(a.radius + (b.radius - a.radius) * e, a.phi + (b.phi - a.phi) * e, a.theta + (b.theta - a.theta) * e);
      camera.position.setFromSpherical(sph).add(target);
      camera.lookAt(target);
      if (k >= 1) { intro = null; lastTouch = t; baseAz = AZ; }
    } else {
      if (!reduce && t - lastTouch > 3500) {
        sph.setFromVector3(camera.position.clone().sub(target));
        const want = baseAz + Math.sin((t - lastTouch - 3500) / 5200) * 0.16;
        sph.theta += (want - sph.theta) * 0.02;
        camera.position.setFromSpherical(sph).add(target);
      }
      controls.update();
    }

    // столы
    tables.forEach((tb) => {
      const u = tb.userData;
      const k = clamp01((t - u.t0) / 520);
      u.k = u.want ? u.from + (1 - u.from) * backOut(k) : u.from * (1 - ease(k));
      if (u.from === undefined) u.k = u.want;
      tb.visible = u.k > 0.002;
      tb.scale.setScalar(Math.max(0.001, u.k));
      tb.position.y = u.y + (1 - Math.min(1, u.k)) * 1.2;
    });

    // цвета
    for (let i = colorTw.length - 1; i >= 0; i--) {
      const c = colorTw[i], k = ease((t - c.t0) / 650);
      c.mat.color.copy(c.from).lerp(c.to, k);
      if (k >= 1) colorTw.splice(i, 1);
    }

    // свет
    const L = currentLight();
    scene.environmentIntensity = L.env;
    sun.intensity = L.sun;
    renderer.toneMappingExposure = L.exposure;
    if (mats.Glow) mats.Glow.emissiveIntensity = L.glow;
    lamps.forEach((l) => { l.intensity = L.lamps; });
    dm.opacity = L.dust * (0.75 + 0.25 * Math.sin(t / 900));

    // пыль плавает
    const p = dg.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += 0.0016 + Math.sin(t / 1400 + seed[i]) * 0.0012; p[i * 3] += Math.cos(t / 2100 + seed[i]) * 0.002; if (p[i * 3 + 1] > 5.6) p[i * 3 + 1] = 0.4; }
    dg.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  });

  view.classList.add('is-live');
  document.dispatchEvent(new CustomEvent('hall:ready'));
}
