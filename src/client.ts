import { calendar_v3, google } from "googleapis";
import { getAuthClient } from "./auth.ts";

let calendarClient: calendar_v3.Calendar | null = null;

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (!calendarClient) {
    const authClient = await getAuthClient();
    calendarClient = google.calendar({ version: "v3", auth: authClient });
  }
  return calendarClient;
}
