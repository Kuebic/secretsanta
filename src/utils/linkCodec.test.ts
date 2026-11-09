import { describe, expect, it } from 'vitest';
import { buildOrganizerLink, parseOrganizerLink } from './linkCodec';

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
