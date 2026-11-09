// An iCalendar (RFC 5545) file for the exchange date, built entirely in the
// browser so nothing a participant sees leaves it in plaintext (ADR 0002).

export interface CalendarEntry {
  title: string;
  // YYYY-MM-DD; the exchange is an all-day event.
  date: string;
  location: string;
  notes: string;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(date: string): boolean {
  const match = DATE.exec(date);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

const compact = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // Other control characters are not allowed in TEXT values.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
}

// Lines longer than 75 octets are folded with CRLF + space, never inside a
// UTF-8 sequence.
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildCalendarFile(entry: CalendarEntry, uid: string, now: Date = new Date()): string {
  const [, y, m, d] = DATE.exec(entry.date)!.map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//secretsanta//Event details//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(start)}`,
    `DTEND;VALUE=DATE:${compact(end)}`,
    `SUMMARY:${escapeText(entry.title)}`,
    ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
    ...(entry.notes ? [`DESCRIPTION:${escapeText(entry.notes)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function calendarFileName(title: string): string {
  const slug = title.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60);
  return `${slug || 'event'}.ics`;
}
