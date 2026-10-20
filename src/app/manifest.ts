import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agenda Fácil",
    short_name: "Agenda",
    description: "Agenda, clientes e atendimento por WhatsApp para nail designers.",
    start_url: "/painel",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
