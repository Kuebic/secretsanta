import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Heart, Plus, Star } from '@phosphor-icons/react';
import { PostCard } from '../components/PostCard';
import { MenuItem } from '../components/SideMenu';
import { PageTransition } from '../components/PageTransition';
import { Layout } from '../components/Layout';
import { CopyButton } from '../components/CopyButton';
import { saveEvent } from '../api/events';
import { mintEvent } from '../utils/eventCrypto';
import { EMPTY_DETAILS, sealEvent } from '../utils/eventData';
import { buildOrganizerLink } from '../utils/linkCodec';
import { LocalEvent, upsertLocalEvent, useLocalEvents } from '../utils/localEvents';
import { useMigrationNotice } from '../utils/legacyStorage';

function organizerLink(event: LocalEvent): string {
  return buildOrganizerLink(window.location.origin, { eventId: event.id, eventKey: event.key, organizerToken: event.organizerToken });
}

function organizerPath(event: LocalEvent): string {
  return organizerLink(event).slice(window.location.origin.length);
}

export function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const events = useLocalEvents();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [showMigrationNotice, dismissMigrationNotice] = useMigrationNotice();

  const handleNewEvent = async () => {
    setIsCreating(true);
    setCreateError(false);
    try {
      const minted = mintEvent([]);
      const credentials = { eventId: minted.eventId, eventKey: minted.eventKey, organizerToken: minted.organizerToken };
      const sealed = await sealEvent(credentials, { details: EMPTY_DETAILS, participants: {}, participantTokens: {} });
      const { createdAt } = await saveEvent(minted.eventId, minted.organizerToken, sealed);
      const event: LocalEvent = { id: minted.eventId, key: minted.eventKey, organizerToken: minted.organizerToken, title: '', createdAt };
      upsertLocalEvent(event);
      navigate(organizerPath(event));
    } catch (error) {
      console.error('Failed to create event:', error);
      setCreateError(true);
      setIsCreating(false);
    }
  };

  const menuItems = [
    <div key={`links`} className="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:space-x-2">
      <MenuItem key={`vanity`} to="https://bsky.app/profile/mael.dev" icon={<Star className={`text-orange-500`} weight={`fill`}/>}>
        {t(`home.vanity`)}
      </MenuItem>
      <MenuItem key={`sponsor`} to="https://github.com/sponsors/arcanis?frequency=one-time&sponsor=arcanis" icon={<Heart className={`text-red-700`} weight={`fill`}/>}>
        {t(`home.sponsor`)}
      </MenuItem>
    </div>,
  ];

  const sortedEvents = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PageTransition>
      <Layout menuItems={menuItems}>
        <div className="lg:flex-[6_6_0%]">
          <PostCard>
            <div className="space-y-4">
              <h1 className="text-xl sm:text-2xl font-bold mb-4 text-red-700">
                {t('home.title')}
              </h1>
              <div className="space-y-4 text-gray-600">
                <Trans
                  i18nKey="home.explanation"
                  components={{
                    p: <p/>,
                    githubLink: <a className="text-blue-500 underline" href="https://github.com/arcanis/secretsanta/" target="_blank"/>,
                    exampleLink: <Link className="text-blue-500 underline" to="/pairing?from=Simba&to=c1w%2FUV9lXC12U578BHPYZhXxhsK0fPTqoQDU9CA7W581P%2BM%3D"/>,
                  }}
                />
              </div>
            </div>
          </PostCard>
        </div>

        <div className="lg:flex-[5_5_0%] space-y-4">
          <div className="bg-postcard-nowhite rounded-lg px-5 py-3 text-white">
            <h2 className="text-xl">{t('events.title')}</h2>
          </div>

          {showMigrationNotice && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 space-y-2" role="status">
              <p className="font-medium">{t('migration.title')}</p>
              <p>{t('migration.body')}</p>
              <button type="button" onClick={dismissMigrationNotice} className="text-green-800 underline">
                {t('migration.dismiss')}
              </button>
            </div>
          )}

          {sortedEvents.length === 0 ? (
            <p className="p-4 bg-gray-50 rounded-lg text-gray-600">{t('events.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {sortedEvents.map(event => (
                <li key={event.id} className="p-4 bg-gray-50 rounded-lg flex items-center gap-4">
                  <Link to={organizerPath(event)} className="flex-1 min-w-0">
                    <div className="font-medium truncate text-gray-800 hover:underline">
                      {event.title || t('events.untitled')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('events.createdOn', { date: new Date(event.createdAt).toLocaleDateString(i18n.language) })}
                    </div>
                  </Link>
                  <CopyButton
                    textToCopy={organizerLink(event)}
                    className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex flex-none items-center justify-center gap-2 text-sm"
                  >
                    {t('events.copyOrganizerLink')}
                  </CopyButton>
                </li>
              ))}
            </ul>
          )}

          {createError && (
            <p className="p-3 bg-red-100 text-red-700 text-sm rounded">{t('events.createError')}</p>
          )}

          <button
            type="button"
            onClick={handleNewEvent}
            disabled={isCreating}
            className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Plus size={20} weight="bold" />
            {t(isCreating ? 'events.creating' : 'events.newEvent')}
          </button>

          <p className="text-xs text-gray-500">{t('events.keepLinkWarning')}</p>
        </div>
      </Layout>
    </PageTransition>
  );
}
