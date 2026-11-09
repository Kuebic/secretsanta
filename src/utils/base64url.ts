// Base64url without padding (RFC 4648 §5). Shared by the browser and the Worker.
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) {
    throw new Error('Not base64url');
  }
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function randomBase64url(byteLength: number): string {
  return bytesToBase64url(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

// SHA-256 of a token, base64url. The server stores and compares only these.
export async function hashToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bytesToBase64url(new Uint8Array(digest));
}
