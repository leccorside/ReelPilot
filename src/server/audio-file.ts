// Recognizes MP3 and WAV files by their first bytes (never by the file name or the declared type).

export const MAX_MUSIC_BYTES = 10 * 1024 * 1024;

export type AudioKind = { ext: "mp3" | "wav"; mime: "audio/mpeg" | "audio/wav" };

export function sniffAudio(bytes: Uint8Array): AudioKind | null {
  if (bytes.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

  // WAV: "RIFF" <size> "WAVE"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { ext: "wav", mime: "audio/wav" };

  // MP3 with an ID3v2 tag: "ID3" <version 2–4>
  if (ascii(0, 3) === "ID3" && bytes[3] >= 2 && bytes[3] <= 4) return { ext: "mp3", mime: "audio/mpeg" };

  // MP3 without a tag: an MPEG audio frame header (11 sync bits, layer III, valid bitrate and rate).
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const version = (bytes[1] >> 3) & 0b11; // 01 is reserved
    const layer = (bytes[1] >> 1) & 0b11; // 01 = layer III
    const bitrate = bytes[2] >> 4; // 0000 free, 1111 bad
    const sampleRate = (bytes[2] >> 2) & 0b11; // 11 reserved
    if (version !== 0b01 && layer === 0b01 && bitrate !== 0 && bitrate !== 0b1111 && sampleRate !== 0b11) {
      return { ext: "mp3", mime: "audio/mpeg" };
    }
  }
  return null;
}

/** A safe display name: no folders, no control characters, at most 120 characters. */
export function cleanFileName(raw: string | null | undefined, fallback: string): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return cleaned || fallback;
}
