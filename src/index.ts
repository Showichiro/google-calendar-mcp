import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@^1.25.0/server/stdio.js";
import { validateAuth } from "./auth.ts";
import { createServer } from "./server.ts";

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
    Deno.addSignalListener("SIGINT", async () => {
      await server.close();
      Deno.exit(0);
    });

    Deno.addSignalListener("SIGTERM", async () => {
      await server.close();
      Deno.exit(0);
    });

    console.error("Google Calendar MCP Server is running");
  } catch (error) {
    console.error("サーバーの起動に失敗しました:", error);
    Deno.exit(1);
  }
}

main();
