// MoodMap — 設定値
// Firebase設定（公開可能。セキュリティはルールで担保）
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-public-demo-key-replace",
  authDomain: "moodmap-demo.firebaseapp.com",
  databaseURL: "https://moodmap-demo-default-rtdb.firebaseio.com",
  projectId: "moodmap-demo",
  storageBucket: "moodmap-demo.appspot.com",
  appId: "1:000000000000:web:moodmapdemo"
};

// オフライン/デモフォールバック：Firebase未設定でも動く
export const DEMO_MODE = true; // true:ローカルシミュレーション / false:Firebase接続

// 気分の定義（色は地球儀の光色）
export const MOODS = [
  { id: 'joy',     emoji: '😊', label: 'うれしい',   color: '#ffd56b' },
  { id: 'love',    emoji: '🥰', label: '愛',         color: '#ff6b8a' },
  { id: 'calm',    emoji: '😌', label: '穏やか',     color: '#7df0a4' },
  { id: 'excited', emoji: '🤩', label: 'ワクワク',   color: '#ff8fcf' },
  { id: 'tired',   emoji: '😪', label: '疲れた',     color: '#9aa0c0' },
  { id: 'sad',     emoji: '😢', label: 'かなしい',   color: '#4fd6ff' },
  { id: 'angry',   emoji: '😤', label: 'イライラ',   color: '#ff7a4d' },
  { id: 'wonder',  emoji: '✨', label: 'ふしぎ',     color: '#b388ff' }
];

// レート制限（クライアント側）
export const RATE_LIMIT = {
  postCooldownMs: 8000,        // 連投ガード
  maxPostsPerHour: 30,
  maxMessageLength: 80
};

// アナリティクス
export const GA_ID = 'G-MOODMAP01';
