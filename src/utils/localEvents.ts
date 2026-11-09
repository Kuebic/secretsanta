import { useCallback, useEffect, useState } from 'react';

// The organizer's events known to this browser (ADR 0002: losing the
// organizer link loses the event, so the home page keeps a local list).
export interface LocalEvent {
  id: string;
  key: string;
  organizerToken: string;
  title: string;
  createdAt: string;
}

const STORAGE_KEY = 'secretSantaEvents';
const CHANGE_EVENT = 'secretsanta:local-events';

export function readLocalEvents(): LocalEvent[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeLocalEvents(events: LocalEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function upsertLocalEvent(event: LocalEvent): void {
  const events = readLocalEvents();
  const index = events.findIndex(existing => existing.id === event.id);
  if (index === -1) {
    events.push(event);
  } else {
    events[index] = event;
  }
  writeLocalEvents(events);
}

export function removeLocalEvent(id: string): void {
  writeLocalEvents(readLocalEvents().filter(event => event.id !== id));
}

export function useLocalEvents(): LocalEvent[] {
  const [events, setEvents] = useState(readLocalEvents);
  const refresh = useCallback(() => setEvents(readLocalEvents()), []);
  useEffect(() => {
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);
  return events;
}
