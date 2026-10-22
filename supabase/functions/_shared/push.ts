// Web Push (notificação no celular para o app instalado), sem dependências: só WebCrypto.
// Criptografia do conteúdo: RFC 8291 (aes128gcm). Identificação do servidor: VAPID (RFC 8292, JWT ES256).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.ts";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // chave pública do aparelho (base64url, 65 bytes)
  auth: string; // segredo do aparelho (base64url, 16 bytes)
}

export interface PushMessage {
  title: string;
  body: string;
  /** Tela que abre ao tocar na notificação (ex.: "/agenda/123"). */
  url?: string;
  tag?: string;
}

const enc = new TextEncoder();
// Bytes "simples" (ArrayBuffer): compatível com o TypeScript do Deno e com o mais novo do app.
const newBytes = (n: number) => new Uint8Array(n);
export type Bytes = ReturnType<typeof newBytes>;

export function b64urlDecode(s: string): Bytes {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const concat = (...parts: Bytes[]): Bytes => {
  const out = newBytes(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** Cifra o conteúdo para um aparelho (RFC 8291). Devolve o corpo da requisição de push. */
export async function encryptPayload(payload: Bytes, uaPublic: Bytes, authSecret: Bytes): Promise<Bytes> {
  const ephemeral = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, ephemeral.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(newBytes(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // Registro único: conteúdo + delimitador 0x02.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, Uint8Array.of(2))));

  const header = newBytes(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** JWT VAPID assinado com a chave privada do servidor (ES256). */
export async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const pub = b64urlDecode(publicKey); // 0x04 || x || y
  const jwk = { kty: "EC", crv: "P-256", x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: privateKey, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${publicKey}`;
}

export const pushEnabled = () => Boolean(getEnv("VAPID_PUBLIC_KEY") && getEnv("VAPID_PRIVATE_KEY"));

/** Envia para um aparelho. Devolve o status HTTP do serviço de push (404/410 = assinatura vencida). */
export async function sendPush(sub: PushSubscriptionKeys, message: PushMessage): Promise<number> {
  const publicKey = getEnv("VAPID_PUBLIC_KEY")!;
  const privateKey = getEnv("VAPID_PRIVATE_KEY")!;
  const subject = getEnv("VAPID_SUBJECT") ?? "mailto:gabimarquinails@gmail.com";
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), b64urlDecode(sub.p256dh), b64urlDecode(sub.auth));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, publicKey, privateKey, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  return res.status;
}

/** Avisa todos os aparelhos da Gabi; remove os que o serviço de push diz não existirem mais. */
export async function pushToOwner(db: SupabaseClient, businessId: string, message: PushMessage): Promise<number> {
  if (!pushEnabled()) return 0;
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("business_id", businessId);
  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      const status = await sendPush(sub, message);
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      else if (status < 300) sent++;
      else console.error("Push recusado", status, new URL(sub.endpoint).host);
    } catch (err) {
      console.error("Falha ao enviar push", err);
    }
  }
  return sent;
}
