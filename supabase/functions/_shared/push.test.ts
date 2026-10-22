import { describe, expect, it } from "vitest";
import { b64urlDecode, b64urlEncode, encryptPayload, type Bytes } from "./push.ts";

const enc = new TextEncoder();

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** Decifra como o celular faria (RFC 8291), usando a chave privada do "aparelho". */
async function decryptAsDevice(body: Bytes, uaKeys: CryptoKeyPair, uaPublic: Bytes, authSecret: Bytes) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaKeys.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, ecdh, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  return { rs, idlen, delimiter: plain[plain.length - 1], text: new TextDecoder().decode(plain.slice(0, -1)) };
}

describe("web push (RFC 8291)", () => {
  it("o aparelho consegue decifrar a notificação", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const message = JSON.stringify({ title: "Júlia agendou Manicure", body: "23/10 às 09:00", url: "/agenda/1" });

    // Como chega do banco: base64url.
    const body = await encryptPayload(enc.encode(message), b64urlDecode(b64urlEncode(uaPublic)), b64urlDecode(b64urlEncode(auth)));
    const out = await decryptAsDevice(body, ua, uaPublic, auth);

    expect(out.rs).toBe(4096);
    expect(out.idlen).toBe(65);
    expect(out.delimiter).toBe(2);
    expect(JSON.parse(out.text)).toEqual(JSON.parse(message));
  });

  it("base64url ida e volta", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes);
  });
});

describe("VAPID (RFC 8292)", () => {
  it("assina um JWT ES256 que confere com a chave pública e aponta para o serviço de push", async () => {
    const { vapidAuthorization } = await import("./push.ts");
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const header = await vapidAuthorization("https://web.push.apple.com/abc", b64urlEncode(pub), jwk.d!, "mailto:teste@example.com");

    const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(key).toBe(b64urlEncode(pub));
    const [h, c, s] = token.split(".");
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.sub).toBe("mailto:teste@example.com");
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64urlDecode(s), enc.encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});
