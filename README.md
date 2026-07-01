# News Feed Dashboard

日本語の簡易 README — 他のチャットやリポジトリ説明にそのまま貼れる内容です。

## 概要
- Node/Express サーバーで複数の RSS を定期収集し、重複除去・クラスタリング・代表見出し生成を行って `public/data.json` に書き出すシングルページのニュースダッシュボード。
- フロントエンドは静的 HTML/CSS/JS（`public/index.html`, `public/style.css`, `public/app.js`）で、自動更新・手動更新・地域別ポップアップ・SNS共有機能を備えています。

## 主要ファイル
- `package.json` — 依存と起動スクリプト（`npm start` で `server.js` を起動）
- `server.js` — RSS 収集、クラスタリング、AI 要約呼び出し（Gemini API 対応）、`public/data.json` 生成、`/api/refresh` エンドポイント
- `public/index.html` — ダッシュボードの HTML
- `public/style.css` — スタイル
- `public/app.js` — クライアント側の描画・UI ロジック（`data.json` をポーリング）
- `public/data.json` — サーバー出力の集約データ（サーバ起動時と定期実行で生成される）

## 動作方法
1. 依存をインストール
```bash
npm install
```
2. サーバーを起動
```bash
npm start
# または（開発）
npm run dev
```
3. ブラウザで `http://localhost:3000` を開く（`PORT` を設定している場合はそのポート）

## 環境変数
- `PORT` — サーバーのポート（任意、デフォルト 3000）
- `GEMINI_API_KEY` — Gemini（AI 要約）を有効にする場合に設定

## 挙動のポイント / 注意点
- サーバーは起動時に一度収集を行い、その後デフォルトで 10 分ごとに RSS を再収集します。
- フロントエンドは `public/data.json` を 30 秒ごとにポーリングして表示を更新します。手動更新ボタンで `/api/refresh` を呼べます。
- `server.js` 内の `USE_AI` フラグはデフォルトで `false` に設定されています。AI を有効にするには環境変数を設定し、必要に応じて `USE_AI` を切り替えてください（注意：API クォータ／遅延）。
- 外部 API（RSS、はてなブックマークカウント、Open-Meteo、Gemini 等）へアクセスするためネットワーク接続が必要です。

## 追加提案
- 英語版 README の追加
- `USE_AI` を環境変数に移し、コード中の手動フラグを除く
- Dockerfile / docker-compose によるコンテナ化

必要なら英語版 README を生成するか、この README をリポジトリにコミットしておきます。どれを進めますか？