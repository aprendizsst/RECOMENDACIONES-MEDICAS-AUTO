
## V10.14 · Recuperación de auditoría IA

- Corrige la incompatibilidad entre `thinkingLevel` y modelos Gemini 2.5.
- El lote usa `gemini-3.5-flash` y fallbacks Gemini 3.x compatibles.
- Para lotes de más de 20 PDF la auditoría se serializa para reducir 429/503.
- El botón **Probar IA real y validar pendientes** ejecuta una generación real antes de reintentar el lote.
- Se conservan motores JER/CONTROL PERIODICO, plantillas, Word/PDF, correo masivo y sincronización con Sheets/consecutivos.

# Despliegue V10.13

## GitHub Pages

Sube el contenido de esta carpeta a la raíz del repositorio y verifica que GitHub Pages use **GitHub Actions**. El workflow `.github/workflows/deploy.yml` publica únicamente los archivos necesarios del portal.

Después del despliegue realiza una recarga fuerte del navegador: `Ctrl + F5`.

## Google Apps Script

V10.13 cambia la lógica de auditoría IA, por lo que debes reemplazar en Apps Script:

- `backend/Code.gs`
- `backend/BackendBridge.html`
- `backend/appsscript.json`

Luego ve a **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.

La aplicación debe mostrar el backend:

`2026.09.04-v10.14-ai-compatibility-recovery`

## Prueba recomendada

1. Carga un lote pequeño de 5 PDF.
2. Comprueba que `Auditoría IA` avance hasta `5 / 5`.
3. Si Gemini devuelve un 429/503, espera la recuperación automática o pulsa **Reintentar IA pendientes**.
4. Verifica que `Revisión clínica` solo aumente por conflictos materiales o campos realmente incompletos.
