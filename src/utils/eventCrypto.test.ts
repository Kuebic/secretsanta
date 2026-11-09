import { describe, expect, it } from 'vitest';
import { decryptBlob, deriveKey, encryptBlob, mintEvent, mintParticipantId, mintToken, openAssignment, sealAssignment } from './eventCrypto';

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
