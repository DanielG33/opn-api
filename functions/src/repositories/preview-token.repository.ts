import { db } from "../firebase";
import { previewTokenService } from "../services/preview-token.service";
import { Timestamp } from "firebase-admin/firestore";

const COLLECTION_NAME = "previewTokens";

export interface PreviewToken {
  id: string;
  seriesId: string;
  tokenHash: string;
  createdAt: Timestamp;
  createdBy?: string;
  expiresAt: Timestamp;
  lastUsedAt?: Timestamp;
  revokedAt?: Timestamp;
  revokedBy?: string;
}

export interface CreateTokenResult {
  tokenString: string;
  tokenDoc: PreviewToken;
}

/**
 * Creates a new preview token for a series.
 * Returns both the plaintext token (only time it's available) and the stored document.
 */
export async function createForSeries(
  seriesId: string,
  createdBy?: string
): Promise<CreateTokenResult> {
  const now = Timestamp.now();
  const tokenString = previewTokenService.generateTokenString();
  const tokenHash = previewTokenService.hashToken(tokenString);
  const expiresAt = previewTokenService.computeExpiry(now);

  const tokenRef = db.collection(COLLECTION_NAME).doc();

  const tokenData: Omit<PreviewToken, "id"> = {
    seriesId,
    tokenHash,
    createdAt: now,
    createdBy,
    expiresAt,
  };

  await tokenRef.set(tokenData);

  const tokenDoc: PreviewToken = {
    id: tokenRef.id,
    ...tokenData,
  };

  return { tokenString, tokenDoc };
}

/**
 * Lists all preview tokens for a series.
 * @param seriesId - The series ID to filter by
 * @param activeOnly - If true, only returns tokens that are not revoked and not expired
 */
export async function listBySeries(
  seriesId: string,
  activeOnly = false
): Promise<PreviewToken[]> {
  let query = db
    .collection(COLLECTION_NAME)
    .where("seriesId", "==", seriesId)
    .orderBy("createdAt", "desc");

  const snapshot = await query.get();
  const tokens: PreviewToken[] = [];
  const now = Timestamp.now();

  snapshot.forEach((doc) => {
    const data = doc.data() as Omit<PreviewToken, "id">;
    const token: PreviewToken = {
      id: doc.id,
      ...data,
    };

    if (activeOnly) {
      const isNotRevoked = !token.revokedAt;
      const isNotExpired = token.expiresAt.toMillis() > now.toMillis();
      if (isNotRevoked && isNotExpired) {
        tokens.push(token);
      }
    } else {
      tokens.push(token);
    }
  });

  return tokens;
}

/**
 * Revokes a preview token, preventing further use.
 */
export async function revoke(
  tokenId: string,
  revokedBy?: string
): Promise<void> {
  const tokenRef = db.collection(COLLECTION_NAME).doc(tokenId);
  const now = Timestamp.now();

  await tokenRef.update({
    revokedAt: now,
    revokedBy,
  });
}

/**
 * Refreshes a token's expiration time by adding 12 hours from now.
 */
export async function refresh(tokenId: string): Promise<void> {
  const now = Timestamp.now();
  const expiresAt = previewTokenService.computeExpiry(now);

  const tokenRef = db.collection(COLLECTION_NAME).doc(tokenId);
  await tokenRef.update({ expiresAt });
}

/**
 * Validates a token and updates its usage information.
 * Checks that:
 * - Token hash matches
 * - Token belongs to the specified series
 * - Token is not revoked
 * - Token is not expired
 * 
 * If valid, updates lastUsedAt and extends expiresAt by 12 hours.
 * 
 * @returns The token document if valid, null if invalid
 */
export async function validateAndTouch(
  seriesId: string,
  tokenString: string
): Promise<PreviewToken | null> {
  const tokenHash = previewTokenService.hashToken(tokenString);
  const now = Timestamp.now();

  // Query for matching token hash
  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as Omit<PreviewToken, "id">;
  const token: PreviewToken = {
    id: doc.id,
    ...data,
  };

  // Validate token
  if (token.seriesId !== seriesId) {
    return null;
  }

  if (token.revokedAt) {
    return null;
  }

  if (token.expiresAt.toMillis() <= now.toMillis()) {
    return null;
  }

  // Token is valid - update usage and extend expiration
  const newExpiresAt = previewTokenService.computeExpiry(now);
  await doc.ref.update({
    lastUsedAt: now,
    expiresAt: newExpiresAt,
  });

  // Return updated token
  return {
    ...token,
    lastUsedAt: now,
    expiresAt: newExpiresAt,
  };
}

export const previewTokenRepository = {
  createForSeries,
  listBySeries,
  revoke,
  refresh,
  validateAndTouch,
};
