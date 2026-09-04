# Despliegue V10.10

## GitHub Pages
1. Sube el contenido de esta carpeta a la raíz del repositorio.
2. Conserva `.github/workflows/deploy.yml`.
3. En GitHub: Settings → Pages → Source: **GitHub Actions**.
4. Haz commit a `main`.
5. Abre Actions y confirma que `Desplegar Recomendaciones Médicas` finalice en verde.
6. Recarga la web con `Ctrl + F5`.

La acción publica un `dist/` que contiene únicamente los archivos necesarios. Ya no ejecuta `npm run build`, Vite, React ni Firebase.

## Google Apps Script
El backend incluido corresponde a `2026.09.04-v10.9-two-sheet-routing`.
Solo debes volver a desplegar Apps Script si tu Web App todavía tiene una versión anterior.

Archivos a copiar en Apps Script:
- `backend/Code.gs`
- `backend/BackendBridge.html`
- `backend/appsscript.json`

Después: Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar.
