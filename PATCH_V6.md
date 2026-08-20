# PATCH V6 — Motor estructural multiformato + auditoría IA + limpieza de lote

La V6 corrige la pérdida de relaciones clínicas al cambiar el diseño del certificado.

## Cambio principal

La lectura ya no aplana los PDF antes de analizar. `js/pdf-service.js` reconstruye filas usando coordenadas X/Y y solo inserta una tabulación cuando existe una separación física suficiente para representar una columna.

El parser Python reconoce tres perfiles:

1. **Matriz de exámenes + columnas de recomendaciones**: exámenes en una matriz y, más abajo, columnas independientes de recomendaciones médicas, ocupacionales y hábitos. Esas recomendaciones se conservan como generales salvo asociación explícita.
2. **Tabla examen → recomendación**: examen en la celda izquierda y recomendación en la derecha. Estados como `REALIZADO` no se convierten en recomendaciones.
3. **Secciones clínicas genéricas**: respaldo semántico para proveedores no catalogados.

## Reglas reforzadas

- Una recomendación que menciona Optometría/Audiometría dentro de su texto no se asigna al examen por esa sola coincidencia.
- El campo exacto `Observaciones:` se conserva completo, aunque contenga acciones como control de peso o valoración por nutrición.
- Dentro de `Información de Remisiones`, cada destino listado se interpreta como remisión aun sin verbo `remitir`.
- PVE/SVE solo se registra con evidencia dentro del bloque dedicado o una mención explícita PVE/SVE/programa; no por similitud temática.
- Recomendaciones cortas válidas como `Uso de EPP`, `Control de peso`, `Hacer deporte` y `Dieta balanceada` ya no se descartan.

## Auditoría con Gemini

La segunda lectura de IA ahora es correctiva: puede quitar falsos positivos de la primera lectura en vez de acumularlos. La fusión local/IA exige evidencia específica por recomendación y por programa de vigilancia.

El modelo predeterminado queda en `gemini-3.5-flash`, con respaldo `gemini-3.1-flash-lite`.

## Controles nuevos

- `Eliminar archivo`: elimina PDF, extracción y salida generada de ese documento en IndexedDB.
- `Eliminar cargados`: limpia todo el lote de PDF/extracciones/salidas, conservando usuario, configuración, plantilla, firma e historial.
- Botón `×` en cada PDF de Documentos y PDF originales.
- `Validar con IA`: fuerza una auditoría visual completa del documento seleccionado sin necesidad de volver a cargar el archivo.
- `Reanalizar`: vuelve a ejecutar PDF.js/OCR/parser/IA ignorando la caché.

Eliminar archivos NO libera ni reutiliza consecutivos que ya hayan sido reservados en el backend.

## Caché

`pipelineVersion` cambia a `2026-08-20.6-layout-audit`. Un PDF procesado con V5 no será reutilizado silenciosamente: al volver a cargarlo se reanaliza con V6.
