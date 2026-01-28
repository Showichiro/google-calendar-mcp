import { z } from "zod";
import { getCalendarClient } from "../client.ts";

// 編集スコープの型定義
export type RecurringEditScope = "thisEventOnly" | "all" | "thisAndFollowing";

// スキーマ定義
export const updateRecurringEventSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  eventId: z.string().describe("定期イベントの親イベントID"),
  scope: z.enum(["thisEventOnly", "all", "thisAndFollowing"]).describe(
    "編集スコープ",
  ),
  instanceDate: z.string().optional().describe(
    "特定インスタンスの日付（thisEventOnly/thisAndFollowing時に必要、YYYY-MM-DD形式）",
  ),
  instanceDateTime: z.string().optional().describe(
    "特定インスタンスの日時（thisEventOnly/thisAndFollowing時に必要、ISO 8601形式）",
  ),
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
  colorId: z.string().optional().describe("イベントの色ID"),
});

export const deleteRecurringInstanceSchema = z.object({
  calendarId: z.string().default("primary").describe("カレンダーID"),
  eventId: z.string().describe("定期イベントの親イベントID"),
  instanceDate: z.string().optional().describe(
    "削除するインスタンスの日付（YYYY-MM-DD形式）",
  ),
  instanceDateTime: z.string().optional().describe(
    "削除するインスタンスの日時（ISO 8601形式）",
  ),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().default("all")
    .describe("参加者への通知設定"),
});

// ヘルパー関数：インスタンスIDの生成
function generateInstanceId(
  eventId: string,
  instanceDate?: string,
  instanceDateTime?: string,
): string {
  if (instanceDateTime) {
    // ISO 8601形式からGoogleカレンダー形式に変換
    // 例: 2024-01-15T10:00:00+09:00 -> 20240115T010000Z (UTC)
    const date = new Date(instanceDateTime);
    const utcString = date.toISOString().replace(/[-:]/g, "").replace(
      /\.\d{3}/,
      "",
    );
    return `${eventId}_${utcString}`;
  } else if (instanceDate) {
    // 終日イベントの場合
    return `${eventId}_${instanceDate.replace(/-/g, "")}`;
  }
  throw new Error("instanceDate または instanceDateTime を指定してください");
}

// ヘルパー関数：RRULEにUNTILを追加
function addUntilToRRule(recurrence: string[], untilDate: string): string[] {
  return recurrence.map((rule) => {
    if (rule.startsWith("RRULE:")) {
      // 既存のUNTILやCOUNTを削除
      let newRule = rule
        .replace(/;UNTIL=[^;]+/g, "")
        .replace(/;COUNT=\d+/g, "");
      // UNTILを追加（日付の前日に設定）
      const until = new Date(untilDate);
      until.setDate(until.getDate() - 1);
      const untilString =
        until.toISOString().replace(/[-:]/g, "").split("T")[0] + "T235959Z";
      newRule += `;UNTIL=${untilString}`;
      return newRule;
    }
    return rule;
  });
}

