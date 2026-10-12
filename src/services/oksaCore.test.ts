/**
 * ============================================================================
 * OKSA CORE AUTOMATED REGRESSION SUITE
 * Test Framework: Native bun:test Library Framework
 * Validation Targets: Bijective Integrity, Type Guards, Self-Healing Matrices
 * ============================================================================
 */

import { expect, test, describe, beforeEach } from "bun:test";
import { OksaCoreEngine, type OksaNode2D } from "./oksaCore";

describe("OksaCoreEngine Architecture Validation", () => {
  let engine: OksaCoreEngine;

  beforeEach(() => {
    engine = new OksaCoreEngine();
  });

  // 1. BIJECTIVE INTEGRITY TESTS (ROUND-TRIP VERIFICATION)
  describe("Bijective Round-Trip Mapping", () => {
    const testCases = [
      "BUN",
      "OKSA",
      "HENRI",
      "HEDDA",
      "BUNGF8XYZ",
      "POLYPROOF",
      "123456789"
    ];

    testCases.forEach((inputName) => {
      test(`should flawlessly serialize and deserialize "${inputName}" without data loss`, () => {
        // Forward encoding path
        const payload = engine.generateIdentity(inputName);
        expect(payload.nodes.length).toBeGreaterThanOrEqual(1);
        
        // Reverse decoding path
        const recoveredName = engine.decodeIdentity(payload.nodes);
        
        // Account for trailing workspace padding spaces enforced by the 3-byte boundary constraint
        const expectedPadded = inputName.padEnd(Math.max(3, Math.ceil(inputName.length / 3) * 3), " ").toUpperCase();
        expect(recoveredName).toBe(expectedPadded.trimEnd());
      });
    });
  });

  // 2. STRATEGY #3 SELF-HEALING MASK REPAIR VERIFICATION
  describe("Strategy #3 Color Checksum Self-Healing", () => {
    test("should pass nominal verification when RGB channels are completely pristine", () => {
      const gZSample = 168; // Standard Gray Mask baseline parameter symbol
      const hexColor = engine.encodeZToChecksumColor(gZSample);
      
      const extractedZ = engine.extractAndHealZ(hexColor);
      expect(extractedZ).toBe(gZSample);
    });

    test("should automatically heal and reconstruct data when Channel G (Green) is corrupted", () => {
      const payload = engine.generateIdentity("OksaCore");
      const targetNode = { ...payload.nodes[0] } as OksaNode2D;
      
      // Inject corruption specifically into the Green channel bits (middle byte)
      const originalColor = targetNode.hexColor; // e.g., "#RRGGBB"
      targetNode.hexColor = originalColor.substring(0, 3) + "FF" + originalColor.substring(5, 7);
      
      // Ensure the decoding engine successfully bypasses the bad Green value
      const recoveredName = engine.decodeIdentity([targetNode, ...payload.nodes.slice(1)]);
      expect(recoveredName).toBe("OKSACORE");
    });

    test("should automatically heal and reconstruct data when Channel R (Red) is corrupted", () => {
      const payload = engine.generateIdentity("BunFetch");
      const targetNode = { ...payload.nodes[0] } as OksaNode2D;
      
      // Inject corruption specifically into the Red channel bits (first byte)
      const originalColor = targetNode.hexColor;
      targetNode.hexColor = "#00" + originalColor.substring(3);
      
      // Ensure the decoder utilizes the Blue and Green channels to rebuild the original Red symbol step
      const recoveredName = engine.decodeIdentity([targetNode, ...payload.nodes.slice(1)]);
      expect(recoveredName).toBe("BUNFETCH");
    });
  });

  // 3. DEFENSIVE BOUNDARY & EDGE GUARD VERIFICATION
  describe("Defensive Guard Rails & Type Safety", () => {
    test("should reject empty or whitespace-only inputs at the gate layer", () => {
      expect(() => engine.generateIdentity("")).toThrow("Oksa Core Error: Input text string target cannot be empty.");
      expect(() => engine.generateIdentity("   ")).toThrow("Oksa Core Error: Input text string target cannot be empty.");
    });

    test("should enforce maximum capacity boundaries at 255 characters", () => {
      const massiveString = "A".repeat(256);
      expect(() => engine.generateIdentity(massiveString)).toThrow("Oksa Limit Met: String signatures cannot map past 255 elements.");
    });

    test("should degrade gracefully or throw an error when passed empty coordinate structures to the decoder", () => {
      expect(() => engine.decodeIdentity([])).toThrow("Oksa Core Error: Target decoding nodes array buffer cannot be empty.");
    });

    test("should safely intercept broken hex color dimensions when reading corrupted DOM strings", () => {
      expect(() => engine.extractAndHealZ("#BAD")).toThrow("Oksa Core Error: Target color signature structure fails hex format lengths.");
      expect(() => engine.extractAndHealZ("#G01234")).toThrow("Oksa Core Error: Hex compilation failure during channel extraction parsing pass.");
    });
  });
});
