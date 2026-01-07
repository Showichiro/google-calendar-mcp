import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleToolCall } from './handler.js';
import {
  // カレンダー操作
  listCalendars,
  getCalendar,
  listCalendarsSchema,
  getCalendarSchema,
  // イベント操作
  listEvents,
  getEvent,
  searchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventsSchema,
  getEventSchema,
  searchEventsSchema,
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
  // 定期イベント
  updateRecurringEvent,
  deleteRecurringInstance,
  updateRecurringEventSchema,
  deleteRecurringInstanceSchema,
  // ユーティリティ
  getFreeBusy,
  listColors,
  getFreeBusySchema,
  listColorsSchema,
} from './tools/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'google-calendar-mcp',
    version: '1.0.0',
  });

  // カレンダー操作ツール
  server.tool(
    'list_calendars',
    'ユーザーがアクセス可能なカレンダーの一覧を取得します',
    listCalendarsSchema.shape,
    async (args) => handleToolCall(() => listCalendars())
  );

  server.tool(
    'get_calendar',
    '指定したカレンダーの詳細情報を取得します',
    getCalendarSchema.shape,
    async (args) => handleToolCall(() => getCalendar(args))
  );

  // イベント操作ツール
  server.tool(
    'list_events',
    '指定した期間のカレンダーイベント一覧を取得します',
    listEventsSchema.shape,
    async (args) => handleToolCall(() => listEvents(args))
  );

  server.tool(
    'get_event',
    '特定のイベントの詳細情報を取得します',
    getEventSchema.shape,
    async (args) => handleToolCall(() => getEvent(args))
  );

  server.tool(
    'search_events',
    'キーワードでイベントを検索します',
    searchEventsSchema.shape,
    async (args) => handleToolCall(() => searchEvents(args))
  );

  server.tool(
    'create_event',
    '新しいカレンダーイベントを作成します。定期イベントの作成も可能です',
    createEventSchema.shape,
    async (args) => handleToolCall(() => createEvent(args))
  );

  server.tool(
    'update_event',
    '既存のカレンダーイベントを更新します',
    updateEventSchema.shape,
    async (args) => handleToolCall(() => updateEvent(args))
  );

  server.tool(
    'delete_event',
    'カレンダーイベントを削除します',
    deleteEventSchema.shape,
    async (args) => handleToolCall(() => deleteEvent(args))
  );

  // 定期イベント操作ツール
  server.tool(
    'update_recurring_event',
    '定期イベント（繰り返しイベント）を更新します。「この予定のみ」「すべての予定」「これ以降の予定」の3つの編集スコープをサポートします',
    updateRecurringEventSchema.shape,
    async (args) => handleToolCall(() => updateRecurringEvent(args))
  );

  server.tool(
    'delete_recurring_instance',
    '定期イベントの特定のインスタンス（1回分）のみを削除します',
    deleteRecurringInstanceSchema.shape,
    async (args) => handleToolCall(() => deleteRecurringInstance(args))
  );

  // ユーティリティツール
  server.tool(
    'get_freebusy',
    '指定した期間の空き時間情報を取得します。複数のカレンダーの予定が埋まっている時間帯を確認できます',
    getFreeBusySchema.shape,
    async (args) => handleToolCall(() => getFreeBusy(args))
  );

  server.tool(
    'list_colors',
    'カレンダーとイベントで使用可能なカラーパレットを取得します',
    listColorsSchema.shape,
    async (args) => handleToolCall(() => listColors())
  );

  return server;
}
