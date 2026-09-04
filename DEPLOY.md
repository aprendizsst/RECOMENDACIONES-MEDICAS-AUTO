# Despliegue V10.11

## GitHub Pages
1. Sube **el contenido** de esta carpeta a la raíz del repositorio.
2. Conserva `.github/workflows/deploy.yml`.
3. En GitHub: **Settings → Pages → Source: GitHub Actions**.
4. Haz commit a `main`.
5. En **Actions**, confirma que `Desplegar Recomendaciones Médicas` finalice en verde.
6. Recarga la web con `Ctrl + F5`.

La acción publica únicamente los archivos necesarios y valida que los JavaScript esenciales existan antes de desplegar.

## Google Apps Script
El backend incluido sigue siendo `2026.09.04-v10.9-two-sheet-routing`.
Si tu Web App ya muestra exactamente esa versión, **no necesitas volver a desplegar Apps Script por el cambio visual V10.11**.

Si tu backend es anterior, copia en Apps Script:
- `backend/Code.gs`
- `backend/BackendBridge.html`
- `backend/appsscript.json`

Después: **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.
