import { useTranslation } from 'react-i18next';
import { EventDetails } from '../utils/eventData';

interface DetailsProps {
  details: EventDetails;
  onChangeDetails: (details: EventDetails) => void;
}

export function Details({ details, onChangeDetails }: DetailsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-2">{t('details.eventTitle')}</span>
          <input
            type="text"
            value={details.title}
            onChange={(e) => onChangeDetails({ ...details, title: e.target.value })}
            className="w-full p-2 border rounded"
            placeholder={t('details.eventTitlePlaceholder')}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">{t('details.notes')}</span>
          <span className="block mt-1 mb-2 text-xs text-gray-500">{t('details.notesHelp')}</span>
          <textarea
            value={details.notes}
            onChange={(e) => onChangeDetails({ ...details, notes: e.target.value })}
            className="w-full p-2 border rounded min-h-[100px]"
            placeholder={t('details.notesPlaceholder')}
          />
        </label>
      </div>
    </div>
  );
}
