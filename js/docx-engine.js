(() => {
  const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const RELNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const CTNS = 'http://schemas.openxmlformats.org/package/2006/content-types';

  function pText(p) {
    return [...p.getElementsByTagNameNS(WNS, 't')].map((n) => n.textContent || '').join('');
  }

  function ensureTextNode(doc, paragraph) {
    let texts = [...paragraph.getElementsByTagNameNS(WNS, 't')];
    if (texts.length) return texts[0];
    let run = paragraph.getElementsByTagNameNS(WNS, 'r')[0];
    if (!run) { run = doc.createElementNS(WNS, 'w:r'); paragraph.appendChild(run); }
    const t = doc.createElementNS(WNS, 'w:t'); run.appendChild(t); return t;
  }

  function setPText(doc, paragraph, text, opts = {}) {
    const texts = [...paragraph.getElementsByTagNameNS(WNS, 't')];
    const first = texts[0] || ensureTextNode(doc, paragraph);
    first.textContent = String(text ?? '');
    first.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    for (let i = 1; i < texts.length; i++) texts[i].textContent = '';
    const run = first.parentNode;
    if (run && run.namespaceURI === WNS) {
      let rPr = [...run.childNodes].find((n) => n.nodeType === 1 && n.namespaceURI === WNS && n.localName === 'rPr');
      if ((opts.bold || opts.italic) && !rPr) { rPr = doc.createElementNS(WNS, 'w:rPr'); run.insertBefore(rPr, run.firstChild); }
      if (opts.bold && rPr && !rPr.getElementsByTagNameNS(WNS, 'b').length) rPr.appendChild(doc.createElementNS(WNS, 'w:b'));
      if (opts.italic && rPr && !rPr.getElementsByTagNameNS(WNS, 'i').length) rPr.appendChild(doc.createElementNS(WNS, 'w:i'));
    }
    return paragraph;
  }

  function cloneParagraph(doc, source, text, opts = {}) {
    const clone = source.cloneNode(true);
    setPText(doc, clone, text, opts);
    return clone;
  }

  function replaceParagraphWithLines(doc, paragraph, lines) {
    const parent = paragraph.parentNode;
    for (const entry of lines) {
      const item = typeof entry === 'string' ? { text: entry } : entry;
      parent.insertBefore(cloneParagraph(doc, paragraph, item.text, item), paragraph);
    }
    parent.removeChild(paragraph);
  }

  function clearRuns(paragraph) {
    [...paragraph.childNodes].forEach((node) => {
      if (node.nodeType === 1 && node.namespaceURI === WNS && ['r','hyperlink','fldSimple'].includes(node.localName)) paragraph.removeChild(node);
    });
  }

  function appendRichRun(doc, paragraph, text, opts = {}, baseRun = null) {
    if (!text) return;
    const run = baseRun ? baseRun.cloneNode(true) : doc.createElementNS(WNS, 'w:r');
    [...run.getElementsByTagNameNS(WNS, 't')].forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    let rPr = [...run.childNodes].find((n) => n.nodeType === 1 && n.namespaceURI === WNS && n.localName === 'rPr');
    if (!rPr && (opts.bold || opts.italic)) { rPr = doc.createElementNS(WNS, 'w:rPr'); run.insertBefore(rPr, run.firstChild); }
    if (rPr) {
      [...rPr.getElementsByTagNameNS(WNS, 'b')].forEach((n) => n.parentNode.removeChild(n));
      [...rPr.getElementsByTagNameNS(WNS, 'i')].forEach((n) => n.parentNode.removeChild(n));
      if (opts.bold) rPr.appendChild(doc.createElementNS(WNS, 'w:b'));
      if (opts.italic) rPr.appendChild(doc.createElementNS(WNS, 'w:i'));
    }
    const t = doc.createElementNS(WNS, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    t.textContent = String(text);
    run.appendChild(t);
    paragraph.appendChild(run);
  }

  function replaceParagraphWithRichRuns(doc, paragraph, runs) {
    const baseRun = paragraph.getElementsByTagNameNS(WNS, 'r')[0]?.cloneNode(true) || null;
    clearRuns(paragraph);
    for (const item of runs) appendRichRun(doc, paragraph, item.text || '', item, baseRun);
  }

  function replaceParagraphWithRichParagraphs(doc, paragraph, groups) {
    const parent = paragraph.parentNode;
    for (const runs of groups) {
      const clone = paragraph.cloneNode(true);
      replaceParagraphWithRichRuns(doc, clone, runs);
      parent.insertBefore(clone, paragraph);
    }
    parent.removeChild(paragraph);
  }

  function cleanRecommendationSentence(value) {
    const text = String(value || '').replace(/^[•\-–—]+\s*/, '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }

  function semanticBlank(value) {
    const n = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
    return !n || ['NO','NINGUNO','NINGUNA','NO APLICA','N/A','NA','SIN REMISIONES','SIN OBSERVACIONES'].includes(n);
  }


  function recommendationKey(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }

  function orderedRecommendationEntries(data, map) {
    const order = new Map((data.examenes_lista || []).filter(Boolean).map((exam, index) => [recommendationKey(exam), index]));
    return Object.entries(map || {}).sort(([examA], [examB]) => {
      const genericA = /^recomendaciones generales$/i.test(String(examA));
      const genericB = /^recomendaciones generales$/i.test(String(examB));
      if (genericA !== genericB) return genericA ? 1 : -1;
      const a = order.has(recommendationKey(examA)) ? order.get(recommendationKey(examA)) : Number.MAX_SAFE_INTEGER;
      const b = order.has(recommendationKey(examB)) ? order.get(recommendationKey(examB)) : Number.MAX_SAFE_INTEGER;
      return a - b;
    });
  }

  async function imageDimensions(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
      });
      return { width: img.naturalWidth || 800, height: img.naturalHeight || 300 };
    } finally { URL.revokeObjectURL(url); }
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('No fue posible interpretar el XML interno de la plantilla Word.');
    return doc;
  }

  function serializeXml(doc) { return new XMLSerializer().serializeToString(doc); }

  function subjectExamLabel(value) {
    const raw=String(value||'').trim(); const n=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(/SEGUIMIENTO/.test(n)) return 'SEGUIMIENTO LABORAL';
    if(/PERIODIC/.test(n)) return 'PERIÓDICO';
    if(/POST\s*INCAPAC/.test(n)) return 'POST INCAPACIDAD';
    if(/CAMBIO\s+DE\s+CARGO/.test(n)) return 'CAMBIO DE CARGO';
    if(/INGRESO|PREINGRESO/.test(n)) return 'INGRESO';
    if(/EGRESO|RETIRO/.test(n)) return 'EGRESO';
    return raw.replace(/^EXAMEN\s+(?:M[ÉE]DICO\s+OCUPACIONAL\s+)?(?:DE\s+)?/i,'').trim().toLocaleUpperCase('es-CO') || 'OCUPACIONAL';
  }

  class DocxEngine {
    constructor() {
      this.engineVersion = '2026-09-03.10.4-compact-letter-output';
      this.criticalMarkers = [
        '{{NUMERO DE CONSECUTIVO}}',
        '{{NOMBRE DE LA PERSONA}}',
        '{{TIPO DE EXAMEN}}',
        '{{LISTA DE EXAMENES REALIZADOS}}',
        '{{Recomendaciones médicas}}'
      ];
      this.recommendedMarkers = [
        '{{LUGAR}}','{{FECHA HOY}}','{{CARGO DE LA PERSONA}}',
        '{{Programa de vigilancia epidemiológica}}','{{Restricciones laborales}}','{{Observaciones}}','{{Remisiones}}'
      ];
    }

    async _templateText(templateBuffer) {
      const zip = await JSZip.loadAsync(templateBuffer);
      const names = Object.keys(zip.files).filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
      if (!names.includes('word/document.xml')) throw new Error('La plantilla no contiene word/document.xml.');
      const chunks = [];
      for (const name of names) {
        const xml = await zip.file(name).async('string');
        const doc = parseXml(xml);
        const paragraphs = [...doc.getElementsByTagNameNS(WNS, 'p')];
        chunks.push(paragraphs.map(pText).join('\n'));
      }
      return chunks.join('\n');
    }

    async validateTemplate(templateBuffer) {
      let text;
      try { text = await this._templateText(templateBuffer); }
      catch (error) { return { valid:false, criticalMissing:this.criticalMarkers.slice(), recommendedMissing:this.recommendedMarkers.slice(), found:[], error:error.message }; }
      const found = [...this.criticalMarkers, ...this.recommendedMarkers].filter((m) => text.includes(m));
      const criticalMissing = this.criticalMarkers.filter((m) => !text.includes(m));
      const recommendedMissing = this.recommendedMarkers.filter((m) => !text.includes(m));
      return { valid:criticalMissing.length === 0, criticalMissing, recommendedMissing, found, markerCount:found.length, totalMarkers:this.criticalMarkers.length + this.recommendedMarkers.length };
    }

    async _loadScript(check, urls, label) {
      if (check()) return;
      let lastError = null;
      for (const src of urls) {
        try {
          await new Promise((resolve, reject) => {
            const existing = [...document.scripts].find((x) => x.src === src);
            if (existing && check()) return resolve();
            const script = existing || document.createElement('script');
            const timer = setTimeout(() => reject(new Error(`Tiempo agotado cargando ${label}`)), 18000);
            script.onload = () => { clearTimeout(timer); check() ? resolve() : reject(new Error(`${label} cargó sin exponer su API.`)); };
            script.onerror = () => { clearTimeout(timer); reject(new Error(`No se pudo cargar ${label} desde ${src}`)); };
            if (!existing) { script.src = src; script.async = true; script.crossOrigin = 'anonymous'; document.head.appendChild(script); }
          });
          if (check()) return;
        } catch (error) { lastError = error; }
      }
      throw lastError || new Error(`No se pudo cargar ${label}.`);
    }

    async ensurePreviewRenderer() {
      await this._loadScript(
        () => !!window.docx?.renderAsync,
        [
          'https://unpkg.com/docx-preview@0.4.0/dist/docx-preview.min.js',
          'https://cdn.jsdelivr.net/npm/docx-preview@0.4.0/dist/docx-preview.min.js'
        ],
        'docx-preview'
      );
      return window.docx;
    }

    async ensureHtml2Pdf() {
      await this._loadScript(
        () => typeof window.html2pdf === 'function',
        [
          'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
          'https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js'
        ],
        'html2pdf'
      );
      return window.html2pdf;
    }

    async renderGeneratedDocx(docxBuffer, bodyContainer, styleContainer = null) {
      const renderer = await this.ensurePreviewRenderer();
      bodyContainer.innerHTML = '';
      if (styleContainer) styleContainer.innerHTML = '';
      await renderer.renderAsync(docxBuffer, bodyContainer, styleContainer || bodyContainer, {
        className:'sst-docx',
        inWrapper:true,
        breakPages:true,
        ignoreWidth:false,
        ignoreHeight:false,
        ignoreFonts:false,
        renderHeaders:true,
        renderFooters:true,
        renderFootnotes:true,
        renderEndnotes:true,
        useBase64URL:true,
        experimental:true
      });
    }

    async toHtml(docxBuffer) {
      const host = document.createElement('div');
      const styles = document.createElement('div');
      const body = document.createElement('div');
      host.appendChild(styles); host.appendChild(body);
      await this.renderGeneratedDocx(docxBuffer, body, styles);
      return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles.innerHTML}<style>html,body{margin:0;background:#e9eef5}body{padding:20px}.sst-docx-wrapper{margin:auto}</style></head><body>${body.innerHTML}</body></html>`;
    }

    async toPdf(docxBuffer) {
      await this.ensurePreviewRenderer();
      const html2pdf = await this.ensureHtml2Pdf();
      const host = document.createElement('div');
      host.setAttribute('aria-hidden','true');
      Object.assign(host.style, { position:'fixed', left:'-100000px', top:'0', width:'816px', background:'#fff', zIndex:'-9999', pointerEvents:'none' });
      const styles = document.createElement('div');
      const body = document.createElement('div');
      host.appendChild(styles); host.appendChild(body); document.body.appendChild(host);
      try {
        await this.renderGeneratedDocx(docxBuffer, body, styles);
        await new Promise((resolve) => setTimeout(resolve, 180));
        const worker = html2pdf().set({
          margin:0,
          image:{type:'jpeg',quality:0.98},
          html2canvas:{scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'},
          jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
          pagebreak:{mode:['css','legacy']}
        }).from(body).toPdf();
        const blob = await worker.outputPdf('blob');
        if (!blob || !blob.size) throw new Error('El conversor devolvió un PDF vacío.');
        return blob;
      } finally { host.remove(); }
    }

    async loadDefaultTemplate() {
      const response = await fetch('assets/default-template.docx');
      if (!response.ok) throw new Error('No se encontró la plantilla base incluida.');
      return response.arrayBuffer();
    }

    recommendationsMap(data) {
      const map = data.recomendaciones_por_examen || {};
      const result = {};
      if (Array.isArray(map)) {
        for (const item of map) {
          if (!item?.examen) continue;
          result[item.examen] = Array.isArray(item.recomendaciones) ? item.recomendaciones : [];
        }
      } else {
        Object.assign(result, map);
      }
      for (const exam of data.examenes_lista || []) if (!(exam in result)) result[exam] = [];
      const generic = (data.recomendaciones_lista || []).filter(Boolean);
      if (generic.length && !Object.values(result).some((arr) => Array.isArray(arr) && arr.length)) result['Recomendaciones generales'] = generic;
      return result;
    }

    async generate(templateBuffer, data, signatureAsset = null) {
      const zip = await JSZip.loadAsync(templateBuffer);
      const documentFile = zip.file('word/document.xml');
      if (!documentFile) throw new Error('La plantilla no contiene word/document.xml.');
      const doc = parseXml(await documentFile.async('string'));
      const simple = {
        '{{NUMERO DE CONSECUTIVO}}': data.consecutivo || '',
        '{{TIPO DE EXAMEN}}': subjectExamLabel(data.tipo_examen || ''),
        '{{LUGAR}}': data.lugar || 'Tunja',
        '{{FECHA HOY}}': SSTUtils.formatDateEs(data.fecha || SSTUtils.todayIso()),
        '{{NOMBRE DE LA PERSONA}}': data.nombre || '',
        '{{CARGO DE LA PERSONA}}': data.cargo || '',
        '{{Programa de vigilancia epidemiológica}}': semanticBlank(data.vigilancia_programa) ? '' : data.vigilancia_programa
      };

      const paragraphs = [...doc.getElementsByTagNameNS(WNS, 'p')];
      for (const p of paragraphs) {
        if (!p.parentNode) continue;
        const original = pText(p);
        if (original.includes('{{LISTA DE EXAMENES REALIZADOS}}')) {
          const exams = (data.examenes_lista || []).filter(Boolean);
          // V10.4: el listado institucional muestra únicamente el nombre del examen.
          // Estados técnicos como REALIZADO/NORMAL/APTO permanecen en los datos de control,
          // pero no se imprimen en la carta para evitar ruido visual y ahorrar espacio.
          replaceParagraphWithLines(doc, p, exams.length ? exams.map((x) => `✓  ${x}`) : ['Ninguno.']);
          continue;
        }
        if (original.includes('{{Recomendaciones médicas}}')) {
          const map = this.recommendationsMap(data);
          const useful = orderedRecommendationEntries(data, map).map(([exam, recs]) => {
            const unique = []; const seen = new Set();
            for (const rec of Array.isArray(recs) ? recs : []) {
              const sentence = cleanRecommendationSentence(rec);
              const key = recommendationKey(sentence);
              if (sentence && key && !seen.has(key)) { seen.add(key); unique.push(sentence); }
            }
            return [exam, unique];
          }).filter(([, recs]) => recs.length);

          if (!useful.length) { setPText(doc, p, ''); continue; }

          // V10.4: todas las recomendaciones quedan en UN solo párrafo justificado.
          // Se mantiene el texto clínico completo; únicamente se añaden conectores/etiquetas
          // para identificar con claridad a qué examen corresponde cada recomendación.
          const runs = [{ text:'Recomendaciones: ', bold:true }];
          useful.forEach(([exam,recs], index) => {
            if (index) runs.push({ text:' ' });
            const isGeneric = /^recomendaciones generales$/i.test(String(exam));
            runs.push({ text:isGeneric ? 'De manera general: ' : `Para ${exam}: `, bold:true });
            runs.push({ text:recs.join(' ').replace(/\s+/g,' ').trim() });
          });
          replaceParagraphWithRichRuns(doc, p, runs);
          continue;
        }
        if (original.toLowerCase().includes('{{restricciones laborales}}')) {
          const restrictions = (data.restricciones_lista || []).map((r) => typeof r === 'string' ? {tipo:'',texto:r} : r).filter((r) => String(r?.texto || '').trim());
          if (!restrictions.length) { setPText(doc, p, ''); continue; }
          const text = restrictions.map((r) => `${r.tipo ? `${r.tipo}: ` : ''}${cleanRecommendationSentence(r.texto)}`).join(' ');
          replaceParagraphWithRichRuns(doc, p, [{ text:restrictions.length === 1 ? 'Restricción: ' : 'Restricciones: ', bold:true }, { text }]);
          continue;
        }
        if (original.toLowerCase().includes('{{observaciones}}')) {
          const value = semanticBlank(data.observaciones) ? '' : String(data.observaciones || '').trim();
          if (!value) setPText(doc, p, '');
          else replaceParagraphWithRichRuns(doc, p, [{text:'Observaciones: ',bold:true},{text:value}]);
          continue;
        }
        if (original.toLowerCase().includes('{{programa de vigilancia epidemiológica}}')) {
          const value = semanticBlank(data.vigilancia_programa) ? '' : String(data.vigilancia_programa || '').trim();
          if (!value) setPText(doc, p, '');
          else replaceParagraphWithRichRuns(doc, p, [{text:'Programa de vigilancia epidemiológica: ',bold:true},{text:value}]);
          continue;
        }
        if (original.toLowerCase().includes('{{remisiones}}')) {
          const value = semanticBlank(data.remisiones) ? '' : String(data.remisiones || '').trim();
          if (!value) setPText(doc, p, '');
          else replaceParagraphWithRichRuns(doc, p, [{text:'Remisión: ',bold:true},{text:value}]);
          continue;
        }
        let replaced = original;
        let changed = false;
        for (const [key, value] of Object.entries(simple)) {
          if (replaced.includes(key)) { replaced = replaced.split(key).join(String(value)); changed = true; }
        }
        if (changed) setPText(doc, p, replaced);
      }

      zip.file('word/document.xml', serializeXml(doc));

      // También reemplaza marcadores simples ubicados en encabezados o pies.
      const secondaryParts = Object.keys(zip.files).filter((name) => /^word\/(header\d+|footer\d+)\.xml$/i.test(name));
      for (const partName of secondaryParts) {
        const partDoc = parseXml(await zip.file(partName).async('string'));
        const partParagraphs = [...partDoc.getElementsByTagNameNS(WNS, 'p')];
        for (const p2 of partParagraphs) {
          const original2 = pText(p2);
          let replaced2 = original2; let changed2 = false;
          for (const [key, value] of Object.entries(simple)) {
            if (replaced2.includes(key)) { replaced2 = replaced2.split(key).join(String(value)); changed2 = true; }
          }
          if (changed2) setPText(partDoc, p2, replaced2);
        }
        zip.file(partName, serializeXml(partDoc));
      }

      if (signatureAsset?.blob) await this._insertSignature(zip, signatureAsset.blob);
      return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    async _insertSignature(zip, blob) {
      let ext = /png/i.test(blob.type) ? 'png' : 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const dims = await imageDimensions(blob);
      const widthEmu = Math.round(1.6 * 914400);
      const heightEmu = Math.round(widthEmu * (dims.height / Math.max(1, dims.width)));
      const mediaName = `signature_sst.${ext}`;
      zip.file(`word/media/${mediaName}`, await blob.arrayBuffer());

      const relPath = 'word/_rels/document.xml.rels';
      let relDoc;
      if (zip.file(relPath)) relDoc = parseXml(await zip.file(relPath).async('string'));
      else relDoc = parseXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELNS}"></Relationships>`);
      const relRoot = relDoc.documentElement;
      const ids = [...relRoot.children].map((n) => String(n.getAttribute('Id') || '')).map((id) => Number(id.replace(/\D/g,''))).filter(Number.isFinite);
      const relId = `rId${Math.max(0, ...ids) + 1}`;
      const rel = relDoc.createElementNS(RELNS, 'Relationship');
      rel.setAttribute('Id', relId);
      rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
      rel.setAttribute('Target', `media/${mediaName}`);
      relRoot.appendChild(rel);
      zip.file(relPath, serializeXml(relDoc));

      const ctPath = '[Content_Types].xml';
      const ctDoc = parseXml(await zip.file(ctPath).async('string'));
      const hasExt = [...ctDoc.documentElement.children].some((n) => n.localName === 'Default' && String(n.getAttribute('Extension')).toLowerCase() === ext);
      if (!hasExt) {
        const def = ctDoc.createElementNS(CTNS, 'Default'); def.setAttribute('Extension', ext); def.setAttribute('ContentType', mime); ctDoc.documentElement.appendChild(def);
      }
      zip.file(ctPath, serializeXml(ctDoc));

      const docPath = 'word/document.xml';
      const wordDoc = parseXml(await zip.file(docPath).async('string'));
      const paragraphs = [...wordDoc.getElementsByTagNameNS(WNS, 'p')];
      const target = paragraphs.find((p) => pText(p).toUpperCase().includes('VÍCTOR ALONSO MORENO CASAS')) || paragraphs.find((p) => pText(p).toUpperCase().includes('VICTOR ALONSO MORENO CASAS'));
      if (!target || !target.parentNode) return;

      const drawingXml = `<w:p xmlns:w="${WNS}" xmlns:r="${RNS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="987" name="Firma SST"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      const fragDoc = parseXml(drawingXml);
      const node = wordDoc.importNode(fragDoc.documentElement, true);
      target.parentNode.insertBefore(node, target);
      zip.file(docPath, serializeXml(wordDoc));
    }
  }

  window.SSTDocx = new DocxEngine();
})();
