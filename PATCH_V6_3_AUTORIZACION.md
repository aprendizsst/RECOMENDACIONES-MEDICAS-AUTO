# V6.3 — Corrección definitiva de autorización UrlFetchApp

## Error corregido
La V6.1/V6.2 podía seguir mostrando `No tienes permiso para llamar a UrlFetchApp.fetch` por dos causas:

1. `ScriptApp.requireScopes()` estaba protegido por `try/catch`, lo que podía impedir que Apps Script completara el flujo de autorización.
2. El manifiesto explícito no incluía `https://www.googleapis.com/auth/script.scriptapp`, scope requerido por los métodos de autorización de `ScriptApp`.

## Cambios
- `authorizePortalServices()` usa `ScriptApp.requireAllScopes()` sin capturar el flujo de autorización.
- Se añadió `script.scriptapp` al manifiesto.
- `testGeminiPermission()` comprueba UrlFetchApp sin gastar una llamada de Gemini.
- `getAuthorizationDiagnostics()` muestra estado, scopes autorizados y URL de autorización si faltan permisos.

## Instalación
1. Reemplazar `Code.gs`.
2. Reemplazar `appsscript.json` dentro DEL PROYECTO DE APPS SCRIPT, no solo en GitHub.
3. Guardar.
4. Ejecutar manualmente `authorizePortalServices` desde el IDE.
5. En la pantalla de consentimiento, marcar/aceptar todos los permisos.
6. Ejecutar `testGeminiPermission`; debe devolver `ok: true` y normalmente código 204.
7. Crear una nueva versión de la implementación web manteniendo `Ejecutar como: Yo` y acceso `Cualquiera`.
8. Probar de nuevo la aplicación.
