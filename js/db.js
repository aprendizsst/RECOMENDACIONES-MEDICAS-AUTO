(() => {
  const DB_NAME = 'portal_sst_recomendaciones_v3';
  const DB_VERSION = 3;
  const STORES = {
    settings: 'settings',
    documents: 'documents',
    outputs: 'outputs',
    assets: 'assets',
    auth: 'auth',
    emailHistory: 'emailHistory'
  };

  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORES.documents)) {
          const store = db.createObjectStore(STORES.documents, { keyPath: 'id' });
          store.createIndex('hash', 'hash', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.outputs)) {
          const store = db.createObjectStore(STORES.outputs, { keyPath: 'id' });
          store.createIndex('documentId', 'documentId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.assets)) db.createObjectStore(STORES.assets, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORES.auth)) db.createObjectStore(STORES.auth, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORES.emailHistory)) {
          const store = db.createObjectStore(STORES.emailHistory, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function transact(storeName, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try { result = fn(store, tx); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
    });
  }

  async function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const DB = {
    stores: STORES,
    async init() { return openDb(); },
    async get(storeName, key) {
      const db = await openDb();
      const tx = db.transaction(storeName, 'readonly');
      return requestResult(tx.objectStore(storeName).get(key));
    },
    async put(storeName, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async add(storeName, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).add(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(storeName, key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    },
    async clear(storeName) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    },
    async getAll(storeName) {
      const db = await openDb();
      const tx = db.transaction(storeName, 'readonly');
      return requestResult(tx.objectStore(storeName).getAll());
    },
    async getByIndex(storeName, indexName, value) {
      const db = await openDb();
      const tx = db.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index(indexName);
      return requestResult(idx.getAll(value));
    },
    async setSetting(key, value) { return this.put(STORES.settings, { key, value }); },
    async getSetting(key, fallback = null) {
      const row = await this.get(STORES.settings, key);
      return row ? row.value : fallback;
    },
    async setAuth(key, value) { return this.put(STORES.auth, { key, value }); },
    async getAuth(key, fallback = null) {
      const row = await this.get(STORES.auth, key);
      return row ? row.value : fallback;
    },
    async clearAllLocalData() {
      await Promise.all([STORES.documents, STORES.outputs, STORES.assets, STORES.emailHistory].map((s) => this.clear(s)));
    }
  };

  window.SSTDB = DB;
})();
