# Upgrade V10.2 · Reingeniería documental

V10.2 introduce perfiles especializados por proveedor/formato, procesamiento masivo en dos fases, auditoría IA estructurada, bloqueo de generación ante incertidumbre, plantilla institucional tipo carta y control reforzado de consecutivos en Google Sheets.

## Archivos principales modificados
- `index.html`
- `css/styles.css`
- `js/config.js`
- `js/profile-engine.js`
- `js/app.js`
- `js/docx-engine.js`
- `js/generator.js`
- `Code.gs` / `backend/Code.gs`
- `assets/default-template.docx`
- `tests/profile_engine_v10.js`

## Regla de publicación
No mezclar archivos V8/V9 con V10.2. Los archivos de raíz y `/js` incluidos en este paquete están sincronizados. El `Code.gs` raíz y `backend/Code.gs` también están sincronizados.
