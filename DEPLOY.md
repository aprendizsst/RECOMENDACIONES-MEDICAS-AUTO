# Despliegue completo en GitHub Pages

## 1. Crear el backend en Google Apps Script

1. Entra a **script.google.com** y crea un **Nuevo proyecto**.
2. Renombra el proyecto, por ejemplo: `Portal SST Backend`.
3. Abre `backend/Code.gs` de este repositorio, copia todo su contenido y reemplaza el contenido de `Code.gs` en Apps Script.
4. En Apps Script pulsa **+ → HTML**, crea un archivo llamado exactamente `BackendBridge`.
5. Copia dentro el contenido de `backend/BackendBridge.html`.
6. Opcionalmente abre **Configuración del proyecto → Mostrar archivo de manifiesto** y usa `backend/appsscript.json`.

### Desplegar la Web App

1. Pulsa **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: **Cualquiera**.
5. Pulsa **Implementar** y autoriza los permisos solicitados.
6. Copia la URL que termina en `/exec`.

> El código crea automáticamente una hoja de cálculo llamada **Portal SST - Base de datos** para usuarios e historial de correo.

## 2. Publicar en GitHub Pages

Sube el contenido de esta carpeta a la raíz de tu repositorio:

```text
index.html
css/
js/
assets/
parser.py
.nojekyll
...
```

El proyecto ya incluye `.github/workflows/pages.yml`. Luego en GitHub:

1. **Settings**.
2. **Pages**.
3. En **Build and deployment → Source**, elige **GitHub Actions**.
4. Haz un `push` a `main` (o ejecuta manualmente el workflow **Deploy GitHub Pages** desde la pestaña Actions).
5. Espera a que el workflow quede en verde y abre la URL publicada por Pages.

Si prefieres **Deploy from a branch**, elimina `.github/workflows/pages.yml` y selecciona `main` + `/ (root)`.

GitHub generará una URL similar a:

```text
https://TU-USUARIO.github.io/bot-recomendaciones-medicas/
```

## 3. Primera apertura

1. Abre la URL de GitHub Pages.
2. La pantalla inicial pedirá **URL del backend**.
3. Pega la URL `/exec` de Apps Script.
4. Pulsa **Probar** y luego **Guardar conexión**.
5. Como todavía no hay usuarios, el sistema abrirá **Crear cuenta** para registrar el administrador inicial.

La URL del backend queda guardada en el navegador y también puede cambiarse luego en **Configuración**.

## 4. Configurar Gemini

Con la cuenta administradora:

1. Abre **Configuración**.
2. En **Gemini**, escribe el modelo y la API key.
3. Pulsa **Guardar configuración de IA**.

La clave se envía al backend y se guarda en **Script Properties**. No queda dentro de GitHub Pages ni de IndexedDB.

Si Gemini no está configurado o falla, el portal conserva el **respaldo local** basado en el parser del proyecto original.

## 5. Correo

El nuevo backend utiliza `GmailApp` del propietario de la implementación de Apps Script. Por eso:

- ya no hay que escribir contraseña SMTP en el navegador;
- no hay contraseña de aplicación expuesta;
- CC y CCO siguen disponibles;
- asunto y cuerpo siguen siendo editables;
- los envíos quedan registrados en la hoja `HistorialCorreos`.

El remitente real será la cuenta de Google que desplegó Apps Script, sujeto a las políticas y cuotas de Google Workspace/Gmail.

## 6. Plantilla y firma

En **Configuración** puedes cargar:

- plantilla institucional `.docx`;
- firma `.png` o `.jpg`;
- formato de salida por defecto: PDF, Word o HTML;
- OCR automático.

Con backend conectado, cuando el **administrador** carga estos archivos se guardan como recursos compartidos en una carpeta privada de Google Drive creada por Apps Script y se sincronizan automáticamente con los demás usuarios. El navegador mantiene además una copia en **IndexedDB** para trabajar con rapidez. En modo local permanecen únicamente en IndexedDB. No se suben al repositorio ni a Gemini.

## 7. Actualizar el backend

Cuando cambies `Code.gs` o `BackendBridge.html`:

1. **Implementar → Administrar implementaciones**.
2. Edita la implementación activa.
3. Selecciona **Nueva versión**.
4. Implementa.

La URL `/exec` normalmente se conserva, por lo que GitHub Pages no requiere cambios.

## 8. Prueba recomendada antes de producción

1. Crear administrador.
2. Guardar Gemini.
3. Cargar un PDF con texto.
4. Cargar el mismo PDF de nuevo y comprobar que se reutilice la caché.
5. Editar un dato y generar PDF.
6. Volver a otra persona y regresar: la vista debe conservarse.
7. Generar todo el lote y descargar ZIP.
8. Cargar plantilla Word y firma.
9. Enviar un correo de prueba a una cuenta controlada.
10. Abrir la aplicación desde otro navegador/usuario y comprobar que plantilla y firma compartidas se sincronicen.
11. Revisar **Control y tablas → Correos**.
