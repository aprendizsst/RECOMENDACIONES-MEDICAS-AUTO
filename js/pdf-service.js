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

  function lineTextFromItems(items) {
    // PDF.js suele fragmentar una misma frase en varios text-items. En V5 se
    // insertaban 3 espacios entre TODOS los items y eso convertía fragmentos
    // normales en columnas falsas. V6 usa geometría real (x, width, height).
    const clean = (items || []).map((item) => {
      const text = String(item.str || '').replace(/\s+/g, ' ').trim();
      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      const width = Math.max(0, Number(item.width || 0));
      const height = Math.max(1, Number(item.height || item.transform?.[3] || 10));
      const charW = text ? (width / Math.max(1, text.length)) : 0;
      return { text, x, y, width, height, charW };
    }).filter((i) => i.text);
    if (!clean.length) return '';

    const rowTolerance = Math.max(1.8, median(clean.map((i) => i.height)) * 0.32);
    const rows = [];
    for (const item of clean.sort((a,b) => b.y - a.y || a.x - b.x)) {
      let row = rows.find((r) => Math.abs(r.y - item.y) <= rowTolerance);
      if (!row) { row = { y:item.y, items:[] }; rows.push(row); }
      row.items.push(item);
      row.y = row.items.reduce((sum,x) => sum + x.y, 0) / row.items.length;
    }
    rows.sort((a,b) => b.y - a.y);

    return rows.map((row) => {
      const ordered = row.items.sort((a,b) => a.x - b.x);
      const charWidths = ordered.map((i) => i.charW).filter((v) => v > 0.2);
      const typicalChar = median(charWidths) || 5;
      let out = '';
      let prev = null;
      for (const item of ordered) {
        if (prev) {
          const prevEnd = prev.x + Math.max(prev.width, prev.text.length * typicalChar);
          const gap = item.x - prevEnd;
          // Solo una separación física grande crea una frontera de columna.
          if (gap > Math.max(22, typicalChar * 4.5)) out += '\t';
          else if (gap > Math.max(1.2, typicalChar * 0.18)) out += ' ';
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
    for (const word of clean.sort((a,b) => a.y - b.y || a.x - b.x)) {
      let row = rows.find((r) => Math.abs(r.y - word.y) <= tolerance);
      if (!row) { row = { y:word.y, words:[] }; rows.push(row); }
      row.words.push(word);
      row.y = row.words.reduce((sum,w) => sum + w.y, 0) / row.words.length;
    }
    rows.sort((a,b) => a.y - b.y);
    return rows.map((row) => {
      const ordered = row.words.sort((a,b) => a.x - b.x);
      let out = '', prev = null;
      for (const word of ordered) {
        if (prev) {
          const gap = word.x - prev.x1;
          if (gap > medianH * 2.6) out += '\t';
          else if (gap > medianH * 0.12) out += ' ';
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
      return { text: pageTexts.join('\n\n'), pageTexts, pageCount: pdf.numPages, usedOcr };
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
