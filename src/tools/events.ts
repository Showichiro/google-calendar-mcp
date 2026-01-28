import { z } from "npm:zod@^3.24.0";
import { getCalendarClient } from "../client.ts";

// スキーマ定義
export const listEventsSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  timeMin: z.string().optional().describe(
    "取得開始日時（ISO 8601形式、例: 2024-01-01T00:00:00Z）",
  ),
  timeMax: z.string().optional().describe("取得終了日時（ISO 8601形式）"),
  maxResults: z.number().optional().default(100).describe("最大取得件数"),
  q: z.string().optional().describe("検索クエリ"),
  singleEvents: z.boolean().optional().default(true).describe(
    "定期イベントを個別インスタンスに展開するか",
  ),
  orderBy: z.enum(["startTime", "updated"]).optional().default("startTime")
    .describe("ソート順"),
});

export const getEventSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  eventId: z.string().describe("イベントID"),
});

export const searchEventsSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  query: z.string().describe("検索キーワード"),
  timeMin: z.string().optional().describe("検索開始日時（ISO 8601形式）"),
  timeMax: z.string().optional().describe("検索終了日時（ISO 8601形式）"),
  maxResults: z.number().optional().default(50).describe("最大取得件数"),
});

export const createEventSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  summary: z.string().describe("イベントタイトル"),
  description: z.string().optional().describe("イベントの説明"),
  location: z.string().optional().describe("場所"),
  start: z.object({
    dateTime: z.string().optional().describe(
      "開始日時（ISO 8601形式、例: 2024-01-15T10:00:00+09:00）",
    ),
    date: z.string().optional().describe(
      "終日イベントの開始日（YYYY-MM-DD形式）",
    ),
    timeZone: z.string().optional().describe("タイムゾーン（例: Asia/Tokyo）"),
  }).describe("開始日時"),
  end: z.object({
    dateTime: z.string().optional().describe("終了日時（ISO 8601形式）"),
    date: z.string().optional().describe(
      "終日イベントの終了日（YYYY-MM-DD形式）",
    ),
    timeZone: z.string().optional().describe("タイムゾーン"),
  }).describe("終了日時"),
  attendees: z.array(z.object({
    email: z.string().describe("参加者のメールアドレス"),
    optional: z.boolean().optional().describe("任意参加かどうか"),
  })).optional().describe("参加者リスト"),
  recurrence: z.array(z.string()).optional().describe(
    '繰り返しルール（RRULE形式、例: ["RRULE:FREQ=WEEKLY;COUNT=10"]）',
  ),
  reminders: z.object({
    useDefault: z.boolean().optional().describe(
      "デフォルトのリマインダーを使用するか",
    ),
    overrides: z.array(z.object({
      method: z.enum(["email", "popup"]).describe("通知方法"),
      minutes: z.number().describe("イベント開始何分前に通知するか"),
    })).optional().describe("カスタムリマインダー"),
  }).optional().describe("リマインダー設定"),
  colorId: z.string().optional().describe("イベントの色ID"),
  visibility: z.enum(["default", "public", "private", "confidential"])
    .optional().describe("公開設定"),
  transparency: z.enum(["opaque", "transparent"]).optional().describe(
    "予定あり(opaque)/予定なし(transparent)",
  ),
});

export const updateEventSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  eventId: z.string().describe("更新するイベントのID"),
  summary: z.string().optional().describe("イベントタイトル"),
  description: z.string().optional().describe("イベントの説明"),
  location: z.string().optional().describe("場所"),
  start: z.object({
    dateTime: z.string().optional().describe("開始日時"),
    date: z.string().optional().describe("終日イベントの開始日"),
    timeZone: z.string().optional().describe("タイムゾーン"),
  }).optional().describe("開始日時"),
  end: z.object({
    dateTime: z.string().optional().describe("終了日時"),
    date: z.string().optional().describe("終日イベントの終了日"),
    timeZone: z.string().optional().describe("タイムゾーン"),
  }).optional().describe("終了日時"),
  attendees: z.array(z.object({
    email: z.string().describe("参加者のメールアドレス"),
    optional: z.boolean().optional().describe("任意参加かどうか"),
  })).optional().describe("参加者リスト"),
  colorId: z.string().optional().describe("イベントの色ID"),
  visibility: z.enum(["default", "public", "private", "confidential"])
    .optional().describe("公開設定"),
  transparency: z.enum(["opaque", "transparent"]).optional().describe(
    "予定あり/予定なし",
  ),
});

export const deleteEventSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  eventId: z.string().describe("削除するイベントのID"),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().default("all")
    .describe("参加者への通知設定"),
});

