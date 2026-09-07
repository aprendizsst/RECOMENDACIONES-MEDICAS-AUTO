# Despliegue V10.16

1. Reemplaza en GitHub los archivos del portal con el contenido de esta carpeta.
2. En Google Apps Script reemplaza `Code.gs`, `BackendBridge.html` y `appsscript.json` con los archivos de `backend/`.
3. Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar.
4. Verifica que el backend reporte `2026.09.07-v10.16-exam-type-auto-zone`.
5. Haz `Ctrl + F5` en el navegador.
6. Prueba primero un PDF de cada tipo: Ingreso, Egreso, Seguimiento, Periódico y Post incapacidad. Verifica encabezado, lugar/zona, generación Word/PDF y correo por zona.
