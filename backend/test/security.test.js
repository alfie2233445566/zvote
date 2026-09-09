// Backend Authentication & Security Unit Tests
// Implements Chapter Four, Section 5.5 (Security Testing: ST-01, ST-02, ST-03)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

describe("Chapter 4 Security Testing Suite (ST-01 to ST-03)", () => {
  const TEST_JWT_SECRET = "test-secret-key-1234567890-secure";

  describe("ST-01: JWT Session & Signature Security", () => {
    test("rejects a token signed with an incorrect secret", () => {
      const forgedToken = jwt.sign(
        { id: "test-user-1", studentId: "UEB1103322", role: "VOTER" },
        "wrong-unauthorized-secret",
        { expiresIn: "1h" }
      );

      assert.throws(
        () => {
          jwt.verify(forgedToken, TEST_JWT_SECRET);
        },
        (err) => {
          assert.equal(err.name, "JsonWebTokenError");
          assert.equal(err.message, "invalid signature");
          return true;
        }
      );
    });

    test("rejects an expired token", () => {
      const expiredToken = jwt.sign(
        { id: "test-user-1", studentId: "UEB1103322", role: "VOTER" },
        TEST_JWT_SECRET,
        { expiresIn: -10 } // Expired 10 seconds ago
      );

      assert.throws(
        () => {
          jwt.verify(expiredToken, TEST_JWT_SECRET);
        },
        (err) => {
          assert.equal(err.name, "TokenExpiredError");
          return true;
        }
      );
    });

    test("accepts a legitimately signed, unexpired token", () => {
      const validToken = jwt.sign(
        { id: "test-user-1", studentId: "UEB1103322", role: "VOTER" },
        TEST_JWT_SECRET,
        { expiresIn: "1h" }
      );

      const decoded = jwt.verify(validToken, TEST_JWT_SECRET);
      assert.equal(decoded.studentId, "UEB1103322");
      assert.equal(decoded.role, "VOTER");
    });
  });

  describe("ST-02: Cryptographic Password Hashing & Bcrypt Integrity", () => {
    test("hashes password with cryptographic salt and verifies matching secret", async () => {
      const plainPassword = "StudentPass@2026!";
      const hash = await bcrypt.hash(plainPassword, 10);

      // Verify hash format starts with $2a$ or $2b$ (bcrypt signature)
      assert.match(hash, /^\$2[ab]\$10\$/);

      // Valid match succeeds
      const isValid = await bcrypt.compare(plainPassword, hash);
      assert.equal(isValid, true);

      // Incorrect password fails
      const isInvalid = await bcrypt.compare("WrongPassword123", hash);
      assert.equal(isInvalid, false);
    });

    test("rejects direct plaintext string equality shortcut", async () => {
      const plainPassword = "AdminPassword#456";
      const hash = await bcrypt.hash(plainPassword, 10);

      // Plaintext must never equal hash directly
      assert.notEqual(plainPassword, hash);
      assert.equal(plainPassword === hash, false);
    });
  });

  describe("ST-03: Brute-Force & Rate-Limiting Resistance Simulation", () => {
    test("simulates authentication throttle tracking repeated invalid attempts", () => {
      // In-memory brute force tracker simulation
      const attempts = new Map();
      const MAX_ATTEMPTS = 5;

      function recordAttempt(identifier) {
        const count = attempts.get(identifier) || 0;
        if (count >= MAX_ATTEMPTS) {
          return { allowed: false, error: "Too many failed attempts. Account temporarily locked." };
        }
        attempts.set(identifier, count + 1);
        return { allowed: true, remaining: MAX_ATTEMPTS - (count + 1) };
      }

      const targetId = "UEB1103322";

      // 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        const res = recordAttempt(targetId);
        assert.equal(res.allowed, true);
        assert.equal(res.remaining, 5 - i);
      }

      // 6th attempt is throttled/blocked
      const lockedRes = recordAttempt(targetId);
      assert.equal(lockedRes.allowed, false);
      assert.match(lockedRes.error, /Too many failed attempts/);
    });
  });
});
