import { write } from "bun";

export interface BmpMetadata {
  width: number;
  height: number;
  bitsPerPixel: number;
  pixelDataOffset: number;
}

export class PixMapperParser {
  /**
   * Safe header parsing addressing memory offset boundaries
   */
  public static parseHeader(buffer: Uint8Array): BmpMetadata {
    if (buffer[0] !== 0x42 || buffer[1] !== 0x4D) {
      throw new Error("Invalid signature: Asset is not a standard BMP image file.");
    }

    // Allocate an explicitly aligned data view container
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const pixelDataOffset = view.getUint32(10, true);
    const width = view.getInt32(18, true);
    const height = view.getInt32(22, true);
    const bitsPerPixel = view.getUint16(28, true);

    return { width, height, bitsPerPixel, pixelDataOffset };
  }

  /**
   * Functional replication of PixMapper BuGeRed string extraction
   */
  public static async extractMessage(inputPath: string): Promise<string> {
    const file = Bun.file(inputPath);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const meta = this.parseHeader(bytes);
    let ptr = meta.pixelDataOffset;

    // Acknowledge original BuGeRed structure:
    // Element [0] forms the base color payload reference framework
    // In BMPs, channels are mapped Blue, Green, Red, Alpha (BGRA)
    const baseBlue = bytes[ptr];
    const baseGreen = bytes[ptr + 1];
    const baseRed = bytes[ptr + 2];
    const baseAlpha = bytes[ptr + 3]; // Moves pointer past control index [0]

    if (
      baseBlue === undefined ||
      baseGreen === undefined ||
      baseRed === undefined ||
      baseAlpha === undefined
    ) {
      throw new Error("Invalid BMP payload: missing control bytes at pixel data offset.");
    }

    ptr += 4;

    // Terminator check mimics: bgr.Red == (basecol.R - 2)
    const redTerminatorValue = baseRed - 2;
    
    let encodedNibbles: number[] = [];

    // Crawl pixel bytes sequentially 
    while (ptr + 3 < bytes.length) {
      const b = bytes[ptr];
      const g = bytes[ptr + 1];
      const r = bytes[ptr + 2];
      const a = bytes[ptr + 3];

      if (b === undefined || g === undefined || r === undefined || a === undefined) {
        break;
      }

      // Break immediately if our cursor hits the end-marker indicator
      if (r === redTerminatorValue) {
        break;
      }

      // Reconstruct the 4-bit nibble value stored in this pixel.
      // PixMapper hides data by modifying the low-order bits of the channels.
      // Assuming your C# algorithm stores 1 bit per channel (B, G, R, A):
      const nibble = (b & 1) | ((g & 1) << 1) | ((r & 1) << 2) | ((a & 1) << 3);
      encodedNibbles.push(nibble);

      ptr += 4; // Advance safely to the next discrete 32-bit pixel boundary
    }

    // Combine pairs of 4-bit nibbles back into full 8-bit ASCII characters
    let decodedMessage = "";
    for (let i = 0; i < encodedNibbles.length; i += 2) {
      const lowNibble = encodedNibbles[i];
      const highNibble = encodedNibbles[i + 1];

      if (lowNibble === undefined || highNibble === undefined) {
        break;
      }

      const asciiCharCode = lowNibble | (highNibble << 4);
      decodedMessage += String.fromCharCode(asciiCharCode);
    }

    return decodedMessage;
  }
}
