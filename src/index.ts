import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { validateAuth } from './auth.js';
import { createServer } from './server.js';

async function main() {
  try {
    // 認証設定の検証
    await validateAuth();

    // サーバーの作成
    const server = createServer();

    // stdioトランスポートの設定
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // シグナルハンドリング
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await server.close();
      process.exit(0);
    });

    console.error('Google Calendar MCP Server is running');
  } catch (error) {
    console.error('サーバーの起動に失敗しました:', error);
    process.exit(1);
  }
}

main();
