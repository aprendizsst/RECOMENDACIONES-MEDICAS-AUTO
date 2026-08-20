(() => {
  class BackendClient {
    constructor() {
      this.url = '';
      this.iframe = null;
      this.ready = false;
      this.pending = new Map();
      this.sequence = 0;
      this.readyPromise = null;
      this.readyResolver = null;
      window.addEventListener('message', (event) => this._onMessage(event));
    }

    bindIframe(iframe) {
      this.iframe = iframe;
    }

    normalizeUrl(url) {
      const value = String(url || '').trim();
      if (!value) return '';
      try {
        const parsed = new URL(value);
        if (!/^https:$/.test(parsed.protocol)) throw new Error('La URL debe usar HTTPS.');
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
      } catch (e) {
        throw new Error('La URL de Google Apps Script no es válida.');
      }
    }

    async setUrl(url) {
      this.url = this.normalizeUrl(url);
      this.ready = false;
      if (!this.iframe || !this.url) return false;
      this.readyPromise = new Promise((resolve) => { this.readyResolver = resolve; });
      const separator = this.url.includes('?') ? '&' : '?';
      this.iframe.src = `${this.url}${separator}mode=bridge&v=${Date.now()}`;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 12000));
      return Promise.race([this.readyPromise, timeout]);
    }

    _onMessage(event) {
      if (!this.iframe || event.source !== this.iframe.contentWindow) return;
      const message = event.data || {};
      if (message.channel !== 'sst-backend') return;
      if (message.type === 'ready') {
        this.ready = true;
        if (this.readyResolver) this.readyResolver(true);
        this.readyResolver = null;
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.data);
      else pending.reject(new Error(message.error || 'Error desconocido del backend'));
    }

    async waitReady() {
      if (this.ready) return true;
      if (this.readyPromise) return this.readyPromise;
      return false;
    }

    async call(action, payload = {}, options = {}) {
      if (!this.url || !this.iframe) throw new Error('El backend de Google Apps Script no está configurado.');
      const isReady = await this.waitReady();
      if (!isReady) throw new Error('No fue posible establecer comunicación con Google Apps Script.');
      const id = `req_${Date.now()}_${++this.sequence}`;
      const timeoutMs = options.timeout || (action === 'geminiAnalyze' ? 190000 : 45000);
      const session = await SSTDB.getAuth('sessionToken', '');
      const message = { channel: 'sst-frontend', id, action, payload, session };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`El backend no respondió a tiempo (${action}).`));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        this.iframe.contentWindow.postMessage(message, '*');
      });
    }

    async ping() { return this.call('ping', {}, { timeout: 15000 }); }
  }

  window.SSTBackend = new BackendClient();
})();
