// Legacy /pairing?from=&to= links only (ADR 0001): a fixed key the static
// version used for obfuscation, kept so those links still decrypt.
const ENCRYPTION_KEY_BYTES = new Uint8Array([
  132, 41, 242, 153, 104, 87, 23, 190,
  54, 187, 224, 176, 15, 198, 167, 249,
  89, 120, 78, 45, 12, 201, 156, 34,
  165, 43, 98, 133, 251, 49, 176, 88
]);

let cachedKey: CryptoKey | null = null;

export async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  
  cachedKey = await window.crypto.subtle.importKey(
    "raw",
    ENCRYPTION_KEY_BYTES,
    { name: "AES-GCM" },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
  
  return cachedKey;
}

export async function decryptText(encryptedText: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    // Split IV and data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt text');
  }
} 