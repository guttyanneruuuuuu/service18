// MoodMap — データレイヤー
// Firebase接続 or DEMO_MODE時はローカルシミュレーション
// データ構造: { mood, message, lat, lon, ts, country }

import { FIREBASE_CONFIG, DEMO_MODE, MOODS } from './config.js';
import { sanitizeMessage, isContentClean, escapeHTML } from './security.js';

let _firebase = null;
let _db = null;
let _moodsRef = null;

// 外部から購読するためのリスナーリスト
const listeners = {
  add: new Set(),
  count: new Set()
};

// シミュレーション用：世界の主要都市（緯度経度）
const SIM_HOTSPOTS = [
  { name: 'Tokyo',     lat: 35.68, lon: 139.69, weight: 8 },
  { name: 'New York',  lat: 40.71, lon: -74.0, weight: 7 },
  { name: 'London',    lat: 51.51, lon: -0.13, weight: 6 },
  { name: 'Paris',     lat: 48.85, lon: 2.35, weight: 5 },
  { name: 'Seoul',     lat: 37.57, lon: 126.98, weight: 5 },
  { name: 'Sao Paulo', lat: -23.55, lon: -46.63, weight: 5 },
  { name: 'Sydney',    lat: -33.87, lon: 151.21, weight: 4 },
  { name: 'Mumbai',    lat: 19.08, lon: 72.88, weight: 6 },
  { name: 'Cairo',     lat: 30.04, lon: 31.24, weight: 4 },
  { name: 'Lagos',     lat: 6.52, lon: 3.38, weight: 4 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13, weight: 5 },
  { name: 'Moscow',    lat: 55.75, lon: 37.62, weight: 4 },
  { name: 'Singapore', lat: 1.35, lon: 103.82, weight: 4 },
  { name: 'Berlin',    lat: 52.52, lon: 13.40, weight: 4 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24, weight: 5 },
  { name: 'Bangkok',   lat: 13.75, lon: 100.5, weight: 4 },
  { name: 'Istanbul',  lat: 41.01, lon: 28.98, weight: 4 },
  { name: 'Dubai',     lat: 25.20, lon: 55.27, weight: 3 },
  { name: 'Toronto',   lat: 43.65, lon: -79.38, weight: 4 },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.38, weight: 3 }
];

const SIM_MESSAGES = [
  '今日もいちにち、おつかれさま。',
  '空がきれいだった。',
  'ちょっとだけ休もう。',
  '小さなことでも、進んだ気がする。',
  '誰かに会いたい夜。',
  'コーヒーがしみる。',
  '頑張りすぎないって決めた。',
  '音楽が沁みる。',
  'なんだか元気が出てきた。',
  'やさしい気持ちでいたい。',
  '雨の音が好き。',
  '深呼吸してみた。',
  '', '', '', '', '' // 空メッセージも多め
];

let simBuffer = [];
let liveCount = 0;

function pickWeighted(arr) {
  const total = arr.reduce((a, b) => a + (b.weight||1), 0);
  let r = Math.random() * total;
  for (const it of arr) {
    r -= (it.weight||1);
    if (r <= 0) return it;
  }
  return arr[0];
}

function jitter(v, range) { return v + (Math.random() - 0.5) * range; }

// シミュレーション初期データ生成
function seedSimulation() {
  const now = Date.now();
  const items = [];
  for (let i = 0; i < 80; i++) {
    const spot = pickWeighted(SIM_HOTSPOTS);
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    items.push({
      id: 'sim_' + i + '_' + now,
      mood: mood.id,
      message: SIM_MESSAGES[Math.floor(Math.random() * SIM_MESSAGES.length)],
      lat: jitter(spot.lat, 6),
      lon: jitter(spot.lon, 6),
      ts: now - Math.floor(Math.random() * 60_000 * 30),
      country: spot.name
    });
  }
  items.sort((a,b) => a.ts - b.ts);
  return items;
}

