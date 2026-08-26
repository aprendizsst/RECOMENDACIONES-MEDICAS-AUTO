# Actualización a V8

1. Reemplaza el contenido del repositorio de GitHub Pages por esta versión completa.
2. Espera que GitHub Actions termine en verde.
3. Reemplaza `Code.gs` en el mismo proyecto de Apps Script y publica una nueva versión de la Web App conservando la URL `/exec`.
4. Si Gemini aún muestra `script.external_request`, ejecuta manualmente `authorizePortalServices()` desde el editor del propietario del Apps Script y acepta todos los permisos; luego publica otra nueva versión.
5. Abre GitHub Pages con `Ctrl+F5`.
6. Cierra sesión y vuelve a entrar. La sesión debe iniciar sin documentos previos.
7. Vuelve a cargar los PDF: la versión de pipeline cambió, por lo que no reutiliza extracciones V7.
