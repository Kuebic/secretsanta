import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ClockCounterClockwise, Code, Rows, Trash } from '@phosphor-icons/react';
import { Accordion } from '../components/Accordion';
import { AccordionContainer } from '../components/AccordionContainer';
import { CopyButton } from '../components/CopyButton';
import { Details } from '../components/Details';
import { Layout } from '../components/Layout';
import { PageTransition } from '../components/PageTransition';
import { ParticipantsList } from '../components/ParticipantsList';
import { ParticipantsTextView } from '../components/ParticipantsTextView';
import { PostCard } from '../components/PostCard';
import { PreviousDrawModal } from '../components/PreviousDrawModal';
import { RulesModal } from '../components/RulesModal';
import { ShareActions } from '../components/ShareActions';
import { MenuItem } from '../components/SideMenu';
import { ApiError, deleteEvent, fetchEvent, fetchStatus, ParticipantStatus, saveAssignments, saveEvent } from '../api/events';
import { StatusTable } from '../components/StatusTable';
import { DrawErrorKey, DrawMode, DrawSection } from '../components/DrawSection';
import { changedGivers, CurrentDraw, hasDraw, hasOpenedCurrentAssignment, keepOrder, loadDraw, NO_DRAW, sealDraw } from '../utils/draw';
import { generatePairs } from '../utils/generatePairs';
import { Participants } from '../types';
import { EventContent, EventDetails, openEvent, sealEvent, withParticipantTokens } from '../utils/eventData';
import { buildOrganizerLink, buildParticipantLink, OrganizerCredentials, parseOrganizerFragment } from '../utils/linkCodec';
import { localEventOf, readLocalEvents, removeLocalEvent, upsertLocalEvent } from '../utils/localEvents';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; messageKey: 'organizer.badLink' | 'organizer.notFound' | 'organizer.decryptError' | 'organizer.loadError' }
  | { kind: 'ready'; createdAt: string };

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'tooLarge';

const SAVE_DELAY_MS = 800;

function rememberLocally(credentials: OrganizerCredentials, title: string, createdAt: string) {
  upsertLocalEvent(localEventOf(credentials, title, createdAt));
}

