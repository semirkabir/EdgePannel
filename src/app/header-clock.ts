import { getClockFormat, getHeaderDateFormat, type HeaderDateFormat } from '@/services/preferences-content';

function getDatePart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function formatHeaderDate(dateParts: Intl.DateTimeFormatPart[], monthNameParts: Intl.DateTimeFormatPart[], format: HeaderDateFormat): string {
  const day = getDatePart(dateParts, 'day');
  const month = getDatePart(dateParts, 'month');
  const year = getDatePart(dateParts, 'year');
  const yearShort = year.slice(-2);
  const monthShort = getDatePart(monthNameParts, 'month');

  switch (format) {
    case 'mm/dd/yy':
      return `${month}/${day}/${yearShort}`;
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'dd/mm/yy':
      return `${day}/${month}/${yearShort}`;
    case 'dd/mm/yyyy':
      return `${day}/${month}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${month}-${day}`;
    case 'dd-mon-yyyy':
    default:
      return `${day} ${monthShort} ${year}`;
  }
}

export function formatClockTime(tz: string): string {
  const now = new Date();
  const resolvedTz = tz === 'local'
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    : tz;
  const use12h = getClockFormat() === '12h';
  const dateFormat = getHeaderDateFormat();
  try {
    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolvedTz,
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    }).formatToParts(now);
    const monthNameParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolvedTz,
      month: 'short',
    }).formatToParts(now);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolvedTz,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: use12h, timeZoneName: 'short',
    }).formatToParts(now);
    const dateText = formatHeaderDate(dateParts, monthNameParts, dateFormat);
    const weekday = getDatePart(dateParts, 'weekday');
    const time = use12h
      ? `${getDatePart(timeParts, 'hour')}:${getDatePart(timeParts, 'minute')}:${getDatePart(timeParts, 'second')} ${getDatePart(timeParts, 'dayPeriod')}`
      : `${getDatePart(timeParts, 'hour')}:${getDatePart(timeParts, 'minute')}:${getDatePart(timeParts, 'second')}`;
    return `${weekday}, ${dateText} ${time} ${getDatePart(timeParts, 'timeZoneName')}`;
  } catch {
    return now.toUTCString().replace('GMT', 'UTC');
  }
}
