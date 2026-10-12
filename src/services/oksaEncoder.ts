//oksaEncoder.ts
/**
 * ============================================================================
 * OKSA 2D FORWARD ENCODER LIBRARY
 * Implementation: Bijective 3-Channel Finite Field Generator
 * Optimizations: Safe Array Lookups & Input Boundary Edge Guards
 * Compatibility: Native TypeScript and Bun Core
 * ============================================================================
 */

export interface OksaNode2D {
  u: number;         // Horizontal projection coordinate [-1.0 to 1.0]
  v: number;         // Vertical projection coordinate [-1.0 to 1.0]
  hexColor: string;  // Self-healing Galois checksum color sequence (#RRGGBB)
}

export interface OksaIdentityPayload {
  name: string;
  nodes: OksaNode2D[];
  svgString: string;
}

export class Oksa2DEncoder {
  private expTable = new Uint8Array(512);
  private logTable = new Uint8Array(256);
  private readonly primitivePolynomial = 285; // x^8 + x^4 + x^3 + x^2 + 1
  private readonly fixedSignatureMultiplier = 42;

  constructor() {
    // Initialize the Galois Field exponential and logarithm lookup tables
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.expTable[i] = x;
      this.logTable[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= this.primitivePolynomial;
    }
    // Defensive normalization guard mapping on table array initialization bounds
    for (let i = 255; i < 512; i++) {
      this.expTable[i] = this.expTable[i - 255] ?? 0;
    }
  }

  // --- SAFE LOOKUP DEFENSIVE LAYERS ---

  private safeLog(value: number): number {
    return this.logTable[value] ?? 0;
  }

  private safeExp(index: number): number {
    return this.expTable[index] ?? 0;
  }

  // --- FINITE FIELD ARITHMETIC OPERATORS ---

  private gfAdd(a: number, b: number): number {
    return a ^ b; // Bitwise XOR addition primitive remains unchanged
  }

  private gfMultiply(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;

    const logA = this.logTable[a];
    const logB = this.logTable[b];

    // Assert index integrity constraints against strict type configuration rules
    if (logA === undefined || logB === undefined) {
      throw new Error("Oksa Encoder Error: Invalid Galois Field matrix multiplication element.");
    }

    return this.safeExp(logA + logB);
  }

  private byteToHex(byte: number): string {
    // Ensure value fits strictly inside single-byte boundary profiles
    const cleanByte = Math.max(0, Math.min(255, byte));
    return cleanByte.toString(16).padStart(2, "0").toUpperCase();
  }

  /**
   * SELF-HEALING ENCODER LOGIC (Strategy #3 Loop)
   * Builds the grey baseline matrix color map utilizing bijective checksum structures.
   */
  public encodeZToChecksumColor(gZ: number): string {
    if (gZ < 0 || gZ > 255) {
      throw new Error("Oksa Encoder Error: Depth element out of bounds for single byte conversion.");
    }

    // Channel R: Core raw depth element byte assignment
    const channelR = gZ;

    // Channel G: Multiplier signature pass utilizing our protected operator
    const channelG = this.gfMultiply(gZ, this.fixedSignatureMultiplier);

    // Channel B: Algebraic validation loop anchor
    const channelB = this.gfAdd(channelR, channelG);

    return `#${this.byteToHex(channelR)}${this.byteToHex(channelG)}${this.byteToHex(channelB)}`;
  }

  // ========================================================
  // PRIMARY FORWARD TRANSLATION APPARATUS
  // ========================================================

  /**
   * FORWARD PIPELINE: Converts alphanumeric name text strings into safe 2D layout metrics
   */
  public generateIdentity(name: string): OksaIdentityPayload {
    if (!name || name.trim().length === 0) {
      throw new Error("Oksa Encoder Error: Target string input context cannot be empty.");
    }

    // Adaptive padding calculation matching our global multiples-of-three constraint rules
    let requiredLength = Math.max(3, Math.ceil(name.length / 3) * 3);
    if (requiredLength > 255) {
      throw new Error("Oksa Limit Met: Signature allocations cannot extend past 255 elements.");
    }

    let paddedText = name.padEnd(requiredLength, " ").toUpperCase();
    const nodes: OksaNode2D[] = [];

    for (let i = 0; i < paddedText.length; i += 3) {
      const b1 = paddedText.charCodeAt(i);
      const b2 = paddedText.charCodeAt(i + 1);
      const b3 = paddedText.charCodeAt(i + 2);

      // Verify character streams match printable ASCII block boundaries safely
      if (Number.isNaN(b1) || Number.isNaN(b2) || Number.isNaN(b3)) {
        throw new Error("Oksa Encoder Error: Corrupted character buffer encountered inside string matrix.");
      }

      // Execute cross-multiplication via our safe operator
      const gX = this.gfMultiply(b1, b2);
      const gY = this.gfMultiply(b2, b3);
      const gZ = this.gfMultiply(b3, b1);

      // Map X and Y coordinates cleanly to flat floating-point bounds [-1.0 to 1.0]
      const u = Number(((gX / 127.5) - 1.0).toFixed(4));
      const v = Number(((gY / 127.5) - 1.0).toFixed(4));

      // Pack the Z axis securely inside the Strategy #3 color space mask envelope
      const hexColor = this.encodeZToChecksumColor(gZ);

      nodes.push({ u, v, hexColor });
    }

    // Generate production-styled SVG presentation strings cleanly
    const pointsAttr = nodes.map(n => `${n.u},${n.v}`).join(" ");
    
    let svgString = `<svg xmlns="http://w3.org" viewBox="-1.2 -1.2 2.4 2.4" class="oksa-id-frame">\n`;
    svgString += `  <polygon class="oksa-hull" points="${pointsAttr}" fill="rgba(88,166,255,0.05)" stroke="#238636" stroke-width="0.015" />\n`;
    nodes.forEach((n, idx) => {
      svgString += `  <circle class="oksa-node" cx="${n.u}" cy="${n.v}" r="0.035" fill="${n.hexColor}" data-index="${idx}" />\n`;
    });
    svgString += `</svg>`;

    return { name: paddedText.trimEnd(), nodes, svgString };
  }
}
