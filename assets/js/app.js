// MoodMap — メインアプリ
// すべての画面ロジック・UI制御を統括

import { MOODS, RATE_LIMIT } from './config.js';
import { escapeHTML, sanitizeMessage, isContentClean, canPostNow, markPosted, getAnonId, blurCoords } from './security.js';
import { track, initEngagementTracking } from './analytics.js';
import { initData, onMoodAdded, onCountChange, postMood, getAllMoods } from './data.js';
import { initGlobe, spawnMood, focusOn, setAutoRotate, getAutoRotate } from './globe.js';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

const state = {
  selectedMood: null,
  userLoc: null,        // {lat, lon} or null
  myTrail: [],          // 自分の投稿履歴 (localStorage)
  feedTab: 'live',
  feedMaxItems: 60,
  feedItems: []
};

// ============ 起動 ============

window.addEventListener('DOMContentLoaded', async () => {
  // 起動順：地球儀→UI→リスナー登録→データ
  initGlobe($('#globe'));
  buildMoodGrid();
  bindEvents();
  loadMyTrail();
  initEngagementTracking();

  // 先にリスナー登録（初期投入を取りこぼさない）
  onMoodAdded(item => {
    spawnMood({ mood: item.mood, lat: item.lat, lon: item.lon, big: item.id?.startsWith('me_') });
    addFeedItem(item);
  });
  onCountChange(({ live, today }) => {
    $('#liveCountText').textContent = live;
    $('#todayCountText').textContent = today;
  });

  await initData();

  // スプラッシュ消す
  setTimeout(() => $('#splash').classList.add('hide'), 1100);
});

// ============ 気分グリッド構築 ============

function buildMoodGrid() {
  const grid = $('#moodGrid');
  grid.innerHTML = MOODS.map(m => `
    <button type="button" class="mood-btn" role="radio" aria-checked="false"
            data-id="${escapeHTML(m.id)}" aria-label="${escapeHTML(m.label)}">
      <span class="e">${m.emoji}</span>
      <span class="l">${escapeHTML(m.label)}</span>
    </button>
  `).join('');
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    selectMood(id, btn);
  });
}

