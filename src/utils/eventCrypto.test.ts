import { describe, expect, it } from 'vitest';
import { decryptBlob, deriveKey, encryptBlob, mintEvent, mintParticipantId, mintToken, openAssignment, sealAssignment } from './eventCrypto';
import { DETAILS_LIMITS, openParticipantView, sealEvent } from './eventData';
import { openWishlist, sealWishlist, wishlistCharactersLeft } from './wishlist';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe('event crypto', () => {
  it('mints a 128-bit event ID, 256-bit key, 128-bit organizer token and one 128-bit token per participant, all base64url without padding', () => {
    const event = mintEvent(['p1', 'p2', 'p3']);
    // 16 bytes -> 22 chars, 32 bytes -> 43 chars
    expect(event.eventId).toMatch(BASE64URL);
    expect(event.eventId).toHaveLength(22);
    expect(event.eventKey).toMatch(BASE64URL);
    expect(event.eventKey).toHaveLength(43);
    expect(event.organizerToken).toMatch(BASE64URL);
    expect(event.organizerToken).toHaveLength(22);
    expect(Object.keys(event.participantTokens)).toEqual(['p1', 'p2', 'p3']);
    for (const token of Object.values(event.participantTokens)) {
      expect(token).toMatch(BASE64URL);
      expect(token).toHaveLength(22);
    }
    expect(new Set([event.eventId, event.organizerToken, ...Object.values(event.participantTokens)]).size).toBe(5);
  });

  it('mints 128-bit base64url participant IDs', () => {
    const id = mintParticipantId();
    expect(id).toMatch(BASE64URL);
    expect(id).toHaveLength(22);
    expect(mintParticipantId()).not.toBe(id);
  });

  it('round-trips text through encrypt and decrypt with the event key', async () => {
    const { eventKey } = mintEvent([]);
    const plaintext = 'Christmas at Noël’s 🎄';
    const blob = await encryptBlob(eventKey, plaintext);
    expect(blob).toMatch(BASE64URL);
    expect(blob).not.toContain('Christmas');
    expect(await decryptBlob(eventKey, blob)).toBe(plaintext);
  });

  it('uses a fresh IV for every encryption', async () => {
    const { eventKey } = mintEvent([]);
    expect(await encryptBlob(eventKey, 'same')).not.toBe(await encryptBlob(eventKey, 'same'));
  });

  it('fails to decrypt with the wrong key', async () => {
    const blob = await encryptBlob(mintEvent([]).eventKey, 'secret');
    await expect(decryptBlob(mintEvent([]).eventKey, blob)).rejects.toThrow();
  });

  it('a key derived from one token does not decrypt what a key derived from another token encrypted', async () => {
    const { eventKey, organizerToken } = mintEvent([]);
    const organizerKey = await deriveKey(eventKey, organizerToken, 'organizer');
    const blob = await encryptBlob(organizerKey, 'participant tokens');

    expect(await decryptBlob(await deriveKey(eventKey, organizerToken, 'organizer'), blob)).toBe('participant tokens');
    await expect(decryptBlob(await deriveKey(eventKey, mintToken(), 'organizer'), blob)).rejects.toThrow();
    await expect(decryptBlob(eventKey, blob)).rejects.toThrow();
  });

  it('a key derived for one purpose does not decrypt another purpose', async () => {
    const { eventKey, organizerToken } = mintEvent([]);
    const blob = await encryptBlob(await deriveKey(eventKey, organizerToken, 'organizer'), 'x');
    await expect(decryptBlob(await deriveKey(eventKey, organizerToken, 'assignment'), blob)).rejects.toThrow();
  });
});

describe('assignments', () => {
  it('the giver whose token sealed an assignment opens it; another participant\'s token cannot', async () => {
    const { eventKey, participantTokens } = mintEvent(['giver', 'other']);
    const sealed = await sealAssignment(eventKey, participantTokens.giver, 'receiver-id');
    expect(sealed).not.toContain('receiver-id');
    expect(await openAssignment(eventKey, participantTokens.giver, sealed)).toBe('receiver-id');
    await expect(openAssignment(eventKey, participantTokens.other, sealed)).rejects.toThrow();
  });

  it('the event key alone does not open an assignment', async () => {
    const { eventKey, participantTokens } = mintEvent(['giver']);
    const sealed = await sealAssignment(eventKey, participantTokens.giver, 'receiver-id');
    await expect(decryptBlob(eventKey, sealed)).rejects.toThrow();
  });
});

