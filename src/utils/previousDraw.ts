import { fetchAssignment, fetchEvent } from '../api/events';
import { PreviousDraw } from './avoidPreviousDraw';
import { decryptBlob, deriveKey } from './eventCrypto';
import { openEvent } from './eventData';
import { OrganizerCredentials } from './linkCodec';

// Everything is decrypted here in the browser with the previous event's
// organizer credentials (ADR 0002). Each assignment is sealed with a key only
// that giver's token derives (ADR 0003); the organizer holds every token.
export async function loadPreviousDraw(credentials: OrganizerCredentials): Promise<PreviousDraw> {
  const { participants, participantTokens } = await openEvent(credentials, await fetchEvent(credentials.eventId));
  const roster = Object.fromEntries(Object.values(participants).map(({ id, name }) => [id, { name }]));
  const assignments: Record<string, string> = {};
  await Promise.all(Object.keys(participants).map(async giverId => {
    const sealed = await fetchAssignment(credentials.eventId, giverId);
    if (sealed === null) return;
    const key = await deriveKey(credentials.eventKey, participantTokens[giverId], 'assignment');
    assignments[giverId] = await decryptBlob(key, sealed);
  }));
  return { roster, assignments };
}
