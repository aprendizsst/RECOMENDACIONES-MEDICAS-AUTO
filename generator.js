(() => {
  const OUTPUT_FIELDS = ['nombre','cargo','tipo_examen','identificacion','examenes_lista','estado_por_examen','recomendaciones_por_examen','recomendaciones_lista','recomendaciones_pendientes_revision','restricciones_lista','observaciones','remisiones','vigilancia_programa','lugar','fecha'];

  class GeneratorService {
    async getAssets() {
      const template = await SSTDB.get(SSTDB.stores.assets, 'template');
      const signature = await SSTDB.get(SSTDB.stores.assets, 'signature');
      return { template, signature };
    }

    async ensureConsecutive(documentRow, data) {
      if (data.consecutivo) return data.consecutivo;
      const token = await SSTDB.getAuth('sessionToken', '');
      if (SSTBackend.url && token) {
        // Con backend activo no se permite caer silenciosamente a un consecutivo local: evitaría duplicados.
        let result;
        const payload = {
          name: data.nombre, identification: data.identificacion, role: data.cargo, exam: data.tipo_examen, date: data.fecha,
          sourceFile: documentRow.fileName || '', documentKey: documentRow.hash || documentRow.id || '', data:SSTUtils.deepClone(data || {})
        };
        try { result = await SSTBackend.call('nextConsecutive', payload, { timeout: 120000 }); }
        catch (error) {
          if (!/no respondió a tiempo/i.test(error.message || '')) throw error;
          // Reintento seguro: el backend identifica el mismo PDF por documentKey y reutiliza
          // el consecutivo ya reservado si la primera respuesta llegó tarde.
          result = await SSTBackend.call('nextConsecutive', payload, { timeout: 120000 });
        }
        if (!result?.consecutive) throw new Error('Google Sheets no devolvió un consecutivo válido.');
        data.consecutivo = result.consecutive;
        data.consecutivo_fuente = result.source || 'Google Sheets';
        await SSTBackend.call('syncConsecutiveRecord', {
          documentKey:documentRow.hash || documentRow.id || '', fileName:documentRow.fileName || '', consecutive:data.consecutivo,
          aiValidationStatus:String(documentRow.aiValidationStatus || ''), syncState:'SINCRONIZADO', data:SSTUtils.deepClone(data || {})
        }, { timeout:90000 });
        return data.consecutivo;
      }
      let current = Number(await SSTDB.getSetting('localSequence', 0)) || 0;
      current += 1;
      await SSTDB.setSetting('localSequence', current);
      data.consecutivo = `LOCAL-${new Date().getFullYear()}-${current}`;
      data.consecutivo_fuente = 'Local';
      return data.consecutivo;
    }

    recommendationsMap(data) {
      const source = data.recomendaciones_por_examen || {};
      const raw = {};
      if (Array.isArray(source)) {
        for (const item of source) if (item?.examen) raw[item.examen] = Array.isArray(item.recomendaciones) ? item.recomendaciones : [];
      } else {
        for (const [key, value] of Object.entries(source)) raw[key] = Array.isArray(value) ? value : [];
      }
      const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
      const clean = (value) => String(value || '').replace(/^[•\-–—]+\s*/, '').replace(/\s+/g,' ').trim();
      const result = {};
      const globalSeen = new Set();
      // Prioriza recomendaciones asociadas a un examen. Las generales se procesan al final
      // para que una misma recomendación no aparezca dos veces ni "migre" de sección.
      const entries = Object.entries(raw).sort(([a],[b]) => (/^recomendaciones generales$/i.test(a)?1:0)-(/^recomendaciones generales$/i.test(b)?1:0));
      for (const [exam, values] of entries) {
        const localSeen = new Set(); const kept = [];
        for (const value of values || []) {
          const text = clean(value); const key = normalize(text);
          if (!text || !key || localSeen.has(key) || globalSeen.has(key)) continue;
          if (/^(REALIZADO|REALIZADA|NORMAL|NO APLICA|N\/?A)$/i.test(text)) continue;
          localSeen.add(key); globalSeen.add(key); kept.push(text);
        }
        if (kept.length) result[exam] = kept;
      }
      const generic = Array.isArray(data.recomendaciones_generales) ? data.recomendaciones_generales : [];
      for (const value of generic) {
        const text=clean(value), key=normalize(text);
        if (!text || !key || globalSeen.has(key)) continue;
        (result['Recomendaciones generales'] ||= []).push(text); globalSeen.add(key);
      }
      return result;
    }

    orderedRecommendationEntries(data, map = null) {
      const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
      const order = new Map((data.examenes_lista || []).filter(Boolean).map((exam, index) => [normalize(exam), index]));
      return Object.entries(map || this.recommendationsMap(data)).sort(([examA],[examB]) => {
        const genericA = /^recomendaciones generales$/i.test(String(examA));
        const genericB = /^recomendaciones generales$/i.test(String(examB));
        if (genericA !== genericB) return genericA ? 1 : -1;
        const a = order.has(normalize(examA)) ? order.get(normalize(examA)) : Number.MAX_SAFE_INTEGER;
        const b = order.has(normalize(examB)) ? order.get(normalize(examB)) : Number.MAX_SAFE_INTEGER;
        return a - b;
      });
    }

    htmlPreview(data) {
      const e = SSTUtils.escapeHtml;
      const exams = (data.examenes_lista || []).map((x) => `<li>${e(x)}</li>`).join('') || '<li>Ninguno.</li>';
      const recommendationEntries = this.orderedRecommendationEntries(data);
      const recommendationParagraph = recommendationEntries.length
        ? recommendationEntries.map(([exam, recs]) => {
            const text = (recs || []).map((r) => { const t=String(r||'').replace(/^[•\-–—]+\s*/, '').replace(/\s+/g,' ').trim(); return t && !/[.!?]$/.test(t) ? `${t}.` : t; }).filter(Boolean).join(' ');
            if (!text) return '';
            const label = /^recomendaciones generales$/i.test(String(exam)) ? 'De manera general:' : `Para ${exam}:`;
            return `<strong>${e(label)}</strong> ${e(text)}`;
          }).filter(Boolean).join(' ')
        : 'Ninguna.';
      return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
        *{box-sizing:border-box}body{margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#253449;padding:28px}.page{max-width:850px;margin:auto;background:#fff;padding:52px 62px;min-height:1080px;box-shadow:0 15px 40px rgba(17,38,64,.16);border-top:6px solid #1769c2}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #dbe5ef;padding-bottom:18px}.brand{font-weight:800;color:#0e4f98}.consecutive{text-align:right;font-size:12px;color:#49657d}.subject{text-align:center;background:#edf5ff;border:1px solid #cfe2fa;color:#0e4f98;padding:10px 14px;margin:24px 0;font-weight:800}.meta{line-height:1.55}.meta strong{font-size:15px}.label{font-weight:800;color:#193b5c;margin-top:20px}.recommendations-paragraph{line-height:1.5;text-align:justify;margin:14px 0}.recommendations-paragraph strong{color:#153b63}ul{line-height:1.45;margin-top:6px}.signature{margin-top:54px}.signature img{max-width:165px;max-height:75px;display:block;margin-bottom:2px}.footer{margin-top:45px;border-top:1px solid #e0e8f0;padding-top:10px;font-size:10px;color:#7890a7;text-align:center}@media print{body{background:white;padding:0}.page{box-shadow:none;max-width:none;min-height:auto}}
      </style></head><body><main class="page"><div class="head"><div class="brand">JER S.A.<br>RECOMENDACIONES MÉDICAS OCUPACIONALES</div><div class="consecutive">Consecutivo<br><strong>${e(data.consecutivo || '')}</strong></div></div><div class="subject">ASUNTO: RECOMENDACIONES EXAMEN ${e(data.tipo_examen || '')}</div><div class="meta">${e(data.lugar || 'Tunja')}, ${e(SSTUtils.formatDateEs(data.fecha || SSTUtils.todayIso()))}<br><br>Señor(a):<br><strong>${e(data.nombre || '')}</strong><br>${e(data.cargo || '')}</div><p>Cordial saludo,</p><p>Según los lineamientos del programa de medicina preventiva y del trabajo de JER S.A; se hace entrega de las recomendaciones establecidas por el Proveedor de servicios de Exámenes Médico Ocupacionales (Ingreso, Periódico, egreso, cambio de cargo y post incapacidad)</p><div class="label">EXÁMENES REALIZADOS:</div><ul>${exams}</ul><p class="recommendations-paragraph"><strong>Recomendaciones:</strong> ${recommendationParagraph}</p><p><strong>Programa de vigilancia epidemiológica:</strong> ${e(data.vigilancia_programa || 'NINGUNO')}</p><p><strong>Observaciones:</strong> ${e(String(data.observaciones || '').trim() || 'Ninguna.')}</p><p><strong>Remisiones:</strong> ${e(String(data.remisiones || '').trim() || 'Ninguna.')}</p><div class="signature">${data.__signatureDataUrl ? `<img src="${data.__signatureDataUrl}" alt="Firma">` : ''}<strong>VÍCTOR ALONSO MORENO CASAS</strong><br>Coordinador SST</div><div class="footer">Portal SST · Documento generado con revisión humana</div></main></body></html>`;
    }

    async fingerprint(data, format, assets) {
      const body = {};
      for (const key of OUTPUT_FIELDS) body[key] = data[key];
      body.consecutivo = data.consecutivo || '';
      body.format = format;
      body.templateHash = assets.template?.hash || 'default-template-v1';
      body.signatureHash = assets.signature?.hash || '';
      body.documentEngineVersion = SSTDocx.engineVersion || 'template-engine-v10';
      return SSTUtils.sha256Text(JSON.stringify(body));
    }

    async ensureJsPdf() {
      if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      if (window.jsPDF) return window.jsPDF;

      const urls = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ];

      for (const src of urls) {
        try {
          await new Promise((resolve, reject) => {
            const existing = [...document.scripts].find((script) => script.src === src);
            if (existing && window.jspdf?.jsPDF) return resolve();
            const script = existing || document.createElement('script');
            const timer = setTimeout(() => reject(new Error(`Tiempo agotado cargando ${src}`)), 12000);
            script.onload = () => { clearTimeout(timer); resolve(); };
            script.onerror = () => { clearTimeout(timer); reject(new Error(`No se pudo cargar ${src}`)); };
            if (!existing) { script.src = src; script.async = true; document.head.appendChild(script); }
          });
          if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
          if (window.jsPDF) return window.jsPDF;
        } catch (error) {
          console.warn('Carga de jsPDF fallida:', error);
        }
      }

      throw new Error('No fue posible cargar el motor PDF (jsPDF). Verifica la conexión a Internet y recarga la aplicación.');
    }

    async generatePdf(data, signatureAsset) {
      const jsPDF = await this.ensureJsPdf();
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pageW = 210, pageH = 297, left = 20, right = 20, bottom = 20, maxW = pageW - left - right;
      let y = 18;
      const check = (needed = 8) => { if (y + needed > pageH - bottom) { doc.addPage(); y = 20; } };
      const text = (value, opts = {}) => {
        const size = opts.size || 10;
        doc.setFont('helvetica', opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal'));
        doc.setFontSize(size);
        doc.setTextColor(opts.color?.[0] ?? 42, opts.color?.[1] ?? 57, opts.color?.[2] ?? 75);
        const width = maxW - (opts.indent || 0);
        const lines = doc.splitTextToSize(String(value ?? ''), width);
        const lineH = size * .43 + 1.2;
        check(lines.length * lineH + 2);
        doc.text(lines, left + (opts.indent || 0), y, { align: opts.align || 'left', maxWidth: width });
        y += lines.length * lineH + (opts.after ?? 2);
      };
      // header
      doc.setFillColor(234,243,255); doc.roundedRect(left, y, maxW, 20, 2, 2, 'F');
      doc.setTextColor(14,79,152); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('JER S.A.', left+6, y+8); doc.setFontSize(10); doc.text('RECOMENDACIONES MÉDICAS OCUPACIONALES', left+6, y+14);
      doc.setFontSize(8); doc.text(`Consecutivo: ${data.consecutivo || ''}`, pageW-right-5, y+11, {align:'right'}); y += 27;
      doc.setFillColor(239,246,255); doc.setDrawColor(207,226,250); doc.roundedRect(left, y, maxW, 11, 1.5, 1.5, 'FD'); doc.setTextColor(14,79,152); doc.setFontSize(10); doc.text(`ASUNTO: RECOMENDACIONES EXAMEN ${data.tipo_examen || ''}`, pageW/2, y+7, {align:'center',maxWidth:maxW-10}); y += 18;
      text(`${data.lugar || 'Tunja'}, ${SSTUtils.formatDateEs(data.fecha || SSTUtils.todayIso())}`, { size: 9 });
      text('Señor(a):', { size: 9, after: 0 }); text(data.nombre || '', { bold: true, size: 10, after: 0 }); text(data.cargo || '', { size: 9, after: 5 });
      text('Cordial saludo,', { size: 9, after: 4 });
      text('Según los lineamientos del programa de medicina preventiva y del trabajo de JER S.A; se hace entrega de las recomendaciones establecidas por el Proveedor de servicios de Exámenes Médico Ocupacionales (Ingreso, Periódico, egreso, cambio de cargo y post incapacidad)', { size: 9, after: 5 });
      text('EXÁMENES REALIZADOS:', { bold: true, size: 9, color: [25,59,92], after: 2 });
      for (const exam of data.examenes_lista || []) text(`• ${exam}`, { size: 9, indent: 4, after: 1 });
      text('Recomendaciones:', { bold: true, size: 9, color: [25,59,92], after: 2 });
      const map = this.recommendationsMap(data);
      const recommendationText = this.orderedRecommendationEntries(data, map).map(([exam, recs]) => {
        const detail = (recs || []).map((rec) => { const clean=String(rec||'').replace(/^[•\-–—]+\s*/, '').replace(/\s+/g,' ').trim(); return clean && !/[.!?]$/.test(clean) ? `${clean}.` : clean; }).filter(Boolean).join(' ');
        if (!detail) return '';
        return `${/^recomendaciones generales$/i.test(String(exam)) ? 'De manera general' : `Para ${exam}`}: ${detail}`;
      }).filter(Boolean).join(' ');
      text(recommendationText || 'Ninguna.', { size: 8.8, indent: 2, after: 3 });
      text(`Programa de vigilancia epidemiológica: ${data.vigilancia_programa || 'NINGUNO'}`, { size: 9, after: 3 });
      text(`Observaciones: ${String(data.observaciones || '').trim() || 'Ninguna.'}`, { size: 9, after: 3 });
      text(`Remisiones: ${String(data.remisiones || '').trim() || 'Ninguna.'}`, { size: 9, after: 6 });
      check(30);
      if (signatureAsset?.blob) {
        try {
          const dataUrl = await SSTUtils.blobToDataUrl(signatureAsset.blob);
          const type = /png/i.test(signatureAsset.blob.type) ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, type, left, y, 40, 15, undefined, 'FAST'); y += 16;
        } catch (error) { console.warn('Firma PDF:', error); }
      }
      text('VÍCTOR ALONSO MORENO CASAS', { bold: true, size: 9, after: 0 }); text('Coordinador SST', { size: 8.5, after: 2 });
      const pages = doc.getNumberOfPages();
      for (let i=1;i<=pages;i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(130,145,160); doc.text(`Portal SST · Página ${i} de ${pages}`, pageW/2, pageH-9, {align:'center'}); }
      return doc.output('blob');
    }

    async prepareTemplateDocument(data, assets) {
      let templateBuffer;
      if (assets.template?.blob) templateBuffer = await assets.template.blob.arrayBuffer();
      else templateBuffer = await SSTDocx.loadDefaultTemplate();

      const validation = await SSTDocx.validateTemplate(templateBuffer);
      if (!validation.valid) {
        throw new Error(`La plantilla Word no es válida. Faltan marcadores obligatorios: ${validation.criticalMissing.join(', ')}`);
      }
      const docxBuffer = await SSTDocx.generate(templateBuffer, data, assets.signature);
      return { templateBuffer, validation, docxBuffer };
    }

    async generate(documentRow, formatOverride = null, options = {}) {
      const persist = options.persist !== false;
      const data = SSTUtils.deepClone(documentRow.data || {});
      await this.ensureConsecutive(documentRow, data);
      documentRow.data.consecutivo = data.consecutivo;
      documentRow.updatedAt = new Date().toISOString();
      await SSTDB.put(SSTDB.stores.documents, documentRow);

      const assets = await this.getAssets();
      const format = formatOverride || await SSTDB.getSetting('outputFormat', 'PDF');
      const fp = await this.fingerprint(data, format, assets);
      const existing = await SSTDB.get(SSTDB.stores.outputs, documentRow.id);
      if (existing && existing.fingerprint === fp && existing.format === format && existing.templateDriven === true) {
        return { output: existing, reused: true };
      }

      if (assets.signature?.blob) {
        try { data.__signatureDataUrl = await SSTUtils.blobToDataUrl(assets.signature.blob); } catch (_) {}
      }

      // V6.4: una sola fuente visual. Word, PDF, HTML y vista previa salen de la
      // plantilla DOCX validada; ya no existe un PDF genérico independiente.
      const prepared = await this.prepareTemplateDocument(data, assets);
      const docxBuffer = prepared.docxBuffer;
      let previewHtml;
      try { previewHtml = await SSTDocx.toHtml(docxBuffer); }
      catch (error) {
        // Nunca mostramos un diseño genérico cuando existe una plantilla institucional:
        // una vista previa distinta puede inducir a aprobar un documento que no corresponde.
        throw new Error(`No fue posible renderizar la plantilla institucional para la vista previa: ${error.message}`);
      }

      let blob, mime, ext;
      if (format === 'Word') {
        blob = new Blob([docxBuffer], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        mime = blob.type; ext = 'docx';
      } else if (format === 'HTML') {
        blob = new Blob([previewHtml], { type:'text/html;charset=utf-8' });
        mime = 'text/html'; ext = 'html';
      } else {
        try {
          blob = await SSTDocx.toPdf(docxBuffer);
        } catch (error) {
          throw new Error(`No fue posible convertir la plantilla Word a PDF: ${error.message}. Puedes generar Word mientras se corrige el renderizador.`);
        }
        mime = 'application/pdf'; ext = 'pdf';
      }

      const output = {
        id:documentRow.id,
        documentId:documentRow.id,
        sourceName:documentRow.fileName,
        filename:`Recomendaciones_${SSTUtils.slugify(data.nombre)}_${SSTUtils.slugify(data.consecutivo || 'sin-consecutivo')}.${ext}`,
        format, mime, blob, previewHtml,
        consecutive:data.consecutivo,
        fingerprint:fp,
        personName:data.nombre || documentRow.fileName,
        updatedAt:new Date().toISOString(),
        templateDriven:true,
        templateName:assets.template?.name || 'Plantilla base incluida',
        templateHash:assets.template?.hash || 'default-template-v1',
        templateValidation:prepared.validation,
        documentEngineVersion:SSTDocx.engineVersion || 'template-engine-v10'
      };
      if (persist) await SSTDB.put(SSTDB.stores.outputs, output);
      return { output, reused:false };
    }

    async generateForEmail(documentRow, formatOverride) {
      if (!['PDF','Word'].includes(String(formatOverride))) throw new Error('Formato de correo no soportado. Usa PDF o Word.');
      return this.generate(documentRow, formatOverride, { persist:false });
    }

    async reserveBatchConsecutives(documents) {
      const token = await SSTDB.getAuth('sessionToken', '');
      if (!SSTBackend.url || !token) return;
      const pending = documents.filter((d) => !d.data?.consecutivo);
      if (!pending.length) return;
      const items = pending.map((d) => ({
        name:d.data?.nombre || '', identification:d.data?.identificacion || '', role:d.data?.cargo || '',
        exam:d.data?.tipo_examen || '', date:d.data?.fecha || '', sourceFile:d.fileName || '',
        documentKey:d.hash || d.id || '', data:SSTUtils.deepClone(d.data || {})
      }));
      const response = await SSTBackend.call('reserveConsecutives', { items }, { timeout: 150000 });
      const byKey = new Map((response?.items || []).map((x) => [String(x.documentKey || ''), x]));
      const syncItems=[];
      for (const doc of pending) {
        const key = String(doc.hash || doc.id || '');
        const hit = byKey.get(key);
        if (!hit?.consecutive) throw new Error(`No se pudo reservar el consecutivo de ${doc.data?.nombre || doc.fileName}.`);
        doc.data.consecutivo = hit.consecutive;
        doc.data.consecutivo_fuente = hit.source || 'Google Sheets';
        doc.updatedAt = new Date().toISOString();
        syncItems.push({documentKey:key,fileName:doc.fileName || '',consecutive:hit.consecutive,aiValidationStatus:String(doc.aiValidationStatus || ''),syncState:'SINCRONIZADO',data:SSTUtils.deepClone(doc.data || {})});
        await SSTDB.put(SSTDB.stores.documents, doc);
      }
      if (syncItems.length) await SSTBackend.call('syncConsecutiveRecords',{items:syncItems},{timeout:120000});
    }

    async generateAll(documents, formatOverride = null, onProgress = () => {}) {
      const outputs = []; let generated = 0, reused = 0;
      await this.reserveBatchConsecutives(documents);
      for (let i=0;i<documents.length;i++) {
        onProgress(i, documents.length, documents[i], 'start');
        const result = await this.generate(documents[i], formatOverride);
        outputs.push(result.output); result.reused ? reused++ : generated++;
        onProgress(i+1, documents.length, documents[i], result.reused ? 'reused' : 'generated');
      }
      return { outputs, generated, reused };
    }

    async makeZip(outputs) {
      if (!outputs?.length) throw new Error('No hay documentos generados.');
      const zip = new JSZip(); const used = new Set();
      for (let i=0;i<outputs.length;i++) {
        let name = outputs[i].filename;
        if (used.has(name)) {
          const dot = name.lastIndexOf('.'); const base = dot>=0 ? name.slice(0,dot) : name; const ext = dot>=0 ? name.slice(dot) : '';
          name = `${base}_${i+1}${ext}`;
        }
        used.add(name); zip.file(name, outputs[i].blob);
      }
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }
  }
  window.SSTGenerator = new GeneratorService();
})();
