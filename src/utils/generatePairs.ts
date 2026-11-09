import { Participant, Rule } from "../types";

export function checkRules(rules: Rule[]): string | null {
  const mustRules = rules.filter(r => r.type === 'must');
  if (mustRules.length > 1) {
    return 'errors.multipleMustRules';
  } else if (mustRules.length === 1) {
    if (rules.some(r => r.type === 'mustNot' && r.targetParticipantId === mustRules[0].targetParticipantId)) {
      return 'errors.conflictingRules';
    }
  }

  return null;
}

export function generateGenerationHash(participants: Record<string, Participant>): string {
  return JSON.stringify(Object.values(participants).map(p => ({rules: p.rules, hint: p.hint})));
}

export type GeneratedPairs = {
  hash: string;
  pairings: {
    giver: {id: string; name: string};
    receiver: {id: string; name: string};
  }[];
};

/** Uniform integer in [0, max) from crypto.getRandomValues, by rejection sampling. */
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function generatePairs(participants: Record<string, Participant>): GeneratedPairs | null {
  const participantIds = Object.keys(participants);
  const n = participantIds.length;

  if (n < 2) {
    return null;
  }

  // Validate rules
  for (const participant of Object.values(participants)) {
    if (checkRules(participant.rules)) {
      return null;
    }
  }

  const indexOf = new Map(participantIds.map((id, i) => [id, i]));

  // allowed[giver] lists the receivers this giver may draw.
  const allowed: number[][] = participantIds.map((giverId, giver) => {
    const rules = participants[giverId].rules;
    const mustRule = rules.find(r => r.type === 'must');
    if (mustRule) {
      const receiver = indexOf.get(mustRule.targetParticipantId);
      return receiver === undefined ? [] : [receiver];
    }
    const mustNot = new Set(
      rules.filter(r => r.type === 'mustNot').map(r => indexOf.get(r.targetParticipantId)),
    );
    return participantIds.map((_, r) => r).filter(r => r !== giver && !mustNot.has(r));
  });

  // A perfect matching between givers and receivers is maintained throughout.
  // Its existence is exactly "the rules allow a draw", so the search below
  // only commits to a receiver when the rest of the roster can still be
  // completed, and it never runs into a dead end.
  const receiverOf = new Array<number>(n).fill(-1);
  const giverOf = new Array<number>(n).fill(-1);
  const fixed = new Array<boolean>(n).fill(false);

  // Find a receiver for `giver`, re-routing unfixed givers along an
  // augmenting path if needed. Receivers held by fixed givers are off limits.
  const augment = (giver: number, visited: boolean[]): boolean => {
    for (const receiver of allowed[giver]) {
      if (visited[receiver]) continue;
      visited[receiver] = true;
      const holder = giverOf[receiver];
      if (holder !== -1 && fixed[holder]) continue;
      if (holder === -1 || augment(holder, visited)) {
        receiverOf[giver] = receiver;
        giverOf[receiver] = giver;
        return true;
      }
    }
    return false;
  };

  for (let giver = 0; giver < n; giver++) {
    if (!augment(giver, new Array<boolean>(n).fill(false))) {
      return null; // The rules allow no draw
    }
  }

  // Assign one giver at a time, most constrained first, each picking a
  // random receiver among those that keep the draw completable.
  for (let step = 0; step < n; step++) {
    let giver = -1;
    let candidates: number[] = [];
    for (let g = 0; g < n; g++) {
      if (fixed[g]) continue;
      const open = allowed[g].filter(r => {
        const holder = giverOf[r];
        return holder === -1 || !fixed[holder];
      });
      if (giver === -1 || open.length < candidates.length) {
        giver = g;
        candidates = open;
      }
    }

    fixed[giver] = true;
    for (const receiver of shuffle(candidates)) {
      if (receiverOf[giver] === receiver) break;

      const savedReceiverOf = receiverOf.slice();
      const savedGiverOf = giverOf.slice();

      // Take `receiver` from its current holder, free our old receiver,
      // then look for a new receiver for the displaced holder.
      const displaced = giverOf[receiver];
      giverOf[receiverOf[giver]] = -1;
      receiverOf[giver] = receiver;
      giverOf[receiver] = giver;
      receiverOf[displaced] = -1;

      const visited = new Array<boolean>(n).fill(false);
      visited[receiver] = true;
      if (augment(displaced, visited)) break;

      receiverOf.splice(0, n, ...savedReceiverOf);
      giverOf.splice(0, n, ...savedGiverOf);
    }
  }

  const pairings = participantIds.map((giverId, giver) => {
    const receiverId = participantIds[receiverOf[giver]];
    return {
      giver: { id: giverId, name: participants[giverId].name },
      receiver: { id: receiverId, name: participants[receiverId].name },
    };
  });

  return {
    hash: generateGenerationHash(participants),
    pairings,
  };
}
