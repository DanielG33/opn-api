import {PreviewTokenService} from "./preview-token.service";
import * as admin from "firebase-admin";

describe("PreviewTokenService", () => {
  let service: PreviewTokenService;

  beforeEach(() => {
    service = new PreviewTokenService();
  });

  describe("generateTokenString", () => {
    it("should generate tokens with pt_ prefix", () => {
      const token = service.generateTokenString();
      expect(token).toMatch(/^pt_/);
    });

    it("should generate tokens with correct length", () => {
      const token = service.generateTokenString();
      // pt_ (3) + base64url(32 bytes) = 3 + 43 = 46 characters
      // 32 bytes in base64 = 43 chars (after removing padding)
      expect(token.length).toBe(46);
    });

    it("should generate unique tokens", () => {
      const token1 = service.generateTokenString();
      const token2 = service.generateTokenString();
      expect(token1).not.toBe(token2);
    });

    it("should only contain base64url-safe characters", () => {
      const token = service.generateTokenString();
      const tokenBody = token.substring(3); // Remove 'pt_' prefix
      // Base64url uses: A-Z, a-z, 0-9, -, _
      expect(tokenBody).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("should not contain base64 padding characters", () => {
      const token = service.generateTokenString();
      expect(token).not.toContain("=");
    });

    it("should not contain standard base64 special chars", () => {
      const token = service.generateTokenString();
      expect(token).not.toContain("+");
      expect(token).not.toContain("/");
    });
  });

  describe("hashToken", () => {
    it("should produce consistent hashes for the same input", () => {
      const tokenString = "pt_test123456789012345678901234567890abc";
      const hash1 = service.hashToken(tokenString);
      const hash2 = service.hashToken(tokenString);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const token1 = "pt_test123456789012345678901234567890abc";
      const token2 = "pt_test123456789012345678901234567890def";
      const hash1 = service.hashToken(token1);
      const hash2 = service.hashToken(token2);
      expect(hash1).not.toBe(hash2);
    });

    it("should produce base64url-encoded hash", () => {
      const token = service.generateTokenString();
      const hash = service.hashToken(token);
      // SHA-256 produces 32 bytes, base64url is 43 chars (no padding)
      expect(hash.length).toBe(43);
      expect(hash).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(hash).not.toContain("=");
      expect(hash).not.toContain("+");
      expect(hash).not.toContain("/");
    });

    it("should hash the full token including prefix", () => {
      const token1 = "pt_abc123";
      const token2 = "abc123"; // Without prefix
      const hash1 = service.hashToken(token1);
      const hash2 = service.hashToken(token2);
      expect(hash1).not.toBe(hash2);
    });

    it("should produce stable hash across multiple calls", () => {
      // Test known input/output for regression testing
      const knownToken = "pt_1234567890123456789012345678901234567890abc";
      const hash1 = service.hashToken(knownToken);
      const hash2 = service.hashToken(knownToken);
      const hash3 = service.hashToken(knownToken);
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe("computeExpiry", () => {
    it("should add 12 hours to the given timestamp", () => {
      const now = admin.firestore.Timestamp.fromDate(new Date("2026-01-26T10:00:00Z"));
      const expiry = service.computeExpiry(now);

      const expectedDate = new Date("2026-01-26T22:00:00Z");
      const expiryDate = expiry.toDate();

      expect(expiryDate.getTime()).toBe(expectedDate.getTime());
    });

    it("should handle midnight crossing", () => {
      const now = admin.firestore.Timestamp.fromDate(new Date("2026-01-26T20:00:00Z"));
      const expiry = service.computeExpiry(now);

      const expectedDate = new Date("2026-01-27T08:00:00Z");
      const expiryDate = expiry.toDate();

      expect(expiryDate.getTime()).toBe(expectedDate.getTime());
    });

    it("should handle month boundary", () => {
      const now = admin.firestore.Timestamp.fromDate(new Date("2026-01-31T20:00:00Z"));
      const expiry = service.computeExpiry(now);

      const expectedDate = new Date("2026-02-01T08:00:00Z");
      const expiryDate = expiry.toDate();

      expect(expiryDate.getTime()).toBe(expectedDate.getTime());
    });

    it("should return a Firestore Timestamp", () => {
      const now = admin.firestore.Timestamp.now();
      const expiry = service.computeExpiry(now);

      expect(expiry).toBeInstanceOf(admin.firestore.Timestamp);
    });

    it("should be exactly 12 hours later", () => {
      const now = admin.firestore.Timestamp.now();
      const expiry = service.computeExpiry(now);

      const differenceMs = expiry.toMillis() - now.toMillis();
      const twelveHoursMs = 12 * 60 * 60 * 1000;

      expect(differenceMs).toBe(twelveHoursMs);
    });
  });
});
