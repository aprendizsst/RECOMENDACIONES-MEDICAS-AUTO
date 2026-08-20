(() => {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  function lineTextFromItems(items) {
    const rows = [];
    for (const item of items || []) {
      const text = String(item.str || '').trim();
      if (!text) continue;
      const x = item.transform?.[4] ?? 0;
      const y = item.transform?.[5] ?? 0;
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, text });
    }
    rows.sort((a,b) => b.y - a.y);
    return rows.map((row) => row.items.sort((a,b) => a.x - b.x).map((i) => i.text).join('   ')).join('\n');
  }


  function lineTextFromOcrWords(words) {
    const clean = (words || []).map((w) => {
      const text = String(w.text || '').trim();
      const box = w.bbox || {};
      return { text, x: Number(box.x0 || 0), y: Number(box.y0 || 0), h: Math.max(1, Number((box.y1 || 0) - (box.y0 || 0))) };
    }).filter((w) => w.text);
    if (!clean.length) return '';
    const heights = clean.map((w) => w.h).sort((a,b) => a-b);
    const medianH = heights[Math.floor(heights.length / 2)] || 12;
    const tolerance = Math.max(6, medianH * 0.65);
    const rows = [];
    for (const word of clean.sort((a,b) => a.y - b.y || a.x - b.x)) {
      let row = rows.find((r) => Math.abs(r.y - word.y) <= tolerance);
      if (!row) { row = { y: word.y, words: [] }; rows.push(row); }
      row.words.push(word);
      row.y = row.words.reduce((sum,w) => sum + w.y, 0) / row.words.length;
    }
    rows.sort((a,b) => a.y - b.y);
    return rows.map((row) => {
      const ordered = row.words.sort((a,b) => a.x - b.x);
      let out = '', lastEnd = null;
      for (const word of ordered) {
        if (lastEnd !== null) {
          const gap = word.x - lastEnd;
          out += gap > medianH * 2.0 ? '   ' : ' ';
        }
        out += word.text;
        const widthGuess = Math.max(medianH * 0.55 * word.text.length, medianH);
        lastEnd = Math.max(lastEnd ?? 0, word.x + widthGuess);
      }
      return out.trim();
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