// ツール実装
export async function listEvents(params: z.infer<typeof listEventsSchema>) {
  const validatedParams = listEventsSchema.parse(params);
  const calendar = await getCalendarClient();

  const response = await calendar.events.list({
    calendarId: validatedParams.calendarId,
    timeMin: validatedParams.timeMin,
    timeMax: validatedParams.timeMax,
    maxResults: validatedParams.maxResults,
    q: validatedParams.q,
    singleEvents: validatedParams.singleEvents,
    orderBy: validatedParams.orderBy,
  });

  const events = response.data.items?.map((event) => ({
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    htmlLink: event.htmlLink,
    created: event.created,
    updated: event.updated,
    creator: event.creator,
    organizer: event.organizer,
    attendees: event.attendees,
    recurrence: event.recurrence,
    recurringEventId: event.recurringEventId,
    colorId: event.colorId,
  }));

  return {
    events,
    nextPageToken: response.data.nextPageToken,
  };
}

export async function getEvent(params: z.infer<typeof getEventSchema>) {
  const { calendarId, eventId } = getEventSchema.parse(params);
  const calendar = await getCalendarClient();

  const response = await calendar.events.get({
    calendarId,
    eventId,
  });

  return {
    id: response.data.id,
    summary: response.data.summary,
    description: response.data.description,
    location: response.data.location,
    start: response.data.start,
    end: response.data.end,
    status: response.data.status,
    htmlLink: response.data.htmlLink,
    created: response.data.created,
    updated: response.data.updated,
    creator: response.data.creator,
    organizer: response.data.organizer,
    attendees: response.data.attendees,
    recurrence: response.data.recurrence,
    recurringEventId: response.data.recurringEventId,
    originalStartTime: response.data.originalStartTime,
    colorId: response.data.colorId,
    reminders: response.data.reminders,
    visibility: response.data.visibility,
    transparency: response.data.transparency,
  };
}

