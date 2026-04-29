// MoodMap — セキュリティユーティリティ
// XSS対策 / 入力サニタイズ / レート制限 / NGワード

import { RATE_LIMIT } from './config.js';

// HTMLエスケープ（XSS防止）
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

// 入力サニタイズ（メッセージ用）
export function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  // 制御文字除去
  let out = msg.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\uFEFF]/g, '');
  // 改行は1つに圧縮
  out = out.replace(/[\r\n]+/g, ' ');
  // 連続空白圧縮
  out = out.replace(/\s+/g, ' ').trim();
  // 長さ制限
  out = out.slice(0, RATE_LIMIT.maxMessageLength);
  return out;
}

// 簡易NGワード（露骨な攻撃ワードのみ。表現の自由は尊重）
const NG_PATTERNS = [
  /\b(死ね|殺す|kill\s*you|fuck\s*you)\b/i,
  /(http|https):\/\/\S+/i,        // 投稿にURLは禁止（スパム防止）
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // メアド禁止
  /\b\d{3}-?\d{4}-?\d{4}\b/,      // 電話番号らしき
];
export function isContentClean(msg) {
  if (!msg) return true;
  return !NG_PATTERNS.some(p => p.test(msg));
}

// レート制限（localStorageベース）
const RL_KEY = 'mm_rl_v1';
function loadRL() {
  try {
    const raw = localStorage.getItem(RL_KEY);
    if (!raw) return { last: 0, hour: [] };
    const v = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return { last: 0, hour: [] };
    return { last: v.last|0, hour: Array.isArray(v.hour) ? v.hour : [] };
  } catch { return { last: 0, hour: [] }; }
}
function saveRL(v) {
  try { localStorage.setItem(RL_KEY, JSON.stringify(v)); } catch {}
}
export function canPostNow() {
  const now = Date.now();
  const v = loadRL();
  if (now - v.last < RATE_LIMIT.postCooldownMs) {
    return { ok: false, reason: 'cooldown', wait: RATE_LIMIT.postCooldownMs - (now - v.last) };
  }
  v.hour = v.hour.filter(t => now - t < 3600_000);
  if (v.hour.length >= RATE_LIMIT.maxPostsPerHour) {
    return { ok: false, reason: 'hour_limit' };
  }
  return { ok: true };
}
export function markPosted() {
  const now = Date.now();
  const v = loadRL();
  v.last = now;
  v.hour = (v.hour || []).filter(t => now - t < 3600_000);
  v.hour.push(now);
  saveRL(v);
}

// 端末固有の匿名ID（個人特定不可・ローカル保存）
export function getAnonId() {
  try {
    let id = localStorage.getItem('mm_aid');
    if (!id) {
      const arr = new Uint8Array(16);
      (crypto || window.crypto).getRandomValues(arr);
      id = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
      localStorage.setItem('mm_aid', id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 12);
  }
}

// 位置のジオハッシュ的丸め（プライバシー：おおよそ50km単位）
export function blurCoords(lat, lon) {
  const f = (n) => Math.round(n * 2) / 2; // 0.5度単位 ≈ 約50km
  return { lat: f(lat), lon: f(lon) };
}
