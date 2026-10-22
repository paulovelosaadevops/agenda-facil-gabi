// Web: desenha a arte de "Horários livres" num canvas, igual à prévia (components/availability-poster.tsx).
// Capturar o DOM na web perdia fundo, fontes e espaçamentos; desenhar direto sai idêntico em qualquer navegador.
import type { PosterDay, PosterFormat } from "@/components/availability-poster";
import { POSTER_WIDTH, posterHeight, posterItems, SOLD_OUT } from "@/components/availability-poster";
import { LOGO_RATIO } from "@/components/logo";
import { LOGO_GOLD, Serif } from "./theme";

export interface PosterData {
  format: PosterFormat;
  period: string;
  days: PosterDay[];
  link: string;
}

const BACKGROUND = "#1D1A18";
const IVORY = "#F2ECE4";
const MUTED = "rgba(242,236,228,0.55)";
const SEPARATOR = "rgba(242,236,228,0.12)";
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const OUTPUT_WIDTH = 1080;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Texto com espaçamento entre letras (nem todo navegador suporta ctx.letterSpacing). */
function spacedText(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, spacing: number) {
  const chars = [...text];
  const total = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let x = centerX - total / 2;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + spacing;
  }
}

/** Desenha a arte em 1080 px de largura. Devolve o PNG e quantos dias couberam (de quantos havia). */
export async function renderPoster(
  data: PosterData,
  logoSrc = "/logo-email.png",
): Promise<{ blob: Blob; drawn: number; total: number }> {
  const story = data.format === "story";
  const s = OUTPUT_WIDTH / POSTER_WIDTH; // mesma escala da prévia (360 → 1080)
  const W = OUTPUT_WIDTH;
  const H = Math.round(posterHeight(data.format) * s);
  const pad = 28 * s;
  const vpad = (story ? 40 : 26) * s;

  const serif = (size: number, weight: 500 | 600) => `${weight} ${size * s}px ${weight === 600 ? Serif.semibold : Serif.medium}, Georgia, serif`;
  const sans = (size: number, weight = 400) => `${weight} ${size * s}px ${SANS}`;
  // As fontes da marca já estão no app; garante que estejam prontas antes de desenhar.
  await Promise.all([document.fonts.load(serif(32, 500)), document.fonts.load(serif(18, 600))]).catch(() => undefined);
  const logo = await loadImage(logoSrc);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Logo
  let y = vpad;
  const logoW = (story ? 230 : 190) * s;
  const logoH = logoW / LOGO_RATIO;
  ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
  y += logoH + (story ? 30 : 16) * s;

  // Título, período e fio dourado
  const titleSize = story ? 32 : 27;
  ctx.fillStyle = IVORY;
  ctx.font = serif(titleSize, 500);
  ctx.textAlign = "center";
  y += titleSize * s;
  ctx.fillText("Horários disponíveis", W / 2, y);
  // Desce além das hastes do título ("p") antes do período.
  y += titleSize * 0.3 * s + 4 * s + 13 * s;
  ctx.fillStyle = MUTED;
  ctx.font = sans(13);
  ctx.fillText(data.period, W / 2, y);
  y += 12 * s + 4 * s;
  ctx.fillStyle = LOGO_GOLD;
  ctx.fillRect((W - 28 * s) / 2, y, 28 * s, 1 * s);
  y += 12 * s + (story ? 26 : 14) * s;

  // Dias (todos: sem horário marcado aparece ESGOTADO)
  const visible = data.days;
  const labelWidth = 64 * s;
  const timesX = pad + labelWidth + 12 * s;
  const timesRight = W - pad;
  const lineHeight = 19 * s;
  if (!visible.length) {
    ctx.fillStyle = IVORY;
    ctx.font = sans(13);
    ctx.textAlign = "center";
    ctx.fillText("Agenda completa nesta semana.", W / 2, y + 20 * s);
  }
  // Limite: o rodapé com o link fica sempre livre (dias que não couberem ficam de fora, como na prévia).
  const listBottom = H - vpad - 15 * s - 30 * s;
  let drawn = 0;
  for (const day of visible) {
    const all = posterItems(day);
    const shown = all.slice(0, 12);
    const extra = all.length - shown.length;
    const items = [
      ...shown.map((i) => ({ text: i.time, taken: i.taken })),
      ...(extra > 0 ? [{ text: `+${extra}`, taken: false }] : []),
    ];
    const baseline = y + 16 * s;

    // Quantas linhas os horários ocupam (para saber se o dia cabe).
    ctx.font = sans(13);
    let lines = 1;
    for (let i = 0, x = timesX; i < items.length; i++) {
      const w = ctx.measureText(items[i].text).width;
      if (x > timesX && x + w > timesRight) {
        x = timesX;
        lines++;
      }
      x += w + 12 * s;
    }
    if (baseline + (lines - 1) * lineHeight + 12 * s > listBottom) break;

    // "Seg 26": dia da semana na serifada; o número em algarismos alinhados (a serifada usa números antigos no canvas).
    ctx.textAlign = "left";
    ctx.fillStyle = LOGO_GOLD;
    const [weekday, number = ""] = day.label.split(" ");
    ctx.font = serif(18, 600);
    ctx.fillText(`${weekday} `, pad, baseline);
    const weekdayWidth = ctx.measureText(`${weekday} `).width;
    ctx.font = sans(16, 500);
    ctx.fillText(number, pad + weekdayWidth, baseline);

    ctx.font = sans(13);
    let x = timesX;
    let line = 0;
    if (!items.length) {
      ctx.fillStyle = LOGO_GOLD;
      ctx.font = sans(13, 600);
      let sx = timesX;
      for (const c of SOLD_OUT) {
        ctx.fillText(c, sx, baseline);
        sx += ctx.measureText(c).width + 2 * s;
      }
    }
    for (const t of items) {
      const w = ctx.measureText(t.text).width;
      if (x > timesX && x + w > timesRight) {
        x = timesX;
        line++;
      }
      const lineY = baseline + line * lineHeight;
      ctx.fillStyle = t.text.startsWith("+") ? LOGO_GOLD : t.taken ? MUTED : IVORY;
      ctx.fillText(t.text, x, lineY);
      // Já agendado: risco no meio do texto.
      if (t.taken) ctx.fillRect(x, lineY - 4.5 * s, w, Math.max(1, s));
      x += w + 12 * s;
    }

    const rowBottom = baseline + line * lineHeight + 4 * s + 8 * s;
    ctx.fillStyle = SEPARATOR;
    ctx.fillRect(pad, rowBottom, W - pad * 2, Math.max(1, s / 2));
    y = rowBottom + (story ? 14 : 8) * s;
    drawn++;
  }

  // Rodapé com o link
  const linkBaseline = H - vpad;
  ctx.fillStyle = LOGO_GOLD;
  ctx.font = serif(15, 600);
  ctx.textAlign = "center";
  ctx.fillText(data.link.replace(/^https?:\/\//, ""), W / 2, linkBaseline);
  ctx.fillStyle = MUTED;
  ctx.font = sans(8.5);
  spacedText(ctx, "AGENDE PELO LINK", W / 2, linkBaseline - 15 * s - 3 * s, 2 * s);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), "image/png"),
  );
  return { blob, drawn, total: visible.length };
}