export async function searchEvents(params: z.infer<typeof searchEventsSchema>) {
  const validatedParams = searchEventsSchema.parse(params);
  const calendar = await getCalendarClient();

  const response = await calendar.events.list({
    calendarId: validatedParams.calendarId,
    q: validatedParams.query,
    timeMin: validatedParams.timeMin,
    timeMax: validatedParams.timeMax,
    maxResults: validatedParams.maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items?.map((event) => ({
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    htmlLink: event.htmlLink,
  }));

  return { events };
}

export async function createEvent(params: z.infer<typeof createEventSchema>) {
  const validatedParams = createEventSchema.parse(params);
  const calendar = await getCalendarClient();

  const response = await calendar.events.insert({
    calendarId: validatedParams.calendarId,
    requestBody: {
      summary: validatedParams.summary,
      description: validatedParams.description,
      location: validatedParams.location,
      start: validatedParams.start,
      end: validatedParams.end,
      attendees: validatedParams.attendees,
      recurrence: validatedParams.recurrence,
      reminders: validatedParams.reminders,
      colorId: validatedParams.colorId,
      visibility: validatedParams.visibility,
      transparency: validatedParams.transparency,
    },
  });

  return {
    id: response.data.id,
    summary: response.data.summary,
    htmlLink: response.data.htmlLink,
    start: response.data.start,
    end: response.data.end,
    status: response.data.status,
  };
}

export async function updateEvent(params: z.infer<typeof updateEventSchema>) {
  const validatedParams = updateEventSchema.parse(params);
  const calendar = await getCalendarClient();

  // 更新するフィールドのみを含むオブジェクトを作成
  const updateBody: Record<string, unknown> = {};
  if (validatedParams.summary !== undefined) {
    updateBody.summary = validatedParams.summary;
  }
  if (validatedParams.description !== undefined) {
    updateBody.description = validatedParams.description;
  }
  if (validatedParams.location !== undefined) {
    updateBody.location = validatedParams.location;
  }
  if (validatedParams.start !== undefined) {
    updateBody.start = validatedParams.start;
  }
  if (validatedParams.end !== undefined) updateBody.end = validatedParams.end;
  if (validatedParams.attendees !== undefined) {
    updateBody.attendees = validatedParams.attendees;
  }
  if (validatedParams.colorId !== undefined) {
    updateBody.colorId = validatedParams.colorId;
  }
  if (validatedParams.visibility !== undefined) {
    updateBody.visibility = validatedParams.visibility;
  }
  if (validatedParams.transparency !== undefined) {
    updateBody.transparency = validatedParams.transparency;
  }

  const response = await calendar.events.patch({
    calendarId: validatedParams.calendarId,
    eventId: validatedParams.eventId,
    requestBody: updateBody,
  });

  return {
    id: response.data.id,
    summary: response.data.summary,
    htmlLink: response.data.htmlLink,
    start: response.data.start,
    end: response.data.end,
    updated: response.data.updated,
  };
}

export async function deleteEvent(params: z.infer<typeof deleteEventSchema>) {
  const validatedParams = deleteEventSchema.parse(params);
  const calendar = await getCalendarClient();

  await calendar.events.delete({
    calendarId: validatedParams.calendarId,
    eventId: validatedParams.eventId,
    sendUpdates: validatedParams.sendUpdates,
  });

  return {
    success: true,
    message: `イベント ${validatedParams.eventId} を削除しました`,
  };
}

// ツール定義
export const eventTools = [
  {
    name: "list_events",
    description: "指定した期間のカレンダーイベント一覧を取得します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        timeMin: {
          type: "string",
          description: "取得開始日時（ISO 8601形式、例: 2024-01-01T00:00:00Z）",
        },
        timeMax: {
          type: "string",
          description: "取得終了日時（ISO 8601形式）",
        },
        maxResults: {
          type: "number",
          description: "最大取得件数（デフォルト: 100）",
        },
        q: {
          type: "string",
          description: "検索クエリ",
        },
        singleEvents: {
          type: "boolean",
          description:
            "定期イベントを個別インスタンスに展開するか（デフォルト: true）",
        },
        orderBy: {
          type: "string",
          enum: ["startTime", "updated"],
          description: "ソート順（デフォルト: startTime）",
        },
      },
      required: [],
    },
  },
  {
    name: "get_event",
    description: "特定のイベントの詳細情報を取得します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        eventId: {
          type: "string",
          description: "イベントID",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "search_events",
    description: "キーワードでイベントを検索します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        query: {
          type: "string",
          description: "検索キーワード",
        },
        timeMin: {
          type: "string",
          description: "検索開始日時（ISO 8601形式）",
        },
        timeMax: {
          type: "string",
          description: "検索終了日時（ISO 8601形式）",
        },
        maxResults: {
          type: "number",
          description: "最大取得件数（デフォルト: 50）",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_event",
    description:
      "新しいカレンダーイベントを作成します。定期イベントの作成も可能です",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        summary: {
          type: "string",
          description: "イベントタイトル",
        },
        description: {
          type: "string",
          description: "イベントの説明",
        },
        location: {
          type: "string",
          description: "場所",
        },
        start: {
          type: "object",
          properties: {
            dateTime: {
              type: "string",
              description:
                "開始日時（ISO 8601形式、例: 2024-01-15T10:00:00+09:00）",
            },
            date: {
              type: "string",
              description: "終日イベントの開始日（YYYY-MM-DD形式）",
            },
            timeZone: {
              type: "string",
              description: "タイムゾーン（例: Asia/Tokyo）",
            },
          },
          description: "開始日時（dateTime または date のいずれかを指定）",
        },
        end: {
          type: "object",
          properties: {
            dateTime: {
              type: "string",
              description: "終了日時（ISO 8601形式）",
            },
            date: {
              type: "string",
              description: "終日イベントの終了日（YYYY-MM-DD形式）",
            },
            timeZone: { type: "string", description: "タイムゾーン" },
          },
          description: "終了日時（dateTime または date のいずれかを指定）",
        },
        attendees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string", description: "参加者のメールアドレス" },
              optional: { type: "boolean", description: "任意参加かどうか" },
            },
            required: ["email"],
          },
          description: "参加者リスト",
        },
        recurrence: {
          type: "array",
          items: { type: "string" },
          description:
            '繰り返しルール（RRULE形式、例: ["RRULE:FREQ=WEEKLY;COUNT=10"]）',
        },
        reminders: {
          type: "object",
          properties: {
            useDefault: {
              type: "boolean",
              description: "デフォルトのリマインダーを使用",
            },
            overrides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string", enum: ["email", "popup"] },
                  minutes: { type: "number" },
                },
              },
            },
          },
          description: "リマインダー設定",
        },
        colorId: {
          type: "string",
          description: "イベントの色ID",
        },
        visibility: {
          type: "string",
          enum: ["default", "public", "private", "confidential"],
          description: "公開設定",
        },
        transparency: {
          type: "string",
          enum: ["opaque", "transparent"],
          description: "予定あり(opaque)/予定なし(transparent)",
        },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "既存のカレンダーイベントを更新します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        eventId: {
          type: "string",
          description: "更新するイベントのID",
        },
        summary: {
          type: "string",
          description: "イベントタイトル",
        },
        description: {
          type: "string",
          description: "イベントの説明",
        },
        location: {
          type: "string",
          description: "場所",
        },
        start: {
          type: "object",
          properties: {
            dateTime: { type: "string" },
            date: { type: "string" },
            timeZone: { type: "string" },
          },
          description: "開始日時",
        },
        end: {
          type: "object",
          properties: {
            dateTime: { type: "string" },
            date: { type: "string" },
            timeZone: { type: "string" },
          },
          description: "終了日時",
        },
        attendees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              optional: { type: "boolean" },
            },
          },
          description: "参加者リスト",
        },
        colorId: {
          type: "string",
          description: "イベントの色ID",
        },
        visibility: {
          type: "string",
          enum: ["default", "public", "private", "confidential"],
          description: "公開設定",
        },
        transparency: {
          type: "string",
          enum: ["opaque", "transparent"],
          description: "予定あり/予定なし",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description: "カレンダーイベントを削除します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        eventId: {
          type: "string",
          description: "削除するイベントのID",
        },
        sendUpdates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "参加者への通知設定（デフォルト: all）",
        },
      },
      required: ["eventId"],
    },
  },
];
