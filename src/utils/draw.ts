import { AssignmentStatus, fetchAssignment } from '../api/events';
import { Participants } from '../types';
import { openAssignment, sealAssignment } from './eventCrypto';

// The current draw as the organizer sees it: decrypted receivers, plus the
// ciphertext the Worker holds for each giver so an unchanged assignment can
// be resent as is (the Worker then keeps its assignedAt and openedAt).
export interface CurrentDraw {
  // giver participant ID -> receiver participant ID
  receivers: Record<string, string>;
  sealed: Record<string, string>;
}

export const NO_DRAW: CurrentDraw = { receivers: {}, sealed: {} };

// The organizer holds every participant token, so it can derive every
// giver's assignment key (ADR 0003). Only givers the status lists as
// assigned are fetched.
export async function loadDraw(
  eventId: string,
  eventKey: string,
  participantTokens: Record<string, string>,
  status: Record<string, AssignmentStatus>,
): Promise<CurrentDraw> {
  const draw: CurrentDraw = { receivers: {}, sealed: {} };
  await Promise.all(Object.entries(status).map(async ([giverId, { assignedAt }]) => {
    const token = participantTokens[giverId];
    if (!assignedAt || !token) return;
    const stored = await fetchAssignment(eventId, giverId);
    if (stored === null) return;
    draw.receivers[giverId] = await openAssignment(eventKey, token, stored.assignment);
    draw.sealed[giverId] = stored.assignment;
  }));
  return draw;
}

export async function sealDraw(
  eventKey: string,
  participantTokens: Record<string, string>,
  receivers: Record<string, string>,
  previous: CurrentDraw,
): Promise<CurrentDraw> {
  const sealed: Record<string, string> = {};
  for (const [giverId, receiverId] of Object.entries(receivers)) {
    sealed[giverId] = previous.receivers[giverId] === receiverId && previous.sealed[giverId]
      ? previous.sealed[giverId]
      : await sealAssignment(eventKey, participantTokens[giverId], receiverId);
  }
  return { receivers, sealed };
}

// The Worker keeps openedAt across a re-draw and moves assignedAt instead, so
// the participant page can say "this changed". A giver has opened their
// current assignment only if nothing was re-drawn for them since.
export function changedSinceOpened({ assignedAt, openedAt }: AssignmentStatus): boolean {
  return Boolean(assignedAt && openedAt && Date.parse(assignedAt) > Date.parse(openedAt));
}

export function hasOpenedCurrentAssignment(status: AssignmentStatus | undefined): boolean {
  return Boolean(status?.openedAt) && !changedSinceOpened(status!);
}

export function countOpened(participantIds: string[], status: Record<string, AssignmentStatus>): number {
  return participantIds.filter(id => hasOpenedCurrentAssignment(status[id])).length;
}

export function hasDraw(draw: CurrentDraw): boolean {
  return Object.keys(draw.receivers).length > 0;
}

// The draw no longer fits the event: someone was added or removed since, or
// an assignment breaks a rule set afterwards.
export function isDrawStale(participants: Participants, draw: CurrentDraw): boolean {
  if (!hasDraw(draw)) return false;
  const ids = Object.keys(participants);
  if (ids.length !== Object.keys(draw.receivers).length) return true;
  return ids.some(giverId => {
    const receiverId = draw.receivers[giverId];
    if (!receiverId || !participants[receiverId] || receiverId === giverId) return true;
    return participants[giverId].rules.some(rule =>
      rule.type === 'must' ? rule.targetParticipantId !== receiverId : rule.targetParticipantId === receiverId);
  });
}