export function OrganizerEvent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { eventId = '' } = useParams();
  const { hash } = useLocation();
  // The fragment never reaches the server; it carries the key and the token.
  const [credentials] = useState(() => parseOrganizerFragment(eventId, hash));

  const [load, setLoad] = useState<LoadState>(() => credentials ? { kind: 'loading' } : { kind: 'error', messageKey: 'organizer.badLink' });
  const [content, setContent] = useState<EventContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [isTextView, setIsTextView] = useState(false);
  const [openSection, setOpenSection] = useState<'participants' | 'details' | 'links' | 'status' | 'draw'>('participants');
  const [draw, setDraw] = useState<CurrentDraw>(NO_DRAW);
  const [status, setStatus] = useState<Record<string, ParticipantStatus>>({});
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawErrorKey, setDrawErrorKey] = useState<DrawErrorKey | null>(null);
  const [rulesParticipantId, setRulesParticipantId] = useState<string | null>(null);
  const [isPreviousDrawOpen, setIsPreviousDrawOpen] = useState(false);

  // Bumped on every edit; a save only marks 'saved' if nothing changed meanwhile.
  const revision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!credentials) {
      return;
    }
    let cancelled = false;
    (async () => {
      let stored;
      try {
        stored = await fetchEvent(credentials.eventId);
      } catch (error) {
        console.error('Failed to load event:', error);
        if (!cancelled) setLoad({ kind: 'error', messageKey: error instanceof ApiError && error.status === 404 ? 'organizer.notFound' : 'organizer.loadError' });
        return;
      }
      let opened;
      try {
        opened = await openEvent(credentials, stored);
      } catch (error) {
        console.error('Failed to decrypt event:', error);
        if (!cancelled) setLoad({ kind: 'error', messageKey: 'organizer.decryptError' });
        return;
      }
      if (cancelled) return;
      setContent(opened);
      setStatus(stored.status ?? {});
      setLoad({ kind: 'ready', createdAt: stored.createdAt });
      // Opening an organizer link on a fresh browser adds the event to its home page.
      rememberLocally(credentials, opened.details.title, stored.createdAt);
      try {
        const current = await loadDraw(credentials, opened.participantTokens, stored.status ?? {});
        if (!cancelled) setDraw(current);
      } catch (error) {
        console.error('Failed to read the current draw:', error);
        if (!cancelled) setDrawErrorKey('draw.loadError');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [credentials]);

  const refreshStatus = useCallback(async () => {
    if (!credentials) return;
    setIsRefreshingStatus(true);
    setStatusError(false);
    try {
      setStatus(await fetchStatus(credentials.eventId));
    } catch (error) {
      console.error('Failed to refresh status:', error);
      setStatusError(true);
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [credentials]);

  // The status table refreshes every time the organizer opens it.
  useEffect(() => {
    if (openSection === 'status' && load.kind === 'ready') {
      void refreshStatus();
    }
  }, [openSection, load.kind, refreshStatus]);

  const save = useCallback((next: EventContent, createdAt: string) => {
    if (!credentials) return;
    const saving = revision.current;
    saveQueue.current = saveQueue.current.then(async () => {
      if (saving !== revision.current) return; // a newer edit will save itself
      setSaveState('saving');
      try {
        await saveEvent(credentials.eventId, credentials.organizerToken, await sealEvent(credentials, next));
        rememberLocally(credentials, next.details.title, createdAt);
        if (saving === revision.current) setSaveState('saved');
      } catch (error) {
        console.error('Failed to save event:', error);
        if (saving === revision.current) setSaveState(error instanceof ApiError && error.status === 413 ? 'tooLarge' : 'error');
      }
    });
  }, [credentials]);

  useEffect(() => {
    if (!content || load.kind !== 'ready' || saveState !== 'pending') return;
    const timer = setTimeout(() => save(content, load.createdAt), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [content, load, saveState, save]);

  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const edit = (change: (current: EventContent) => EventContent) => {
    revision.current++;
    setContent(current => current && change(current));
    setSaveState('pending');
  };

  const setParticipants = (participants: Participants) => edit(current => ({
    ...current,
    participants,
    participantTokens: withParticipantTokens(participants, current.participantTokens),
  }));

  const setDetails = (details: EventDetails) => edit(current => ({ ...current, details }));

  // Assignments are sealed per giver and written in one request; a giver whose
  // receiver is unchanged gets the same ciphertext back, so the Worker keeps
  // their opened state and they see no "this changed" banner. A re-draw keeps
  // every assignment that still fits (ticket 15); a shuffle starts over.
  const handleDraw = async (mode: DrawMode) => {
    if (!credentials || !content || isDrawing) return;
    setDrawErrorKey(null);
    if (Object.keys(content.participants).length < 2) {
      setDrawErrorKey('errors.needMoreParticipants');
      return;
    }
    const keep = mode === 'keep' ? keepOrder(draw, status) : [];
    const generated = generatePairs(content.participants, { keep });
    if (!generated) {
      setDrawErrorKey('errors.invalidPairs');
      return;
    }
    const receivers = Object.fromEntries(generated.pairings.map(({ giver, receiver }) => [giver.id, receiver.id]));
    const openedAndChanged = changedGivers(draw.receivers, receivers)
      .filter(giverId => hasOpenedCurrentAssignment(status[giverId])).length;
    if (hasDraw(draw) && openedAndChanged > 0 && !window.confirm(t('draw.redrawConfirm', { count: openedAndChanged }))) {
      return;
    }
    setIsDrawing(true);
    try {
      const next = await sealDraw(credentials.eventKey, content.participantTokens, receivers, draw);
      await saveAssignments(credentials.eventId, credentials.organizerToken, next.sealed);
      setDraw(next);
      setStatus(await fetchStatus(credentials.eventId));
    } catch (error) {
      console.error('Failed to save the draw:', error);
      setDrawErrorKey('draw.saveError');
    } finally {
      setIsDrawing(false);
    }
  };

  const handleDelete = async () => {
    if (!credentials || !window.confirm(t('organizer.deleteConfirm'))) return;
    try {
      await deleteEvent(credentials.eventId, credentials.organizerToken);
    } catch (error) {
      console.error('Failed to delete event:', error);
      window.alert(t('organizer.deleteError'));
      return;
    }
    removeLocalEvent(credentials.eventId);
    navigate('/');
  };

  const menuItems = [
    <MenuItem key={`back`} to="/" icon={<ArrowLeft weight={`bold`}/>}>
      {t('organizer.allEvents')}
    </MenuItem>,
  ];

  if (load.kind !== 'ready' || !content || !credentials) {
    const isKnownLocally = readLocalEvents().some(event => event.id === eventId);
    return (
      <PageTransition>
        <Layout menuItems={menuItems}>
          <PostCard>
            {load.kind === 'error' ? (
              <div className="space-y-4">
                <p className="text-gray-700">{t(load.messageKey)}</p>
                {load.kind === 'error' && load.messageKey === 'organizer.notFound' && isKnownLocally && (
                  <button
                    type="button"
                    onClick={() => { removeLocalEvent(eventId); navigate('/'); }}
                    className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  >
                    {t('organizer.removeFromBrowser')}
                  </button>
                )}
                <Link className="block text-blue-500 underline" to="/">{t('organizer.allEvents')}</Link>
              </div>
            ) : (
              <p className="text-gray-600">{t('organizer.loading')}</p>
            )}
          </PostCard>
        </Layout>
      </PageTransition>
    );
  }

  const toggleViewButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsTextView(!isTextView);
      }}
      className="p-2 text-gray-200 hover:bg-gray-700 rounded-full"
      title={t(isTextView ? 'participants.switchToFormView' : 'participants.switchToTextView')}
    >
      {isTextView ? <Rows size={20} weight={`bold`} /> : <Code size={20} weight={`bold`} />}
    </button>
  );

  // Each participant's own link: event key and their token in the fragment.
  const participantLink = (participantId: string) => buildParticipantLink(window.location.origin, {
    eventId: credentials.eventId,
    participantId,
    eventKey: credentials.eventKey,
    participantToken: content.participantTokens[participantId],
  });

  const saveMessage = {
    saved: t('organizer.saved'),
    pending: t('organizer.saving'),
    saving: t('organizer.saving'),
    error: t('organizer.saveError'),
    tooLarge: t('organizer.saveTooLarge'),
  }[saveState];

  return <>
    <PageTransition>
      <Layout menuItems={menuItems}>
        <div className="lg:flex-[6_6_0%]">
          <PostCard>
            <div className="space-y-4">
              <h1 className="text-xl sm:text-2xl font-bold mb-4 text-red-700 break-words">
                {content.details.title || t('events.untitled')}
              </h1>
              <p className="text-sm text-gray-600">{t('organizer.organizerLinkHelp')}</p>
              <CopyButton
                textToCopy={buildOrganizerLink(window.location.origin, credentials)}
                className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                {t('organizer.copyOrganizerLink')}
              </CopyButton>
              <div className={`flex items-center gap-2 text-sm ${saveState === 'error' || saveState === 'tooLarge' ? 'text-red-700' : 'text-gray-500'}`}>
                <span role="status">{saveMessage}</span>
                {saveState === 'error' && (
                  <button type="button" className="underline" onClick={() => save(content, load.createdAt)}>
                    {t('organizer.retry')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 text-sm text-red-700 border border-red-300 rounded hover:bg-red-50 flex items-center gap-2"
              >
                <Trash size={16} weight="bold" />
                {t('organizer.deleteEvent')}
              </button>
            </div>
          </PostCard>
        </div>

        <div className="lg:order-none lg:flex-[5_5_0%]">
          <AccordionContainer>
            <Accordion
              title={t('participants.title')}
              isOpen={openSection === 'participants'}
              onToggle={() => setOpenSection('participants')}
              action={toggleViewButton}
            >
              {isTextView ? (
                <ParticipantsTextView
                  participants={content.participants}
                  onChangeParticipants={setParticipants}
                />
              ) : (
                <ParticipantsList
                  participants={content.participants}
                  onChangeParticipants={setParticipants}
                  onOpenRules={setRulesParticipantId}
                />
              )}
              <button
                type="button"
                onClick={() => setIsPreviousDrawOpen(true)}
                className="mt-4 w-full p-2 border border-red-300 text-red-700 rounded hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <ClockCounterClockwise size={20} weight="bold" />
                {t('previousDraw.open')}
              </button>
            </Accordion>

            <Accordion
              title={t('details.title')}
              isOpen={openSection === 'details'}
              onToggle={() => setOpenSection('details')}
            >
              <Details details={content.details} onChangeDetails={setDetails} />
            </Accordion>

            {Object.keys(content.participants).length > 0 && (
              <Accordion
                title={t('organizer.participantLinksTitle')}
                isOpen={openSection === 'links'}
                onToggle={() => setOpenSection('links')}
              >
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{t('organizer.participantLinksHelp')}</p>
                  {saveState !== 'saved' && (
                    <p className="text-xs text-gray-500">{t('organizer.participantLinksUnsaved')}</p>
                  )}
                  {Object.values(content.participants).map(participant => (
                    <ShareActions
                      key={participant.id}
                      name={participant.name}
                      eventTitle={content.details.title}
                      link={participantLink(participant.id)}
                    />
                  ))}
                </div>
              </Accordion>
            )}
            {Object.keys(content.participants).length > 0 && (
              <Accordion
                title={t('status.title')}
                isOpen={openSection === 'status'}
                onToggle={() => setOpenSection('status')}
              >
                <StatusTable
                  rows={Object.values(content.participants).map(participant => ({
                    id: participant.id,
                    name: participant.name,
                    link: participantLink(participant.id),
                  }))}
                  status={status}
                  eventTitle={content.details.title}
                  isRefreshing={isRefreshingStatus}
                  hasError={statusError}
                  onRefresh={refreshStatus}
                />
              </Accordion>
            )}
            <Accordion
              title={t('draw.title')}
              isOpen={openSection === 'draw'}
              onToggle={() => setOpenSection('draw')}
            >
              <DrawSection
                participants={content.participants}
                draw={draw}
                status={status}
                isDrawing={isDrawing}
                canDraw={saveState === 'saved'}
                errorKey={drawErrorKey}
                onDraw={handleDraw}
              />
            </Accordion>
          </AccordionContainer>
        </div>
      </Layout>
    </PageTransition>
    {rulesParticipantId && (
      <RulesModal
        isOpen
        onClose={() => setRulesParticipantId(null)}
        participants={content.participants}
        participantId={rulesParticipantId}
        onChangeParticipants={setParticipants}
      />
    )}
    {isPreviousDrawOpen && (
      <PreviousDrawModal
        currentEventId={credentials.eventId}
        participants={content.participants}
        onChangeParticipants={setParticipants}
        onClose={() => setIsPreviousDrawOpen(false)}
      />
    )}
  </>;
}
