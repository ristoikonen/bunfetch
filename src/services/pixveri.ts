import { PixMapperParser } from "./PixMapper";
import { write } from "bun";


// bun run pixveri.ts 


async function runVerification() {
  console.log("Starting PixMapper Cloud Verification Process...");

  const testInputBmp = "input_carrier.bmp";
  const testOutputBmp = "output_encoded.bmp";
  const secretMessage = "Hello from Bun and TypeScript cloud environment! 🛠️";

  try {
    // 0. Fallback: Generate a small 100x100 dummy 32bpp BMP file if an image isn't available
    if (!(await Bun.file(testInputBmp).exists())) {
      console.log(`[!] ${testInputBmp} missing. Generating a safe mock uncompressed 32bpp BMP file...`);
      const mockBmpBytes = new Uint8Array(54 + (100 * 100 * 4));
      // Populate standard BMP file descriptors
      mockBmpBytes[0] = 0x42; mockBmpBytes[1] = 0x4D; // Signature 'BM'
      const view = new DataView(mockBmpBytes.buffer);
      view.setUint32(10, 54, true);    // Data Offset
      view.setInt32(18, 100, true);    // Width
      view.setInt32(22, 100, true);    // Height
      view.setUint16(26, 1, true);     // Planes
      view.setUint16(28, 32, true);    // 32 bpp
      // Fill image body with a standard green background
      for (let offset = 54; offset < mockBmpBytes.length; offset += 4) {
        mockBmpBytes[offset] = 34;     // B
        mockBmpBytes[offset + 1] = 139; // G
        mockBmpBytes[offset + 2] = 100; // R (Baseline 100, target terminator value = 98)
        mockBmpBytes[offset + 3] = 255; // A
      }
      await write(testInputBmp, mockBmpBytes);
    }

    // 1. Extract and display structural metadata info
    const originalBytes = new Uint8Array(await Bun.file(testInputBmp).arrayBuffer());
    const initialMeta = PixMapperParser.parseHeader(originalBytes);
    console.log(`Image Found: ${initialMeta.width}x${initialMeta.height} @ ${initialMeta.bitsPerPixel}bpp`);

    // 2. Perform steganographic message embedding
    console.log(`Hiding message data: "${secretMessage}"`);
    await PixMapperParser.embedMessage(testInputBmp, testOutputBmp, secretMessage);
    console.log(`Steganographic modifications saved to -> ${testOutputBmp}`);

    // 3. Extract the message back out using the reverse parse engine
    console.log("Querying extraction engine...");
    const extractedText = await PixMapperParser.extractMessage(testOutputBmp);
    
    console.log(`\n🎉 Extracted String Result: "${extractedText}"`);
    if (extractedText === secretMessage) {
      console.log("VERIFICATION SUCCESS: Data matches original message text payload exactly!");
    } else {
      console.error("VERIFICATION FAILURE: Extracted message data corrupt or shifted.");
    }

  } catch (error: any) {
    console.error("Process runtime error encountered:", error.message);
  }
}

runVerification();