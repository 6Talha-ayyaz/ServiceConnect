export function StarRating({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          style={{
            cursor: onChange ? "pointer" : "default",
            fontSize: size,
            color: n <= value ? "var(--warning)" : "var(--border-strong)",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
