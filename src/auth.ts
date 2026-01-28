import { Auth, google } from "npm:googleapis@^144.0.0";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

type OAuth2Client = Auth.OAuth2Client;
let authClient: OAuth2Client | null = null;

interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type: string;
  scope: string;
}

function getCredentialsPath(): string {
  const envPath = Deno.env.get("CLIENT_SECRET_PATH");
  if (envPath) {
    return envPath;
  }
  throw new Error("環境変数 CLIENT_SECRET_PATH が設定されていません");
}

function getTokenPath(): string {
  const envPath = Deno.env.get("TOKEN_PATH");
  if (envPath) {
    return envPath;
  }
  throw new Error("環境変数 TOKEN_PATH が設定されていません");
}

function loadCredentials(): Credentials {
  const credentialsPath = getCredentialsPath();
  try {
    const content = Deno.readTextFileSync(credentialsPath);
    return JSON.parse(content);
  } catch {
    throw new Error(`認証情報ファイルが見つかりません: ${credentialsPath}`);
  }
}

function loadToken(): TokenData | null {
  const tokenPath = getTokenPath();
  try {
    const content = Deno.readTextFileSync(tokenPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveToken(token: TokenData): void {
  const tokenPath = getTokenPath();
  Deno.writeTextFileSync(tokenPath, JSON.stringify(token, null, 2));
}

function extractPortFromUri(uri: string): number {
  const match = uri.match(/:(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 8080; // デフォルトポート
}

function getAuthorizationCode(
  authUrl: string,
  port: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();

    const server = Deno.serve({
      port,
      signal: ac.signal,
      onListen() {
        console.error(
          `認証が必要です。ブラウザで以下のURLを開いてください:\n${authUrl}`,
        );

        // 可能であればブラウザを自動で開く
        try {
          const command = Deno.build.os === "darwin"
            ? "open"
            : Deno.build.os === "windows"
            ? "cmd"
            : "xdg-open";
          const args = Deno.build.os === "windows"
            ? ["/c", "start", authUrl]
            : [authUrl];
          new Deno.Command(command, { args }).spawn();
        } catch {
          // ブラウザを開けなくても続行
        }
      },
    }, (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (code) {
          // サーバーを停止
          setTimeout(() => ac.abort(), 100);
          resolve(code);
          return new Response(
            "<h1>認証が完了しました</h1><p>このウィンドウを閉じてください。</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        } else {
          setTimeout(() => ac.abort(), 100);
          reject(new Error("認証コードが取得できませんでした"));
          return new Response(
            "<h1>エラー</h1><p>認証コードが取得できませんでした。</p>",
            {
              status: 400,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }
      }
      return new Response("Not Found", { status: 404 });
    });

    // タイムアウト設定（5分）
    setTimeout(() => {
      ac.abort();
      reject(new Error("認証がタイムアウトしました"));
    }, 300000);

    // サーバーの終了を待つ
    server.finished.catch(() => {});
  });
}

async function authorize(): Promise<OAuth2Client> {
  const credentials = loadCredentials();
  const clientCredentials = credentials.installed || credentials.web;

  if (!clientCredentials) {
    throw new Error("認証情報ファイルの形式が不正です");
  }

  const { client_id, client_secret, redirect_uris } = clientCredentials;

  // redirect_uriをJSONから取得（なければデフォルト値を使用）
  const redirectUri = redirect_uris?.[0] || "http://localhost:8080/callback";
  const port = extractPortFromUri(redirectUri);

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri,
  );

  // 既存のトークンを確認
  const token = loadToken();
  if (token) {
    oauth2Client.setCredentials(token);

    // トークンの有効期限を確認
    if (token.expiry_date && token.expiry_date > Date.now()) {
      return oauth2Client;
    }

    // リフレッシュトークンで更新を試みる
    if (token.refresh_token) {
      try {
        const { credentials: newCredentials } = await oauth2Client
          .refreshAccessToken();
        saveToken(newCredentials as TokenData);
        oauth2Client.setCredentials(newCredentials);
        return oauth2Client;
      } catch {
        console.error("トークンの更新に失敗しました。再認証が必要です。");
      }
    }
  }

  // 新規認証フロー
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  const code = await getAuthorizationCode(authUrl, port);
  const { tokens } = await oauth2Client.getToken(code);
  saveToken(tokens as TokenData);
  oauth2Client.setCredentials(tokens);

  return oauth2Client;
}

export async function getAuthClient(): Promise<OAuth2Client> {
  if (!authClient) {
    authClient = await authorize();
  }
  return authClient;
}

export function validateAuth(): void {
  try {
    getCredentialsPath();
    getTokenPath();
  } catch {
    throw new Error(
      "認証の設定が不完全です。以下の環境変数を設定してください:\n" +
        "- CLIENT_SECRET_PATH: Google Cloud Consoleからダウンロードした認証情報JSONファイルのパス\n" +
        "- TOKEN_PATH: トークンを保存するファイルのパス",
    );
  }
}