function selectMood(id, btn) {
  state.selectedMood = id;
  $$('.mood-btn').forEach(b => {
    const sel = b === btn;
    b.classList.toggle('selected', sel);
    b.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  $('#postBtn').disabled = false;
  track('select_mood', { mood: id });
}

// ============ イベント結線 ============

function bindEvents() {
  $('#postBtn').addEventListener('click', onPost);
  $('#addMessageBtn').addEventListener('click', () => {
    const ta = $('#moodMessage');
    ta.hidden = !ta.hidden;
    if (!ta.hidden) {
      ta.focus();
      track('toggle_message', { open: true });
    }
  });
  $('#moodMessage').addEventListener('input', e => {
    e.target.value = e.target.value.slice(0, RATE_LIMIT.maxMessageLength);
  });

  $('#locBtn').addEventListener('click', requestLocation);

  // フィード
  $$('.ftab').forEach(t => t.addEventListener('click', () => {
    $$('.ftab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.feedTab = t.dataset.tab;
    rerenderFeed();
    track('feed_tab', { tab: state.feedTab });
  }));
  $('.feed-head').addEventListener('click', e => {
    if (e.target.closest('.ftab')) return;
    $('#feed').classList.toggle('collapsed');
    track('feed_toggle');
  });

  // FAB
  $('#fabRotate').addEventListener('click', () => {
    const v = !getAutoRotate();
    setAutoRotate(v);
    $('#fabRotate').classList.toggle('active', v);
    track('toggle_rotate', { on: v });
  });
  $('#fabMyTrail').addEventListener('click', () => openTrail());
  $('#fabAbout').addEventListener('click', () => $('#aboutModal').hidden = false);

  // モーダル閉じる
  document.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) {
      e.target.closest('.modal').hidden = true;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal').forEach(m => m.hidden = true);
  });

  // アフターグロー
  $('#afterCloseBtn').addEventListener('click', () => {
    $('#afterglow').classList.remove('show');
  });
  $('#shareCardBtn').addEventListener('click', () => {
    $('#afterglow').classList.remove('show');
    openShareCard();
  });

  // シェアカード操作
  $('#dlCardBtn').addEventListener('click', downloadCard);
  $('#tweetBtn').addEventListener('click', tweetCard);
  $('#copyLinkBtn').addEventListener('click', copyLink);
  $('#trailShareBtn').addEventListener('click', () => {
    track('share_trail');
    const text = encodeURIComponent('わたしの感情の軌跡 🌍✨\n#MoodMap で世界中の気分を地球儀に。');
    const url = encodeURIComponent(location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  });
}

// ============ 投稿処理 ============

async function onPost() {
  if (!state.selectedMood) return;

  // レート制限
  const rl = canPostNow();
  if (!rl.ok) {
    if (rl.reason === 'cooldown') {
      toast(`連投はちょっと待ってね（あと${Math.ceil(rl.wait/1000)}秒）`);
    } else {
      toast('1時間あたりの上限に達しました。少し休もう。');
    }
    track('rate_limited', { reason: rl.reason });
    return;
  }

  const message = $('#moodMessage').value.trim();
  const sanitized = sanitizeMessage(message);
  if (sanitized && !isContentClean(sanitized)) {
    toast('その表現はちょっと…別の言葉でどうぞ。');
    track('content_blocked');
    return;
  }

  $('#postBtn').disabled = true;

  // 位置の取り扱い
  let lat = null, lon = null;
  if (state.userLoc) {
    const { lat: la, lon: lo } = blurCoords(state.userLoc.lat, state.userLoc.lon);
    lat = la; lon = lo;
  }

  const result = await postMood({
    mood: state.selectedMood,
    message: sanitized,
    lat: lat, lon: lon
  });

  if (!result.ok) {
    toast(result.error || '送信できませんでした');
    $('#postBtn').disabled = false;
    return;
  }

  markPosted();
  saveMyTrail({ mood: state.selectedMood, message: sanitized, ts: Date.now() });
  track('post_mood', { mood: state.selectedMood, has_message: !!sanitized, has_loc: !!state.userLoc });

  // フォーカス＆派手な光
  if (typeof result.item.lat === 'number') focusOn(result.item.lat, result.item.lon);

  // アフターグロー表示
  showAfterglow();

  // リセット（選択解除＋テキストクリア）
  setTimeout(() => {
    $$('.mood-btn').forEach(b => b.classList.remove('selected'));
    state.selectedMood = null;
    $('#moodMessage').value = '';
    $('#postBtn').disabled = true;
  }, 600);
}

function showAfterglow() {
  const ag = $('#afterglow');
  ag.hidden = false;
  requestAnimationFrame(() => ag.classList.add('show'));
}

// ============ 位置情報 ============

function requestLocation() {
  if (!navigator.geolocation) {
    toast('この端末では位置情報を使えないみたい');
    return;
  }
  $('#locBtn').textContent = '取得中...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('#locStatus').textContent = '📍 およその位置で投稿します';
      $('#locStatus').classList.add('ok');
      $('#locBtn').classList.add('done');
      track('loc_granted');
    },
    err => {
      $('#locBtn').textContent = '位置を許可';
      toast('位置情報は使わなくても投稿できるよ');
      track('loc_denied');
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
  );
}

// ============ フィード ============

function addFeedItem(item) {
  state.feedItems.unshift(item);
  if (state.feedItems.length > 200) state.feedItems.pop();
  rerenderFeed();
}

function rerenderFeed() {
  const list = $('#feedList');
  let items = state.feedItems;

  if (state.feedTab === 'trending') {
    // 直近30分でmood別カウント上位
    const cutoff = Date.now() - 30 * 60 * 1000;
    const recent = items.filter(i => i.ts >= cutoff);
    const counts = {};
    recent.forEach(i => counts[i.mood] = (counts[i.mood] || 0) + 1);
    const ranked = Object.entries(counts)
      .sort((a,b) => b[1]-a[1])
      .map(([id, n]) => {
        const m = MOODS.find(x => x.id === id);
        return { mood: id, message: `${m?.label || ''} の気分が ${n} 件`, ts: Date.now(), trending: true, count: n };
      });
    items = ranked;
  } else {
    items = items.slice(0, state.feedMaxItems);
  }

  list.innerHTML = items.map(it => {
    const m = MOODS.find(x => x.id === it.mood);
    const emoji = m?.emoji || '✨';
    const msg = it.message ? escapeHTML(it.message) : `<span class="empty">— ${escapeHTML(m?.label || '気分')} —</span>`;
    const meta = it.trending ? 'トレンド' : timeAgo(it.ts);
    return `
      <div class="feed-item">
        <div class="feed-emoji">${emoji}</div>
        <div class="feed-body">
          <div class="feed-msg">${msg}</div>
          <div class="feed-meta">${escapeHTML(meta)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'いま';
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s/60)}分前`;
  return `${Math.floor(s/3600)}時間前`;
}

// ============ シェアカード ============

function openShareCard() {
  const moodId = state.myTrail[state.myTrail.length-1]?.mood || state.selectedMood;
  const msg = state.myTrail[state.myTrail.length-1]?.message || '';
  const m = MOODS.find(x => x.id === moodId) || MOODS[0];

  $('#scMood').textContent = m.emoji;
  $('#scLabel').textContent = m.label;
  $('#scMsg').textContent = msg || (state.userLoc ? 'ここにいる、いまの気持ち。' : '世界のどこかで、いまこの気分。');
  const d = new Date();
  $('#scDate').textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  $('#scLoc').textContent = state.userLoc ? '🌏 地球の上で' : '🌌 どこかの星の上で';

  // カードのオーブ色を気分色に
  const orb = $('#shareCard .sc-orb');
  if (orb) {
    orb.style.background = `radial-gradient(circle at 35% 30%, #fff, ${m.color} 30%, #7b6cff 70%, #4fd6ff 100%)`;
    orb.style.boxShadow = `0 0 60px ${m.color}aa, 0 0 120px #7b6cff80, inset 0 -20px 40px rgba(0,0,0,0.3)`;
  }

  $('#shareModal').hidden = false;
  track('open_share');
}

async function downloadCard() {
  try {
    const card = $('#shareCard');
    const canvas = await html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
    const link = document.createElement('a');
    link.download = `moodmap_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('画像を保存したよ ✨');
    track('download_card');
  } catch (e) {
    toast('保存に失敗… もう一度試してね');
  }
}

function tweetCard() {
  const m = MOODS.find(x => x.id === state.selectedMood) || MOODS.find(x => x.id === state.myTrail[state.myTrail.length-1]?.mood) || MOODS[0];
  const text = encodeURIComponent(`いまの気分は ${m.emoji}${m.label}。\n世界中の気分を地球儀で見れるよ → #MoodMap`);
  const url = encodeURIComponent(location.href);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  track('tweet_card');
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('リンクをコピーしたよ');
    track('copy_link');
  } catch {
    toast('コピーできなかった…');
  }
}

// ============ 自分の軌跡 ============

const TRAIL_KEY = 'mm_trail_v1';
function loadMyTrail() {
  try {
    const v = JSON.parse(localStorage.getItem(TRAIL_KEY) || '[]');
    state.myTrail = Array.isArray(v) ? v.slice(-200) : [];
  } catch { state.myTrail = []; }
}
function saveMyTrail(item) {
  state.myTrail.push(item);
  if (state.myTrail.length > 200) state.myTrail.shift();
  try { localStorage.setItem(TRAIL_KEY, JSON.stringify(state.myTrail)); } catch {}
}

function openTrail() {
  const chart = $('#trailChart');
  const empty = $('#trailEmpty');
  if (state.myTrail.length === 0) {
    chart.innerHTML = '';
    empty.hidden = false;
  } else {
    empty.hidden = true;
    // 最近30件を時系列で
    const items = state.myTrail.slice(-30);
    const max = Math.max(...items.map((_,i,a) => 1));
    chart.innerHTML = items.map((it, i) => {
      const m = MOODS.find(x => x.id === it.mood);
      const h = 20 + ((i+1) / items.length) * 90;
      return `
        <div class="trail-bar" title="${escapeHTML(m?.label||'')}">
          <div class="b" style="height:${h}px; background: linear-gradient(180deg, ${m?.color||'#fff'}, #7b6cff)"></div>
          <div class="e">${m?.emoji||'✨'}</div>
        </div>
      `;
    }).join('');
  }
  $('#trailModal').hidden = false;
  track('open_trail', { count: state.myTrail.length });
}

// ============ トースト ============

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, 2600);
}

// グローバル（デバッグ）
window.__MM_DEBUG__ = false;
window.__MM_VERSION__ = '1.0.0';
