(() => {
  class BackendClient {
    constructor() {
      this.url = '';
      this.iframe = null; // Se conserva por compatibilidad con la interfaz existente.
      this.pending = new Map();
      this.sequence = 0;
      this.lastError = '';
      window.addEventListener('message', (event) => this._onMessage(event));
    }

    bindIframe(iframe) {
      this.iframe = iframe || null;
    }

    normalizeUrl(url) {
      const value = String(url || '').trim();
      if (!value) return '';
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:') throw new Error('La URL debe usar HTTPS.');
        if (parsed.hostname !== 'script.google.com') throw new Error('Usa la URL oficial de Google Apps Script.');
        if (!/\/macros\/s\/[^/]+\/exec\/?$/.test(parsed.pathname)) {
          throw new Error('La URL debe terminar en /exec.');
        }
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
      } catch (error) {
        if (error && /URL debe|Apps Script|\/exec/.test(error.message || '')) throw error;
        throw new Error('La URL de Google Apps Script no es válida.');
      }
    }

    _trustedOrigin(origin) {
      if (!origin || origin === 'null') return true; // HtmlService puede usar un iframe sandbox con origin null.
      try {
        const host = new URL(origin).hostname.toLowerCase();
        return host === 'script.google.com' || host.endsWith('.googleusercontent.com');
      } catch (_) {
        return false;
      }
    }

    _onMessage(event) {
      const message = event.data || {};
      if (message.channel !== 'sst-backend-http' || !message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.nonce !== pending.nonce) return;
      if (!this._trustedOrigin(event.origin)) return;

      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      try { pending.cleanup?.(); } catch (_) {}

      if (message.ok) pending.resolve(message.data);
      else pending.reject(new Error(message.error || 'Error desconocido del backend'));
    }

    async setUrl(url) {
      this.url = this.normalizeUrl(url);
      if (!this.url) return false;
      try {
        await this.call('ping', {}, { timeout: 25000, skipSession: true });
        this.lastError = '';
        return true;
      } catch (error) {
        this.lastError = error?.message || String(error);
        console.warn('Prueba del backend:', error);
        return false;
      }
    }

    async waitReady() {
      return !!this.url;
    }

    async call(action, payload = {}, options = {}) {
      if (!this.url) throw new Error('El backend de Google Apps Script no está configurado.');

      const id = `req_${Date.now()}_${++this.sequence}_${Math.random().toString(36).slice(2, 8)}`;
      const nonce = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`);
      const timeoutMs = options.timeout || (action === 'geminiAnalyze' ? 195000 : 45000);
      const session = options.skipSession ? '' : await SSTDB.getAuth('sessionToken', '');
      const request = {
        id,
        nonce,
        action,
        payload,
        session,
        frontendOrigin: location.origin
      };

      return new Promise((resolve, reject) => {
        const frameName = `sst_backend_${Date.now()}_${this.sequence}`;
        const frame = document.createElement('iframe');
        frame.name = frameName;
        frame.title = 'Solicitud segura al backend';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0;';

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = this.url;
        form.target = frameName;
        form.acceptCharset = 'UTF-8';
        form.style.display = 'none';

        const field = document.createElement('textarea');
        field.name = 'request';
        field.value = JSON.stringify(request);
        form.appendChild(field);

        const cleanup = () => {
          setTimeout(() => {
            try { form.remove(); } catch (_) {}
            try { frame.remove(); } catch (_) {}
          }, 100);
        };

        const timer = setTimeout(() => {
          this.pending.delete(id);
          cleanup();
          reject(new Error(`El backend no respondió a tiempo (${action}).`));
        }, timeoutMs);

        this.pending.set(id, { resolve, reject, timer, cleanup, nonce });
        document.body.appendChild(frame);
        document.body.appendChild(form);

        try {
          form.submit();
        } catch (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          cleanup();
          reject(new Error(`No se pudo enviar la solicitud al backend: ${error.message || error}`));
        }
      });
    }

    async ping() {
      return this.call('ping', {}, { timeout: 20000, skipSession: true });
    }
  }

  window.SSTBackend = new BackendClient();
})();