// ツール実装
export async function updateRecurringEvent(
  params: z.infer<typeof updateRecurringEventSchema>,
) {
  const validatedParams = updateRecurringEventSchema.parse(params);
  const calendar = await getCalendarClient();

  const {
    calendarId,
    eventId,
    scope,
    instanceDate,
    instanceDateTime,
    ...updates
  } = validatedParams;

  // 更新するフィールドを準備
  const updateBody: Record<string, unknown> = {};
  if (updates.summary !== undefined) updateBody.summary = updates.summary;
  if (updates.description !== undefined) {
    updateBody.description = updates.description;
  }
  if (updates.location !== undefined) updateBody.location = updates.location;
  if (updates.start !== undefined) updateBody.start = updates.start;
  if (updates.end !== undefined) updateBody.end = updates.end;
  if (updates.colorId !== undefined) updateBody.colorId = updates.colorId;

  switch (scope) {
    case "thisEventOnly": {
      // 特定のインスタンスのみを更新
      const instanceId = generateInstanceId(
        eventId,
        instanceDate,
        instanceDateTime,
      );

      const response = await calendar.events.patch({
        calendarId,
        eventId: instanceId,
        requestBody: updateBody,
      });

      return {
        scope: "thisEventOnly",
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
        updated: response.data.updated,
        message: "この予定のみを更新しました",
      };
    }

    case "all": {
      // 親イベント（定期イベントのマスター）を更新
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: updateBody,
      });

      return {
        scope: "all",
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
        recurrence: response.data.recurrence,
        updated: response.data.updated,
        message: "すべての予定を更新しました",
      };
    }

    case "thisAndFollowing": {
      // 1. 元のイベントを取得
      const originalEvent = await calendar.events.get({
        calendarId,
        eventId,
      });

      if (!originalEvent.data.recurrence) {
        throw new Error("指定されたイベントは定期イベントではありません");
      }

      // 2. 元のイベントの繰り返しをUNTILで終了
      const splitDate = instanceDate ||
        (instanceDateTime ? instanceDateTime.split("T")[0] : undefined);
      if (!splitDate) {
        throw new Error(
          "instanceDate または instanceDateTime を指定してください",
        );
      }

      const updatedRecurrence = addUntilToRRule(
        originalEvent.data.recurrence,
        splitDate,
      );

      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          recurrence: updatedRecurrence,
        },
      });

      // 3. 新しい定期イベントを作成（変更後のプロパティで）
      const newEventBody: Record<string, unknown> = {
        summary: updates.summary || originalEvent.data.summary,
        description: updates.description !== undefined
          ? updates.description
          : originalEvent.data.description,
        location: updates.location !== undefined
          ? updates.location
          : originalEvent.data.location,
        start: updates.start || {
          dateTime: instanceDateTime,
          date: instanceDate,
          timeZone: originalEvent.data.start?.timeZone,
        },
        end: updates.end || originalEvent.data.end,
        recurrence: originalEvent.data.recurrence.map((rule) => {
          // UNTILとCOUNTを削除して元のルールを継続
          if (rule.startsWith("RRULE:")) {
            return rule.replace(/;UNTIL=[^;]+/g, "").replace(/;COUNT=\d+/g, "");
          }
          return rule;
        }),
        colorId: updates.colorId !== undefined
          ? updates.colorId
          : originalEvent.data.colorId,
        attendees: originalEvent.data.attendees,
        reminders: originalEvent.data.reminders,
      };

      const newEvent = await calendar.events.insert({
        calendarId,
        requestBody: newEventBody,
      });

      return {
        scope: "thisAndFollowing",
        originalEventId: eventId,
        newEventId: newEvent.data.id,
        summary: newEvent.data.summary,
        start: newEvent.data.start,
        end: newEvent.data.end,
        message:
          "これ以降の予定を更新しました（元のイベントを分割して新しい定期イベントを作成）",
      };
    }

    default:
      throw new Error(`不正なスコープ: ${scope}`);
  }
}

export async function deleteRecurringInstance(
  params: z.infer<typeof deleteRecurringInstanceSchema>,
) {
  const validatedParams = deleteRecurringInstanceSchema.parse(params);
  const calendar = await getCalendarClient();

  const { calendarId, eventId, instanceDate, instanceDateTime, sendUpdates } =
    validatedParams;

  // インスタンスIDを生成
  const instanceId = generateInstanceId(
    eventId,
    instanceDate,
    instanceDateTime,
  );

  // 特定のインスタンスを削除
  await calendar.events.delete({
    calendarId,
    eventId: instanceId,
    sendUpdates,
  });

  return {
    success: true,
    deletedInstanceId: instanceId,
    message: `定期イベントの特定インスタンス (${
      instanceDate || instanceDateTime
    }) を削除しました`,
  };
}

// ツール定義
export const recurringTools = [
  {
    name: "update_recurring_event",
    description:
      "定期イベント（繰り返しイベント）を更新します。「この予定のみ」「すべての予定」「これ以降の予定」の3つの編集スコープをサポートします",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        eventId: {
          type: "string",
          description: "定期イベントの親イベントID（recurringEventId）",
        },
        scope: {
          type: "string",
          enum: ["thisEventOnly", "all", "thisAndFollowing"],
          description:
            "編集スコープ: thisEventOnly=この予定のみ, all=すべての予定, thisAndFollowing=これ以降の予定",
        },
        instanceDate: {
          type: "string",
          description:
            "特定インスタンスの日付（終日イベントの場合、YYYY-MM-DD形式）。thisEventOnly/thisAndFollowing時に必要",
        },
        instanceDateTime: {
          type: "string",
          description:
            "特定インスタンスの日時（ISO 8601形式）。thisEventOnly/thisAndFollowing時に必要",
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
        colorId: {
          type: "string",
          description: "イベントの色ID",
        },
      },
      required: ["eventId", "scope"],
    },
  },
  {
    name: "delete_recurring_instance",
    description: "定期イベントの特定のインスタンス（1回分）のみを削除します",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendarId: {
          type: "string",
          description: 'カレンダーID（デフォルト: "primary"）',
        },
        eventId: {
          type: "string",
          description: "定期イベントの親イベントID",
        },
        instanceDate: {
          type: "string",
          description:
            "削除するインスタンスの日付（終日イベントの場合、YYYY-MM-DD形式）",
        },
        instanceDateTime: {
          type: "string",
          description: "削除するインスタンスの日時（ISO 8601形式）",
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
