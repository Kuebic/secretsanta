import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowsClockwise, DownloadSimple, Eye, EyeSlash } from '@phosphor-icons/react';
import { AssignmentStatus } from '../api/events';
import { Participants } from '../types';
import { countOpened, CurrentDraw, hasDraw, isDrawStale } from '../utils/draw';
import { generateCSV } from '../utils/links';

export type DrawErrorKey = 'errors.needMoreParticipants' | 'errors.invalidPairs' | 'draw.saveError' | 'draw.loadError';

interface DrawSectionProps {
  participants: Participants;
  draw: CurrentDraw;
  status: Record<string, AssignmentStatus>;
  isDrawing: boolean;
  canDraw: boolean;
  errorKey: DrawErrorKey | null;
  onDraw: () => void;
}

// The organizer runs the draw here. Pairings stay hidden until asked for, so
// an organizer who is also a participant is not spoiled.
export function DrawSection({ participants, draw, status, isDrawing, canDraw, errorKey, onDraw }: DrawSectionProps) {
  const { t } = useTranslation();
  const [isRevealed, setIsRevealed] = useState(false);
  const drawn = hasDraw(draw);
  const total = Object.keys(participants).length;
  const opened = countOpened(Object.keys(participants), status);

  const name = (id: string) => participants[id]?.name ?? '?';
  const pairings = Object.entries(draw.receivers)
    .map(([giverId, receiverId]): [string, string] => [name(giverId), name(receiverId)])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const handleExportCSV = () => {
    const url = window.URL.createObjectURL(new Blob([generateCSV(pairings)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secret-santa-assignments.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('draw.help')}</p>

      {drawn ? (
        <p role="status" className="text-gray-700">{t('draw.opened', { opened, total })}</p>
      ) : (
        <p className="text-gray-600">{t('draw.none')}</p>
      )}

      {isDrawStale(participants, draw) && (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm">
          {t('draw.stale')}
        </div>
      )}

      {errorKey && <p className="text-sm text-red-700">{t(errorKey)}</p>}
      {!canDraw && <p className="text-xs text-gray-500">{t('draw.waitForSave')}</p>}

      <button
        type="button"
        onClick={onDraw}
        disabled={!canDraw || isDrawing}
        className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <ArrowsClockwise size={20} weight="bold" />
        {isDrawing ? t('draw.drawing') : t(drawn ? 'draw.redraw' : 'draw.draw')}
      </button>

      {drawn && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsRevealed(!isRevealed)}
            aria-pressed={isRevealed}
            className="w-full p-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            {isRevealed ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
            {t(isRevealed ? 'draw.hidePairings' : 'draw.revealPairings')}
          </button>
          {isRevealed ? (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="font-medium pb-1">{t('draw.giver')}</th>
                    <th className="font-medium pb-1">{t('draw.receiver')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pairings.map(([giver, receiver]) => (
                    <tr key={giver}>
                      <td className="py-1 pr-2 break-words">{giver}</td>
                      <td className="py-1 break-words">{receiver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={handleExportCSV}
                className="p-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                <DownloadSimple size={20} weight="bold" />
                {t('draw.exportCSV')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('draw.pairingsHidden')}</p>
          )}
        </div>
      )}
    </div>
  );
}
