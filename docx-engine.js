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

  function setParagraphAlignment(doc, paragraph, alignment = 'left') {
    if (!paragraph) return paragraph;
    let pPr = [...paragraph.childNodes].find((n) => n.nodeType === 1 && n.namespaceURI === WNS && n.localName === 'pPr');
    if (!pPr) {
      pPr = doc.createElementNS(WNS, 'w:pPr');
      paragraph.insertBefore(pPr, paragraph.firstChild);
    }
    [...pPr.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === WNS && n.localName === 'jc').forEach((n) => pPr.removeChild(n));
    const jc = doc.createElementNS(WNS, 'w:jc');
    jc.setAttributeNS(WNS, 'w:val', alignment);
    pPr.appendChild(jc);
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
    const canonical = window.SSTProfiles?.canonicalExamType?.(value) || '';
    return canonical ? canonical.toLocaleUpperCase('es-CO') : 'TIPO DE EXAMEN POR VALIDAR';
  }


  class DocxEngine {
    constructor() {
      this.engineVersion = '2026-09-08.10.24-letter-native-scale-pdf';
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

    async ensureHtml2Canvas() {
      await this._loadScript(
        () => typeof window.html2canvas === 'function',
        [
          'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
          'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
          'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
        ],
        'html2canvas'
      );
      return window.html2canvas;
    }

    async ensureJsPdf() {
      await this._loadScript(
        () => !!(window.jspdf?.jsPDF || window.jsPDF),
        [
          'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
          'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
          'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
        ],
        'jsPDF'
      );
      return window.jspdf?.jsPDF || window.jsPDF;
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

    async toPdf(docxBuffer, previewHtml = null) {
      // V10.24: la fuente del PDF se normaliza primero a la dimensión física REAL
      // de una hoja Carta (8.5 x 11 in a 96 dpi = 816 x 1056 CSS px).
      // Después se captura a 3x (~288 dpi). De esta forma el PDF ocupa toda la hoja
      // sin estirar letras, logo, tablas o firma y sin depender de la altura accidental
      // que el navegador pueda asignar al SECTION de docx-preview.
      const html2canvas = await this.ensureHtml2Canvas();
      const jsPDF = await this.ensureJsPdf();
      if (typeof html2canvas !== 'function' || !jsPDF) {
        throw new Error('No fue posible inicializar el renderizador PDF (html2canvas/jsPDF).');
      }

      const LETTER_W_MM = 215.9;
      const LETTER_H_MM = 279.4;
      const LETTER_W_PX = 816;   // 8.5 in * 96 dpi
      const LETTER_H_PX = 1056; // 11 in * 96 dpi
      const BODY_PAD_PX = 20;
      const html = previewHtml || await this.toHtml(docxBuffer);

      // El iframe usa exactamente el ancho físico de Carta más el padding que utiliza
      // la vista previa. Evitamos un viewport excesivamente ancho (como 1400 px), que
      // podía alterar la composición de tablas y producir una página visual muy angosta.
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      Object.assign(frame.style, {
        position:'fixed',
        left:'-12000px',
        top:'0',
        width:`${LETTER_W_PX + BODY_PAD_PX * 2}px`,
        height:`${LETTER_H_PX + BODY_PAD_PX * 2}px`,
        border:'0',
        background:'#ffffff',
        pointerEvents:'none',
        zIndex:'-9999'
      });
      document.body.appendChild(frame);

      const waitForFrameLoad = () => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tiempo agotado preparando la vista previa para PDF.')), 20000);
        frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once:true });
        frame.srcdoc = html;
      });

      const waitForImages = async (scope) => {
        const images = [...scope.querySelectorAll('img')];
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once:true });
            img.addEventListener('error', done, { once:true });
          });
        }));
      };

      try {
        await waitForFrameLoad();
        const frameDoc = frame.contentDocument;
        const frameWin = frame.contentWindow;
        if (!frameDoc || !frameWin) throw new Error('No fue posible abrir la vista previa interna para PDF.');

        // Normalización estricta de la página, no del contenido. Esto NO recentra ni
        // recorta el logo: conserva (0,0) y obliga únicamente al papel a ser Carta.
        const captureStyle = frameDoc.createElement('style');
        captureStyle.setAttribute('data-sst-pdf-capture', 'v10.24');
        captureStyle.textContent = `
          html, body { margin:0 !important; background:#fff !important; }
          body { padding:${BODY_PAD_PX}px !important; }
          .sst-docx-wrapper { margin:0 !important; padding:0 !important; background:#fff !important; }
          .sst-docx-wrapper > section.sst-docx,
          section.sst-docx {
            width:${LETTER_W_PX}px !important;
            min-width:${LETTER_W_PX}px !important;
            max-width:${LETTER_W_PX}px !important;
            height:${LETTER_H_PX}px !important;
            min-height:${LETTER_H_PX}px !important;
            max-height:${LETTER_H_PX}px !important;
            box-sizing:border-box !important;
            overflow:hidden !important;
          }
        `;
        frameDoc.head.appendChild(captureStyle);

        if (frameDoc.fonts?.ready) {
          try { await frameDoc.fonts.ready; } catch (_) {}
        }
        await waitForImages(frameDoc);
        await new Promise((resolve) => frameWin.requestAnimationFrame(() => frameWin.requestAnimationFrame(resolve)));

        let pages = [...frameDoc.querySelectorAll('.sst-docx-wrapper > section.sst-docx')];
        if (!pages.length) pages = [...frameDoc.querySelectorAll('section.sst-docx')];
        if (!pages.length) pages = [...frameDoc.querySelectorAll('.sst-docx')].filter((el) => el.tagName === 'SECTION');
        if (!pages.length) throw new Error('La vista previa no produjo páginas renderizables.');

        const pdf = new jsPDF({ unit:'mm', format:'letter', orientation:'portrait', compress:true });

        for (let index = 0; index < pages.length; index++) {
          const page = pages[index];

          // Espera una última composición después de fijar el papel a Carta. Esto ayuda
          // especialmente a imágenes en encabezado (logo) y tablas con ancho porcentual.
          await new Promise((resolve) => frameWin.requestAnimationFrame(resolve));

          const canvas = await html2canvas(page, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            width: LETTER_W_PX,
            height: LETTER_H_PX,
            windowWidth: LETTER_W_PX + BODY_PAD_PX * 2,
            windowHeight: LETTER_H_PX + BODY_PAD_PX * 2,
            imageTimeout: 20000,
            removeContainer: true
          });
          if (!canvas.width || !canvas.height) {
            throw new Error(`La página ${index + 1} quedó vacía durante el renderizado.`);
          }

          if (index > 0) pdf.addPage('letter', 'portrait');

          // Como el canvas ya tiene exactamente la proporción Carta, se inserta 1:1.
          // No se calcula otro factor de escala y, por tanto, no existe estiramiento.
          const imageData = canvas.toDataURL('image/png');
          pdf.addImage(imageData, 'PNG', 0, 0, LETTER_W_MM, LETTER_H_MM, undefined, 'FAST');
        }

        const blob = pdf.output('blob');
        if (!blob || !blob.size) throw new Error('El conversor devolvió un PDF vacío.');
        return blob;
      } finally {
        frame.remove();
      }
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

      // V10.22: el bloque de firma debe conservarse alineado al margen izquierdo
      // tanto en Word como en docx-preview; el PDF hereda exactamente esta posición.
      await this._alignCoordinatorBlockLeft(zip);
      if (signatureAsset?.blob) await this._insertSignature(zip, signatureAsset.blob);
      return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    async _alignCoordinatorBlockLeft(zip) {
      const docPath = 'word/document.xml';
      const file = zip.file(docPath);
      if (!file) return;
      const wordDoc = parseXml(await file.async('string'));
      const normalize = (value) => String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/\s+/g, ' ').trim();
      const paragraphs = [...wordDoc.getElementsByTagNameNS(WNS, 'p')];
      for (const paragraph of paragraphs) {
        const value = normalize(pText(paragraph));
        if (value.includes('VICTOR ALONSO MORENO CASAS') || /\bCOORDINADOR\s+SST\b/.test(value)) {
          setParagraphAlignment(wordDoc, paragraph, 'left');
        }
      }
      zip.file(docPath, serializeXml(wordDoc));
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

      const drawingXml = `<w:p xmlns:w="${WNS}" xmlns:r="${RNS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="987" name="Firma SST"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      const fragDoc = parseXml(drawingXml);
      const node = wordDoc.importNode(fragDoc.documentElement, true);
      target.parentNode.insertBefore(node, target);
      zip.file(docPath, serializeXml(wordDoc));
    }
  }

  window.SSTDocx = new DocxEngine();
})();
