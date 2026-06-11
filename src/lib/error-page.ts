// HTML self-contained (sin imports de la app) para fallback de SSR roto.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Geocapitals · Servicio temporalmente no disponible</title>
    <style>
      :root { color-scheme: dark; }
      html, body { margin: 0; padding: 0; height: 100%; background: #0b0a09; color: #f5f1e8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; }
      main { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 32px; }
      .card { max-width: 520px; text-align: center; }
      h1 { font-size: 22px; margin: 0 0 8px; font-weight: 600; letter-spacing: -0.01em; }
      p { color: #a8a29e; line-height: 1.55; margin: 0 0 24px; font-size: 15px; }
      .row { display: inline-flex; gap: 12px; }
      a, button { font: inherit; cursor: pointer; border-radius: 8px; padding: 10px 18px; border: 1px solid #44403c; background: transparent; color: inherit; text-decoration: none; transition: background 120ms; }
      a.primary, button.primary { background: #d4af37; color: #0b0a09; border-color: #d4af37; font-weight: 600; }
      a:hover, button:hover { background: rgba(255,255,255,0.04); }
      a.primary:hover, button.primary:hover { background: #c9a432; }
      .brand { font-size: 11px; letter-spacing: 0.2em; color: #78716c; text-transform: uppercase; margin-bottom: 24px; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <div class="brand">Geocapitals</div>
        <h1>Servicio temporalmente no disponible</h1>
        <p>Estamos teniendo un problema cargando esta página. Vuelve a intentarlo en unos segundos.</p>
        <div class="row">
          <button class="primary" onclick="location.reload()">Reintentar</button>
          <a href="/inversionistas">Ver proyectos</a>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
