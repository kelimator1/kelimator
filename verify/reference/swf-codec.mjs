/**
 * Shared codec helpers for the C3 reference harness.
 *
 * `swfBase64Decode` / `swfBase64Encode` mirror the 2012 SWF's own Base64+UTF-8
 * codec (`artifacts/decompiled/scripts/frame_5/DoAction.as`, used by
 * `frame_131/DoAction.as` `myOnLoad` for every round value). `swfBase64Encode`
 * is the standard Base64(UTF-8) the original server produced.
 *
 * `decodeLatin5` maps the ISO-8859-9 (Latin-5) bytes of the archived fixture to
 * the characters the 2012 client would see after `System.useCodePage` decoding.
 */

// ISO-8859-9 (Latin-5) bytes that differ from Latin-1.
export const LATIN5 = {
  0xd0: 'Ğ', 0xdd: 'İ', 0xde: 'Ş', 0xd6: 'Ö', 0xdc: 'Ü', 0xc7: 'Ç',
  0xf0: 'ğ', 0xfd: 'ı', 0xfe: 'ş', 0xf6: 'ö', 0xfc: 'ü', 0xe7: 'ç',
};

export function decodeLatin5(buf) {
  let out = '';
  for (const byte of buf) out += LATIN5[byte] ?? String.fromCharCode(byte);
  return out;
}

/** Faithful port of the SWF's `Base64.decode` (base64 → UTF-8). */
export function swfBase64Decode(input) {
  const key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  let i = 0;
  while (i < input.length) {
    const enc1 = key.indexOf(input.charAt(i++));
    const enc2 = key.indexOf(input.charAt(i++));
    const enc3 = key.indexOf(input.charAt(i++));
    const enc4 = key.indexOf(input.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 0x0f) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    out += String.fromCharCode(chr1);
    if (enc3 !== 64) out += String.fromCharCode(chr2);
    if (enc4 !== 64) out += String.fromCharCode(chr3);
  }
  // _utf8_decode (frame_5/DoAction.as)
  let decoded = '';
  let j = 0;
  while (j < out.length) {
    const c1 = out.charCodeAt(j);
    if (c1 < 128) {
      decoded += String.fromCharCode(c1);
      j += 1;
    } else if (c1 > 191 && c1 < 224) {
      const c2 = out.charCodeAt(j + 1);
      decoded += String.fromCharCode(((c1 & 0x1f) << 6) | (c2 & 0x3f));
      j += 2;
    } else {
      const c2 = out.charCodeAt(j + 1);
      const c3 = out.charCodeAt(j + 2);
      decoded += String.fromCharCode(((c1 & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      j += 3;
    }
  }
  return decoded;
}

/** Standard Base64(UTF-8) — what the original server produced and the SWF decodes. */
export function swfBase64Encode(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}
