export interface ToolResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const ERROR_PATTERNS: Record<string, string> = {
  "not found": "リソースが見つかりません",
  "unauthorized": "認証エラー。再認証が必要な可能性があります",
  "forbidden": "アクセス権限がありません",
  "invalid": "入力パラメータが不正です",
  "quota": "API制限に達しました。しばらく待ってから再試行してください",
  "rate limit":
    "リクエスト制限に達しました。しばらく待ってから再試行してください",
};

function translateError(message: string): string {
  const lowerMessage = message.toLowerCase();
  for (const [pattern, translation] of Object.entries(ERROR_PATTERNS)) {
    if (lowerMessage.includes(pattern)) {
      return `${translation}: ${message}`;
    }
  }
  return message;
}

export async function handleToolCall<T>(
  fn: () => Promise<T>,
): Promise<ToolResult> {
  try {
    const result = await fn();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: translateError(errorMessage),
        },
      ],
      isError: true,
    };
  }
}
