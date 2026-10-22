// E-mails transacionais (confirmação, lembrete, manutenção, aviso para a Gabi), com o visual do app.
// Produção: API do Brevo (BREVO_API_KEY + EMAIL_FROM verificado no Brevo). Sem chave: só registra no log.
import { getEnv } from "./env.ts";

export interface Email {
  to: { email: string; name?: string };
  subject: string;
  /** Prévia que o Gmail/iPhone mostram ao lado do assunto. */
  preheader?: string;
  /** Título grande, na serifada do app. */
  title?: string;
  /** Texto (parágrafos separados por linha em branco; *negrito*). */
  text: string;
  /** Cartão grafite como o "SEU HORÁRIO" do app: rótulo, destaque (hora) e linhas. */
  card?: { overline: string; highlight: string; lines: string[] };
  /** Linhas "rótulo · valor", como as listas dos Ajustes. */
  details?: [string, string][];
  /** Botão principal (grafite) e secundário (champagne), como os do app. */
  action?: { label: string; url: string };
  secondaryAction?: { label: string; url: string };
  extraAction?: { label: string; url: string };
  /** Arquivo anexo em texto (ex.: o .ics do horário, que o Gmail/iPhone mostram como "Adicionar ao calendário"). */
  attachment?: { name: string; content: string };
  replyTo?: string;
}

// Cores do app (tema "Nude & Champagne").
const C = {
  bg: "#F7F3EE",
  surface: "#FFFFFF",
  graphite: "#2B2724",
  ivory: "#F7F3EE",
  label2: "#7A716A",
  label3: "#A39A92",
  accent: "#8A6A4A",
  champagne: "#C9AD8A",
  tinted: "#EDE3D7",
  separator: "#EEE8E1",
};
const SERIF = "'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (s: string) => esc(s).replace(/\n/g, "<br>").replace(/\*(.+?)\*/g, `<strong style="color:${C.graphite};font-weight:600">$1</strong>`);

function button(a: { label: string; url: string }, primary: boolean) {
  const bg = primary ? C.graphite : C.tinted;
  const fg = primary ? C.ivory : C.accent;
  return `<tr><td style="padding:0 0 10px"><a href="${esc(a.url)}" style="display:block;background:${bg};color:${fg};text-decoration:none;font-family:${SANS};font-weight:600;font-size:16px;line-height:22px;text-align:center;padding:15px 20px;border-radius:14px">${esc(a.label)}</a></td></tr>`;
}

/** HTML com o visual do app: marfim, logo marrom, título serifado, cartão grafite, linhas e botões. */
export function renderEmail(email: Email): string {
  const appUrl = getEnv("APP_URL")?.replace(/\/$/, "");
  const logo = appUrl
    ? `<img src="${appUrl}/logo-email-marrom.png" width="200" alt="Gabi Marqui Nail Designer" style="display:block;margin:0 auto;border:0;width:200px;max-width:200px;height:auto">`
    : `<div style="font-family:${SERIF};font-style:italic;font-size:34px;color:${C.accent}">Gabi Marqui</div><div style="font-family:${SANS};font-size:10px;letter-spacing:4px;color:${C.accent}">NAIL DESIGNER</div>`;

  const title = email.title
    ? `<tr><td style="padding:0 4px 10px;font-family:${SERIF};font-size:32px;line-height:38px;font-weight:600;color:${C.graphite}">${esc(email.title)}</td></tr>`
    : "";
  const paragraphs = email.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:24px;color:${C.label2}">${rich(p)}</p>`)
    .join("");

  const card = email.card
    ? `<tr><td style="padding:10px 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.graphite};border-radius:18px"><tr><td style="padding:22px 22px 20px">
        <div style="font-family:${SANS};font-size:11px;letter-spacing:2px;font-weight:600;color:${C.champagne}">${esc(email.card.overline.toUpperCase())}</div>
        <div style="font-family:${SANS};font-size:46px;line-height:54px;font-weight:300;letter-spacing:-1px;color:${C.ivory};margin-top:6px">${esc(email.card.highlight)}</div>
        ${email.card.lines.map((l, i) => `<div style="font-family:${SANS};font-size:${i ? 14 : 16}px;line-height:22px;color:${C.ivory};opacity:${i ? 0.7 : 1}">${esc(l)}</div>`).join("")}
      </td></tr></table></td></tr>`
    : "";

  const details = email.details?.length
    ? `<tr><td style="padding:0 0 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border-radius:14px">
        ${email.details
          .map(
            ([label, value], i) =>
              `<tr><td style="padding:13px 16px;font-family:${SANS};font-size:15px;color:${C.graphite};${i ? `border-top:1px solid ${C.separator};` : ""}white-space:nowrap">${esc(label)}</td>
               <td align="right" style="padding:13px 16px;font-family:${SANS};font-size:15px;color:${C.label2};${i ? `border-top:1px solid ${C.separator};` : ""}">${rich(value)}</td></tr>`,
          )
          .join("")}
      </table></td></tr>`
    : "";

  const buttons = [
    email.action && button(email.action, true),
    email.secondaryAction && button(email.secondaryAction, false),
    email.extraAction && button(email.extraAction, false),
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap" rel="stylesheet">
<title>${esc(email.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
${email.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(email.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 16px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td align="center" style="padding:4px 0 30px">${logo}</td></tr>
${title}
<tr><td style="padding:0 4px">${paragraphs}</td></tr>
${card}
${details}
${buttons}
<tr><td align="center" style="padding:22px 8px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.label3}">Gabi Marqui Nail Designer${appUrl ? ` · <a href="${appUrl}/agendar" style="color:${C.label3}">agendar horário</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Texto simples equivalente (clientes de e-mail sem HTML). */
function renderText(email: Email): string {
  const parts = [email.title, email.text.replace(/\*(.+?)\*/g, "$1")];
  if (email.card) parts.push([email.card.overline, email.card.highlight, ...email.card.lines].join("\n"));
  if (email.details) parts.push(email.details.map(([l, v]) => `${l}: ${v.replace(/\*(.+?)\*/g, "$1")}`).join("\n"));
  for (const a of [email.action, email.secondaryAction, email.extraAction]) if (a) parts.push(`${a.label}: ${a.url}`);
  return parts.filter(Boolean).join("\n\n");
}

function utf8Base64(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Envia o e-mail. Devolve o id do provedor (ou undefined no modo de log). */
export async function sendEmail(email: Email): Promise<string | undefined> {
  const apiKey = getEnv("BREVO_API_KEY");
  const from = getEnv("EMAIL_FROM");
  if (!apiKey || !from) {
    console.log(`\n[email:log] -> ${email.to.email}\n${email.subject}\n${renderText(email)}\n`);
    return undefined;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: getEnv("EMAIL_FROM_NAME") ?? "Gabi Marqui Nail Designer" },
      to: [email.to],
      replyTo: { email: email.replyTo ?? from },
      subject: email.subject,
      htmlContent: renderEmail(email),
      textContent: renderText(email),
      attachment: email.attachment ? [{ name: email.attachment.name, content: utf8Base64(email.attachment.content) }] : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  const body = (await res.json().catch(() => ({}))) as { messageId?: string };
  return body.messageId;
}

export const emailEnabled = () => Boolean(getEnv("BREVO_API_KEY") && getEnv("EMAIL_FROM"));
