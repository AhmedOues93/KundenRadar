"use client";

/** Letzte Auffangebene, falls schon das Wurzel-Layout fehlschlägt. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f6f7f9",
          color: "#0f172a",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>KundenRadar ist nicht erreichbar</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#475569" }}>
            {error.message || "Unbekannter Fehler."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.25rem",
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  );
}
