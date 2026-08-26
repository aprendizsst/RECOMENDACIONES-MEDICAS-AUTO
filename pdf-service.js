(() => {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function median(values) {
    const arr = (values || []).filter(Number.isFinite).sort((a,b) => a-b);
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function buildXAnchors(points, tolerance = 9) {
    const xs = (points || []).map((p) => Number(p.x)).filter(Number.isFinite).sort((a,b) => a-b);
    const clusters = [];
    for (const x of xs) {
      let c = clusters.find((k) => Math.abs(k.x - x) <= tolerance);
      if (!c) { c = { x, count:0, values:[] }; clusters.push(c); }
      c.values.push(x); c.count += 1;
      c.x = c.values.reduce((a,b) => a+b, 0) / c.values.length;
    }
    return clusters.filter((c) => c.count >= 2).sort((a,b) => a.x - b.x);
  }

  function nearestAnchor(x, anchors, tolerance = 13) {
    let best = null, dist = Infinity;
    for (const a of anchors || []) {
      const d = Math.abs(a.x - x);
      if (d < dist) { dist = d; best = a; }
    }
    return best && dist <= tolerance ? best : null;
  }

  function lineTextFromItems(items) {
    // V8: no confía ciegamente en item.width. Algunos PDF de proveedores usan
    // cajas de texto cuyo width ocupa toda la celda y ocultaba la separación
    // examen | recomendación. Se usan anclas X repetidas + ancho tipográfico estimado.
    const clean = (items || []).map((item) => {
      const text = String(item.str || '').replace(/\s+/g, ' ').trim();
      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      const width = Math.max(0, Number(item.width || 0));
      const height = Math.max(1, Math.abs(Number(item.height || item.transform?.[3] || 10)));
      const charW = text ? (width / Math.max(1, text.length)) : 0;
      return { text, x, y, width, height, charW };
    }).filter((i) => i.text);
    if (!clean.length) return '';

    const rowTolerance = Math.max(1.8, median(clean.map((i) => i.height)) * 0.34);
    const rows = [];
    for (const item of clean.slice().sort((a,b) => b.y - a.y || a.x - b.x)) {
      let row = rows.find((r) => Math.abs(r.y - item.y) <= rowTolerance);
      if (!row) { row = { y:item.y, items:[] }; rows.push(row); }
      row.items.push(item);
      row.y = row.items.reduce((sum,x) => sum + x.y, 0) / row.items.length;
    }
    rows.sort((a,b) => b.y - a.y);

    const anchors = buildXAnchors(clean, 9);
    const charCandidates = clean.map((i) => i.charW).filter((v) => v > 0.6 && v < 16);
    const typicalChar = median(charCandidates) || Math.max(3.5, median(clean.map((i) => i.height)) * 0.45) || 5;

    return rows.map((row) => {
      const ordered = row.items.sort((a,b) => a.x - b.x);
      let out = '';
      let prev = null;
      for (const item of ordered) {
        if (prev) {
          const estimatedGlyph = Math.max(typicalChar * Math.max(1, prev.text.length) * 0.82, typicalChar * 1.5);
          // Si PDF.js reporta un width artificialmente grande (caja/celda), se limita
          // al ancho tipográfico razonable para poder medir el espacio real a la columna siguiente.
          const effectiveWidth = prev.width > 0
            ? Math.min(prev.width, estimatedGlyph * 1.45)
            : estimatedGlyph;
          const prevEnd = prev.x + effectiveWidth;
          const gap = item.x - prevEnd;
          const startDelta = item.x - prev.x;
          const aPrev = nearestAnchor(prev.x, anchors);
          const aNow = nearestAnchor(item.x, anchors);
          const anchorJump = !!(aPrev && aNow && aNow !== aPrev && (aNow.x - aPrev.x) > Math.max(52, typicalChar * 9));
          const largeStartJump = startDelta > Math.max(88, typicalChar * 14) && gap > -typicalChar * 2.2;
          const physicalGap = gap > Math.max(14, typicalChar * 2.5);
          if (physicalGap || anchorJump || largeStartJump) out += '\t';
          else if (gap > Math.max(0.8, typicalChar * 0.12)) out += ' ';
          else if (!/[\s(/-]$/.test(out) && !/^[,.;:)]/.test(item.text)) out += ' ';
        }
        out += item.text;
        prev = item;
      }
      return out.replace(/[ ]{2,}/g, ' ').trim();
    }).filter(Boolean).join('\n');
  }


  function lineTextFromOcrWords(words) {
    const clean = (words || []).map((w) => {
      const text = String(w.text || '').trim();
      const box = w.bbox || {};
      return {
        text,
        x:Number(box.x0 || 0), y:Number(box.y0 || 0),
        x1:Number(box.x1 || 0), y1:Number(box.y1 || 0),
        h:Math.max(1, Number((box.y1 || 0) - (box.y0 || 0)))
      };
    }).filter((w) => w.text);
    if (!clean.length) return '';
    const medianH = median(clean.map((w) => w.h)) || 12;
    const tolerance = Math.max(5, medianH * 0.58);
    const rows = [];
    for (const word of clean.slice().sort((a,b) => a.y - b.y || a.x - b.x)) {
      let row = rows.find((r) => Math.abs(r.y - word.y) <= tolerance);
      if (!row) { row = { y:word.y, words:[] }; rows.push(row); }
      row.words.push(word);
      row.y = row.words.reduce((sum,w) => sum + w.y, 0) / row.words.length;
    }
    rows.sort((a,b) => a.y - b.y);
    const anchors = buildXAnchors(clean, Math.max(8, medianH * .7));
    return rows.map((row) => {
      const ordered = row.words.sort((a,b) => a.x - b.x);
      let out = '', prev = null;
      for (const word of ordered) {
        if (prev) {
          const gap = word.x - prev.x1;
          const aPrev = nearestAnchor(prev.x, anchors, Math.max(12, medianH));
          const aNow = nearestAnchor(word.x, anchors, Math.max(12, medianH));
          const anchorJump = !!(aPrev && aNow && aNow !== aPrev && (aNow.x - aPrev.x) > medianH * 4.2);
          const startJump = (word.x - prev.x) > medianH * 7.2 && gap > -medianH * .5;
          if (gap > medianH * 1.35 || anchorJump || startJump) out += '\t';
          else if (gap > medianH * 0.08) out += ' ';
          else if (!/[\s(/-]$/.test(out) && !/^[,.;:)]/.test(word.text)) out += ' ';
        }
        out += word.text;
        prev = word;
      }
      return out.replace(/[ ]{2,}/g, ' ').trim();
    }).filter(Boolean).join('\n');
  }

  class PdfService {
    async loadFromBlob(blob) {
      const buffer = await blob.arrayBuffer();
      return pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
    }

    async extract(blob, options = {}) {
      const { ocrEnabled = true, forceOcr = false, onProgress = () => {} } = options;
      const buffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
      const pageTexts = [];
      let usedOcr = false;
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress({ stage: 'text', page: i, total: pdf.numPages, message: `Extrayendo texto · página ${i} de ${pdf.numPages}` });
        const page = await pdf.getPage(i);
        let text = '';
        try {
          const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
          text = lineTextFromItems(content.items);
        } catch (_) {}
        if (ocrEnabled && (forceOcr || text.replace(/\s/g, '').length < APP_CONFIG.ocrMinCharsPerPage) && window.Tesseract) {
          usedOcr = true;
          onProgress({ stage: 'ocr', page: i, total: pdf.numPages, message: `OCR de respaldo · página ${i} de ${pdf.numPages}` });
          try {
            const viewport = page.getViewport({ scale: 1.8 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            const result = await Tesseract.recognize(canvas, 'spa', { logger: (m) => {
              if (m.status === 'recognizing text' && Number.isFinite(m.progress)) {
                onProgress({ stage: 'ocr', page: i, total: pdf.numPages, message: `OCR página ${i} · ${Math.round(m.progress * 100)}%` });
              }
            }});
            const layoutText = lineTextFromOcrWords(result?.data?.words || []);
            if (layoutText) text = layoutText;
            else if (result?.data?.text?.trim()) text = result.data.text.trim();
          } catch (error) {
            console.warn('OCR no disponible para la página', i, error);
          }
        }
        pageTexts.push(text);
      }
      const joined = pageTexts.join('\n\n');
      const lines = joined.split(/\n+/).filter(Boolean);
      const tabRows = lines.filter((line) => line.includes('\t')).length;
      const tabs = lines.reduce((sum,line) => sum + ((line.match(/\t/g) || []).length), 0);
      return { text: joined, pageTexts, pageCount: pdf.numPages, usedOcr, layoutStats:{ rows:lines.length, tabRows, tabs } };
    }

    async renderPage(blob, pageNumber, canvas, options = {}) {
      const pdf = await this.loadFromBlob(blob);
      const page = await pdf.getPage(Math.max(1, Math.min(pageNumber, pdf.numPages)));
      const base = page.getViewport({ scale: 1 });
      const containerWidth = options.maxWidth || canvas.parentElement?.clientWidth || 1000;
      const scale = Math.max(0.75, Math.min(2.25, (containerWidth - 36) / base.width));
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      return { pageCount: pdf.numPages, pageNumber: page.pageNumber };
    }

    async renderAll(blob, container, options = {}) {
      container.innerHTML = '';
      const pdf = await this.loadFromBlob(blob);
      for (let i = 1; i <= pdf.numPages; i++) {
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        await this.renderPage(blob, i, canvas, { maxWidth: options.maxWidth || container.clientWidth });
      }
      return pdf.numPages;
    }
  }
  window.SSTPdf = new PdfService();
})();
