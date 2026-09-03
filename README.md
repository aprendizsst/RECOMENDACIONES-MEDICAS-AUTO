> V10.6 añade correo masivo a un destinatario común, selección de archivos y adjuntos PDF/Word.

# Portal SST · Recomendaciones Médicas · V10.6


Aplicación GitHub Pages + Google Apps Script para lectura masiva de conceptos médicos ocupacionales, auditoría multimodal, revisión humana, generación DOCX/PDF, consecutivos compartidos y correo.

## Qué cambia en V10.3

### 1. Motores especializados por formato
El flujo ya no intenta interpretar todos los certificados con el mismo parser. Primero clasifica el PDF y luego ejecuta un extractor específico:

- `JER_TABLA`: formato con **Información de la empresa / Información del paciente / Exámenes de diagnóstico laboral realizados - recomendaciones / Concepto laboral / Restricciones / PVE / Remisiones**.
- `CONTROL_PERIODICO`: formato **Concepto médico ocupacional / Control periódico con recomendaciones / Restricciones laborales por columnas / Recomendaciones médicas, ocupacionales y hábitos / Otras observaciones**.
- `GENERICO`: respaldo para documentos que no cumplen un perfil conocido; la generación queda condicionada a revisión.

El motor conserva texto clínico completo y mantiene por separado: datos del trabajador, exámenes, recomendaciones por examen, recomendaciones generales, restricciones, observaciones, vigilancia epidemiológica y remisiones.

### 2. Procesamiento masivo hasta 50 PDF
La carga se ejecuta en dos colas independientes:

1. **Lectura local**: PDF.js → reconstrucción geométrica → perfil especializado → OCR solo si hace falta → parser legado solo como respaldo.
2. **Auditoría IA**: cola limitada de auditorías multimodales para no congelar la extracción local.

Configuración base: 50 PDF por lote, 4 lecturas locales y 3 auditorías IA simultáneas. Los fallos de un PDF no detienen el resto del lote.

> Ningún sistema OCR/IA puede garantizar matemáticamente 100 % de exactitud sobre documentos arbitrarios. V10.3 usa un modelo *fail-closed*: si la IA falla, hay discrepancias o quedan campos críticos, el documento **no se puede generar** hasta resolver la revisión.

### 3. IA de auditoría, no de invención
Gemini recibe el PDF visual, el texto reconstruido y el resultado del motor especializado. La respuesta está forzada a JSON estructurado y se fusiona sin borrar evidencia local. Reglas estrictas impiden:

- convertir `REALIZADO` en recomendación;
- mezclar restricciones con recomendaciones;
- inventar remisiones o PVE/SVE;
- resumir o acortar recomendaciones clínicas;
- asociar una recomendación a un examen sin evidencia suficiente.

V10.3 usa `gemini-3.8-flash` como modelo preferido, con `gemini-3.7-flash` y versiones anteriores como respaldo. El nivel de razonamiento se limita a `low` para reducir latencia en extracción documental estructurada.

### 4. Ortografía controlada
La normalización corrige tildes, espacios y errores OCR conocidos sin modificar dosis, tiempos, unidades, límites de peso, lateralidad ni el sentido clínico. Las siglas (SST, PVE, SVE, DME, EPP, EPS, ARL, AFP, IMC, PPyP) se preservan.

### 5. Salida institucional reorganizada
La plantilla base fue rediseñada en estilo carta, siguiendo el formato institucional de referencia:

- asunto en franja azul;
- ciudad y fecha;
- trabajador y cargo;
- saludo y párrafo institucional;
- exámenes realizados;
- recomendaciones clínicas completas;
- restricciones;
- observaciones;
- PVE/SVE;
- remisiones;
- firma SST.

Los bloques vacíos se omiten. La plantilla DOCX es la única fuente visual para Word, PDF y vista previa.

### 6. Plantillas DOCX
Una plantilla personalizada solo se activa si contiene los marcadores críticos. La validación lee los marcadores aunque Word los haya dividido en varios `runs`. Al cambiar la plantilla se invalida la salida anterior para impedir que se reutilice un documento generado con otra versión.

