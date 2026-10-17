import { write } from "bun";

export interface BmpMetadata {
  width: number;
  height: number;
  bitsPerPixel: number;
  pixelDataOffset: number;
}

export class PixMapperParser {
  /**
   * Parses the uncompressed BMP headers cleanly while addressing DataView offset shifts.
   */
  public static parseHeader(buffer: Uint8Array): BmpMetadata {
    if (buffer[0] !== 0x42 || buffer[1] !== 0x4D) {
      throw new Error("Invalid signature: Asset is not a standard BMP image file.");
    }

    // Allocate data view explicitly mapping to the underlying memory window
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const pixelDataOffset = view.getUint32(10, true);
    const width = view.getInt32(18, true);
    const height = view.getInt32(22, true);
    const bitsPerPixel = view.getUint16(28, true);

    if (bitsPerPixel !== 32 && bitsPerPixel !== 24) {
      throw new Error(`Unsupported depth: ${bitsPerPixel}bpp. Only 24-bit or 32-bit BMPs are supported.`);
    }

    return { width, height, bitsPerPixel, pixelDataOffset };
  }
  
  /**
   * Embeds an ASCII string message into a BMP file container by mutating individual pixel components.
   */
  public static async embedMessage(
    inputPath: string,
    outputPath: string,
    message: string
  ): Promise<boolean> {
    const file = Bun.file(inputPath);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const meta = this.parseHeader(bytes);
    const stride = meta.bitsPerPixel / 8; // 3 for 24bpp, 4 for 32bpp
    
    let ptr = meta.pixelDataOffset;

    // Verify there is enough spatial resolution overhead to inject payload
    const totalPixels = Math.abs(meta.width * meta.height);
    if (message.length + 2 >= totalPixels) {
      throw new Error("Payload size allocation exception: Text data length exceeds available pixels.");
    }

    // Base Reference Pixel Anchor [Pixel 0] - Do not alter its values, read them as control keys
    const baseRed = bytes[ptr + 2] ?? 0;
    
    // Calculate the terminator mutation byte
    const redTerminatorValue = baseRed - 2;

    // Advance point past the baseline control cell to begin payload delivery
    ptr += stride;

    // Embed the text string characters
    for (let i = 0; i < message.length; i++) {
      const charCode = message.charCodeAt(i);

      // To keep it simple, clear, and safe from channel overlap corruption, 
      // we hide the full ASCII byte inside a single color channel (e.g. Red).
      // We ensure it never accidentally mimics the terminator value.
      let targetValue = charCode;
      if (targetValue === redTerminatorValue) {
        targetValue += 1; // Slight color skew to prevent premature loop break
      }

      bytes[ptr + 2] = targetValue; // Store ASCII value directly inside Red channel element
      ptr += stride; // Progress to the next discrete pixel alignment block
    }

       // Append the final end marker signature to the next sequential red cell
    bytes[ptr + 2] = redTerminatorValue;

    // Native serverless high-speed write back to disk
    await write(outputPath, bytes);
    return true;
  }

  /**
   * Extracts an embedded ASCII string message out of a steganographic BMP container.
   */
  public static async extractMessage(inputPath: string): Promise<string> {
    const file = Bun.file(inputPath);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const meta = this.parseHeader(bytes);
    const stride = meta.bitsPerPixel / 8;
    
    let ptr = meta.pixelDataOffset;

    // Parse out baseline reference coordinates without incrementing the pointer index
    const baseBlue  = bytes[ptr];
    const baseGreen = bytes[ptr + 1];
    const baseRed   = bytes[ptr + 2] ?? 0;
    const baseAlpha = stride === 4 ? bytes[ptr + 3] : 255;

    // Step past the control layout index pixel cleanly
    ptr += stride;

    const redTerminatorValue = baseRed - 2;
    const messageBytes: number[] = [];

    // Extraction processing loop
    while (ptr <= bytes.length - stride) {
      const currentBlue  = bytes[ptr] ?? 0;
      const currentGreen = bytes[ptr + 1] ?? 0;
      const currentRed   = bytes[ptr + 2] ?? 0;

      // Break instantly if the validation check matches the steganographic target mark
      if (currentRed === redTerminatorValue) {
        break;
      }

      messageBytes.push(currentRed);

      // Enforce clean stride bounding increments to stop bit slippage
      ptr += stride;
    }

    return String.fromCharCode(...messageBytes);
  }
}
