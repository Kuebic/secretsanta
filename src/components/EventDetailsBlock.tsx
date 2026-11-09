import { useTranslation } from 'react-i18next';
import { buildCalendarFile, calendarFileName, isCalendarDate } from '../utils/calendar';
import { EventDetails } from '../utils/eventData';

interface EventDetailsBlockProps {
  eventId: string;
  details: EventDetails;
}

// What a participant sees of the event's details: only the fields the
// organizer filled in, and an .ics download when there is a valid date.
export function EventDetailsBlock({ eventId, details }: EventDetailsBlockProps) {
  const { t, i18n } = useTranslation();
  const hasDate = isCalendarDate(details.date);

  const formattedDate = () => {
    const [y, m, d] = details.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // The file is built in the browser and handed over as a blob URL; nothing
  // is sent anywhere.
  const downloadCalendarFile = () => {
    const title = details.title || t('events.untitled');
    const file = buildCalendarFile({ title, date: details.date, location: details.location, notes: details.notes }, `${eventId}@secretsanta`);
    const url = URL.createObjectURL(new Blob([file], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = calendarFileName(title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const rows: { label: string; value: string }[] = [
    ...(details.budget ? [{ label: t('details.budget'), value: details.budget }] : []),
    ...(hasDate ? [{ label: t('details.date'), value: formattedDate() }] : []),
    ...(details.location ? [{ label: t('details.location'), value: details.location }] : []),
  ];

  if (rows.length === 0 && !details.notes) return null;

  return (
    <section className="p-4 bg-gray-50 rounded-lg space-y-3" aria-label={t('details.title')}>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-sm font-medium text-gray-700">{label}</dt>
              <dd className="text-gray-800 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {details.notes && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-1">{t('details.notes')}</h2>
          <p className="text-gray-700 whitespace-pre-wrap break-words">{details.notes}</p>
        </div>
      )}
      {hasDate && (
        <button
          type="button"
          onClick={downloadCalendarFile}
          className="w-full sm:w-auto px-4 py-2 bg-white border border-red-700 text-red-700 rounded hover:bg-red-50"
        >
          {t('details.addToCalendar')}
        </button>
      )}
    </section>
  );
}
