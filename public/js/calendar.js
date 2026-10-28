/**
 * Calendar export: an RFC 5545 .ics file with every milestone as an all-day
 * event, and Google Calendar "add event" links. Pure functions (testable).
 */

/**
 * Escapes text per RFC 5545 section 3.3.11.
 * @param {string} text
 */
export function escapeIcsText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds content lines longer than 75 octets (RFC 5545 section 3.1).
 * @param {string} line
 */
export function foldLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (size + len > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** @param {string} iso YYYY-MM-DD */
const compact = (iso) => iso.replaceAll('-', '');

/** @param {string} iso */
function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Pick<import('../../types/plan.js').Plan, 'input' | 'timeline'>} plan
 * @param {string} [stamp] DTSTAMP in UTC basic format
 */
export function buildIcs(
  plan,
  stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, ''),
) {
  const name = plan.input.title || `${plan.input.eventType.replace('_', ' ')} in ${plan.input.city}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utsav AI//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const m of plan.timeline.milestones) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.id}-${compact(m.due)}@utsav-ai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(m.due)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(m.due))}`,
      foldLine(`SUMMARY:${escapeIcsText(`${m.title} (${name})`)}`),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Google Calendar template link for a single all-day task.
 * @param {string} title
 * @param {string} dateIso
 * @param {string} details
 */
export function googleCalendarUrl(title, dateIso, details) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${compact(dateIso)}/${compact(nextDay(dateIso))}`);
  url.searchParams.set('details', details);
  return url.toString();
}
