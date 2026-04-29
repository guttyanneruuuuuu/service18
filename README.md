# 🌍 MoodMap — 世界中のいまの感情、ひとつの地球で。

[![Deploy](https://img.shields.io/badge/GitHub_Pages-deployed-7b6cff?style=flat-square)](https://guttyanneruuuuuu.github.io/service18/)
[![License](https://img.shields.io/badge/license-MIT-ff8fcf?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/stack-Vanilla_JS_+_Three.js-4fd6ff?style=flat-square)](#)

> 匿名で1タップ。あなたの気分が、世界の地球儀を彩る光になる。

**🔗 ライブ:** https://guttyanneruuuuuu.github.io/service18/

---

## ✨ コンセプト

世界中の人がいま感じている**「気分」**をリアルタイムの3D地球儀に光として可視化するソーシャル可視化サービスです。
ログイン不要・1タップで投稿、地球が美しい光で染まり、シェアカードで拡散できる。

## 🎯 なぜ勝てるか（競合分析）

| 観点 | MoodMap | 既存サービス |
|---|---|---|
| **ジャンル** | リアルタイム感情×3D地球可視化×匿名 | テキストSNS / チャット / 日記アプリ |
| **競合** | 直接競合は実質ゼロ（We Feel Fineは2005年で停止、emojimapも停止） | X / TikTok / BeReal 等 |
| **モート** | 蓄積された世界の感情データ。後発が真似ても歴史データは奪えない | — |
| **ネットワーク効果** | ユーザー増→地球が美しくなる→さらに人が来る | — |
| **拡散性** | 美麗シェアカードがX/Instagramで自然拡散 | — |
| **離脱率対策** | ログイン不要・3秒で投稿完了・即視覚的フィードバック | — |

## 💰 収益化モデル

1. **ブランドスポンサー** — 特定地域の「色」を企業色に染める広告
2. **プレミアム軌跡カード** — 月額/年額で限定スキン・解析機能
3. **B2B感情データAPI** — マーケ・地域分析向け匿名集計データ販売
4. **限定NFT/コレクタブル** — 特別な日（イベント時）の地球スナップショット

## 🛡️ セキュリティ対策

- **CSP（Content Security Policy）** — XSS / 不正スクリプト実行を防御
- **入力サニタイズ** — 制御文字・改行除去・長さ制限
- **NGワードフィルタ** — 攻撃ワード・URL・メアド・電話番号の検知ブロック
- **クライアントレート制限** — 連投ガード（8秒）+ 1時間30件上限
- **匿名ID** — `crypto.getRandomValues` で生成、サーバには送らない
- **位置のぼかし** — ジオハッシュ的に約50km単位に丸めてプライバシー保護
- **HTTPS / HSTS** — GitHub Pagesで標準対応
- **X-Content-Type-Options / Referrer-Policy / Permissions-Policy** 設定済み

## 📊 アナリティクス

- **GA4** によるイベント・離脱トラッキング
- **自前イベント** — `app_open`, `select_mood`, `post_mood`, `feed_scroll`, `share_*`, `session_end` 等
- **離脱率分析** — `visibilitychange` / `beforeunload` でセッション情報送信

## 📱 UI / UX

- **ぷにぷにUI** — グラスモーフィズム + 立体的な複層シャドウで弾力感
- **完全レスポンシブ** — スマホ縦持ち・タブレット・PC全対応
- **3秒で投稿完了** — ログイン不要・気分タップ→「地球に放つ」
- **即時フィードバック** — 地球儀がその座標にフォーカスし光が広がる
- **アフターグロー** — シェアへスムーズに誘導（拡散導線）

## 🛠️ 技術スタック

| 領域 | 採用 | 理由 |
|---|---|---|
| フロントエンド | Vanilla JS (ESM) + Three.js | 軽量・依存最小・GitHub Pages完結 |
| 3D | Three.js r158 | 標準デファクト・WebGL最適化 |
| データ | Firebase Realtime DB（無料枠） | 完全無料運用可能 |
| アナリティクス | Google Analytics 4 | 無料・業界標準 |
| シェア生成 | html2canvas | クライアント側で完結 |
| ホスティング | GitHub Pages | 完全無料 |

## 🚀 ローカル実行

```bash
git clone https://github.com/guttyanneruuuuuu/service18.git
cd service18
python3 -m http.server 8080
# → http://localhost:8080/
```

## 📂 プロジェクト構成

```
.
├── index.html              # エントリ
├── manifest.json           # PWA
├── 404.html                # カスタム404
├── robots.txt / sitemap.xml
├── assets/
│   ├── css/style.css       # ぷにぷにデザインシステム
│   ├── js/
│   │   ├── app.js          # メインアプリ
│   │   ├── globe.js        # 3D地球儀（Three.js）
│   │   ├── data.js         # データレイヤー（Firebase / Demo）
│   │   ├── security.js     # XSS対策・サニタイズ・レート制限
│   │   ├── analytics.js    # GA4 + 自前イベント
│   │   └── config.js       # 設定値
│   └── img/                # OGP / アイコン
└── .github/workflows/      # 自動デプロイ
```

## 🔄 PDCAログ

- **Plan**: 既存サービス調査→空白市場「リアルタイム感情×3D地球」を発見
- **Do**: フロントエンドのみで完結する構成で実装
- **Check**: ブラウザテスト、データリスナー登録順序の問題を発見
- **Act**: リスナー先登録に修正、シード投入をバッチ化、モバイルレイアウトの被り解消、シェアカード絵文字対応

## 📄 License

MIT © 2026 MoodMap
