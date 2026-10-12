/**
 * ============================================================================
 * OKSA CORE 2D TWO-WAY IDENTITY ENGINEERING LIBRARY
 * Core Architecture: Bijective 3-Channel Finite Field Generator & Solver
 * Security Protocols: Strategy #3 Galois Checksum Loop & Self-Healing Matrix
 * Optimizations: Defensive Safe-Lookup Wrappers & Bound Edge Guards
 * Runtime Framework: Native TypeScript and Bun Execution Engine Space
 * ============================================================================
 */

export interface OksaNode2D {
  u: number;         // Transformed Horizontal Screen Coordinate [-1.0 to 1.0]
  v: number;         // Transformed Vertical Screen Coordinate [-1.0 to 1.0]
  hexColor: string;  // Self-healing Galois checksum color signature (#RRGGBB)
}

export interface OksaIdentityPayload {
  name: string;
  nodes: OksaNode2D[];
  svgString: string;
}

export class OksaCoreEngine {
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

  public gfAdd(a: number, b: number): number {
    return a ^ b; // Bitwise XOR addition primitive
  }

  public gfMultiply(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;

    const logA = this.logTable[a];
    const logB = this.logTable[b];

    // Assert index integrity constraints against strict type configuration rules
    if (logA === undefined || logB === undefined) {
      throw new Error("Oksa Core Error: Invalid Galois Field element encountered during multiplication.");
    }

    return this.safeExp(logA + logB);
  }

  public gfDivide(a: number, b: number): number {
    if (b === 0) throw new Error("Oksa Core Error: Division by zero inside Galois Field calculation loop.");
    if (a === 0) return 0;

    const logA = this.logTable[a];
    const logB = this.logTable[b];

    if (logA === undefined || logB === undefined) {
      throw new Error("Oksa Core Error: Invalid Galois Field element encountered during division.");
    }

    let diff = logA - logB;
    if (diff < 0) diff += 255;
    return this.safeExp(diff);
  }

  // --- HELPER UTILITIES ---

  private byteToHex(byte: number): string {
    const cleanByte = Math.max(0, Math.min(255, byte));
    return cleanByte.toString(16).padStart(2, "0").toUpperCase();
  }

  /**
   * STRATEGY #3 COLOR SPACE MASK ENCODER
   * Packs raw gZ elements securely into an error-reducing color signature sequence.
   */
  public encodeZToChecksumColor(gZ: number): string {
    if (gZ < 0 || gZ > 255) {
      throw new Error("Oksa Core Error: Target depth component out of bounds for single byte conversion.");
    }

    const channelR = gZ;
    const channelG = this.gfMultiply(gZ, this.fixedSignatureMultiplier);
    const channelB = this.gfAdd(channelR, channelG);

    return `#${this.byteToHex(channelR)}${this.byteToHex(channelG)}${this.byteToHex(channelB)}`;
  }

  /**
   * STRATEGY #3 SELF-HEALING ARRAYS PARSER
   * Evaluates the algebraic validation loop and auto-repairs individual corrupted channels.
   */
  public extractAndHealZ(hexColor: string): number {
    const cleanHex = hexColor.replace("#", "");
    if (cleanHex.length !== 6) {
      throw new Error("Oksa Core Error: Target color signature structure fails hex format lengths.");
    }

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      throw new Error("Oksa Core Error: Hex compilation failure during channel extraction parsing pass.");
    }

    // 1. Nominal Check: Does the mathematical equilibrium balance cleanly?
    if (this.gfAdd(r, g) === b) {
      return r; 
    }

    // 2. Diagnostics: If validation breaks, cross-examine channels and heal mutations
    if (this.gfAdd(r, this.gfMultiply(r, this.fixedSignatureMultiplier)) === b) {
      return r; // Channel G was distorted; Channel R and B remain pristine
    }

