import { decryptBlob, encryptBlob } from './eventCrypto';

// One entry in a wishlist: a description and an optional link (empty when none).
export interface WishlistItem {
  text: string;
  url: string;
}

// What a participant tells their giver. Sealed with the event key, so every
// participant link (and so their giver) can read it; the server cannot.
export interface Wishlist {
  items: WishlistItem[];
  notes: string;
}

export const EMPTY_WISHLIST: Wishlist = { items: [], notes: '' };

// The Worker refuses blobs over 16 KB. A sealed blob is base64url of
// iv (12) || ciphertext || tag (16), so the JSON plaintext gets
// 16384 * 3/4 - 28 bytes.
const MAX_BLOB_CHARS = 16 * 1024;
const MAX_PLAINTEXT_BYTES = (MAX_BLOB_CHARS * 3) / 4 - 12 - 16;

const encode = (wishlist: Wishlist) => new TextEncoder().encode(JSON.stringify(wishlist));

// The visible character budget. Counted in encoded bytes so it matches the
// Worker's limit exactly: one per plain character, more for accented letters
// and emoji, a little for each item.
export function wishlistCharactersLeft(wishlist: Wishlist): number {
  return MAX_PLAINTEXT_BYTES - encode(wishlist).length;
}

export async function sealWishlist(eventKey: string, wishlist: Wishlist): Promise<string> {
  if (wishlistCharactersLeft(wishlist) < 0) {
    throw new RangeError('Wishlist over the 16 KB limit');
  }
  return encryptBlob(eventKey, JSON.stringify(wishlist));
}

export async function openWishlist(eventKey: string, sealed: string): Promise<Wishlist> {
  const raw = JSON.parse(await decryptBlob(eventKey, sealed)) as Partial<Wishlist>;
  return {
    items: Array.isArray(raw.items)
      ? raw.items.map(item => ({ text: String(item?.text ?? ''), url: String(item?.url ?? '') }))
      : [],
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}

// Item links are rendered as plain links; only http(s) ones, so a typed
// "javascript:" never becomes clickable. A bare domain gets https://.
export function wishlistLinkHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}
