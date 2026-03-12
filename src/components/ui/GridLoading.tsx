// ─── Grid Loading Animation ──────────────────────────────────────────────────
// A 3×3 grid of squares that pulse with staggered delays,
// evoking a construction grid / building blocks motif.

export default function GridLoading({ text = "Chargement..." }: { text?: string }) {
  return (
    <div className="grid-loading-container">
      <div className="grid-loading">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="grid-loading-cell"
            style={{
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      {text && <p className="grid-loading-text">{text}</p>}
    </div>
  );
}
