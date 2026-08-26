(() => {
  const Utils = {
    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    },
    slugify(value, fallback = 'Trabajador') {
      const clean = String(value || fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
      return clean || fallback;
    },
    async sha256Bytes(buffer) {
      const hash = await crypto.subtle.digest('SHA-256', buffer);
      return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    async sha256Text(text) {
      return this.sha256Bytes(new TextEncoder().encode(String(text || '')).buffer);
    },
    arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
      return btoa(binary);
    },
    base64ToUint8(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },
    blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    },
    async blobToArrayBuffer(blob) { return blob.arrayBuffer(); },
    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },
    parseEmails(value) {
      const seen = new Set();
      return String(value || '').split(/[,;\n]+/).map((x) => x.trim().toLowerCase()).filter((x) => x && !seen.has(x) && seen.add(x));
    },
    validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); },
    formatDateEs(value) {
      const date = value instanceof Date ? value : new Date(`${String(value || '').slice(0,10)}T12:00:00`);
      if (Number.isNaN(date.getTime())) return String(value || '');
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
    },
    todayIso() {
      const d = new Date();
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    },
    debounce(fn, delay = 350) {
      let timer;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },
    deepClone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); },
    bytesLabel(bytes) {
      if (!Number.isFinite(bytes)) return '—';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
      return `${(bytes/(1024*1024)).toFixed(1)} MB`;
    },
    template(text, data) {
      return String(text || '').replaceAll('{nombre}', data?.nombre?.trim() || 'el colaborador').replaceAll('{identificacion}', data?.identificacion?.trim() || 'no registrada');
    },
    safeJson(value) { try { return JSON.stringify(value); } catch (_) { return ''; } }
  };
  window.SSTUtils = Utils;
})();
