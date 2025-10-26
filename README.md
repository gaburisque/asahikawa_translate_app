# Asahikawa Voice Translator (AVT)

旭川観光客向けのリアルタイム音声翻訳PWA

## 機能

- 🎤 5秒間の音声録音（WebM/Opus）
- 🌐 自動言語検出（日本語 ↔ 英語）
- 🔊 音声読み上げ（Web Speech API + Web Audio API fallback）
- 📱 Progressive Web App（スマホにインストール可能）
- ⚡ パフォーマンス計測機能
- 💬 待機メッセージのランダム表示（6候補、リロードで変わる）
- 📱 スマホ誤操作対策（テキスト選択・ダブルタップズーム防止）
- 🔈 TTS再生安定化（AudioContext unlock、自動再生ポリシー対応）
- 💻 PC録音インジケータ（進捗バー・タイマー表示）

## テスト手順

詳細なテスト手順は [TESTING.md](./TESTING.md) を参照してください。

- 待機メッセージのランダム表示確認
- スマホ誤操作防止テスト
- E2E翻訳テスト（録音→翻訳→音声再生）
- PC録音インジケータ表示テスト
- エラーハンドリングテスト

## クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集してOpenAI APIキーを追加：

```
OPENAI_API_KEY=sk-...
```

**または、デモモードで実行（APIキー不要）：**

```
OPENAI_API_KEY=demo
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く

### 4. 本番ビルド

```bash
npm run build
npm start
```

## Vercelへのデプロイ

1. GitHubにプッシュ
2. [Vercel](https://vercel.com/new)でインポート
3. 環境変数を設定：`OPENAI_API_KEY`
4. デプロイ

## ホーム画面に追加

### iOS（Safari）
1. 共有ボタン（□↑）をタップ
2. 「ホーム画面に追加」を選択
3. 「追加」をタップ

### Android（Chrome）
1. メニュー（⋮）をタップ
2. 「ホーム画面に追加」を選択
3. 「追加」をタップ

## デモモード

`OPENAI_API_KEY=demo` に設定すると、OpenAI APIを呼ばずにモックレスポンスを返します。以下の用途に最適：
- UI/UXのテスト
- APIコストをかけずにデモを共有
- APIキーなしでの開発

**モックレスポンス：**
- ASR：「こんにちは、旭川へようこそ」を返却
- Translate：事前定義された翻訳を返却
- TTS：無音の音声を返却

## 技術スタック

- **フレームワーク:** Next.js 14（App Router）
- **言語:** TypeScript
- **スタイリング:** Tailwind CSS
- **バリデーション:** Zod
- **API:** OpenAI（Whisper、GPT-4o、TTS）
- **音声:** MediaRecorder、Web Speech API

## アーキテクチャ

```
app/
├── page.tsx          # メインUI（録音、翻訳表示）
├── layout.tsx        # アプリレイアウト、PWAメタデータ
├── manifest.ts       # PWAマニフェスト
├── api/
│   ├── asr/          # 音声認識（Whisper）
│   ├── translate/    # 翻訳（GPT-4o）
│   └── tts/          # 音声合成（OpenAI TTS）
lib/
├── openai.ts         # OpenAIクライアントラッパー
├── metrics.ts        # パフォーマンス計測
└── fetchWithAbort.ts # タイムアウトユーティリティ
public/
├── sw.js             # Service Worker（Network-first）
└── icon.png          # PWAアイコン（512x512）
```

## パフォーマンス計測

アプリは以下を追跡・記録します：
- **ASR:** 音声認識時間
- **Translate:** 翻訳時間
- **TTS:** 音声合成時間
- **E2E:** エンドツーエンド総時間

翻訳後、ブラウザのコンソールで計測ログを確認できます。

## ブラウザサポート

- ✅ Chrome/Edge（デスクトップ & モバイル）
- ✅ Safari（デスクトップ & iOS）- フォールバック付き
- ✅ Firefox（デスクトップ & Android）

**注意：** iOS Safariは音声再生にユーザージェスチャーが必要です。

## ライセンス

MIT

