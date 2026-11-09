import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Participants } from '../types';
import { avoidPreviousDraw } from '../utils/avoidPreviousDraw';
import { OrganizerCredentials, parseOrganizerLink } from '../utils/linkCodec';
import { useLocalEvents } from '../utils/localEvents';
import { loadPreviousDraw } from '../utils/previousDraw';

interface PreviousDrawModalProps {
  currentEventId: string;
  participants: Participants;
  onChangeParticipants: (participants: Participants) => void;
  onClose: () => void;
}

type ImportState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; messageKey: 'previousDraw.badLink' | 'previousDraw.sameEvent' | 'previousDraw.loadError' | 'previousDraw.noDraw' }
  | { kind: 'done'; added: number; unmatched: string[] };

export function PreviousDrawModal({ currentEventId, participants, onChangeParticipants, onClose }: PreviousDrawModalProps) {
  const { t } = useTranslation();
  const localEvents = useLocalEvents().filter(event => event.id !== currentEventId);
  const [selectedId, setSelectedId] = useState('');
  const [link, setLink] = useState('');
  const [state, setState] = useState<ImportState>({ kind: 'idle' });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const source = (): OrganizerCredentials | null => {
    if (link.trim()) return parseOrganizerLink(link);
    const local = localEvents.find(event => event.id === selectedId);
    return local ? { eventId: local.id, eventKey: local.key, organizerToken: local.organizerToken } : null;
  };

  const handleImport = async () => {
    const credentials = source();
    if (!credentials) {
      setState({ kind: 'error', messageKey: 'previousDraw.badLink' });
      return;
    }
    if (credentials.eventId === currentEventId) {
      setState({ kind: 'error', messageKey: 'previousDraw.sameEvent' });
      return;
    }
    setState({ kind: 'loading' });
    let previous;
    try {
      previous = await loadPreviousDraw(credentials);
    } catch (error) {
      console.error('Failed to read the previous draw:', error);
      setState({ kind: 'error', messageKey: 'previousDraw.loadError' });
      return;
    }
    if (Object.keys(previous.assignments).length === 0) {
      setState({ kind: 'error', messageKey: 'previousDraw.noDraw' });
      return;
    }
    const result = avoidPreviousDraw(previous, participants);
    if (result.added.length > 0) {
      onChangeParticipants(result.participants);
    }
    setState({ kind: 'done', added: result.added.length, unmatched: result.unmatched });
  };

  const canImport = state.kind !== 'loading' && (link.trim() !== '' || selectedId !== '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-xl w-full space-y-4" role="dialog" aria-labelledby="previous-draw-title">
        <h2 id="previous-draw-title" className="text-xl font-bold">{t('previousDraw.title')}</h2>
        <p className="text-sm text-gray-600">{t('previousDraw.help')}</p>

        {localEvents.length > 0 && (
          <label className="block space-y-1">
            <span className="block text-sm font-medium text-gray-700">{t('previousDraw.fromLocal')}</span>
            <select
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setLink(''); }}
              className="w-full p-2 border rounded"
            >
              <option value="">{t('previousDraw.selectEvent')}</option>
              {localEvents.map(event => (
                <option key={event.id} value={event.id}>
                  {(event.title || t('events.untitled'))} · {new Date(event.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('previousDraw.fromLink')}</span>
          <input
            type="url"
            value={link}
            onChange={e => { setLink(e.target.value); setSelectedId(''); }}
            placeholder={t('previousDraw.linkPlaceholder')}
            className="w-full p-2 border rounded"
            autoComplete="off"
          />
        </label>

        <div role="status" className="text-sm space-y-2">
          {state.kind === 'loading' && <p className="text-gray-600">{t('previousDraw.importing')}</p>}
          {state.kind === 'error' && <p className="text-red-700">{t(state.messageKey)}</p>}
          {state.kind === 'done' && (
            <>
              <p className="text-green-700">
                {state.added > 0 ? t('previousDraw.added', { count: state.added }) : t('previousDraw.nothingAdded')}
              </p>
              {state.unmatched.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-gray-700">{t('previousDraw.unmatchedTitle')}</p>
                  <ul className="list-disc pl-5 mt-1">
                    {state.unmatched.map(name => <li key={name}>{name}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            {t('previousDraw.close')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className={`px-4 py-2 rounded text-white ${canImport ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            {t('previousDraw.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