// =========== 公開API ===========

export async function initData() {
  if (DEMO_MODE) {
    simBuffer = seedSimulation();
    liveCount = 12 + Math.floor(Math.random() * 30);

    // 既存データを購読者に発火（バッチ化：レンダリング負荷を分散）
    let i = 0;
    const flushSeed = () => {
      const batch = simBuffer.slice(i, i + 8);
      batch.forEach(item => listeners.add.forEach(fn => fn(item)));
      i += 8;
      if (i < simBuffer.length) {
        setTimeout(flushSeed, 60);
      } else {
        listeners.count.forEach(fn => fn({ live: liveCount, today: simBuffer.length }));
      }
    };
    setTimeout(flushSeed, 100);
    // カウントは即時1回
    setTimeout(() => listeners.count.forEach(fn => fn({ live: liveCount, today: simBuffer.length })), 50);

    // 定期的にシミュレートされた投稿を流す
    setInterval(() => {
      const spot = pickWeighted(SIM_HOTSPOTS);
      const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
      const item = {
        id: 'sim_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
        mood: mood.id,
        message: SIM_MESSAGES[Math.floor(Math.random() * SIM_MESSAGES.length)],
        lat: jitter(spot.lat, 5),
        lon: jitter(spot.lon, 5),
        ts: Date.now(),
        country: spot.name
      };
      simBuffer.push(item);
      if (simBuffer.length > 300) simBuffer.shift();
      listeners.add.forEach(fn => fn(item));

      // ライブカウントを揺らす
      liveCount = Math.max(8, liveCount + (Math.random() < 0.5 ? -1 : 1));
      listeners.count.forEach(fn => fn({ live: liveCount, today: simBuffer.length }));
    }, 1500 + Math.random() * 2000);

    return { mode: 'demo' };
  }

  // 本番Firebase接続（将来）
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    _firebase = initializeApp(FIREBASE_CONFIG);
    _db = getDatabase(_firebase);
    _moodsRef = ref(_db, 'moods');
    const recent = query(_moodsRef, limitToLast(200));
    onChildAdded(recent, (snap) => {
      const v = snap.val();
      if (v) listeners.add.forEach(fn => fn({ id: snap.key, ...v }));
    });
    return { mode: 'firebase' };
  } catch (e) {
    console.warn('Firebase init failed, falling back to demo', e);
    return initData();
  }
}

export function onMoodAdded(fn) { listeners.add.add(fn); return () => listeners.add.delete(fn); }
export function onCountChange(fn) { listeners.count.add(fn); return () => listeners.count.delete(fn); }

export async function postMood({ mood, message, lat, lon }) {
  // サニタイズ
  const cleanMsg = sanitizeMessage(message || '');
  if (cleanMsg && !isContentClean(cleanMsg)) {
    return { ok: false, error: 'コンテンツが投稿基準に合いません' };
  }
  const moodOk = MOODS.find(m => m.id === mood);
  if (!moodOk) return { ok: false, error: '不正な気分です' };

  // 位置ランダム化（未指定時は地球上のどこかに）
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    const spot = pickWeighted(SIM_HOTSPOTS);
    lat = jitter(spot.lat, 12);
    lon = jitter(spot.lon, 12);
  }

  const item = {
    mood, message: cleanMsg,
    lat: Number(lat.toFixed(2)),
    lon: Number(lon.toFixed(2)),
    ts: Date.now(),
    country: ''
  };

  if (DEMO_MODE || !_moodsRef) {
    item.id = 'me_' + Date.now();
    simBuffer.push(item);
    listeners.add.forEach(fn => fn(item));
    return { ok: true, item };
  }

  try {
    const { push } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    await push(_moodsRef, item);
    return { ok: true, item };
  } catch (e) {
    return { ok: false, error: '送信に失敗しました' };
  }
}

export function getAllMoods() { return [...simBuffer]; }
