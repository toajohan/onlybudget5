import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Derived from the app's existing secret: no extra env var to set. Changing JWT_SECRET means re-entering secrets.
function key(): Buffer {
  return createHash("sha256").update(`onlybudget-settings:${process.env.JWT_SECRET ?? ""}`).digest();
}

/** AES-256-GCM, stored as "iv.tag.ciphertext" in base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** Null if the value can't be decrypted (e.g. JWT_SECRET changed since it was saved). */
export function decryptSecret(stored: string): string | null {
  try {
    const [iv, tag, data] = stored.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
