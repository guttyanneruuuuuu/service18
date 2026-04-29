// MoodMap — 3D地球儀（Three.js）
// 感情を光の点として地球上に配置し、ぼんやり光らせる

import { MOODS } from './config.js';

const moodColorMap = Object.fromEntries(MOODS.map(m => [m.id, m.color]));

let scene, camera, renderer, earth, glow, pointsGroup, starField;
let canvas;
let autoRotate = true;
let pointerDown = false, lastX = 0, lastY = 0;
let rotY = 0, rotX = 0.2, targetRotY = 0, targetRotX = 0.2;
let dragVel = 0;
const RADIUS = 1.6;

function latLonToVec3(lat, lon, r = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function makeEarthTexture() {
  // プロシージャルな地球風グラデーションテクスチャ
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');

  // ベース
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a0e3a');
  g.addColorStop(0.5, '#1a1f6e');
  g.addColorStop(1, '#0a0e3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  // 大陸シルエット風のノイズ
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const lat = 90 - (y / 512) * 180;
    // 緯度で確率を曲げて陸地っぽく
    const isLand = Math.random() < 0.3 + 0.2 * Math.cos(lat * Math.PI / 180);
    if (!isLand) continue;
    const sz = Math.random() * 8 + 1;
    const alpha = Math.random() * 0.18 + 0.05;
    ctx.fillStyle = `rgba(140, 120, 220, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI*2);
    ctx.fill();
  }
  // 緯度線
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const x = (lon / 360) * 1024;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeStarField() {
  const geom = new THREE.BufferGeometry();
  const N = 1500;
  const pos = new Float32Array(N*3);
  const col = new Float32Array(N*3);
  for (let i = 0; i < N; i++) {
    const r = 30 + Math.random()*20;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2*Math.random()-1);
    pos[i*3]   = r * Math.sin(p) * Math.cos(t);
    pos[i*3+1] = r * Math.sin(p) * Math.sin(t);
    pos[i*3+2] = r * Math.cos(p);
    const c = 0.6 + Math.random()*0.4;
    col[i*3] = c; col[i*3+1] = c; col[i*3+2] = c + Math.random()*0.2;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.9,
    sizeAttenuation: true, depthWrite: false
  });
  return new THREE.Points(geom, mat);
}

function makeGlowSprite(colorHex, size = 0.18) {
  // ガウシアンっぽい白点テクスチャを使い回し
  if (!makeGlowSprite._tex) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
    makeGlowSprite._tex = new THREE.CanvasTexture(c);
  }
  const mat = new THREE.SpriteMaterial({
    map: makeGlowSprite._tex,
    color: new THREE.Color(colorHex),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

export function initGlobe(canvasEl) {
  canvas = canvasEl;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06061a, 0.02);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0.5, 5);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  // ライト
  scene.add(new THREE.AmbientLight(0x6a6aff, 0.55));
  const dir = new THREE.DirectionalLight(0xffd6ff, 0.9);
  dir.position.set(5, 3, 5);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x4fd6ff, 0.4);
  dir2.position.set(-5, -2, -3);
  scene.add(dir2);

  // 地球本体
  const tex = makeEarthTexture();
  const geo = new THREE.SphereGeometry(RADIUS, 64, 64);
  const mat = new THREE.MeshPhongMaterial({
    map: tex,
    color: 0xffffff,
    emissive: 0x1a1450,
    emissiveIntensity: 0.45,
    shininess: 8,
    specular: 0x222244
  });
  earth = new THREE.Mesh(geo, mat);
  scene.add(earth);

  // グロー（外殻）
  const glowGeo = new THREE.SphereGeometry(RADIUS * 1.08, 64, 64);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      c: { value: 0.8 }, p: { value: 4.5 },
      glowColor: { value: new THREE.Color(0x7b6cff) }
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP;
      uniform float c; uniform float p; uniform vec3 glowColor;
      void main() {
        float intensity = pow(c - dot(vN, normalize(vP)), p);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `
  });
  glow = new THREE.Mesh(glowGeo, glowMat);
  scene.add(glow);

  // 星空
  starField = makeStarField();
  scene.add(starField);

  // 感情の点を入れるグループ（地球と一緒に回転）
  pointsGroup = new THREE.Group();
  earth.add(pointsGroup);

  // 入力イベント
  setupInput();

  window.addEventListener('resize', onResize, { passive: true });

  animate();
}

