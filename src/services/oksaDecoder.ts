/**
 * ============================================================================
 * OKSA 2D REVERSE EXTRACTOR & ERROR CORRECTION ENGINE
 * Implementation: Bijective 3-Channel Log-Domain Matrix Solver
 * Runtime Compatibility: Native TypeScript and Bun Core
 * ============================================================================
 */

export interface OksaColorNode {
  u: number; // 2D Projection X-Axis Vector [-1.0 to 1.0]
  v: number; // 2D Projection Y-Axis Vector [-1.0 to 1.0]
  r: number; // Red channel byte [0 - 255]
  g: number; // Green channel byte [0 - 255]
  b: number; // Blue channel byte [0 - 255]
}

export class Oksa2DDecoder {
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
    for (let i = 255; i < 512; i++) this.expTable[i] = this.expTable[i - 255] ?? 0;
  }

  private safeLog(value: number): number {
    return this.logTable[value] ?? 0;
  }

  private safeExp(index: number): number {
    return this.expTable[index] ?? 0;
  }

  // --- FINITE FIELD ARITHMETIC OPERATORS ---
  private gfAdd(a: number, b: number): number { 
    return a ^ b; 
  }

  private gfMultiply(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;

    const logA = this.logTable[a];
    const logB = this.logTable[b];

    if (logA === undefined || logB === undefined) {
      throw new Error("Oksa Engine Error: Invalid Galois Field element.");
    }

    return this.safeExp(logA + logB);
  }

  private gfDivide(a: number, b: number): number {
    if (b === 0) throw new Error("Oksa Engine Error: Division by zero inside Galois Field.");
    if (a === 0) return 0;

    const logA = this.logTable[a];
    const logB = this.logTable[b];

    if (logA === undefined || logB === undefined) {
      throw new Error("Oksa Engine Error: Invalid Galois Field element.");
    }

    let diff = logA - logB;
    if (diff < 0) diff += 255;
    return this.safeExp(diff);
  }

  /**
   * SELF-HEALING ARRAYS PARSER (Strategy #3 Verification Loop)
   * Resolves the true depth component gZ from corrupted or shifted color space profiles.
   */
  public extractAndHealZ(r: number, g: number, b: number): number {
    // 1. Nominal Gate Check: Does the mathematical equilibrium balance cleanly?
    if (this.gfAdd(r, g) === b) {
      return r; // Vector channels are perfectly intact.
    }

    // 2. Automated Diagnostic and Self-Repair Gate Routine
    // Check if the validation multiplier path matches Channel B perfectly (Flags Channel G as corrupted)
    if (this.gfAdd(r, this.gfMultiply(r, this.fixedSignatureMultiplier)) === b) {
      return r; 
    }

    // Check if Channel R was the broken link by trying to resolve it via Channel G
    const recoveredRFromG = this.gfDivide(g, this.fixedSignatureMultiplier);
    if (this.gfAdd(recoveredRFromG, g) === b) {
      return recoveredRFromG; // Successfully bypassed a modified/corrupted Red channel value!
    }

    // Default historical safety fallback to channel R if multiple vectors degrade below thresholds
    return r;
  }

  /**
   * REVERSE TWO-WAY MATRIX INTERFACE
   * Reads 2D point arrays and decodes the complete original string signature
   */
  public decodeIdentity(nodes: OksaColorNode[]): string {
    let recoveredText = "";

    for (const node of nodes) {
      // Reconstruct original finite field integers from screen floating-point layout values
      const gX = Math.round((node.u + 1.0) * 127.5);
      const gY = Math.round((node.v + 1.0) * 127.5);

      // Execute our automated data-cleansing loop to extract a clean Z byte integer
      const gZ = this.extractAndHealZ(node.r, node.g, node.b);

      // Extract discrete log powers to resolve the cyclic system of linear equations.
      // Guard against noUncheckedIndexedAccess by normalizing optional table entries.
      const logGX = this.safeLog(gX);
      const logGY = this.safeLog(gY);
      const logGZ = this.safeLog(gZ);

      let totalLogSum = logGX + logGY + logGZ;
      if (totalLogSum % 2 !== 0) totalLogSum += 255;
      const totalLog = (totalLogSum / 2) % 255;

      // Solve for original ASCII byte character triplets
      const b1 = this.safeExp((totalLog - logGY + 255) % 255);
      const b2 = this.safeExp((totalLog - logGZ + 255) % 255);
      const b3 = this.safeExp((totalLog - logGX + 255) % 255);

      recoveredText += String.fromCharCode(b1, b2, b3);
    }

    return recoveredText.trimEnd(); // Clears any whitespace padding characters
  }
}
