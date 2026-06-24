// base58btc (Bitcoin alphabet) — the multibase `z` encoding a Data Integrity `proofValue`
// uses. Small and dependency-free; decode is what the verifier needs, encode is here for
// the round-trip test signer.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);

const INDEX: ReadonlyMap<string, number> = new Map(
  ALPHABET.split("").map((character, position) => [character, position]),
);

/** Decode a base58btc string to bytes. Throws on an out-of-alphabet character. */
export function base58btcDecode(input: string): Uint8Array {
  if (input.length === 0) {
    return new Uint8Array(0);
  }

  let value = 0n;
  for (const character of input) {
    const digit = INDEX.get(character);
    if (digit === undefined) {
      throw new Error(`Invalid base58btc character: '${character}'.`);
    }
    value = value * BASE + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }

  // Each leading '1' encodes a leading zero byte.
  for (const character of input) {
    if (character !== "1") {
      break;
    }
    bytes.unshift(0);
  }

  return Uint8Array.from(bytes);
}

/** Encode bytes to a base58btc string (used by the test signer). */
export function base58btcEncode(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }

  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }

  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % BASE)] + out;
    value /= BASE;
  }

  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }
    out = ALPHABET[0] + out;
  }

  return out;
}

/** Decode a multibase value (only the base58btc `z` prefix is in scope here). */
export function multibaseDecode(value: string): Uint8Array {
  if (!value.startsWith("z")) {
    throw new Error(`Unsupported multibase prefix in '${value.slice(0, 1)}…' (only base58btc 'z' is supported).`);
  }
  return base58btcDecode(value.slice(1));
}
