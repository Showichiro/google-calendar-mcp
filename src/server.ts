import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleToolCall } from "./handler.ts";
import {
  createEvent,
  createEventSchema,
  deleteEvent,
  deleteEventSchema,
  deleteRecurringInstance,
  deleteRecurringInstanceSchema,
  getCalendar,
  getCalendarSchema,
  getEvent,
  getEventSchema,
  // ユーティリティ
  getFreeBusy,
  getFreeBusySchema,
  // カレンダー操作
  listCalendars,
  listCalendarsSchema,
  listColors,
  listColorsSchema,
  // イベント操作
  listEvents,
  listEventsSchema,
  searchEvents,
  searchEventsSchema,
  updateEvent,
  updateEventSchema,
  // 定期イベント
  updateRecurringEvent,
  updateRecurringEventSchema,
} from "./tools/index.ts";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "google-calendar-mcp",
    version: "1.0.0",
  });

  // カレンダー操作ツール
  server.tool(
    "list_calendars",
    "ユーザーがアクセス可能なカレンダーの一覧を取得します",
    listCalendarsSchema.shape,
    (_args) => handleToolCall(() => listCalendars()),
  );

  server.tool(
    "get_calendar",
    "指定したカレンダーの詳細情報を取得します",
    getCalendarSchema.shape,
    (args) => handleToolCall(() => getCalendar(args)),
  );

  // イベント操作ツール
  server.tool(
    "list_events",
    "指定した期間のカレンダーイベント一覧を取得します",
    listEventsSchema.shape,
    (args) => handleToolCall(() => listEvents(args)),
  );

  server.tool(
    "get_event",
    "特定のイベントの詳細情報を取得します",
    getEventSchema.shape,
    (args) => handleToolCall(() => getEvent(args)),
  );

  server.tool(
    "search_events",
    "キーワードでイベントを検索します",
    searchEventsSchema.shape,
    (args) => handleToolCall(() => searchEvents(args)),
  );

  server.tool(
    "create_event",
    "新しいカレンダーイベントを作成します。定期イベントの作成も可能です",
    createEventSchema.shape,
    (args) => handleToolCall(() => createEvent(args)),
  );

  server.tool(
    "update_event",
    "既存のカレンダーイベントを更新します",
    updateEventSchema.shape,
    (args) => handleToolCall(() => updateEvent(args)),
  );

  server.tool(
    "delete_event",
    "カレンダーイベントを削除します",
    deleteEventSchema.shape,
    (args) => handleToolCall(() => deleteEvent(args)),
  );

  // 定期イベント操作ツール
  server.tool(
    "update_recurring_event",
    "定期イベント（繰り返しイベント）を更新します。「この予定のみ」「すべての予定」「これ以降の予定」の3つの編集スコープをサポートします",
    updateRecurringEventSchema.shape,
    (args) => handleToolCall(() => updateRecurringEvent(args)),
  );

  server.tool(
    "delete_recurring_instance",
    "定期イベントの特定のインスタンス（1回分）のみを削除します",
    deleteRecurringInstanceSchema.shape,
    (args) => handleToolCall(() => deleteRecurringInstance(args)),
  );

  // ユーティリティツール
  server.tool(
    "get_freebusy",
    "指定した期間の空き時間情報を取得します。複数のカレンダーの予定が埋まっている時間帯を確認できます",
    getFreeBusySchema.shape,
    (args) => handleToolCall(() => getFreeBusy(args)),
  );

  server.tool(
    "list_colors",
    "カレンダーとイベントで使用可能なカラーパレットを取得します",
    listColorsSchema.shape,
    (_args) => handleToolCall(() => listColors()),
  );

  return server;
}
