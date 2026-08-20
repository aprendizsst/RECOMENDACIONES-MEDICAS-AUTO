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

> El código crea automáticamente una hoja de cálculo llamada **Portal SST - Base de datos** para usuarios, historial de correo y control interno de consecutivos.

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

El backend V6 utiliza `MailApp` del propietario de la implementación de Apps Script. Por eso:

- ya no hay que escribir contraseña SMTP en el navegador;
- no hay contraseña de aplicación expuesta;
- CC y CCO siguen disponibles;
- asunto y cuerpo siguen siendo editables;
- los envíos y los errores quedan registrados en la hoja `HistorialCorreos`;
- la sección Correo muestra la cuota disponible del servicio.

**Después de actualizar a V6**, vuelve a publicar Apps Script como **Nueva versión** y acepta los nuevos permisos. Si el portal muestra `Correo requiere autorización`, abre Apps Script, selecciona `authorizePortalServices` y ejecútala una vez con la cuenta propietaria; acepta los permisos y vuelve a desplegar una nueva versión.

El remitente real será la cuenta de Google que desplegó Apps Script, sujeto a las políticas y cuotas de Google Workspace/Gmail.

## 5.1 Conectar la hoja real de consecutivos

Con una cuenta administradora del portal:

1. Abre **Configuración → Consecutivos**.
2. Pega la URL completa o el ID del Google Sheet que contiene los consecutivos.
3. Escribe el nombre de la pestaña donde están los consecutivos.
4. Define el prefijo, por ejemplo `SST`.
5. Pulsa **Guardar y validar**.
6. El panel debe mostrar cuántos consecutivos válidos leyó y cuál sería el siguiente.

El backend reconoce encabezados como `CONSECUTIVO`, `CONSECUTIVO SST`, `NUMERO DE CONSECUTIVO`, `NRO CONSECUTIVO`, `NO CONSECUTIVO` y `NUMERO`. Si encuentra una columna `AÑO/ANIO/YEAR`, respeta el año actual. El cálculo se realiza bajo `LockService` para evitar duplicados cuando varias personas generan documentos al mismo tiempo.

Si la pestaña indicada existe pero no tiene una columna de consecutivo reconocible, el backend crea `Consecutivos_BOT` en ese mismo libro y no modifica la tabla existente.

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
4. Cargar el mismo PDF de nuevo y comprobar que se reutilice la caché del motor actual.
5. Pulsar **Reanalizar** y confirmar que fuerza una extracción nueva sin duplicar el registro.
6. Editar un dato y generar PDF.
7. Volver a otra persona y regresar: la vista debe conservarse.
8. Generar todo el lote y descargar ZIP.
9. Cargar plantilla Word y firma.
10. Validar la hoja real de consecutivos desde Configuración y comprobar que el número generado coincide con el siguiente de Sheets.
11. Enviar un correo de prueba a una cuenta controlada y revisar el indicador de cuota.
12. Abrir la aplicación desde otro navegador/usuario y comprobar que plantilla y firma compartidas se sincronicen.
13. Revisar **Control y tablas → Correos** y confirmar que registra tanto éxitos como errores.


## 9. Actualización V6 del motor clínico

Después de actualizar el repositorio, usa **Eliminar cargados** o vuelve a subir los certificados problemáticos. La caché está versionada, por lo que un documento de V5 se reanaliza al cargarlo con V6. Para una comprobación manual adicional, selecciona el certificado y pulsa **Validar con IA**. Consulta `PATCH_V6.md` y `UPGRADE_V6.md`.
