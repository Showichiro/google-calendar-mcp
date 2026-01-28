# Google Calendar MCP Server

Google Calendar APIを操作するMCP (Model Context Protocol) サーバーです。

## 機能

### カレンダー操作

- `list_calendars` - カレンダー一覧の取得
- `get_calendar` - カレンダー詳細の取得

### イベント操作

- `list_events` - イベント一覧の取得
- `get_event` - イベント詳細の取得
- `search_events` - イベントの検索
- `create_event` - イベントの作成（定期イベント対応）
- `update_event` - イベントの更新
- `delete_event` - イベントの削除

### 定期イベント操作

- `update_recurring_event` - 定期イベントの更新
  - `thisEventOnly`: この予定のみ
  - `all`: すべての予定
  - `thisAndFollowing`: これ以降の予定
- `delete_recurring_instance` - 定期イベントの特定インスタンス削除

### ユーティリティ

- `get_freebusy` - 空き時間情報の取得
- `list_colors` - 利用可能なカラーパレットの取得

## セットアップ

### 前提条件

- [Deno](https://deno.land/) v2.0 以上

### 1. Google Cloud Consoleでの準備

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントIDを作成
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みのリダイレクトURI: `http://localhost:8080/callback`
4. 認証情報JSONファイルをダウンロード

### 2. 環境変数の設定

```bash
export CLIENT_SECRET_PATH="/path/to/client_secret.json"
export TOKEN_PATH="/path/to/token.json"
```

### 3. 起動

```bash
deno task start
```

または、`deno.json` なしで直接実行することもできます:

```bash
deno run --allow-net=www.googleapis.com,accounts.google.com,oauth2.googleapis.com,localhost --allow-read --allow-write --allow-env --allow-run src/index.ts
```

以下のパーミッションが必要です（`deno task start` で自動的に付与されます）:

- `--allow-net`: Google
  APIs、OAuth認証サーバー、ローカルコールバックサーバーへのアクセス
- `--allow-read`: 認証情報・トークンファイルの読み取り
- `--allow-write`: トークンファイルの書き込み
- `--allow-env`: 環境変数の読み取り
- `--allow-run`: ブラウザの自動起動（OAuth認証フロー）

### 4. 初回認証

サーバーを起動すると、初回はブラウザでGoogle認証を求められます。認証後、トークンが保存され、以降は自動的に認証されます。

## 使用方法

### Claude Desktopでの設定

`claude_desktop_config.json`に以下を追加:

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net=www.googleapis.com,accounts.google.com,oauth2.googleapis.com,localhost",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-run",
        "/path/to/google-calendar-mcp/src/index.ts"
      ],
      "env": {
        "CLIENT_SECRET_PATH": "/path/to/client_secret.json",
        "TOKEN_PATH": "/path/to/token.json"
      }
    }
  }
}
```

### Claude Codeでの設定

```bash
claude mcp add google-calendar \
  -e CLIENT_SECRET_PATH=/path/to/client_secret.json \
  -e TOKEN_PATH=/path/to/token.json \
  -- deno run \
  --allow-net=www.googleapis.com,accounts.google.com,oauth2.googleapis.com,localhost \
  --allow-read --allow-write --allow-env --allow-run \
  /path/to/google-calendar-mcp/src/index.ts
```

## 使用例

### イベント一覧の取得

```
今日の予定を教えて
```

### イベントの作成

```
明日の14時から15時に「打ち合わせ」という予定を作成して
```

### 定期イベントの作成

```
毎週月曜日の10時から11時に「週次ミーティング」を10回作成して
```

### 定期イベントの個別編集

```
今週の週次ミーティングだけ時間を11時からに変更して
```

## 技術スタック

- TypeScript
- Deno
- @modelcontextprotocol/sdk
- googleapis
- zod

## ライセンス

MIT
