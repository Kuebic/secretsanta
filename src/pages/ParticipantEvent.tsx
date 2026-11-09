import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../components/Layout';
import { PageTransition } from '../components/PageTransition';
import { PostCard } from '../components/PostCard';
import { ApiError, fetchAssignment, fetchEvent, markOpened, StoredAssignment } from '../api/events';
import { EnvelopeReveal } from '../components/EnvelopeReveal';
import { EventDetailsBlock } from '../components/EventDetailsBlock';
import { openAssignment } from '../utils/eventCrypto';
import { openParticipantView, ParticipantView } from '../utils/eventData';
import { parseParticipantFragment } from '../utils/linkCodec';

type ErrorKey = 'participant.badLink' | 'participant.notFound' | 'participant.notInEvent' | 'participant.decryptError' | 'participant.loadError';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; messageKey: ErrorKey }
  | { kind: 'ready'; view: ParticipantView; name: string; assignment: StoredAssignment | null };

type Reveal =
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'revealed'; receiverId: string; changed: boolean };

// The assignment was re-drawn with a different receiver after the giver last
// opened it (the Worker keeps assignedAt when the receiver is unchanged).
function changedSinceOpened({ assignedAt, openedAt }: StoredAssignment): boolean {
  return Boolean(assignedAt && openedAt && Date.parse(assignedAt) > Date.parse(openedAt));
}

type Identity = 'unconfirmed' | 'confirmed' | 'wrongLink';

export function ParticipantEvent() {
  const { t } = useTranslation();
  const { eventId = '', participantId = '' } = useParams();
  const { hash } = useLocation();
  // The fragment never reaches the server; it carries the event key and this participant's token.
  const [credentials] = useState(() => parseParticipantFragment(eventId, participantId, hash));
  const [load, setLoad] = useState<LoadState>(() => credentials ? { kind: 'loading' } : { kind: 'error', messageKey: 'participant.badLink' });
  const [identity, setIdentity] = useState<Identity>('unconfirmed');
  const [reveal, setReveal] = useState<Reveal>({ kind: 'none' });

  // Nothing is decrypted or marked opened before identity confirmation.
  const confirm = async () => {
    setIdentity('confirmed');
    if (!credentials || load.kind !== 'ready' || !load.assignment) return;
    let receiverId;
    try {
      receiverId = await openAssignment(credentials.eventKey, credentials.participantToken, load.assignment.assignment);
    } catch (error) {
      console.error('Failed to decrypt the assignment:', error);
      setReveal({ kind: 'error' });
      return;
    }
    if (load.view.names[receiverId] === undefined) {
      setReveal({ kind: 'error' });
      return;
    }
    setReveal({ kind: 'revealed', receiverId, changed: changedSinceOpened(load.assignment) });
    markOpened(credentials.eventId, credentials.participantId, credentials.participantToken)
      .catch(error => console.error('Failed to record that the assignment was opened:', error));
  };

  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    const fail = (messageKey: ErrorKey) => { if (!cancelled) setLoad({ kind: 'error', messageKey }); };
    (async () => {
      let stored, assignment;
      try {
        [stored, assignment] = await Promise.all([
          fetchEvent(credentials.eventId),
          fetchAssignment(credentials.eventId, credentials.participantId),
        ]);
      } catch (error) {
        console.error('Failed to load event:', error);
        return fail(error instanceof ApiError && error.status === 404 ? 'participant.notFound' : 'participant.loadError');
      }
      let view;
      try {
        view = await openParticipantView(credentials.eventKey, stored);
      } catch (error) {
        console.error('Failed to decrypt event:', error);
        return fail('participant.decryptError');
      }
      const name = view.names[credentials.participantId];
      if (name === undefined) {
        return fail('participant.notInEvent');
      }
      if (!cancelled) setLoad({ kind: 'ready', view, name, assignment });
    })();
    return () => {
      cancelled = true;
    };
  }, [credentials]);

  return (
    <PageTransition>
      <Layout menuItems={[]}>
        <PostCard>
          <div className="space-y-4">
            {load.kind === 'loading' && <p className="text-gray-600">{t('participant.loading')}</p>}
            {load.kind === 'error' && <p className="text-gray-700">{t(load.messageKey)}</p>}
            {load.kind === 'ready' && identity === 'unconfirmed' && (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-red-700 break-words">
                  {t('participant.areYou', { name: load.name })}
                </h1>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={confirm}
                    className="flex-1 p-2 bg-red-700 text-white rounded hover:bg-red-800"
                  >
                    {t('participant.yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdentity('wrongLink')}
                    className="flex-1 p-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    {t('participant.no')}
                  </button>
                </div>
              </>
            )}
            {load.kind === 'ready' && identity === 'wrongLink' && (
              <p className="text-gray-700">{t('participant.wrongLink')}</p>
            )}
            {load.kind === 'ready' && identity === 'confirmed' && (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-red-700 break-words">
                  {load.view.details.title || t('events.untitled')}
                </h1>
                <p className="text-gray-700">{t('participant.welcome', { name: load.name })}</p>
                <EventDetailsBlock eventId={eventId} details={load.view.details} />
                {!load.assignment && <p className="p-3 bg-gray-50 rounded text-gray-600">{t('participant.noDrawYet')}</p>}
                {reveal.kind === 'error' && <p className="p-3 bg-gray-50 rounded text-gray-700">{t('participant.assignmentError')}</p>}
                {reveal.kind === 'revealed' && (
                  <div className="space-y-4">
                    {reveal.changed && (
                      <div role="alert" className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm">
                        {t('participant.changed')}
                      </div>
                    )}
                    <EnvelopeReveal receiverName={load.view.names[reveal.receiverId]} />
                    {load.view.notes[reveal.receiverId] && (
                      <div>
                        <h2 className="text-sm font-medium text-gray-700 mb-1">{t('participant.organizersNote')}</h2>
                        <p className="text-gray-700 whitespace-pre-wrap break-words">{load.view.notes[reveal.receiverId]}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </PostCard>
      </Layout>
    </PageTransition>
  );
}
