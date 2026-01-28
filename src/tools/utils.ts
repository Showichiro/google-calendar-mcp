import { z } from "npm:zod@^3.24.0";
import { getCalendarClient } from "../client.ts";

// スキーマ定義
export const getFreeBusySchema = z.object({
  timeMin: z.string().describe("確認開始日時（ISO 8601形式）"),
  timeMax: z.string().describe("確認終了日時（ISO 8601形式）"),
  calendarIds: z.array(z.string()).optional().default(["primary"]).describe(
    "確認するカレンダーIDのリスト",
  ),
  timeZone: z.string().optional().describe("タイムゾーン（例: Asia/Tokyo）"),
});

export const listColorsSchema = z.object({});

// ツール実装
export async function getFreeBusy(params: z.infer<typeof getFreeBusySchema>) {
  const validatedParams = getFreeBusySchema.parse(params);
  const calendar = await getCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: validatedParams.timeMin,
      timeMax: validatedParams.timeMax,
      timeZone: validatedParams.timeZone,
      items: validatedParams.calendarIds.map((id) => ({ id })),
    },
  });

  const calendars = response.data.calendars;
  const result: Record<
    string,
    { busy: Array<{ start: string; end: string }> }
  > = {};

  if (calendars) {
    for (const [calendarId, calendarData] of Object.entries(calendars)) {
      result[calendarId] = {
        busy: calendarData.busy?.map((period) => ({
          start: period.start || "",
          end: period.end || "",
        })) || [],
      };
    }
  }

  return {
    timeMin: validatedParams.timeMin,
    timeMax: validatedParams.timeMax,
    calendars: result,
  };
}

export async function listColors() {
  const calendar = await getCalendarClient();
  const response = await calendar.colors.get();

  return {
    calendar: response.data.calendar,
    event: response.data.event,
  };
}

// ツール定義
export const utilTools = [
  {
    name: "get_freebusy",
    description:
      "指定した期間の空き時間情報を取得します。複数のカレンダーの予定が埋まっている時間帯を確認できます",
    inputSchema: {
      type: "object" as const,
      properties: {
        timeMin: {
          type: "string",
          description:
            "確認開始日時（ISO 8601形式、例: 2024-01-15T00:00:00+09:00）",
        },
        timeMax: {
          type: "string",
          description:
            "確認終了日時（ISO 8601形式、例: 2024-01-15T23:59:59+09:00）",
        },
        calendarIds: {
          type: "array",
          items: { type: "string" },
          description:
            '確認するカレンダーIDのリスト（デフォルト: ["primary"]）',
        },
        timeZone: {
          type: "string",
          description: "タイムゾーン（例: Asia/Tokyo）",
        },
      },
      required: ["timeMin", "timeMax"],
    },
  },
  {
    name: "list_colors",
    description: "カレンダーとイベントで使用可能なカラーパレットを取得します",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
