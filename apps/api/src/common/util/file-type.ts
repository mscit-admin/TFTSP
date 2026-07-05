/**
 * Magic-byte file-type detection (NOT extension). Accepts raster images + PDF,
 * and flags SVG/markup for outright rejection (§M4.3 XSS rule). Shared by the
 * document-upload confirm path and the public view-request ID attachment.
 */
export type DetectedFileKind = 'image' | 'pdf' | 'svg' | 'unsupported';

export function detectFileKind(buf: Buffer): DetectedFileKind {
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isGif =
    buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  const isWebp =
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;
  const isPdf =
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d;

  if (isPng || isJpeg || isGif || isWebp) {
    return 'image';
  }
  if (isPdf) {
    return 'pdf';
  }
  // SVG has no binary magic — sniff the leading text; any markup/XML is rejected.
  const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.includes('<svg') || head.startsWith('<')) {
    return 'svg';
  }
  return 'unsupported';
}
