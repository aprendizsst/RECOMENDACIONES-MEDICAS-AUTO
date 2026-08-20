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

  class DocxEngine {
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
        '{{TIPO DE EXAMEN}}': data.tipo_examen || '',
        '{{LUGAR}}': data.lugar || 'Tunja',
        '{{FECHA HOY}}': SSTUtils.formatDateEs(data.fecha || SSTUtils.todayIso()),
        '{{NOMBRE DE LA PERSONA}}': data.nombre || '',
        '{{CARGO DE LA PERSONA}}': data.cargo || '',
        '{{Programa de vigilancia epidemiológica}}': data.vigilancia_programa || 'NINGUNO'
      };

      const paragraphs = [...doc.getElementsByTagNameNS(WNS, 'p')];
      for (const p of paragraphs) {
        if (!p.parentNode) continue;
        const original = pText(p);
        if (original.includes('{{LISTA DE EXAMENES REALIZADOS}}')) {
          const exams = (data.examenes_lista || []).filter(Boolean);
          replaceParagraphWithLines(doc, p, exams.length ? exams.map((x) => `• ${x}`) : ['Ninguno.']);
          continue;
        }
        if (original.includes('{{Recomendaciones médicas}}')) {
          const lines = [{ text: 'Recomendaciones:', bold: true }];
          const map = this.recommendationsMap(data);
          const entries = Object.entries(map);
          if (!entries.length) lines.push('Ninguna.');
          for (const [exam, recs] of entries) {
            lines.push({ text: `${exam}:`, bold: true });
            if (Array.isArray(recs) && recs.length) for (const rec of recs) lines.push(`• ${rec}`);
            else lines.push({ text: 'Sin recomendación específica registrada en el certificado.', italic: true });
          }
          replaceParagraphWithLines(doc, p, lines);
          continue;
        }
        if (original.toLowerCase().includes('{{observaciones}}')) {
          setPText(doc, p, `Observaciones: ${String(data.observaciones || '').trim() || 'Ninguna.'}`);
          continue;
        }
        if (original.toLowerCase().includes('{{remisiones}}')) {
          setPText(doc, p, `Remisiones: ${String(data.remisiones || '').trim() || 'Ninguna.'}`);
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
