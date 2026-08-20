# Actualización rápida a V6

## GitHub Pages

Reemplaza preferiblemente todo el contenido del repositorio por esta V6. Los archivos críticos son:

- `parser.py`
- `js/pdf-service.js`
- `js/app.js`
- `js/config.js`
- `index.html`
- `css/styles.css`

Haz commit, espera a que **Actions** finalice en verde y fuerza recarga con `Ctrl + F5`.

## Google Apps Script

1. Reemplaza por completo `Code.gs` con `backend/Code.gs` de V6.
2. Guarda.
3. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.
4. Mantén la misma URL `/exec`.

No es necesario ejecutar `apiDispatch()` manualmente.

## Prueba recomendada

1. Usa **Eliminar cargados** para iniciar con un lote limpio.
2. Carga un PDF del formato de matriz + tres columnas.
3. Verifica que las recomendaciones de las tres columnas queden en `Recomendaciones generales`, salvo relación explícita.
4. Carga un PDF del formato examen/recomendación por fila.
5. Verifica que `REALIZADO` no aparezca como recomendación.
6. Comprueba PVE/SVE, remisiones y Observaciones.
7. Selecciona el documento y pulsa **Validar con IA**.
8. Si necesitas repetir desde cero, pulsa **Reanalizar**.

La cabecera del editor muestra el perfil estructural detectado y la calidad de extracción.
