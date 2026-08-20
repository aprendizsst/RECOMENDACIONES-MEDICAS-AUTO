# Portal SST · Recomendaciones Médicas — GitHub Pages

Migración del proyecto original **Streamlit/Python** a una aplicación web estática compatible con **GitHub Pages**, manteniendo el flujo funcional principal y eliminando la dependencia de Streamlit/LibreOffice en la interfaz.

## Qué conserva

- Acceso con usuarios y cambio de contraseña.
- Carga múltiple de certificados PDF.
- Extracción local de texto con PDF.js.
- OCR automático de respaldo con Tesseract.js y reconstrucción espacial de líneas para tablas/columnas.
- Relectura OCR estructural automática cuando la primera extracción queda en calidad baja.
- **Parser clínico multiformato en Python**, derivado del motor original y ejecutado dentro del navegador con Pyodide (`parser.py`).
- Validación visual opcional con Gemini más una segunda auditoría específica de recomendaciones, remisiones, vigilancia y observaciones.
- Edición de nombre, identificación, correo, cargo, tipo de examen, fecha, lugar, exámenes, recomendaciones, vigilancia, observaciones y remisiones.
- Recomendaciones organizadas por examen.
- Detección de fragmentos pendientes de revisión.
- Caché persistente por huella SHA-256 **y versión del motor**: no reprocesa innecesariamente, pero reanaliza automáticamente documentos antiguos cuando cambia el extractor.
- Vista de todos los PDF originales sin reprocesarlos.
- Generación individual y masiva.
- Caché de documentos generados: solo se regenera cuando cambian datos, plantilla, firma o formato.
- Salida **PDF**, **Word (.docx)** o **HTML**.
- Plantilla institucional `.docx` con los mismos placeholders del proyecto original.
- Firma PNG/JPG.
- Descarga individual y ZIP colectivo.
- Correo individual/masivo con CC, CCO, asunto y cuerpo editables.
- Confirmación explícita antes de enviar.
- Historial de envíos.
- Tablas de control separadas del flujo principal.

## Arquitectura

```text
GitHub Pages
├─ HTML/CSS/JavaScript         → toda la interfaz visible
├─ IndexedDB                   → PDF, caché, salidas y copia local de recursos
├─ PDF.js + Tesseract.js       → lectura/OCR
├─ Pyodide + parser.py         → motor clínico heredado de app.py
├─ JSZip                       → DOCX y ZIP
└─ jsPDF                       → generación PDF

Google Apps Script (iframe oculto)
├─ usuarios y sesiones
├─ Gemini API key
├─ llamadas a Gemini
├─ consecutivos
├─ plantilla/firma compartidas en Drive
├─ MailApp
└─ historial en Google Sheets
```

El usuario permanece en la URL `github.io`. Apps Script funciona únicamente como backend seguro y no muestra otra interfaz.



## Motor clínico V5

La extracción ya no depende de posiciones fijas ni de un único proveedor. Primero identifica las secciones clínicas y después aplica reglas especializadas. Las recomendaciones por examen solo se relacionan cuando existe vínculo estructural explícito; las remisiones no se confunden con controles; el ingreso a PVE/SVE no se infiere a partir de una recomendación; y los bloques mixtos de observaciones/recomendaciones se separan por función.

Cada documento recibe `calidad_extraccion` y `campos_revision`. Si la lectura embebida es débil, el portal puede repetir la lectura con OCR estructural. Con IA activa, Gemini realiza además una segunda auditoría visual y la fusión exige evidencia del PDF.

## Consecutivos reales de Google Sheets

En **Configuración → Consecutivos** el administrador puede pegar la URL/ID del libro real, indicar la pestaña y el prefijo. El backend lee el mayor consecutivo, usa bloqueo para concurrencia y mantiene trazabilidad por hash del PDF. Si la hoja configurada no tiene una columna reconocible de consecutivo, se crea `Consecutivos_BOT` sin alterar la tabla original.

## Recursos institucionales compartidos

Con backend conectado, la cuenta **administradora** puede cargar la plantilla Word y la firma desde **Configuración**. El backend las conserva en una carpeta privada de Google Drive y el portal sincroniza automáticamente la versión vigente al iniciar sesión. También se guarda una copia en IndexedDB para acelerar el uso del navegador.

En modo local, plantilla y firma permanecen únicamente en el navegador.

## Diferencias técnicas inevitables respecto a Streamlit

- La salida **Word (.docx)** sigue partiendo de la plantilla institucional y conserva los placeholders.
- La salida **PDF** se genera de forma nativa en el navegador con los datos validados; GitHub Pages no puede ejecutar LibreOffice para convertir el DOCX. Por eso el contenido se conserva, pero la maquetación PDF no es una conversión pixel a pixel del Word.
- El envío ya no usa una contraseña SMTP almacenada en el cliente. Lo realiza `MailApp` desde la cuenta que despliega Apps Script, manteniendo destinatario, CC, CCO, asunto, cuerpo, adjunto e historial.

## Inicio rápido

Consulta **[DEPLOY.md](DEPLOY.md)**. El orden es:

1. Crear y desplegar el backend de Apps Script usando `backend/Code.gs` + `backend/BackendBridge.html`.
2. Subir este proyecto a GitHub.
3. Activar GitHub Pages con **GitHub Actions** usando el workflow incluido.
4. Abrir la URL `github.io`, pegar una sola vez la URL `/exec` de Apps Script y crear el administrador inicial.
5. Desde **Configuración → Gemini**, guardar la API key. La clave queda en `Script Properties`, nunca en GitHub.

## Plantilla Word

Los marcadores soportados son:

```text
{{NUMERO DE CONSECUTIVO}}
{{TIPO DE EXAMEN}}
{{LUGAR}}
{{FECHA HOY}}
{{NOMBRE DE LA PERSONA}}
{{CARGO DE LA PERSONA}}
{{LISTA DE EXAMENES REALIZADOS}}
{{Recomendaciones médicas}}
{{Programa de vigilancia epidemiológica}}
{{Observaciones}}
{{Remisiones}}
```

La firma se inserta antes del párrafo que contiene `VÍCTOR ALONSO MORENO CASAS`.

## Seguridad

**No escribas la API key de Gemini en `js/config.js`, `index.html` ni ningún archivo del repositorio.** La interfaz envía la clave al backend autenticado y Apps Script la conserva en `PropertiesService`.

El modo local sirve para revisión/generación sin backend. En ese modo Gemini, usuarios compartidos, consecutivo compartido y correo quedan desactivados.

## Proyecto original

La versión Streamlit recibida se conserva en `legacy/app_streamlit_original.py` solo como referencia de trazabilidad. GitHub Pages no la ejecuta.
