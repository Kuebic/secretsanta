import { useTranslation } from 'react-i18next';
import { DETAILS_LIMITS, EventDetails } from '../utils/eventData';

interface DetailsProps {
  details: EventDetails;
  onChangeDetails: (details: EventDetails) => void;
}

type TextField = keyof typeof DETAILS_LIMITS;

export function Details({ details, onChangeDetails }: DetailsProps) {
  const { t } = useTranslation();

  // maxLength stops typing, but a paste or a migrated value can still be long.
  const change = (field: TextField, value: string) =>
    onChangeDetails({ ...details, [field]: value.slice(0, DETAILS_LIMITS[field]) });

  const textInput = (field: Exclude<TextField, 'notes'>, label: string, placeholder: string) => (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <input
        type="text"
        value={details[field]}
        maxLength={DETAILS_LIMITS[field]}
        onChange={(e) => change(field, e.target.value)}
        className="w-full p-2 border rounded"
        placeholder={placeholder}
      />
    </label>
  );

  const notesLeft = DETAILS_LIMITS.notes - details.notes.length;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <p className="text-xs text-gray-500">{t('details.help')}</p>
        {textInput('title', t('details.eventTitle'), t('details.eventTitlePlaceholder'))}
        {textInput('budget', t('details.budget'), t('details.budgetPlaceholder'))}
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-2">{t('details.date')}</span>
          <input
            type="date"
            value={details.date}
            onChange={(e) => onChangeDetails({ ...details, date: e.target.value })}
            className="w-full p-2 border rounded bg-white"
          />
        </label>
        {textInput('location', t('details.location'), t('details.locationPlaceholder'))}
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-2">{t('details.notes')}</span>
          <textarea
            value={details.notes}
            maxLength={DETAILS_LIMITS.notes}
            onChange={(e) => change('notes', e.target.value)}
            className="w-full p-2 border rounded min-h-[100px]"
            placeholder={t('details.notesPlaceholder')}
          />
          <span className={`block mt-1 text-xs text-right ${notesLeft < 100 ? 'text-red-700' : 'text-gray-500'}`} aria-live="polite">
            {t('details.charactersLeft', { count: notesLeft })}
          </span>
        </label>
      </div>
    </div>
  );
}
