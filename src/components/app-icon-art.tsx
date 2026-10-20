/** Arte do ícone do app para ImageResponse (só CSS suportado pelo next/og). */
export function AppIconArt({ size, rounded }: { size: number; rounded: boolean }) {
  const s = size / 512;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #ff8fb5 0%, #e5396f 55%, #b8245a 100%)",
        borderRadius: rounded ? 112 * s : 0,
      }}
    >
      {/* Brilho de quatro pontas */}
      <svg width={260 * s} height={260 * s} viewBox="0 0 24 24" fill="white">
        <path d="M12 1.5c.5 4.9 2.6 8 7.5 9.3.6.2.6.9 0 1.1-4.9 1.3-7 4.4-7.5 9.3-.1.6-.9.6-1 0-.5-4.9-2.6-8-7.5-9.3-.6-.2-.6-.9 0-1.1 4.9-1.3 7-4.4 7.5-9.3.1-.6.9-.6 1 0Z" />
      </svg>
    </div>
  );
}
