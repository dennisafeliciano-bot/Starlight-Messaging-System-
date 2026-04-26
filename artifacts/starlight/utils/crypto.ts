const MASTER_KEY = "STARLIGHT-SECURE-LLC-2026";

async function deriveKey(keyString: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyString),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("starlight-salt-2026"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
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
  const key = await deriveKey(MASTER_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    enc.encode(dataString)
  );
  return JSON.stringify({
    cipher: bufferToBase64(cipher),
    iv: bufferToBase64(iv.buffer),
  });
}

export async function decryptStarPacket(encryptedJson: string): Promise<string | null> {
  try {
    const { cipher, iv } = JSON.parse(encryptedJson);
    const key = await deriveKey(MASTER_KEY);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: base64ToBuffer(iv) },
      key,
      base64ToBuffer(cipher)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
