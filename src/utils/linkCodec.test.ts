import { describe, expect, it } from 'vitest';
import { buildOrganizerLink, buildParticipantLink, parseOrganizerLink, parseParticipantLink } from './linkCodec';

const eventId = 'AAAAAAAAAAAAAAAAAAAAAA';
const eventKey = 'k'.repeat(42) + 'A';
const organizerToken = 'tok_-tok_-tok_-tok_-tA';

describe('organizer link', () => {
  it('puts the event ID in the path and the key and token in the fragment', () => {
    const link = buildOrganizerLink('https://santa.test', { eventId, eventKey, organizerToken });
    expect(link).toBe(`https://santa.test/o/${eventId}#${eventKey}.${organizerToken}`);
    const url = new URL(link);
    expect(url.search).toBe('');
    expect(url.pathname).not.toContain(eventKey);
    expect(url.pathname).not.toContain(organizerToken);
  });

  it('parses back what it built', () => {
    const link = buildOrganizerLink('https://santa.test', { eventId, eventKey, organizerToken });
    expect(parseOrganizerLink(link)).toEqual({ eventId, eventKey, organizerToken });
  });

  it('parses a link pasted with surrounding whitespace', () => {
    expect(parseOrganizerLink(`  https://santa.test/o/${eventId}#${eventKey}.${organizerToken}\n`)).toEqual({ eventId, eventKey, organizerToken });
  });

  it('rejects links without a complete fragment or with the wrong shape', () => {
    expect(parseOrganizerLink(`https://santa.test/o/${eventId}`)).toBeNull();
    expect(parseOrganizerLink(`https://santa.test/o/${eventId}#${eventKey}`)).toBeNull();
    expect(parseOrganizerLink(`https://santa.test/o/${eventId}#${eventKey}.`)).toBeNull();
    expect(parseOrganizerLink(`https://santa.test/p/${eventId}/x#${eventKey}.${organizerToken}`)).toBeNull();
    expect(parseOrganizerLink(`https://santa.test/o/short#${eventKey}.${organizerToken}`)).toBeNull();
    expect(parseOrganizerLink('not a url')).toBeNull();
  });
});

describe('participant link', () => {
  const participantId = 'PPPPPPPPPPPPPPPPPPPPPP';
  const participantToken = 'ptok-ptok-ptok-ptok-pA';
  const credentials = { eventId, participantId, eventKey, participantToken };

  it('puts event and participant IDs in the path and the key and token in the fragment', () => {
    const link = buildParticipantLink('https://santa.test', credentials);
    expect(link).toBe(`https://santa.test/p/${eventId}/${participantId}#${eventKey}.${participantToken}`);
    const url = new URL(link);
    expect(url.search).toBe('');
    expect(url.pathname).not.toContain(eventKey);
    expect(url.pathname).not.toContain(participantToken);
  });

  it('parses back what it built', () => {
    const link = buildParticipantLink('https://santa.test', credentials);
    expect(parseParticipantLink(link)).toEqual(credentials);
  });

  it('adds 115 characters to the origin, about 130 on a short domain', () => {
    expect(buildParticipantLink('https://santa.test', credentials)).toHaveLength('https://santa.test'.length + 115);
    expect(buildParticipantLink('https://santa.dev', credentials)).toHaveLength(132);
  });

  it('rejects links without a complete fragment or with the wrong shape', () => {
    expect(parseParticipantLink(`https://santa.test/p/${eventId}/${participantId}`)).toBeNull();
    expect(parseParticipantLink(`https://santa.test/p/${eventId}/${participantId}#${eventKey}`)).toBeNull();
    expect(parseParticipantLink(`https://santa.test/p/${eventId}/short#${eventKey}.${participantToken}`)).toBeNull();
    expect(parseParticipantLink(`https://santa.test/o/${eventId}#${eventKey}.${participantToken}`)).toBeNull();
    expect(parseParticipantLink('not a url')).toBeNull();
  });

  it('is not mistaken for an organizer link', () => {
    expect(parseOrganizerLink(buildParticipantLink('https://santa.test', credentials))).toBeNull();
  });
});
