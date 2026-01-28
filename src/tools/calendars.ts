import { z } from "zod";
import { getCalendarClient } from "../client.ts";

// スキーマ定義
export const listCalendarsSchema = z.object({});

export const getCalendarSchema = z.object({
  calendarId: z.string().describe(
    'カレンダーID（例: "primary" または メールアドレス）',
  ),
});

// ツール実装
export async function listCalendars() {
  const calendar = await getCalendarClient();
  const response = await calendar.calendarList.list();

  const calendars = response.data.items?.map((cal) => ({
    id: cal.id,
    summary: cal.summary,
    description: cal.description,
    primary: cal.primary,
    accessRole: cal.accessRole,
    backgroundColor: cal.backgroundColor,
    foregroundColor: cal.foregroundColor,
    timeZone: cal.timeZone,
  }));

  return { calendars };
}

export async function getCalendar(params: z.infer<typeof getCalendarSchema>) {
  const { calendarId } = getCalendarSchema.parse(params);
  const calendar = await getCalendarClient();
  const response = await calendar.calendars.get({ calendarId });

  return {
    id: response.data.id,
    summary: response.data.summary,
    description: response.data.description,
    timeZone: response.data.timeZone,
    location: response.data.location,
  };
}

// ツール定義
export const calendarTools = [
  {
    name: "list_calendars",
    description: "ユーザーがアクセス可能なカレンダーの一覧を取得します",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_calendar",
    description: "指定したカレンダーの詳細情報を取得します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description:
            'カレンダーID（"primary" でプライマリカレンダー、またはメールアドレス形式のカレンダーID）',
        },
      },
      required: ["calendarId"],
    },
  },
];
