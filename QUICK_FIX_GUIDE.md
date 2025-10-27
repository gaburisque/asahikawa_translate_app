# 🚨 マイクが起動しない問題 - 緊急診断ガイド

## 現在の症状
- ✅ タップは反応する（アニメーション動く）
- ❌ マイクが起動しない
- ❌ マイク使用許可のダイアログも表示されない

---

## 🔍 原因の特定（今すぐ実行）

### ステップ1: 開発サーバーを再起動
```bash
# 現在のサーバーを停止（Ctrl+C）
# 再起動
npm run dev
```

### ステップ2: Console を開く
```
Mac Safari > 開発 > [iPhone名] > [ページ名] > Console
```

### ステップ3: ボタンをタップして、以下のログを確認

**表示されるログを教えてください：**

```javascript
// 期待されるログ
📱 Native touchstart (passive: false)
🎤 startRecording called { ... }
🔍 Environment check: {
  hasNavigator: true,
  hasMediaDevices: true,
  hasGetUserMedia: true,
  isSecureContext: ???,  // ← これが重要！
  protocol: "???:",       // ← これが重要！
  hostname: "???"
}
```

---

## 🎯 原因の判定

### ケース1: `isSecureContext: false` または `protocol: "http:"`
**原因**: HTTP接続でアクセスしている

**解決策**: HTTPS接続に変更する

#### 解決策A: ngrok を使う（推奨・最速）
```bash
# ngrok インストール（初回のみ）
brew install ngrok

# アカウント作成（初回のみ）
# https://ngrok.com/ でアカウント作成

# authtoken 設定（初回のみ）
ngrok config add-authtoken YOUR_AUTH_TOKEN

# HTTPS トンネルを作成
ngrok http 3001
```

**表示される URL をコピー**:
```
Forwarding  https://xxxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3001
           ↑ この URL を iPhone Safari で開く
```

#### 解決策B: Vercel にデプロイ（本番環境）
```bash
# Vercel CLI インストール（初回のみ）
npm i -g vercel

# デプロイ
vercel

# 環境変数を設定
# Vercel Dashboard > Settings > Environment Variables
# OPENAI_API_KEY を追加

# 本番デプロイ
vercel --prod
```

#### 解決策C: localtunnel を使う（代替）
```bash
# localtunnel インストール
npm install -g localtunnel

# HTTPS トンネルを作成
lt --port 3001
```

---

### ケース2: `hasGetUserMedia: false`
**原因**: ブラウザが getUserMedia をサポートしていない

**解決策**:
- Safari を最新版にアップデート
- iOS を最新版にアップデート
- プライベートブラウズモードを解除

---

### ケース3: ログが途中で止まる
**原因**: 既に権限が拒否されている

**解決策**:
```
iPhone:
設定 > Safari > カメラとマイク > 「なし」→「確認」に変更
```

または

```
iPhone:
設定 > Safari > Webサイトの設定 > カメラ/マイク > [あなたのドメイン] > 削除
```

---

### ケース4: エラーメッセージが表示される
**エラー内容を教えてください**:
- 画面に表示されるエラーメッセージ
- Console に表示されるエラーログ

---

## 📝 必ず教えてください

**以下の情報をコピーして送ってください**:

```javascript
// Console に表示される「🔍 Environment check:」の内容
{
  hasNavigator: ???,
  hasMediaDevices: ???,
  hasGetUserMedia: ???,
  isSecureContext: ???,  // ← 重要
  protocol: "???:",       // ← 重要
  hostname: "???"
}
```

**画面に表示されるエラーメッセージ**:
```
(ここにエラーメッセージをコピー)
```

---

## 🚀 最速の解決策（99%これで解決）

**iPhone で HTTP接続（http://192.168.x.x:3001）でアクセスしている場合**:

### 方法1: ngrok（5分で解決）
```bash
# Terminal で実行
ngrok http 3001

# 出てきた https:// の URL を iPhone Safari で開く
```

### 方法2: Vercel（10分で解決）
```bash
# Terminal で実行
vercel

# 出てきた https:// の URL を iPhone Safari で開く
```

---

## ⚠️ 重要な事実

**iOS Safari の制約**:
- ❌ HTTP接続では `getUserMedia` が**完全にブロック**される
- ❌ エラーも出ない、ダイアログも出ない、何も起こらない
- ✅ HTTPS または localhost のみ動作

**つまり**:
- `http://192.168.x.x:3001` → ❌ 動かない
- `https://xxxx.ngrok.io` → ✅ 動く
- `https://your-app.vercel.app` → ✅ 動く
- `http://localhost:3001`（Mac Safariで直接）→ ✅ 動く

---

## 📞 次のステップ

1. **今すぐ**: Console のログをコピーして送る
2. **確認**: `isSecureContext` と `protocol` の値
3. **修正**: ngrok または Vercel で HTTPS化

---

## 💡 テスト方法（HTTPS化後）

```
1. ngrok または Vercel の https:// URL を iPhone Safari で開く
2. ボタンをタップ
3. 「"[ドメイン]" がマイクへのアクセスを求めています」ダイアログが表示される
4. 「許可」をタップ
5. 録音が開始される（青いゲージが回る）
```

---

**まずは Console のログを教えてください！** 🔍

