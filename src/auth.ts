import { google, Auth } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

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
  const envPath = process.env.CLIENT_SECRET_PATH;
  if (envPath) {
    return envPath;
  }
  throw new Error('環境変数 CLIENT_SECRET_PATH が設定されていません');
}

function getTokenPath(): string {
  const envPath = process.env.TOKEN_PATH;
  if (envPath) {
    return envPath;
  }
  throw new Error('環境変数 TOKEN_PATH が設定されていません');
}

function loadCredentials(): Credentials {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`認証情報ファイルが見つかりません: ${credentialsPath}`);
  }
  const content = fs.readFileSync(credentialsPath, 'utf-8');
  return JSON.parse(content);
}

function loadToken(): TokenData | null {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) {
    return null;
  }
  const content = fs.readFileSync(tokenPath, 'utf-8');
  return JSON.parse(content);
}

function saveToken(token: TokenData): void {
  const tokenPath = getTokenPath();
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
}

function extractPortFromUri(uri: string): number {
  const match = uri.match(/:(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 8080; // デフォルトポート
}

async function getAuthorizationCode(authUrl: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.startsWith('/callback')) {
          const parsedUrl = url.parse(req.url, true);
          const code = parsedUrl.query.code as string;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>認証が完了しました</h1><p>このウィンドウを閉じてください。</p>');
            server.close();
            resolve(code);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>エラー</h1><p>認証コードが取得できませんでした。</p>');
            server.close();
            reject(new Error('認証コードが取得できませんでした'));
          }
        }
      } catch (error) {
        server.close();
        reject(error);
      }
    });

    server.listen(port, () => {
      console.error(`認証が必要です。ブラウザで以下のURLを開いてください:\n${authUrl}`);

      // 可能であればブラウザを自動で開く
      import('child_process').then(({ exec }) => {
        const command = process.platform === 'darwin'
          ? `open "${authUrl}"`
          : process.platform === 'win32'
            ? `start "${authUrl}"`
            : `xdg-open "${authUrl}"`;
        exec(command);
      }).catch(() => {
        // ブラウザを開けなくても続行
      });
    });

    // タイムアウト設定（5分）
    setTimeout(() => {
      server.close();
      reject(new Error('認証がタイムアウトしました'));
    }, 300000);
  });
}

async function authorize(): Promise<OAuth2Client> {
  const credentials = loadCredentials();
  const clientCredentials = credentials.installed || credentials.web;

  if (!clientCredentials) {
    throw new Error('認証情報ファイルの形式が不正です');
  }

  const { client_id, client_secret, redirect_uris } = clientCredentials;

  // redirect_uriをJSONから取得（なければデフォルト値を使用）
  const redirectUri = redirect_uris?.[0] || 'http://localhost:8080/callback';
  const port = extractPortFromUri(redirectUri);

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

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
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        saveToken(newCredentials as TokenData);
        oauth2Client.setCredentials(newCredentials);
        return oauth2Client;
      } catch {
        console.error('トークンの更新に失敗しました。再認証が必要です。');
      }
    }
  }

  // 新規認証フロー
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
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

export async function validateAuth(): Promise<void> {
  try {
    getCredentialsPath();
    getTokenPath();
  } catch (error) {
    throw new Error(
      '認証の設定が不完全です。以下の環境変数を設定してください:\n' +
      '- CLIENT_SECRET_PATH: Google Cloud Consoleからダウンロードした認証情報JSONファイルのパス\n' +
      '- TOKEN_PATH: トークンを保存するファイルのパス'
    );
  }
}
