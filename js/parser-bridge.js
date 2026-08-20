(() => {
  class ParserBridge {
    constructor() {
      this.pyodide = null;
      this.initPromise = null;
      this.analyzeFn = null;
      this.fuseFn = null;
      this.ready = false;
    }

    async init(onProgress = () => {}) {
      if (this.ready) return true;
      if (this.initPromise) return this.initPromise;
      this.initPromise = (async () => {
        if (typeof loadPyodide !== 'function') throw new Error('Pyodide no se cargó. Revisa la conexión a Internet.');
        onProgress('Cargando motor clínico local…', 0.2);
        this.pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' });
        onProgress('Cargando reglas de extracción del proyecto original…', 0.7);
        const code = await fetch('parser.py', { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('No se pudo cargar parser.py');
          return r.text();
        });
        await this.pyodide.runPythonAsync(code);
        this.analyzeFn = this.pyodide.globals.get('analizar_json');
        this.fuseFn = this.pyodide.globals.get('fusionar_json');
        this.ready = true;
        onProgress('Motor clínico listo', 1);
        return true;
      })();
      try { return await this.initPromise; }
      catch (error) { this.initPromise = null; throw error; }
    }

    async analyze(text) {
      await this.init();
      const result = this.analyzeFn(String(text || ''));
      const json = String(result);
      return JSON.parse(json);
    }

    async fuse(localData, aiData, sourceText) {
      await this.init();
      const result = this.fuseFn(JSON.stringify(localData || {}), JSON.stringify(aiData || {}), String(sourceText || ''));
      return JSON.parse(String(result));
    }

    dispose() {
      try { this.analyzeFn?.destroy?.(); } catch (_) {}
      try { this.fuseFn?.destroy?.(); } catch (_) {}
    }
  }
  window.SSTParser = new ParserBridge();
})();
