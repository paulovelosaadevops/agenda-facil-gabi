import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * HTML da versão web. Faz o app instalável (PWA): ao "Adicionar à Tela de Início" ele abre em tela cheia,
 * com ícone e nome próprios, como um app nativo.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover: o conteúdo respeita o entalhe e a barra de gestos do iPhone. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Gabi Marqui Nail Designer</title>
        <meta name="description" content="Agende seu horário com a Gabi Marqui Nail Designer." />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#F7F3EE" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#141210" media="(prefers-color-scheme: dark)" />
        {/* iPhone: abrir em tela cheia, sem a barra do Safari. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Gabi Marqui" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Fundo da tela antes do app carregar (sem flash branco) e sem "puxar" a página inteira no iPhone.
// color-scheme: barras de rolagem e campos do navegador seguem o tema claro/escuro do app.
const STYLES = `
:root { color-scheme: light dark; }
html, body { background-color: #F7F3EE; overscroll-behavior: none; }
@media (prefers-color-scheme: dark) { html, body { background-color: #141210; } }
body { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
`;
