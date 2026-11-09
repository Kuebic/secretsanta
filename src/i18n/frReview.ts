/**
 * French strings drafted by an agent during the Worker rebuild, awaiting a native speaker's review.
 *
 * An entry is either a whole section of `fr.ts` ("status") or one key ("rules.mutualExclusion").
 * Remove an entry once a native speaker has read it in the running app. Strings inherited from
 * the original project are not listed: a native speaker already wrote them.
 *
 * Choices a reviewer may want to revisit:
 * - The app speaks with "vous"; the share and nudge messages, which the organizer sends to people
 *   they know, use "tu" and open with "Salut".
 * - The event title sits in guillemets in those messages, so titles without an article still read.
 * - Glossary terms: Giver "la personne qui offre", Receiver "la personne qui reçoit", Draw and
 *   Assignment both "tirage", Wishlist "liste de souhaits", Organizer's note "note de l'organisateur".
 */
export const frAwaitingNativeReview: readonly string[] = [
  // Strings added to sections that existed before the rebuild.
  'home.explanation',
  'participants.rulesCount_many',
  'participants.textSyntax',
  'rules.organizersNoteLabel',
  'rules.organizersNotePlaceholder',
  'rules.mutualExclusion',
  'rules.mutualExclusionUnavailable',
  'rules.mutualExclusionRemovePrompt',
  'rules.mutualExclusionRemoveOneSide',
  'rules.mutualExclusionRemoveBothSides',

  // Sections the rebuild added; every string in them is a draft.
  'events',
  'migration',
  'organizer',
  'previousDraw',
  'draw',
  'details',
  'share',
  'status',
  'participant',
  'wishlist',
];
