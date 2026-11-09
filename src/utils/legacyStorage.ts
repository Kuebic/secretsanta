import { useEffect, useState } from 'react';
import { deleteEvent, saveAssignments, saveEvent } from '../api/events';
import { mintEvent, sealAssignment } from './eventCrypto';
import { sealEvent } from './eventData';
import { mapLegacyData } from './legacyMigration';
import { readLocalEvents, upsertLocalEvent } from './localEvents';

// The static version's localStorage keys.
const LEGACY_KEYS = {
  participants: 'secretSantaParticipants',
  assignments: 'secretSantaAssignments',
  instructions: 'secretSantaInstructions',
} as const;

// Set when a migration succeeds; the home page clears it when it shows the
// notice, so the notice appears once.
const NOTICE_KEY = 'secretSantaMigrationNotice';
const MIGRATED_EVENT = 'secretsanta:legacy-migrated';

function readLegacy(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function removeLegacyKeys(): void {
  for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
}

async function migrate(): Promise<void> {
  const present = Object.values(LEGACY_KEYS).some(key => localStorage.getItem(key) !== null);
  if (!present || readLocalEvents().length > 0) {
    return;
  }
  const event = mapLegacyData({
    participants: readLegacy(LEGACY_KEYS.participants),
    assignments: readLegacy(LEGACY_KEYS.assignments),
    instructions: readLegacy(LEGACY_KEYS.instructions),
  });
  if (event === null) {
    // Empty leftovers of someone who opened the old app once.
    removeLegacyKeys();
    return;
  }

  const minted = mintEvent(Object.keys(event.participants));
  const credentials = { eventId: minted.eventId, eventKey: minted.eventKey, organizerToken: minted.organizerToken };
  const sealed = await sealEvent(credentials, {
    details: event.details,
    participants: event.participants,
    participantTokens: minted.participantTokens,
  });
  const { createdAt } = await saveEvent(minted.eventId, minted.organizerToken, sealed);
  try {
    const assignments = Object.entries(event.assignments);
    if (assignments.length > 0) {
      const sealedAssignments: Record<string, string> = {};
      for (const [giverId, receiverId] of assignments) {
        sealedAssignments[giverId] = await sealAssignment(minted.eventKey, minted.participantTokens[giverId], receiverId);
      }
      await saveAssignments(minted.eventId, minted.organizerToken, sealedAssignments);
    }
  } catch (error) {
    // Half an event is worse than none: the next load starts over.
    await deleteEvent(minted.eventId, minted.organizerToken).catch(() => undefined);
    throw error;
  }

  localStorage.setItem(NOTICE_KEY, minted.eventId);
  upsertLocalEvent({ id: minted.eventId, key: minted.eventKey, organizerToken: minted.organizerToken, title: event.details.title, createdAt });
  removeLegacyKeys();
  window.dispatchEvent(new Event(MIGRATED_EVENT));
}

let running: Promise<void> | null = null;

// Moves the static version's data into one event, once. Any failure (offline,
// API down) leaves the legacy keys untouched so the next load tries again.
export function migrateLegacyStorage(): Promise<void> {
  running ??= migrate().catch(error => {
    console.error('Legacy data migration failed; will retry on next load:', error);
  });
  return running;
}

export function useMigrationNotice(): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => {
      if (localStorage.getItem(NOTICE_KEY) !== null) {
        localStorage.removeItem(NOTICE_KEY);
        setShown(true);
      }
    };
    check();
    window.addEventListener(MIGRATED_EVENT, check);
    return () => window.removeEventListener(MIGRATED_EVENT, check);
  }, []);
  return [shown, () => setShown(false)];
}
