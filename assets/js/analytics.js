// MoodMap — アナリティクス
// GA4 + 自前イベントトラッキング（ユーザー離脱率分析用）

import { GA_ID } from './config.js';

const SESSION_KEY = 'mm_sess_v1';

// セッション開始時刻
function sess() {
  try {
    let s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (!s.start || Date.now() - s.lastActive > 30*60*1000) {
      s = { start: Date.now(), lastActive: Date.now(), events: 0, posts: 0 };
    }
    s.lastActive = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  } catch { return { start: Date.now(), lastActive: Date.now(), events: 0, posts: 0 }; }
}

export function track(eventName, params = {}) {
  try {
    const s = sess();
    s.events++;
    if (eventName === 'post_mood') s.posts++;
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));

    // GA4
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...params,
        session_dur_sec: Math.round((Date.now() - s.start) / 1000),
        session_events: s.events
      });
    }

    // 開発時ログ
    if (window.__MM_DEBUG__) console.log('[track]', eventName, params);
  } catch (e) { /* noop */ }
}

// 離脱検知
export function initEngagementTracking() {
  // ページ表示状態
  document.addEventListener('visibilitychange', () => {
    track(document.hidden ? 'page_hidden' : 'page_visible');
  });

  // 離脱前
  window.addEventListener('beforeunload', () => {
    const s = sess();
    track('session_end', {
      duration_sec: Math.round((Date.now() - s.start) / 1000),
      total_posts: s.posts,
      total_events: s.events
    });
  });

  // スクロール深度（フィード操作）
  let maxScroll = 0;
  const feedList = document.getElementById('feedList');
  if (feedList) {
    feedList.addEventListener('scroll', () => {
      const ratio = feedList.scrollTop / Math.max(1, feedList.scrollHeight - feedList.clientHeight);
      if (ratio > maxScroll + 0.25) {
        maxScroll = ratio;
        track('feed_scroll', { depth: Math.round(ratio * 100) });
      }
    }, { passive: true });
  }

  // 初回表示
  track('app_open', {
    referrer: document.referrer ? new URL(document.referrer).hostname : 'direct',
    viewport: `${window.innerWidth}x${window.innerHeight}`
  });
}
