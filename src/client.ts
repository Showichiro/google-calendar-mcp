import { google, calendar_v3 } from 'googleapis';
import { getAuthClient } from './auth.js';

let calendarClient: calendar_v3.Calendar | null = null;

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (!calendarClient) {
    const authClient = await getAuthClient();
    calendarClient = google.calendar({ version: 'v3', auth: authClient });
  }
  return calendarClient;
}
