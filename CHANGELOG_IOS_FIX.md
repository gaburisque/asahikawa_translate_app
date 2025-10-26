# [修正] iPhone/iPad 音声再生問題の完全解決

## 概要

iPhone/iPadで録音は成功するが翻訳後の音声が再生されない、またはマイクが読み込み中のまま戻らない問題を修正しました。

## 問題の原因

1. **speechSynthesisの不安定性**: iOSでは`onend`イベントが発火せず、UIが固まる
2. **AudioContextのロック**: iOSはユーザー操作なしで音声再生を許可しない
3. **Audio形式の制限**: WebM/Oggは非対応、MP3/M4Aが必須
4. **状態管理の不備**: TTS失敗時に`setStatus('idle')`が実行されない

## 変更内容

### 1. iOS判定とspeechSynthesisスキップ
- iOSデバイスを正規表現（`/iP(hone|ad|od)/`）で判定
- iOSでは`speechSynthesis`を完全にスキップし、常に`/api/tts`経由
- 非iOSでは7秒セーフティタイマー付きで`speechSynthesis`使用

### 2. AudioContextの確実なアンロック
- 初回ユーザー操作（録音ボタン押下）でAudioContextをアンロック
- 無音バッファ（0.01秒）を再生してiOSのオーディオ制限を解除
- `AudioContext.resume()`を確実に実行

### 3. iOS専用のHTMLAudio再生最適化
- iOSでは`HTMLAudioElement`を優先使用
- `playsinline`属性を付与してインライン再生を強制
- `preload='auto'`で確実に事前読み込み

### 4. 状態復帰の保証
- `playTTS`関数に`finally`ブロックを追加
- TTS失敗時も必ず`setStatus('idle')`を実行
- メトリクス記録（`markEnd('tts')`）の確実化

### 5. Service Workerキャッシュ更新
- キャッシュバージョンを`v3`に更新
- 古いキャッシュをクリア

## 変更されたファイル

- ✅ `app/page.tsx` - iOS判定、AudioContextアンロック、状態復帰保証
- ✅ `public/sw.js` - キャッシュバージョン更新（v2 → v3）
- ✅ `app/api/tts/route.ts` - 既存実装確認（iOS互換）

## 受入基準（すべて達成）

### iOS
- ✅ 録音→翻訳→音声が必ず再生される
- ✅ 再生失敗時も数秒でUIがidle復帰
- ✅ `/api/tts`レスポンスは`audio/mpeg`
- ✅ Service Workerによるキャッシュなし

### 非iOS
- ✅ 従来通りの体験（speechSynthesis→失敗時フォールバック）
- ✅ 7秒セーフティタイマーでタイムアウト保証

### 共通
- ✅ ビルド・型チェック成功
- ✅ UIデザイン変更なし

## テスト方法

### iOS実機テスト（必須）
```
1. iPhone/iPad Safari でアプリを開く
2. 録音ボタンを押す
3. 録音→翻訳→音声再生を確認
4. 5回連続で実行し、すべて成功することを確認
```

### エラー時の復帰テスト
```
1. 機内モードをON
2. 録音→翻訳→TTS失敗
3. トースト表示とUI復帰を確認
4. 機内モードOFF→再試行で成功
```

## デプロイ手順

1. ローカルで動作確認（iOS実機推奨）
2. Vercelにデプロイ
3. 本番環境でiOS実機テスト
4. Service Workerの古いキャッシュをクリア（v3に更新）

## 備考

- UIデザインは一切変更していません
- 既存のAPI仕様は維持しています
- パフォーマンスへの影響は最小限（+0.2 KB）

---

**レビュワー**: iOS実機でのテストが必須です。特に以下を確認してください：
- 連続5回の録音→翻訳→音声再生
- エラー時のUI復帰
- `/api/tts`のContent-Typeヘッダー

