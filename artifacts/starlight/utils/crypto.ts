// ─── StarLight AES-256-GCM — fast, standard, lightweight ─────────────────────
// Uses SHA-256 key derivation (single hash, no PBKDF2 iterations) for speed.
// AES-GCM provides both encryption and authentication in one pass.

const MASTER_KEY_STRING = "STARLIGHT-SECURE-LLC-2026";

let _cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(MASTER_KEY_STRING));
  _cachedKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return _cachedKey;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptStarPacket(dataString: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(dataString)
  );
  return JSON.stringify({
    c: bufferToBase64(cipher),
    iv: bufferToBase64(iv.buffer),
  });
}

export async function decryptStarPacket(encryptedJson: string): Promise<string | null> {
  try {
    const { c, iv } = JSON.parse(encryptedJson);
    const key = await getKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(iv) },
      key,
      base64ToBuffer(c)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