describe('details', () => {
  // The Worker refuses any blob over 16 KB (spec: Limits).
  const MAX_BLOB_BYTES = 16 * 1024;

  it('seals and opens title, budget, date, location and notes', async () => {
    const minted = mintEvent([]);
    const credentials = { eventId: minted.eventId, eventKey: minted.eventKey, organizerToken: minted.organizerToken };
    const details = { title: 'Family Christmas', budget: '20 €', date: '2026-12-24', location: 'Grandma\'s', notes: 'Wrap it.' };
    const sealed = await sealEvent(credentials, { details, participants: {}, participantTokens: {} });
    expect(sealed.details).not.toContain('Family');
    expect((await openParticipantView(minted.eventKey, sealed)).details).toEqual(details);
  });

  it('details filled to every field\'s character budget, with the costliest characters to encode, stay under 16 KB', async () => {
    const minted = mintEvent([]);
    const credentials = { eventId: minted.eventId, eventKey: minted.eventKey, organizerToken: minted.organizerToken };
    // A control character becomes six bytes once JSON-escaped (\u0001).
    const fill = (n: number) => '\u0001'.repeat(n);
    const details = {
      title: fill(DETAILS_LIMITS.title),
      budget: fill(DETAILS_LIMITS.budget),
      date: '2026-12-24',
      location: fill(DETAILS_LIMITS.location),
      notes: fill(DETAILS_LIMITS.notes),
    };
    const sealed = await sealEvent(credentials, { details, participants: {}, participantTokens: {} });
    expect(sealed.details.length).toBeLessThanOrEqual(MAX_BLOB_BYTES);
    expect(DETAILS_LIMITS.notes).toBeGreaterThanOrEqual(1000);
  });
});

describe('wishlists', () => {
  const MAX_BLOB_BYTES = 16 * 1024;
  const wishlist = {
    items: [
      { text: 'Wool socks, size 42', url: '' },
      { text: 'Le Petit Prince', url: 'https://example.com/petit-prince' },
    ],
    notes: 'Allergic to peanuts. No candles please.',
  };

  it('seals a wishlist with the event key so any participant link opens it, and nothing readable reaches the server', async () => {
    const { eventKey } = mintEvent([]);
    const sealed = await sealWishlist(eventKey, wishlist);
    expect(sealed).not.toContain('socks');
    expect(await openWishlist(eventKey, sealed)).toEqual(wishlist);
  });

  it('a wishlist does not open with another event\'s key', async () => {
    const sealed = await sealWishlist(mintEvent([]).eventKey, wishlist);
    await expect(openWishlist(mintEvent([]).eventKey, sealed)).rejects.toThrow();
  });

  it('a wishlist that uses its whole character budget seals under 16 KB, and one character more is refused', async () => {
    const { eventKey } = mintEvent([]);
    const empty = { items: [{ text: '', url: 'https://example.com/' }], notes: '' };
    const full = { ...empty, notes: 'x'.repeat(wishlistCharactersLeft(empty)) };
    expect(wishlistCharactersLeft(full)).toBe(0);
    expect((await sealWishlist(eventKey, full)).length).toBeLessThanOrEqual(MAX_BLOB_BYTES);

    // Characters that take more room once encoded use more of the budget.
    const over = { ...full, notes: `${full.notes.slice(1)}é` };
    expect(wishlistCharactersLeft(over)).toBeLessThan(0);
    await expect(sealWishlist(eventKey, over)).rejects.toThrow();
  });

  it('an empty wishlist leaves a budget of thousands of characters', () => {
    expect(wishlistCharactersLeft({ items: [], notes: '' })).toBeGreaterThan(10000);
  });
});
