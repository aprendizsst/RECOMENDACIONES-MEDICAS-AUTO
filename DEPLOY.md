# Despliegue V10.6

## 1. GitHub Pages

Sube todo el contenido del proyecto a la raíz del repositorio. El workflow `.github/workflows/pages.yml` publica el sitio estático.

En GitHub: **Settings → Pages → Source: GitHub Actions**.

## 2. Apps Script

En el proyecto existente de Apps Script reemplaza **los tres archivos** `Code.gs`, `BackendBridge.html` y `appsscript.json` con los archivos de `backend/`. No basta con guardar el código: crea una **nueva versión** de la implementación Web App.

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


### Verificación V10.6

Después de iniciar sesión, abre Configuración → Google Apps Script. Debe mostrar `2026.09.03-v10.6-email-batch`. Pulsa **Probar escritura en Sheets** y verifica la hoja `DiagnosticoBackend`. Los certificados procesados deben aparecer en `DocumentosProcesados`.