function setupInput() {
  const onDown = (x, y) => {
    pointerDown = true; lastX = x; lastY = y; dragVel = 0;
    autoRotate = false;
  };
  const onMove = (x, y) => {
    if (!pointerDown) return;
    const dx = (x - lastX) * 0.005;
    const dy = (y - lastY) * 0.005;
    targetRotY += dx;
    targetRotX = Math.max(-1.2, Math.min(1.2, targetRotX + dy));
    dragVel = dx;
    lastX = x; lastY = y;
  };
  const onUp = () => {
    pointerDown = false;
    setTimeout(() => { autoRotate = true; }, 4000);
  };

  canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', onUp);

  // ピンチズーム的な簡易：ホイール
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camera.position.z = Math.max(3.2, Math.min(8, camera.position.z + e.deltaY * 0.002));
  }, { passive: false });
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

// 既存の点（pulse中など）
const liveSprites = []; // {sprite, born, life, baseScale}

export function spawnMood({ mood, lat, lon, big = false }) {
  if (!pointsGroup) return;
  const color = moodColorMap[mood] || '#ffffff';
  const pos = latLonToVec3(lat, lon, RADIUS * 1.005);

  const baseSize = big ? 0.55 : (0.18 + Math.random() * 0.06);

  // メイングロー（フェードイン→ゆっくりフェードアウト）
  const sp = makeGlowSprite(color, 0.001);
  sp.position.copy(pos);
  // 法線方向に少しオフセット
  sp.position.multiplyScalar(1.003);
  pointsGroup.add(sp);

  liveSprites.push({
    sprite: sp,
    born: performance.now(),
    life: big ? 6000 : 3500 + Math.random() * 2500,
    baseScale: baseSize,
    big
  });

  // bigなら追加の波紋（拡大→消える）
  if (big) {
    const ring = makeGlowSprite(color, 0.001);
    ring.position.copy(sp.position);
    pointsGroup.add(ring);
    liveSprites.push({
      sprite: ring,
      born: performance.now(),
      life: 1800,
      baseScale: 1.3,
      big: false,
      ring: true
    });
  }

  // 点を残す（永続：薄い恒星点）
  const dot = makeGlowSprite(color, 0.06);
  dot.position.copy(pos).multiplyScalar(1.001);
  dot.material.opacity = 0.55;
  pointsGroup.add(dot);

  // 多すぎたら古いdotを掃除（パフォーマンス）
  if (pointsGroup.children.length > 700) {
    const old = pointsGroup.children.find(c => c.userData?.persistent !== true);
    if (old) {
      pointsGroup.remove(old);
      old.material?.dispose?.();
    }
  }
}

export function setAutoRotate(v) { autoRotate = !!v; }
export function getAutoRotate() { return autoRotate; }

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();

  // 慣性 & 自動回転
  if (autoRotate && !pointerDown) {
    targetRotY += 0.0015;
  }
  rotY += (targetRotY - rotY) * 0.08;
  rotX += (targetRotX - rotX) * 0.08;
  if (earth) {
    earth.rotation.y = rotY;
    earth.rotation.x = rotX;
  }
  if (glow) {
    glow.rotation.y = rotY * 0.6;
  }
  if (starField) starField.rotation.y += 0.0002;

  // ライブスプライトのアニメ
  for (let i = liveSprites.length - 1; i >= 0; i--) {
    const it = liveSprites[i];
    const t = (now - it.born) / it.life;
    if (t >= 1) {
      pointsGroup.remove(it.sprite);
      it.sprite.material.dispose?.();
      liveSprites.splice(i, 1);
      continue;
    }
    if (it.ring) {
      // 波紋：拡大しつつ薄くなる
      const s = it.baseScale * (0.2 + t * 1.4);
      it.sprite.scale.set(s, s, 1);
      it.sprite.material.opacity = (1 - t) * 0.7;
    } else {
      // パルス：現れて、ゆっくり収束
      const fadeIn = Math.min(1, t * 6);
      const fadeOut = Math.max(0, 1 - Math.pow(t, 2));
      const pulse = it.big ? (1 + Math.sin(t * Math.PI * 4) * 0.15) : (1 + Math.sin(t * Math.PI * 6) * 0.08);
      const s = it.baseScale * fadeIn * pulse;
      it.sprite.scale.set(s, s, 1);
      it.sprite.material.opacity = fadeOut;
    }
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

// 指定座標までカメラを移動（投稿時にフォーカス）
export function focusOn(lat, lon) {
  // 単純に対象座標が手前に来るようrotYをセット
  const targetY = -((lon + 180) * Math.PI / 180) - Math.PI/2;
  const targetX = (lat * Math.PI / 180) * 0.6;
  targetRotY = targetY;
  targetRotX = Math.max(-1.0, Math.min(1.0, targetX));
  autoRotate = false;
  setTimeout(() => { autoRotate = true; }, 6000);
}