    const recoveredRFromG = this.gfDivide(g, this.fixedSignatureMultiplier);
    if (this.gfAdd(recoveredRFromG, g) === b) {
      return recoveredRFromG; // Successfully recovered from a corrupted Red channel!
    }

    return r; // Absolute fallback boundary
  }

  // ========================================================
  // TWO-WAY APPARATUS INTERFACES (FORWARD / REVERSE)
  // ========================================================

  /**
   * FORWARD ENCODER: Maps alphanumeric keys into protective 2D visual coordinate layouts
   */
  public generateIdentity(name: string): OksaIdentityPayload {
    if (!name || name.trim().length === 0) {
      throw new Error("Oksa Core Error: Input text string target cannot be empty.");
    }

    let requiredLength = Math.max(3, Math.ceil(name.length / 3) * 3);
    if (requiredLength > 255) {
      throw new Error("Oksa Limit Met: String signatures cannot map past 255 elements.");
    }

    let paddedText = name.padEnd(requiredLength, " ").toUpperCase();
    const nodes: OksaNode2D[] = [];

    for (let i = 0; i < paddedText.length; i += 3) {
      const b1 = paddedText.charCodeAt(i);
      const b2 = paddedText.charCodeAt(i + 1);
      const b3 = paddedText.charCodeAt(i + 2);

      if (Number.isNaN(b1) || Number.isNaN(b2) || Number.isNaN(b3)) {
        throw new Error("Oksa Core Error: Corrupted input stream buffer inside text conversion indices.");
      }

      const gX = this.gfMultiply(b1, b2);
      const gY = this.gfMultiply(b2, b3);
      const gZ = this.gfMultiply(b3, b1);

      const u = Number(((gX / 127.5) - 1.0).toFixed(4));
      const v = Number(((gY / 127.5) - 1.0).toFixed(4));
      const hexColor = this.encodeZToChecksumColor(gZ);

      nodes.push({ u, v, hexColor });
    }

    const pointsAttr = nodes.map(n => `${n.u},${n.v}`).join(" ");
    let svgString = `<svg xmlns="http://w3.org" viewBox="-1.2 -1.2 2.4 2.4" class="oksa-id-frame">\n`;
    svgString += `  <polygon class="oksa-hull" points="${pointsAttr}" fill="rgba(88,166,255,0.05)" stroke="#238636" stroke-width="0.015" />\n`;
    nodes.forEach((n, idx) => {
      svgString += `  <circle class="oksa-node" cx="${n.u}" cy="${n.v}" r="0.035" fill="${n.hexColor}" data-index="${idx}" />\n`;
    });
    svgString += `</svg>`;

    return { name: paddedText.trimEnd(), nodes, svgString };
  }

  /**
   * REVERSE DECODER: Extracts pristine character strings directly from parsed node coordinates
   */
  public decodeIdentity(nodes: OksaNode2D[]): string {
    if (!nodes || nodes.length === 0) {
      throw new Error("Oksa Core Error: Target decoding nodes array buffer cannot be empty.");
    }

    let recoveredText = "";

    for (const node of nodes) {
      const gX = Math.round((node.u + 1.0) * 127.5);
      const gY = Math.round((node.v + 1.0) * 127.5);
      const gZ = this.extractAndHealZ(node.hexColor);

      // Guarded index fetches to preserve strict compiler options
      const logGX = this.safeLog(gX);
      const logGY = this.safeLog(gY);
      const logGZ = this.safeLog(gZ);

      let totalLogSum = logGX + logGY + logGZ;
      if (totalLogSum % 2 !== 0) totalLogSum += 255;
      const totalLog = (totalLogSum / 2) % 255;

      const b1 = this.safeExp((totalLog - logGY + 255) % 255);
      const b2 = this.safeExp((totalLog - logGZ + 255) % 255);
      const b3 = this.safeExp((totalLog - logGX + 255) % 255);

      recoveredText += String.fromCharCode(b1, b2, b3);
    }

    return recoveredText.trimEnd();
  }
}