Marcadores críticos:

- `{{NUMERO DE CONSECUTIVO}}`
- `{{NOMBRE DE LA PERSONA}}`
- `{{TIPO DE EXAMEN}}`
- `{{LISTA DE EXAMENES REALIZADOS}}`
- `{{Recomendaciones médicas}}`

Marcadores recomendados: `{{LUGAR}}`, `{{FECHA HOY}}`, `{{CARGO DE LA PERSONA}}`, `{{Programa de vigilancia epidemiológica}}`, `{{Restricciones laborales}}`, `{{Observaciones}}`, `{{Remisiones}}`.

### 7. Google Sheets y consecutivos
El backend maneja dos ámbitos:

- **Base del Portal SST**: usuarios, historial de correos y `ConsecutivosControl`.
- **Hoja externa de consecutivos**: configurable por ID/URL y nombre de pestaña.

El backend detecta la columna de consecutivo, admite valores mostrados como `42.613`, busca el mayor valor real, usa `LockService` para evitar carreras, reserva consecutivos por lote y registra `document_key → consecutivo` para que un reintento del mismo PDF no consuma otro número.

En Configuración → Google Sheets se muestra el consecutivo actual, siguiente, número de filas leídas y alertas por duplicados o claves conflictivas.

## Despliegue

1. Publica el contenido de esta carpeta en GitHub Pages.
2. Copia `Code.gs`, `BackendBridge.html` y `appsscript.json` al proyecto Apps Script.
3. Publica una **nueva versión** de la Web App y usa la URL `/exec` en Configuración.
4. Ejecuta `authorizePortalServices()` una vez desde el editor de Apps Script y acepta permisos.
5. En Configuración → Gemini guarda la API key y prueba la conexión.
6. En Configuración → Google Sheets pega la URL/ID de la hoja real de consecutivos y el nombre de la pestaña.
7. Prueba primero con un PDF de cada formato y luego con un lote de 10; después valida el lote operativo de hasta 50.

## Pruebas incluidas

```bash
node tests/profile_engine_v10.js
python tests/parser_regression.py
```

Estas pruebas cubren los dos perfiles documentales y las regresiones del parser legado.


## Corrección V10.2 · filas con estado REALIZADO
El perfil JER ahora reconoce por estructura cualquier examen ubicado en la columna izquierda de la matriz, incluso nombres no catalogados. Los valores REALIZADO/NORMAL/NO APLICA/APTO se conservan como estado de la fila y no generan una falsa revisión por recomendación faltante. La auditoría IA devuelve estados_por_examen de forma explícita.


## Corrección V10.3 · tipo de examen sin falsos positivos
El control de calidad ya no compara `tipo_examen` como una cadena literal. El motor clasifica semánticamente las familias `INGRESO`, `PERIODICO`, `SEGUIMIENTO`, `EGRESO`, `CAMBIO_CARGO` y `POST_INCAPACIDAD`. Redacciones equivalentes dentro de la misma familia no bloquean el documento. En perfiles conocidos de alta confianza, el valor explícito extraído del PDF tiene prioridad sobre la paráfrasis de Gemini. Solo se genera `discrepancia IA: tipo_examen` cuando ambas fuentes se pueden clasificar y pertenecen a categorías materialmente diferentes.


## Mejora V10.4 · carta compacta y vista previa PDF
La lista de exámenes ya no imprime estados como `— REALIZADO`. Las recomendaciones se generan como un único párrafo justificado, ordenado por examen y sin omitir detalle clínico. El visor de PDF originales ahora se ajusta al ancho disponible, se recentra correctamente y se vuelve a renderizar cuando cambia el tamaño del panel.


## V10.6 · Persistencia Apps Script

Los certificados procesados se sincronizan en `Portal SST - Base de datos / DocumentosProcesados`. La sincronización usa `document_key` para actualizar el mismo PDF sin duplicarlo. Configuración → Google Apps Script incluye una prueba real de escritura. El frontend exige el backend `2026.09.03-v10.6-email-batch`; después de cambiar `Code.gs` se debe publicar una nueva versión de la Web App.
