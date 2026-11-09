/// <reference lib="es2020.intl" />
import { ArrowClockwise, Check, ShareNetwork } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParticipantStatus } from '../api/events';
import { CopyButton } from './CopyButton';

export interface StatusRow {
  id: string;
  name: string;
  link: string;
}

interface StatusTableProps {
  rows: StatusRow[];
  status: Record<string, ParticipantStatus>;
  eventTitle: string;
  isRefreshing: boolean;
  hasError: boolean;
  onRefresh: () => void;
}

type Filter = 'all' | 'notFilled';

// Detected once: the Web Share API does not appear or disappear at runtime.
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// "3 days ago" / "il y a 3 jours", in the reader's language.
function relativeTime(iso: string, language: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(0, 'minute');
}

function Stamp({ at, label, missingLabel }: { at?: string; label: string; missingLabel: string }) {
  const { i18n } = useTranslation();
  if (!at) {
    return <span className="text-gray-400" aria-label={missingLabel} title={missingLabel}>—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-green-700" title={new Date(at).toLocaleString(i18n.language)}>
      <Check size={16} weight="bold" aria-label={label} />
      <span className="text-gray-600 text-xs">{relativeTime(at, i18n.language)}</span>
    </span>
  );
}

const nudgeButtonClass = 'px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1 text-xs';

function Nudge({ message, title }: { message: string; title: string }) {
  const { t } = useTranslation();

  const handleShare = async () => {
    try {
      await navigator.share({ title, text: message });
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError; nothing to report.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Failed to share:', error);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1 justify-end">
      <CopyButton textToCopy={message} className={nudgeButtonClass}>
        {t('status.copyNudge')}
      </CopyButton>
      {canShare && (
        <button type="button" onClick={handleShare} className={nudgeButtonClass}>
          <ShareNetwork size={16} weight="bold" />
          {t('status.shareNudge')}
        </button>
      )}
    </div>
  );
}

// The organizer's view of who has filled in their wishlist and who has opened
// their assignment, with a Nudge per participant.
export function StatusTable({ rows, status, eventTitle, isRefreshing, hasError, onRefresh }: StatusTableProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = filter === 'all' ? rows : rows.filter(row => !status[row.id]?.wishlistUpdatedAt);

  const nudgeMessage = (row: StatusRow) => eventTitle
    ? t('status.nudgeMessage', { name: row.name, title: eventTitle, link: row.link })
    : t('status.nudgeMessageUntitled', { name: row.name, link: row.link });

  const filterButton = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`px-3 py-1 text-sm ${filter === value ? 'bg-red-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{t('status.help')}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden" role="group">
          {filterButton('all', t('status.filterAll'))}
          {filterButton('notFilled', t('status.filterNotFilled'))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
        >
          <ArrowClockwise size={16} weight="bold" className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? t('status.refreshing') : t('status.refresh')}
        </button>
      </div>
      {hasError && <p className="text-sm text-red-700">{t('status.loadError')}</p>}
      {visible.length === 0 ? (
        <p className="text-sm text-gray-600">{t('status.everyoneFilled')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-2 font-medium">{t('status.name')}</th>
                <th className="py-1 pr-2 font-medium">{t('status.wishlist')}</th>
                <th className="py-1 pr-2 font-medium">{t('status.opened')}</th>
                <th className="py-1 font-medium text-right">{t('status.nudge')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id} className="border-b last:border-b-0 align-middle">
                  <td className="py-2 pr-2 text-gray-800 break-words">{row.name}</td>
                  <td className="py-2 pr-2">
                    <Stamp at={status[row.id]?.wishlistUpdatedAt} label={t('status.filled')} missingLabel={t('status.notFilled')} />
                  </td>
                  <td className="py-2 pr-2">
                    <Stamp at={status[row.id]?.openedAt} label={t('status.opened')} missingLabel={t('status.notOpened')} />
                  </td>
                  <td className="py-2">
                    <Nudge message={nudgeMessage(row)} title={eventTitle || t('events.untitled')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
