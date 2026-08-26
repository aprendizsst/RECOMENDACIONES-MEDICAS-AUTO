# Despliegue V7

## 1. GitHub Pages

Sube todo el contenido del proyecto a la raíz del repositorio. El workflow `.github/workflows/pages.yml` publica el sitio estático.

En GitHub: **Settings → Pages → Source: GitHub Actions**.

## 2. Apps Script

En el proyecto existente de Apps Script reemplaza `Code.gs` y `appsscript.json` con los archivos de `backend/`. Conserva `BackendBridge.html`.

Ejecuta manualmente `authorizePortalServices()` y acepta permisos de solicitudes externas, correo, Sheets y Drive. Después prueba:

- `testGeminiPermission()` → `ok: true`
- `testGeminiApi()` → `ok: true`

Publica una nueva versión de la Web App, ejecutada como el propietario y con acceso permitido según la política de la organización. Conserva la URL `/exec` configurada en el portal.

## 3. Configuración del portal

- Guarda la API key de Gemini desde Configuración.
- Conecta la hoja real de consecutivos.
- Carga la plantilla DOCX institucional y verifica que diga `Validada`.
- Carga la firma si aplica.

## 4. Prueba de aceptación

Carga un PDF de cada proveedor/formato y confirma:

- identificación y datos del trabajador;
- todos los exámenes realizados;
- recomendaciones completas por examen;
- observaciones;
- remisiones;
- PVE/SVE;
- estado `IA validada automáticamente`;
- vista previa con la plantilla institucional;
- consecutivo de Sheets;
- envío de un correo de prueba.
