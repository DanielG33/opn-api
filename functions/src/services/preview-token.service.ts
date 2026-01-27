import * as crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

/**
 * PreviewTokenService handles the generation and hashing of preview tokens
 * for accessing draft series content without authentication.
 */
export class PreviewTokenService {
  /**
   * Generates a cryptographically secure preview token string.
   * Format: pt_<base64url-encoded-random-32-bytes>
   *
   * @returns A token string starting with 'pt_' followed by 43 base64url characters
   */
  generateTokenString(): string {
    const randomBytes = crypto.randomBytes(32);
    const base64url = randomBytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    return `pt_${base64url}`;
  }

  /**
   * Hashes a token string using SHA-256 and returns base64url encoding.
   * This hash is stored in the database for comparison.
   *
   * @param tokenString - The preview token string to hash
   * @returns The SHA-256 hash of the token, base64url-encoded
   */
  hashToken(tokenString: string): string {
    const hash = crypto.createHash("sha256").update(tokenString).digest();
    const base64url = hash
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    return base64url;
  }

  /**
   * Computes the expiry timestamp for a preview token.
   * Default expiry is 12 hours from the given timestamp.
   *
   * @param now - The starting timestamp (typically current time)
   * @returns A Firestore Timestamp 12 hours in the future
   */
  computeExpiry(now: Timestamp = Timestamp.now()): Timestamp {
    const expiryDate = now.toDate();
    expiryDate.setHours(expiryDate.getHours() + 12);
    return Timestamp.fromDate(expiryDate);
  }
}

export const previewTokenService = new PreviewTokenService();
