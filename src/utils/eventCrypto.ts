import { base64urlToBytes, bytesToBase64url, randomBase64url } from './base64url';

// Everything an event's content is protected with is minted in the browser
// (ADR 0002). Sizes are fixed by the spec: 128-bit IDs and tokens, 256-bit key.
const ID_BYTES = 16;
const KEY_BYTES = 32;
const IV_BYTES = 12;

export interface MintedEvent {
  eventId: string;
  eventKey: string;
  organizerToken: string;
  participantTokens: Record<string, string>;
}

export function mintParticipantId(): string {
  return randomBase64url(ID_BYTES);
}

export function mintToken(): string {
  return randomBase64url(ID_BYTES);
}

export function mintEvent(participantIds: string[]): MintedEvent {
  return {
    eventId: randomBase64url(ID_BYTES),
    eventKey: randomBase64url(KEY_BYTES),
    organizerToken: mintToken(),
    participantTokens: Object.fromEntries(participantIds.map(id => [id, mintToken()])),
  };
}

const subtle = () => globalThis.crypto.subtle;

function importAesKey(rawKey: string): Promise<CryptoKey> {
  return subtle().importKey('raw', base64urlToBytes(rawKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// A key only the holder of `token` can derive: HKDF-SHA256 over the event key,
// the token as salt. Returned as base64url raw key bytes so it plugs into
// encryptBlob/decryptBlob like the event key.
export async function deriveKey(eventKey: string, token: string, info: string): Promise<string> {
  const material = await subtle().importKey('raw', base64urlToBytes(eventKey), 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: base64urlToBytes(token), info: new TextEncoder().encode(info) },
    material,
    KEY_BYTES * 8,
  );
  return bytesToBase64url(new Uint8Array(bits));
}

// AES-GCM; the result is base64url(iv || ciphertext+tag).
export async function encryptBlob(key: string, plaintext: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv }, await importAesKey(key), new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(IV_BYTES + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, IV_BYTES);
  return bytesToBase64url(combined);
}

export async function decryptBlob(key: string, blob: string): Promise<string> {
  const combined = base64urlToBytes(blob);
  const plaintext = await subtle().decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, IV_BYTES) },
    await importAesKey(key),
    combined.slice(IV_BYTES),
  );
  return new TextDecoder().decode(plaintext);
}
