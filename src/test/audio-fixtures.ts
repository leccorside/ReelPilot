/** A tiny valid WAV file (mono, 8 kHz, 16-bit) of `samples` samples of silence. */
export function makeWav(samples = 800): Uint8Array {
  const dataBytes = samples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(8000, 24); // sample rate
  buf.writeUInt32LE(16000, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  return new Uint8Array(buf);
}

/** First bytes of an MP3 with an ID3v2.3 tag, followed by filler. */
export function makeMp3Id3(): Uint8Array {
  const buf = Buffer.alloc(64);
  buf.write("ID3", 0, "ascii");
  buf[3] = 3;
  return new Uint8Array(buf);
}

/** An MP3 without tag: MPEG-1 Layer III frame header (FF FB 90 64). */
export function makeMp3Frame(): Uint8Array {
  const buf = Buffer.alloc(64);
  buf.set([0xff, 0xfb, 0x90, 0x64]);
  return new Uint8Array(buf);
}
