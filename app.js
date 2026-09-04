(() => {
  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const state = {
    documents: [], outputs: [], emailHistory: [], selectedDocId: null,
    selectedOriginalId: null, originalPage: 1, selectedOutputId: null,
    user: null, localMode: false, backendOnline: false, backendInfo: null,
    controlTab: 'validation', lastCacheStats: { generated: 0, reused: 0 },
    parserReady: false, authBootstrap: null, selectedBatchIds: new Set(), selectedEmailIds: new Set(), emailMode: 'individual', emailFormat: 'PDF', aiStatus: null
  };

  let originalRenderSequence = 0;
  let originalResizeTimer = null;

  const viewMeta = {
    dashboard: ['PANEL OPERATIVO','Inicio'], documents: ['INGESTA Y REVISIÓN','Documentos'],
    originals: ['FUENTES ORIGINALES','PDF originales'], generated: ['SALIDAS','Documentos generados'],
    email: ['DISTRIBUCIÓN','Correo'], control: ['TRAZABILIDAD','Control y tablas'], settings: ['CONFIGURACIÓN','Configuración']
  };

  function setBoot(message, pct) { $('bootMessage').textContent = message; $('bootProgress').style.width = `${Math.max(0, Math.min(100, pct))}%`; }
  function toast(title, detail = '', type = 'success', timeout = 4200) {
    const el = document.createElement('div'); el.className = `toast ${type}`;
    el.innerHTML = `<strong>${SSTUtils.escapeHtml(title)}</strong>${detail ? `<small>${SSTUtils.escapeHtml(detail)}</small>` : ''}`;
    $('toastStack').appendChild(el); setTimeout(() => el.remove(), timeout);
  }
  function setBackendUi(online, detail = '') {
    state.backendOnline = !!online;
    for (const id of ['backendDot','authBackendDot']) {
      const el = $(id); if (!el) continue; el.className = `status-dot ${online ? 'success' : (detail ? 'error' : 'warn')}`;
    }
    $('backendLabel').textContent = online ? 'Backend seguro' : 'Backend';
    $('backendDetail').textContent = online ? 'Google Apps Script conectado' : (detail || 'Sin conexión');
    $('authBackendStatus').textContent = online ? 'Backend seguro conectado' : (detail || 'Backend sin configurar');
    $('settingsBackendStatus').textContent = online ? 'Conectado' : 'Sin conexión';
    $('settingsBackendStatus').className = `status-badge ${online ? 'success' : 'warn'}`;
    $('emailBackendBadge').textContent = online && !state.localMode ? 'Servicio de correo listo' : 'Backend requerido';
    $('emailBackendBadge').className = `status-badge ${online && !state.localMode ? 'success' : 'warn'}`;
    $('qualityGemini').textContent = online ? 'Disponible' : 'Sin backend';
  }


  function backendVersionCompatible(info = state.backendInfo) {
    const required = String(APP_CONFIG.requiredBackendVersion || '').trim();
    if (!required) return true;
    return String(info?.backendVersion || '').trim() === required;
  }

  function backendVersionLabel(info = state.backendInfo) {
    const deployed = String(info?.backendVersion || '').trim();
    const required = String(APP_CONFIG.requiredBackendVersion || '').trim();
    if (!deployed) return required ? `Backend sin versión identificable · se requiere ${required}` : 'Backend conectado';
    return required && deployed !== required ? `Backend ${deployed} · se requiere ${required}` : `Backend ${deployed}`;
  }

  function backendDocumentRecord(doc) {
    return {
      documentKey: String(doc?.hash || doc?.id || ''),
      fileName: String(doc?.fileName || ''),
      aiValidationStatus: String(doc?.aiValidationStatus || ''),
      consecutive: String(doc?.data?.consecutivo || ''),
      syncState: 'SINCRONIZADO',
      data: SSTUtils.deepClone(doc?.data || {})
    };
  }

  async function syncDocumentsToBackend(documents, options = {}) {
    const docs = (documents || []).filter(Boolean);
    if (!docs.length || !state.backendOnline || state.localMode) return { saved:0, skipped:true };
    const token = await SSTDB.getAuth('sessionToken', '');
    if (!token) return { saved:0, skipped:true };
    if (!backendVersionCompatible()) {
      const message = `${backendVersionLabel()}. Actualiza Code.gs y vuelve a implementar la Web App antes de sincronizar.`;
      if (!options.silent) toast('Apps Script desactualizado', message, 'error', 10000);
      throw new Error(message);
    }
    let saved = 0, inserted = 0, updated = 0;
    const chunkSize = 20;
    for (let i=0; i<docs.length; i+=chunkSize) {
      const chunk = docs.slice(i, i+chunkSize);
      const response = await SSTBackend.call('saveDocumentRecords', { items: chunk.map(backendDocumentRecord) }, { timeout:90000 });
      saved += Number(response?.saved || 0);
      inserted += Number(response?.inserted || 0);
      updated += Number(response?.updated || 0);
      const externalErrors = response?.consecutiveSheetSync?.errors || [];
      if (externalErrors.length) throw new Error(`La base interna se guardó, pero la hoja de consecutivos no pudo completarse: ${externalErrors.join(' | ')}`);
    }
    const stamp = new Date().toISOString();
    for (const doc of docs) {
      doc.remoteSyncStatus = 'synced';
      doc.remoteSyncedAt = stamp;
      doc.remoteSyncError = '';
      await SSTDB.put(SSTDB.stores.documents, doc);
    }
    return { saved, inserted, updated, skipped:false };
  }

  async function testBackendWrite() {
    if (!state.backendOnline || state.localMode) return toast('Backend requerido','Conecta Google Apps Script antes de probar la escritura.','warn');
    try {
      const result = await SSTBackend.call('backendDiagnostics', { writeProbe:true }, { timeout:60000 });
      state.backendInfo = Object.assign({}, state.backendInfo || {}, { backendVersion:result.backendVersion, capabilities:result.capabilities || [] });
      const db = result.portalDatabase || {};
      const ext = result.consecutiveData || {};
      if ($('backendDiagnosticsDetail')) $('backendDiagnosticsDetail').textContent = `Escritura OK · ${result.backendVersion || 'sin versión'} · Consecutivos: ${ext.ok ? `${ext.spreadsheetName} / ${ext.sheetName}` : (ext.error || 'sin configurar')} · Registro SST: ${ext?.sstLog ? `${ext.sstLog.spreadsheetName} / ${ext.sstLog.sheetName}` : 'CORRESPONDENCIA ENVIADA SST 2026 / Hoja 1'} · Base técnica: ${db.name || 'Base Portal'} / ${db.documentSheet || 'DocumentosProcesados'} (${db.documentRows ?? 0}).`;
      $('settingsBackendStatus').textContent = 'Escritura OK';
      $('settingsBackendStatus').className = 'status-badge success';
      toast('Apps Script y Sheets listos', `Prueba de escritura registrada en ${result.writeProbe?.sheet || 'DiagnosticoBackend'}.`, 'success', 7000);
    } catch (error) {
      if ($('backendDiagnosticsDetail')) $('backendDiagnosticsDetail').textContent = `Error de escritura: ${error.message}`;
      $('settingsBackendStatus').textContent = 'Revisar backend';
      $('settingsBackendStatus').className = 'status-badge error';
      toast('No se pudo escribir en Sheets', error.message, 'error', 10000);
    }
  }

  async function init() {
    try {
      setBoot('Inicializando almacenamiento local…', 18); await SSTDB.init();
      SSTBackend.bindIframe($('backendBridge'));
      bindEvents();
      setBoot('Recuperando configuración…', 34);
      const backendUrl = await SSTDB.getSetting('backendUrl', APP_CONFIG.defaultBackendUrl || '');
      $('setupBackendUrl').value = backendUrl || '';
      $('settingsBackendUrl').value = backendUrl || '';
      $('emailSubject').value = await SSTDB.getSetting('emailSubject', APP_CONFIG.emailSubject);
      $('emailBody').value = await SSTDB.getSetting('emailBody', APP_CONFIG.emailBody);
      state.emailMode = await SSTDB.getSetting('emailMode', 'individual');
      state.emailFormat = await SSTDB.getSetting('emailAttachmentFormat', 'PDF');
      $('emailCommonTo').value = await SSTDB.getSetting('emailCommonTo', '');
      $('toggleAi').checked = true; $('toggleAi').disabled = true; await SSTDB.setSetting('aiEnabled', true);
      $('toggleOcr').checked = await SSTDB.getSetting('ocrEnabled', true);
      $('settingsOutputFormat').value = await SSTDB.getSetting('outputFormat', 'PDF');
      $('settingsGeminiModel').value = await SSTDB.getSetting('geminiModel', APP_CONFIG.defaultGeminiModel);
      setBoot('Comprobando servicio seguro…', 48);
      if (backendUrl) {
        try {
          const ready = await SSTBackend.setUrl(backendUrl);
          if (ready) { state.backendInfo = await SSTBackend.ping(); setBackendUi(true); }
          else setBackendUi(false, 'No respondió');
        } catch (error) { console.warn(error); setBackendUi(false, 'No disponible'); }
      } else setBackendUi(false, 'Sin configurar');
      setBoot('Verificando sesión…', 68);
      const token = await SSTDB.getAuth('sessionToken', '');
      if (state.backendOnline && token) {
        try {
          const session = await SSTBackend.call('sessionInfo');
          state.user = session.user; state.localMode = false;
          await enterApp(); return;
        } catch (_) { await SSTDB.setAuth('sessionToken', ''); }
      }
      setBoot('Preparando acceso…', 90);
      await showAuth();
    } catch (error) {
      console.error(error); setBoot('No fue posible iniciar el portal.', 100); toast('Error de inicio', error.message, 'error', 8000);
      setTimeout(() => { $('appBoot').classList.add('hidden'); $('authView').classList.remove('hidden'); $('backendSetupPanel').classList.remove('hidden'); }, 1000);
    }
  }

  async function showAuth() {
    $('appBoot').classList.add('hidden'); $('appView').classList.add('hidden'); $('authView').classList.remove('hidden');
    if (!state.backendOnline) { $('backendSetupPanel').classList.remove('hidden'); $('authForms').classList.add('hidden'); return; }
    $('backendSetupPanel').classList.add('hidden'); $('authForms').classList.remove('hidden');
    try {
      state.authBootstrap = await SSTBackend.call('bootstrapStatus');
      if (!state.authBootstrap.hasUsers) {
        switchAuthTab('register'); $('registerHint').textContent = 'Configura la primera cuenta administradora del Portal SST.';
      } else $('registerHint').textContent = 'Registra una nueva cuenta para acceder al portal.';
    } catch (error) { setBackendUi(false, error.message); $('backendSetupPanel').classList.remove('hidden'); $('authForms').classList.add('hidden'); }
  }

  function switchAuthTab(tab) {
    qsa('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));
    qsa('[data-auth-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.authPanel !== tab));
  }

  async function clearWorkspaceForNewSession() {
    await SSTDB.clear(SSTDB.stores.documents);
    await SSTDB.clear(SSTDB.stores.outputs);
    state.documents = [];
    state.outputs = [];
    state.selectedDocId = null;
    state.selectedOriginalId = null;
    state.selectedOutputId = null;
    state.selectedBatchIds.clear();
    state.originalPage = 1;
    state.lastCacheStats = { generated:0, reused:0 };
  }

  async function enterApp() {
    $('appBoot').classList.add('hidden'); $('authView').classList.add('hidden'); $('appView').classList.remove('hidden');
    const name = state.user?.name || (state.localMode ? 'Revisión local' : 'Usuario');
    $('topUsername').textContent = name; $('sidebarUsername').textContent = name;
    $('topUserRole').textContent = state.localMode ? 'Modo local' : (state.user?.role === 'admin' ? 'Administrador' : 'Portal SST');
    $('userAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'U';
    await loadState();
    showView('dashboard');
    warmParser();
  }

  async function warmParser() {
    try {
      $('engineText').textContent = 'Cargando parser…'; $('qualityParser').textContent = 'Cargando';
      await SSTParser.init((message) => { $('engineText').textContent = message; });
      state.parserReady = true; $('engineText').textContent = 'Motor listo'; $('qualityParser').textContent = 'Listo';
    } catch (error) { $('engineText').textContent = 'Parser no disponible'; $('qualityParser').textContent = 'Error'; console.error(error); }
  }

  async function loadState() {
    state.documents = (await SSTDB.getAll(SSTDB.stores.documents)).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    state.outputs = (await SSTDB.getAll(SSTDB.stores.outputs)).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    state.emailHistory = (await SSTDB.getAll(SSTDB.stores.emailHistory)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (state.backendOnline && !state.localMode) {
      try { await syncSharedAssets(); } catch (error) { console.warn('Recursos compartidos:', error); }

      try {
        const result = await SSTBackend.call('emailHistory', { limit: 200 });
        if (Array.isArray(result.items)) state.emailHistory = result.items;
      } catch (error) { console.warn('Historial remoto:', error); }
      await refreshBackendDiagnostics();
    }
    if (!state.selectedDocId && state.documents[0]) state.selectedDocId = state.documents[0].id;
    if (!state.selectedOriginalId && state.documents[0]) state.selectedOriginalId = state.documents[0].id;
    if (!state.selectedOutputId && state.outputs[0]) state.selectedOutputId = state.outputs[0].id;
    if (!state.selectedBatchIds.size && state.documents.length) state.documents.forEach((d) => state.selectedBatchIds.add(d.id));
    await renderAll();
    await renderAssetSettings();
    if (state.backendOnline && !state.localMode && state.documents.length) {
      setTimeout(() => { autoAuditPendingDocuments().catch((error) => console.warn('Auditoría IA automática:', error)); }, 350);
    }
  }

  function needsAutomaticAiAudit(doc) {
    if (!doc || !state.backendOnline || state.localMode) return false;
    if ((doc.size || doc.blob?.size || 0) > APP_CONFIG.maxGeminiPdfMb * 1024 * 1024) return false;
    return doc.aiValidationVersion !== APP_CONFIG.aiValidationVersion || doc.aiValidationStatus !== 'validated' || !doc.aiValidatedAt;
  }

  async function ensureAiReady(options = {}) {
    const { notify = false } = options;
    if (!state.backendOnline || state.localMode) {
      state.aiStatus = { ready:false, detail:'El backend seguro no está conectado.' };
      return false;
    }
    try {
      const ai = await SSTBackend.call('aiStatus', {}, { timeout:30000 });
      state.aiStatus = ai;
      if ($('qualityGemini')) $('qualityGemini').textContent = ai.ready ? `Lista · ${ai.model || ''}` : 'Requiere autorización';
      if ($('aiStatusBadge')) {
        $('aiStatusBadge').textContent = ai.ready ? 'IA lista' : 'IA pendiente';
        $('aiStatusBadge').className = `status-badge ${ai.ready ? 'success' : 'error'}`;
      }
      if ($('aiStatusDetail')) $('aiStatusDetail').textContent = ai.ready
        ? `Gemini ${ai.model || ''} conectado. Cada PDF se audita automáticamente antes de poder generar.`
        : (ai.detail || 'Gemini no está listo.');
      if (!ai.ready && notify) toast('IA pendiente de autorización', ai.detail || 'Autoriza UrlFetchApp en Google Apps Script.', 'error', 9000);
      return !!ai.ready;
    } catch (error) {
      state.aiStatus = { ready:false, detail:error.message };
      if (notify) toast('IA no disponible', error.message, 'error', 9000);
      return false;
    }
  }

  async function runAutomaticAiAudit(doc, options = {}) {
    if (!doc?.blob || !needsAutomaticAiAudit(doc)) return doc;
    const ready = state.aiStatus?.ready === true || await ensureAiReady({ notify:false });
    if (!ready) throw new Error(state.aiStatus?.detail || 'Gemini no está autorizado en Apps Script.');
    const buffer = options.buffer || await doc.blob.arrayBuffer();
    const sourceText = options.sourceText || doc.text || '';
    const label = options.label || doc.fileName || 'certificado.pdf';
    const ratio = options.ratio ?? .82;
    updateProcessing(options.title || 'Validación IA automática', `${label} · auditoría visual completa`, ratio);
    try {
      const aiData = await SSTBackend.call('geminiAnalyze', {
        fileName: doc.fileName,
        pdfBase64: SSTUtils.arrayBufferToBase64(buffer),
        text: sourceText.slice(0,50000),
        localData: doc.data,
        profileId:doc.data?.perfil_detectado?.id || '',
        profileConfidence:Number(doc.data?.confianza_formato || 0),
        model: await SSTDB.getSetting('geminiModel', APP_CONFIG.defaultGeminiModel)
      }, { timeout:195000 });
      doc.data = fuseAiV10(doc.data, aiData);
      doc.data.validado_ia = true;
      doc.aiError = '';
      doc.aiValidationStatus = 'validated';
      doc.aiValidationVersion = APP_CONFIG.aiValidationVersion;
      doc.aiValidatedAt = new Date().toISOString();
      doc.updatedAt = doc.aiValidatedAt;
      await SSTDB.put(SSTDB.stores.documents, doc);
      return doc;
    } catch (error) {
      doc.aiError = error.message;
      doc.aiValidationStatus = 'error';
      doc.aiValidationVersion = APP_CONFIG.aiValidationVersion;
      doc.aiLastAttemptAt = new Date().toISOString();
      doc.updatedAt = doc.aiLastAttemptAt;
      if (doc.data) doc.data.modo_validacion = 'Respaldo local · IA pendiente';
      await SSTDB.put(SSTDB.stores.documents, doc);
      throw error;
    }
  }

  async function autoAuditPendingDocuments() {
    if (!state.backendOnline || state.localMode) return;
    const pending = state.documents.filter(needsAutomaticAiAudit);
    if (!pending.length) return;
    if (!(await ensureAiReady({ notify:false }))) {
      for (const doc of pending) {
        doc.aiValidationStatus = 'pending_auth';
        doc.aiError = state.aiStatus?.detail || 'Gemini pendiente de autorización.';
        await SSTDB.put(SSTDB.stores.documents, doc);
      }
      await renderAll();
      return;
    }
    $('processingBanner').classList.remove('hidden');
    let ok = 0, failed = 0;
    try {
      let done = 0;
      const aiConcurrency = Math.max(1, Number(APP_CONFIG.aiConcurrency || 3));
      await runBoundedPool(pending, aiConcurrency, async (doc) => {
        try {
          await runAutomaticAiAudit(doc, { title:`IA automática ${done+1} de ${pending.length}`, ratio:(done+.7)/pending.length });
          ok++;
        } catch (error) { failed++; console.warn(`IA automática ${doc.fileName}:`, error); }
        finally { done++; }
      });
      try { if (ok) await syncDocumentsToBackend(pending.filter((d)=>d.aiValidationStatus==='validated'), { silent:true }); }
      catch (syncError) { console.warn('Sincronización posterior a IA:', syncError); }
      await renderAll();
      if (ok) toast('Validación IA automática', `${ok} certificado(s) auditado(s)${failed ? ` · ${failed} pendiente(s)` : ''}.`, failed ? 'warn' : 'success', 6500);
    } finally {
      setTimeout(() => $('processingBanner').classList.add('hidden'), 500);
    }
  }

  async function refreshBackendDiagnostics() {
    if (!state.backendOnline || state.localMode) return;
    try {
      const diag = await SSTBackend.call('backendDiagnostics', {}, { timeout:30000 });
      state.backendInfo = Object.assign({}, state.backendInfo || {}, { backendVersion:diag.backendVersion, capabilities:diag.capabilities || [] });
      const db = diag.portalDatabase || {};
      const compatible = backendVersionCompatible();
      $('settingsBackendStatus').textContent = compatible ? 'Conectado y sincronizando' : 'Actualizar Apps Script';
      $('settingsBackendStatus').className = `status-badge ${compatible ? 'success' : 'warn'}`;
      if ($('backendDiagnosticsDetail')) $('backendDiagnosticsDetail').textContent = `${backendVersionLabel()} · ${db.name || 'Base Portal'} / ${db.documentSheet || 'DocumentosProcesados'} · ${db.documentRows ?? 0} certificado(s) guardado(s).${compatible ? '' : ' Debes reemplazar Code.gs y publicar una nueva versión de la Web App.'}`;
    } catch (error) {
      if ($('backendDiagnosticsDetail')) $('backendDiagnosticsDetail').textContent = `El backend responde, pero no expone el diagnóstico V10.8: ${error.message}. Actualiza Code.gs y vuelve a implementar la Web App.`;
      $('settingsBackendStatus').textContent = 'Backend desactualizado';
      $('settingsBackendStatus').className = 'status-badge warn';
    }
    try {
      const ai = await SSTBackend.call('aiStatus', {}, { timeout: 30000 });
      state.aiStatus = ai;
      $('qualityGemini').textContent = ai.ready ? `Lista · ${ai.model || ''}` : 'Requiere autorización';
      if ($('aiStatusBadge')) {
        $('aiStatusBadge').textContent = ai.ready ? 'IA lista' : 'IA pendiente';
        $('aiStatusBadge').className = `status-badge ${ai.ready ? 'success' : 'error'}`;
      }
      if ($('aiStatusDetail')) $('aiStatusDetail').textContent = ai.ready
        ? `Gemini ${ai.model || ''} conectado y autorizado para validar automáticamente todos los PDF.`
        : `${ai.detail || 'Gemini no está listo.'}${ai.authorizationError ? ' Ejecuta authorizePortalServices() en Apps Script y publica una nueva versión.' : ''}`;
    } catch (error) {
      state.aiStatus = { ready:false, detail:error.message };
      $('qualityGemini').textContent = 'Error';
      if ($('aiStatusBadge')) { $('aiStatusBadge').textContent='IA pendiente'; $('aiStatusBadge').className='status-badge error'; }
      if ($('aiStatusDetail')) $('aiStatusDetail').textContent = error.message;
    }
    try {
      const mail = await SSTBackend.call('mailStatus', {}, { timeout: 30000 });
      $('emailBackendBadge').textContent = mail.ready ? `Correo listo · cupo ${mail.remainingQuota ?? '—'}` : `Correo sin cupo · ${mail.remainingQuota ?? 0}`;
      $('emailBackendBadge').className = `status-badge ${mail.ready ? 'success' : 'warn'}`;
      $('emailBackendBadge').title = `${mail.service || 'MailApp'}${mail.sender ? ' · ' + mail.sender : ''}${mail.detail ? ' · ' + mail.detail : ''}`;
    } catch (error) {
      $('emailBackendBadge').textContent = 'Correo requiere autorización';
      $('emailBackendBadge').className = 'status-badge warn';
      console.warn('Diagnóstico correo:', error);
    }
    try {
      const status = await SSTBackend.call('consecutiveStatus', {}, { timeout: 30000 });
      $('consecutiveStatusBadge').textContent = `Actual ${status.currentDisplay ?? status.current ?? 0}`;
      const statusIssues = (status.duplicateConsecutives || []).length + (status.conflictingDocumentKeys || []).length;
      $('consecutiveStatusBadge').className = `status-badge ${statusIssues ? 'warn' : 'success'}`;
      $('consecutiveStatusDetail').textContent = `${status.spreadsheetName} / ${status.sheetName} · ${status.rowsRead ?? 0} consecutivo(s) válidos · actual: ${status.currentDisplay ?? status.current ?? 0} · siguiente: ${status.nextDisplay ?? status.next} · registro SST: ${status.sstLog?.spreadsheetName || 'CORRESPONDENCIA ENVIADA SST 2026'} / ${status.sstLog?.sheetName || 'Hoja 1'}${status.sstLog?.ok===false ? ` · ERROR: ${status.sstLog.error}` : ''}${statusIssues ? ` · ALERTA: ${statusIssues} inconsistencia(s) detectada(s)` : ' · integridad OK'}`;
      $('settingsConsecutiveSheet').value = status.sheetName || 'CONSECUTIVOS 2026';
      $('settingsConsecutivePrefix').value = status.prefix || 'SST';
      if (status.configured && status.spreadsheetId && !$('settingsConsecutiveSpreadsheet').value) {
        $('settingsConsecutiveSpreadsheet').value = `https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit`;
      }
    } catch (error) {
      $('consecutiveStatusBadge').textContent = 'Revisar';
      $('consecutiveStatusBadge').className = 'status-badge warn';
      $('consecutiveStatusDetail').textContent = error.message;
      console.warn('Diagnóstico consecutivos:', error);
    }
  }

  async function saveConsecutiveSettings() {
    if (!state.backendOnline || state.localMode) return toast('Backend requerido','Conecta Apps Script para validar consecutivos.','warn');
    try {
      const result = await SSTBackend.call('saveConsecutiveConfig', {
        spreadsheetUrlOrId: $('settingsConsecutiveSpreadsheet').value.trim(),
        sheetName: $('settingsConsecutiveSheet').value.trim() || 'CONSECUTIVOS 2026',
        prefix: $('settingsConsecutivePrefix').value.trim() || 'SST'
      }, { timeout: 60000 });
      $('consecutiveStatusBadge').textContent = `Actual ${result.currentDisplay ?? result.current ?? 0}`;
      const resultIssues = (result.duplicateConsecutives || []).length + (result.conflictingDocumentKeys || []).length;
      $('consecutiveStatusBadge').className = `status-badge ${resultIssues ? 'warn' : 'success'}`;
      $('consecutiveStatusDetail').textContent = `${result.spreadsheetName} / ${result.sheetName} · ${result.rowsRead ?? 0} consecutivo(s) válidos · actual: ${result.currentDisplay ?? result.current ?? 0} · siguiente: ${result.nextDisplay ?? result.next} · registro SST: ${result.sstLog?.spreadsheetName || 'CORRESPONDENCIA ENVIADA SST 2026'} / ${result.sstLog?.sheetName || 'Hoja 1'}${result.sstLog?.ok===false ? ` · ERROR: ${result.sstLog.error}` : ''}${resultIssues ? ` · ALERTA: ${resultIssues} inconsistencia(s)` : ' · integridad OK'}`;
      toast('Consecutivos conectados', `Se validará contra ${result.spreadsheetName} / ${result.sheetName}.`, 'success', 6500);
    } catch (error) { toast('No se pudo validar la hoja', error.message, 'error', 8000); }
  }

  function isViewActive(view) { const p = document.querySelector(`[data-view-panel="${view}"]`); return !!p?.classList.contains('active'); }

  function showView(view) {
    qsa('.view-section').forEach((el) => el.classList.toggle('active', el.dataset.viewPanel === view));
    qsa('.nav-item[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
    const meta = viewMeta[view] || ['',view]; $('viewEyebrow').textContent = meta[0]; $('viewTitle').textContent = meta[1];
    $('sidebar').classList.remove('open');
    if (view === 'originals') renderOriginals();
    if (view === 'generated') renderGenerated();
    if (view === 'email') renderEmail();
    if (view === 'control') renderControlTable();
    if (view === 'settings') renderAssetSettings();
  }

  async function renderAll() {
    renderDashboard(); renderDocumentList(); renderEditor(); renderOriginals(); renderGenerated(); renderEmail(); renderControlTable();
  }

  function renderDashboard() {
    const aiCount = state.documents.filter((d) => d.data?.validado_ia).length;
    $('metricDocs').textContent = state.documents.length; $('metricDocsSub').textContent = state.documents.length ? `${state.documents.length} en la sesión actual` : 'Sesión limpia';
    $('metricAi').textContent = aiCount; $('metricGenerated').textContent = state.outputs.length; $('metricCache').textContent = `${state.lastCacheStats.reused} reutilizados`;
    $('metricEmails').textContent = state.emailHistory.filter((x) => String(x.status || x.estado || '').toLowerCase().includes('enviado')).length;
    $('qualityOcr').textContent = $('toggleOcr').checked ? 'Activo' : 'Desactivado'; $('qualityCache').textContent = 'Limpia al iniciar';
    const recent = state.documents.slice(0,5);
    $('recentDocuments').className = recent.length ? 'recent-list' : 'empty-state compact';
    $('recentDocuments').innerHTML = recent.length ? recent.map((d) => `<div class="document-item" data-dashboard-doc="${d.id}"><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || d.fileName)}</strong><small>${SSTUtils.escapeHtml(d.fileName)}</small><em>${d.data?.modo_validacion ? SSTUtils.escapeHtml(d.data.modo_validacion) : 'Respaldo local'}${d.data?.calidad_extraccion ? ` · Calidad ${SSTUtils.escapeHtml(d.data.calidad_extraccion)}` : ''}</em></div><span class="mini-status ${d.data?.validado_ia ? 'ai' : ''}"></span></div>`).join('') : '<span>▣</span><strong>No hay documentos cargados</strong><p>Los certificados aparecerán aquí al cargarlos.</p>';
  }

  function documentMatches(d, query) {
    const text = `${d.fileName} ${d.data?.nombre || ''} ${d.data?.identificacion || ''} ${d.data?.cargo || ''}`.toLowerCase();
    return text.includes(String(query || '').trim().toLowerCase());
  }

  function renderBatchSelectionSummary() {
    const selected = state.documents.filter((d) => state.selectedBatchIds.has(d.id)).length;
    if ($('selectedDocCount')) $('selectedDocCount').textContent = `${selected} seleccionado${selected === 1 ? '' : 's'}`;
    if ($('btnGenerateSelectedBatch')) $('btnGenerateSelectedBatch').disabled = selected === 0;
  }

  function renderBatchInsights() {
    const strip=$('batchInsightStrip'); if(!strip)return;
    const total=state.documents.length;
    strip.classList.toggle('hidden', total === 0);
    if(!total)return;
    const jer=state.documents.filter((d)=>d.data?.perfil_detectado?.id==='JER_TABLA').length;
    const control=state.documents.filter((d)=>d.data?.perfil_detectado?.id==='CONTROL_PERIODICO').length;
    const high=state.documents.filter((d)=>String(d.data?.calidad_extraccion||'').toLowerCase()==='alta').length;
    const validated=state.documents.filter((d)=>d.aiValidationStatus==='validated' || d.data?.validado_ia).length;
    const review=state.documents.filter((d)=>d.dirty || (d.data?.campos_revision||[]).length || d.aiValidationStatus==='error' || d.aiValidationStatus==='pending_auth').length;
    $('batchJerCount').textContent=jer; $('batchControlCount').textContent=control; $('batchHighCount').textContent=high; $('batchReviewCount').textContent=review; $('batchAiSummary').textContent=`${validated} / ${total}`;
  }

  function renderDocumentList() {
    const query = $('documentSearch')?.value || '';
    const docs = state.documents.filter((d) => documentMatches(d, query));
    $('docListCount').textContent = state.documents.length;
    $('documentList').innerHTML = docs.length ? docs.map((d) => {
      const aiState = d.aiValidationStatus === 'validated' ? 'IA validada' : (d.aiValidationStatus === 'pending_auth' ? 'IA pendiente' : (d.aiValidationStatus === 'error' ? 'IA con error' : 'IA pendiente'));
      return `<div class="document-item ${d.id === state.selectedDocId ? 'active' : ''}" data-doc-id="${d.id}"><label class="batch-check" title="Incluir en vista previa/lote"><input type="checkbox" class="batch-select" data-batch-id="${d.id}" ${state.selectedBatchIds.has(d.id) ? 'checked' : ''}><span></span></label><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || 'Sin nombre')}</strong><small>${SSTUtils.escapeHtml(d.fileName)}</small><em>${d.dirty ? 'Editado · requiere actualizar salida' : `${aiState} · ${d.data?.perfil_documental || 'Formato detectado'} · ${Number(d.data?.confianza_formato || 0)}% · ${(d.data?.restricciones_lista || []).length} restr.`}</em></div><span class="mini-status ${d.aiValidationStatus === 'validated' ? 'ai' : (d.dirty ? 'warn' : '')}"></span><button class="item-delete" type="button" data-delete-doc="${d.id}" title="Eliminar este archivo" aria-label="Eliminar ${SSTUtils.escapeHtml(d.fileName)}">×</button></div>`;
    }).join('') : '<div class="empty-state compact"><span>▣</span><strong>Sin certificados</strong></div>';
    renderBatchSelectionSummary();
    renderBatchInsights();
  }

  function selectedDocument() { return state.documents.find((d) => d.id === state.selectedDocId) || null; }
  function selectedOutput() { return state.outputs.find((o) => o.id === state.selectedOutputId) || null; }

  function normalizedMap(data) {
    const source = data?.recomendaciones_por_examen || {};
    const map = {};
    // V8: llaves explícitas. En V7 el `else` quedaba asociado al if interno
    // (`if (item?.examen)`) y los mapas tipo objeto se ignoraban por completo.
    if (Array.isArray(source)) {
      for (const item of source) {
        if (item?.examen) map[item.examen] = Array.isArray(item.recomendaciones) ? item.recomendaciones : [];
      }
    } else {
      for (const [k,v] of Object.entries(source)) map[k] = Array.isArray(v) ? v : [];
    }
    for (const exam of data?.examenes_lista || []) if (!(exam in map)) map[exam] = [];
    if (!Object.keys(map).length && data?.recomendaciones_lista?.length) map['Recomendaciones generales'] = [...data.recomendaciones_lista];
    return map;
  }

  function renderEditor() {
    const doc = selectedDocument();
    $('editorEmpty').classList.toggle('hidden', !!doc); $('editorContent').classList.toggle('hidden', !doc);
    if (!doc) return;
    const d = doc.data || {};
    $('editorSourceFile').textContent = doc.fileName; $('editorPersonTitle').textContent = d.nombre || 'Trabajador sin identificar'; $('editorValidationMode').textContent = `${d.modo_validacion || 'Motor local'} · ${d.perfil_documental || 'Formato genérico'} · Calidad ${d.calidad_extraccion || '—'}`;
    const aiOk = doc.aiValidationStatus === 'validated';
    const review = (d.campos_revision || []).length ? ` · revisar ${(d.campos_revision || []).join(', ')}` : '';
    $('editorStatusText').textContent = doc.dirty ? `Editado · ${aiOk ? 'IA validada' : 'IA pendiente'}${review}` : `${aiOk ? 'IA validada automáticamente' : 'IA pendiente'}${review}`;
    $('editorStatusDot').className = `status-dot ${aiOk && !doc.dirty ? 'success' : 'warn'}`;
    if ($('btnValidateAiSelected')) {
      $('btnValidateAiSelected').classList.toggle('hidden', aiOk);
      $('btnValidateAiSelected').textContent = '↻ Reintentar IA';
    }
    const values = { fieldName:d.nombre, fieldId:d.identificacion, fieldEmail:d.correo, fieldRole:d.cargo, fieldExamType:d.tipo_examen, fieldDate:d.fecha || SSTUtils.todayIso(), fieldPlace:d.lugar || 'Tunja', fieldSurveillance:d.vigilancia_programa, fieldObservations:d.observaciones, fieldReferrals:d.remisiones };
    for (const [id,value] of Object.entries(values)) $(id).value = value ?? '';
    $('fieldExams').value = (d.examenes_lista || []).join('\n');
    if ($('fieldRestrictions')) {
      $('fieldRestrictions').value = (d.restricciones_lista || []).map((r) => typeof r === 'string' ? r : `${r.tipo ? r.tipo + ' | ' : ''}${r.texto || ''}`).filter(Boolean).join('\n');
      $('restrictionCount').textContent = `${(d.restricciones_lista || []).length} restricción${(d.restricciones_lista || []).length === 1 ? '' : 'es'}`;
      $('restrictionCount').className = `status-badge ${(d.restricciones_lista || []).length ? 'success' : ''}`;
    }
    const reviews = d.campos_revision || [];
    if ($('qualityReviewBox')) {
      $('qualityReviewBox').classList.toggle('hidden', !reviews.length);
      $('qualityReviewList').innerHTML = reviews.map((x)=>`<span>${SSTUtils.escapeHtml(x)}</span>`).join('');
      $('qualityReviewText').textContent = reviews.some((x)=>String(x).toLowerCase().includes('discrepancia'))
        ? 'El motor por formato y la auditoría IA no coinciden en uno o más campos. Compara el PDF original y corrige el editor antes de marcar la revisión como resuelta.'
        : 'Hay campos que deben verificarse contra el PDF original antes de generar la recomendación.';
    }
    const pending = d.recomendaciones_pendientes_revision || [];
    $('pendingReviewBox').classList.toggle('hidden', !pending.length); $('fieldPending').value = pending.join('\n');
    const recMap = normalizedMap(d);
    renderRecommendationGroups(recMap, d.estado_por_examen || {});
    if ($('recommendationCoverage')) {
      const exams = (d.examenes_lista || []).filter(Boolean);
      const covered = exams.filter((exam) => Array.isArray(recMap[exam]) && recMap[exam].length).length;
      const statusOnly = exams.filter((exam) => !(recMap[exam] || []).length && (d.estado_por_examen || {})[exam]).length;
      $('recommendationCoverage').textContent = `${covered} / ${exams.length} con recomendación${statusOnly ? ` · ${statusOnly} solo estado` : ''}`;
      $('recommendationCoverage').className = `status-badge ${covered + statusOnly === exams.length && exams.length ? 'success' : 'warn'}`;
      $('recommendationCoverage').title = 'Las recomendaciones deben conservar el detalle de la celda derecha. Estados como REALIZADO se muestran aparte y no se convierten en recomendaciones.';
    }
    $('saveState').textContent = doc.dirty ? 'Cambios guardados · salida pendiente de actualizar' : 'Cambios guardados automáticamente';
  }

  function renderRecommendationGroups(map, statuses = {}) {
    const entries = Object.entries(map || {});
    $('recommendationGroups').innerHTML = (entries.length ? entries : [['Recomendaciones generales',[]]]).map(([exam,recs],i) => {
      const status = statuses?.[exam] || '';
      const paragraph = (recs || []).map((r) => String(r || '').trim()).filter(Boolean).join(' ');
      return `<div class="recommendation-card" data-rec-group="${i}"><div class="recommendation-card-head"><input class="rec-exam" value="${SSTUtils.escapeHtml(exam)}" aria-label="Examen"><button class="remove-group" type="button" title="Eliminar grupo">×</button></div>${status ? `<div class="field-help">Estado detectado en el certificado: <strong>${SSTUtils.escapeHtml(status)}</strong></div>` : ''}<textarea class="rec-text" rows="4" placeholder="La recomendación completa de este examen aparecerá aquí en un solo párrafo.">${SSTUtils.escapeHtml(paragraph)}</textarea></div>`;
    }).join('');
  }

  const remoteSyncSelectedDebounced = SSTUtils.debounce(async () => {
    const doc = selectedDocument(); if (!doc || !state.backendOnline || state.localMode) return;
    try { await syncDocumentsToBackend([doc], { silent:true }); }
    catch (error) { doc.remoteSyncStatus='error'; doc.remoteSyncError=error.message; await SSTDB.put(SSTDB.stores.documents, doc); }
    renderControlTable();
  }, 1400);

  const saveSelectedDebounced = SSTUtils.debounce(async () => {
    const doc = selectedDocument(); if (!doc) return; doc.updatedAt = new Date().toISOString(); await SSTDB.put(SSTDB.stores.documents, doc); renderDocumentList(); renderDashboard(); renderControlTable(); remoteSyncSelectedDebounced();
  }, 280);

  function syncEditorToState() {
    const doc = selectedDocument(); if (!doc) return;
    const d = doc.data;
    const fieldMap = { fieldName:'nombre',fieldId:'identificacion',fieldEmail:'correo',fieldRole:'cargo',fieldExamType:'tipo_examen',fieldDate:'fecha',fieldPlace:'lugar',fieldSurveillance:'vigilancia_programa',fieldObservations:'observaciones',fieldReferrals:'remisiones' };
    for (const [id,key] of Object.entries(fieldMap)) d[key] = $(id).value.trim();
    d.examenes_lista = $('fieldExams').value.split('\n').map((x) => x.trim()).filter(Boolean);
    if ($('fieldRestrictions')) d.restricciones_lista = $('fieldRestrictions').value.split('\n').map((x) => x.trim()).filter(Boolean).map((line) => {
      const parts = line.split('|');
      return parts.length > 1 ? { tipo:parts.shift().trim(), texto:parts.join('|').trim() } : { tipo:'', texto:line };
    });
    const map = {};
    qsa('.recommendation-card', $('recommendationGroups')).forEach((card) => {
      const exam = card.querySelector('.rec-exam').value.trim();
      const recs = card.querySelector('.rec-text').value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (exam) map[exam] = recs;
    });
    d.recomendaciones_por_examen = map;
    d.recomendaciones_lista = Object.entries(map).flatMap(([exam,recs]) => recs.map((rec) => exam === 'Recomendaciones generales' ? rec : `${exam}: ${rec}`));
    d.recomendaciones_pendientes_revision = $('fieldPending').value.split('\n').map((x) => x.trim()).filter(Boolean);
    doc.dirty = true; $('saveState').textContent = 'Guardando cambios…'; $('editorStatusText').textContent = 'Cambios sin regenerar'; $('editorStatusDot').className = 'status-dot warn';
    saveSelectedDebounced();
  }

  function validateForGeneration(doc) {
    const d = doc?.data || {}; const missing = [];
    if (!String(d.nombre || '').trim()) missing.push('nombre');
    if (!String(d.cargo || '').trim()) missing.push('cargo');
    if (!(d.examenes_lista || []).length) missing.push('exámenes realizados');
    const pending = d.recomendaciones_pendientes_revision || [];
    if (pending.length) missing.push('fragmentos pendientes de revisión');
    if ((d.campos_revision || []).length) missing.push(`control de calidad (${d.campos_revision.join(', ')})`);
    if (APP_CONFIG.aiRequiredForGeneration && doc?.aiValidationStatus !== 'validated') missing.push('validación automática con IA');
    return missing;
  }

  function extractionScore(data) {
    const d = data || {};
    let score = 0;
    if (String(d.nombre || '').trim()) score += 8;
    if (String(d.identificacion || '').trim()) score += 5;
    if (String(d.cargo || '').trim()) score += 6;
    score += Math.min(12, (d.examenes_lista || []).length * 3);
    score += Math.min(18, (d.recomendaciones_lista || []).length * 3);
    if (String(d.observaciones || '').trim()) score += 2;
    if (String(d.remisiones || '').trim()) score += 2;
    if (String(d.vigilancia_programa || '').trim()) score += 2;
    score -= (d.campos_revision || []).length * 5;
    score -= (d.recomendaciones_pendientes_revision || []).length * 4;
    if (String(d.calidad_extraccion || '').toLowerCase() === 'alta') score += 8;
    if (String(d.calidad_extraccion || '').toLowerCase() === 'revisar') score -= 8;
    return score;
  }

  function needsOcrRescue(data, extraction) {
    if (!extraction || extraction.usedOcr) return false;
    const critical = new Set((data?.campos_revision || []).map((x) => String(x).toLowerCase()));
    const exams = data?.examenes_lista || [];
    const map = normalizedMap(data || {});
    const covered = exams.filter((exam) => Array.isArray(map[exam]) && map[exam].length).length;
    const profile = String(data?.perfil_documental || '').toLowerCase();
    const layout = extraction.layoutStats || {};
    if (String(data?.calidad_extraccion || '').toLowerCase() === 'revisar') return true;
    // Si se detectaron varios exámenes pero ninguna recomendación, la tabla perdió estructura.
    if (exams.length >= 2 && covered === 0) return true;
    // En los dos formatos tabulares conocidos deben existir fronteras de columna. Si PDF.js
    // no las reconstruyó, OCR se usa automáticamente como segunda lectura geométrica.
    if ((profile.includes('tabla examen') || profile.includes('matriz de exámenes')) && Number(layout.tabRows || 0) < 2) return true;
    return ['exámenes realizados','recomendaciones','observaciones','remisiones','vigilancia epidemiológica'].some((x) => critical.has(x));
  }

  function aiMapToObject(aiData) {
    const map = {};
    for (const item of (aiData?.recomendaciones_por_examen || [])) {
      const exam = String(item?.examen || '').trim();
      if (!exam) continue;
      map[exam] = (item?.recomendaciones || []).map((x) => SSTProfiles.normalizeClinicalText(x)).filter(Boolean).filter((x) => !/^(REALIZAD[OA]S?|NORMAL|NO APLICA|N\/?A|APTO)$/i.test(String(x).trim()));
    }
    const signature = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
    const assigned = new Set(Object.values(map).flat().map(signature));
    const general = (aiData?.recomendaciones_medicas || []).map((x) => SSTProfiles.normalizeClinicalText(x)).filter(Boolean).filter((x) => !assigned.has(signature(x)));
    if (general.length) map['Recomendaciones generales'] = [...new Map(general.map((x) => [signature(x),x])).values()];
    return map;
  }

  function semanticSignature(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }

  function mergeDetailedTextLists(values) {
    const out=[];
    for (const raw of values || []) {
      const value=SSTProfiles.normalizeClinicalText(raw); const key=semanticSignature(value); if(!value||!key)continue;
      let merged=false;
      for(let i=0;i<out.length;i++){
        const existing=semanticSignature(out[i]);
        if(existing===key){ merged=true; break; }
        if(existing.includes(key)||key.includes(existing)){ if(key.length>existing.length)out[i]=value; merged=true; break; }
        const a=existing.split(' ').slice(0,8).join(' '), b=key.split(' ').slice(0,8).join(' ');
        if(a.length>24 && a===b){ if(key.length>existing.length)out[i]=value; merged=true; break; }
      }
      if(!merged)out.push(value);
    }
    return out;
  }

  function mergeRecommendationMaps(localMapRaw, aiMapRaw) {
    const localMap=normalizedMap({recomendaciones_por_examen:localMapRaw || {}}); const aiMap=aiMapRaw || {};
    const out={}; for(const [exam,recs] of Object.entries(localMap)) out[exam]=mergeDetailedTextLists(recs);
    for(const [aiExam,aiRecs] of Object.entries(aiMap)) {
      const aiKey=semanticSignature(aiExam);
      let target=Object.keys(out).find((exam)=>{ const k=semanticSignature(exam); return k===aiKey || (k.length>10 && aiKey.length>10 && (k.includes(aiKey)||aiKey.includes(k))); });
      if(!target) target=aiExam;
      out[target]=mergeDetailedTextLists([...(out[target]||[]),...(aiRecs||[])]);
    }
    return out;
  }

  function mergeExamStatuses(localStatuses, aiStatuses, examList = []) {
    const out={...(localStatuses||{})};
    const entries=Array.isArray(aiStatuses) ? aiStatuses.map((x)=>[x?.examen,x?.estado]) : Object.entries(aiStatuses||{});
    for(const [rawExam,rawStatus] of entries){
      const exam=String(rawExam||'').trim(); const status=String(rawStatus||'').trim();
      if(!exam||!status)continue;
      if(!/^(REALIZAD[OA]S?|NORMAL|NO APLICA|N\/?A|APTO)$/i.test(status))continue;
      const key=semanticSignature(exam);
      const target=[...examList,...Object.keys(out)].find((x)=>{ const k=semanticSignature(x); return k===key || (k.length>8&&key.length>8&&(k.includes(key)||key.includes(k))); }) || exam;
      out[target]=/^REALIZAD/i.test(status)?'Realizado':SSTProfiles.normalizeClinicalText(status);
    }
    return out;
  }

  function unresolvedExamCoverage(data) {
    const exams=data?.examenes_lista||[], map=normalizedMap(data||{}), statuses=data?.estado_por_examen||{};
    return exams.filter((exam)=>!((map[exam]||[]).length) && !statuses[exam]);
  }

  function mergeRestrictions(localItems, aiItems) {
    const out=[];
    for(const raw of [...(localItems||[]),...(aiItems||[])]) {
      const item=typeof raw==='string'?{tipo:'',texto:raw}:raw||{};
      const text=SSTProfiles.normalizeClinicalText(item.texto||''); const key=semanticSignature(text); if(!text||!key)continue;
      let found=-1;
      for(let i=0;i<out.length;i++){
        const existing=semanticSignature(out[i].texto); if(existing===key || existing.includes(key) || key.includes(existing)){found=i;break;}
      }
      if(found>=0){
        if(key.length>semanticSignature(out[found].texto).length)out[found].texto=text;
        if(!out[found].tipo && item.tipo)out[found].tipo=String(item.tipo).trim();
      } else out.push({tipo:String(item.tipo||'').trim(),texto:text});
    }
    return out;
  }

  function fuseAiV10(localData, aiData) {
    const local = SSTUtils.deepClone(localData || {});
    const ai = aiData || {};
    const out = { ...local };
    const reviewFlags=[...(local.campos_revision||[])];
    const profileConfidence=Number(local.confianza_formato||0);
    const highProfile=profileConfidence>=Number(APP_CONFIG.highConfidenceProfileThreshold||92);
    const scalarMap = {
      nombre:'nombre', cargo:'cargo', identificacion:'identificacion', correo:'correo', tipo_examen:'tipo_examen',
      lugar:'lugar', fecha:'fecha', observaciones:'observaciones', remisiones:'remisiones'
    };
    for (const [aiKey,key] of Object.entries(scalarMap)) {
      const aiValue = String(ai[aiKey] ?? '').trim(); if(!aiValue)continue;
      const localValue=String(local[key]??'').trim();
      if(!localValue){ out[key]=aiValue; continue; }

      // V10.3 · tipo de examen: el valor explícito del perfil conocido tiene
      // prioridad. La IA puede redactar "seguimiento laboral" mientras el PDF
      // dice "examen de seguimiento con restricciones"; eso es equivalencia,
      // no una discrepancia. Solo bloqueamos categorías realmente opuestas.
      if(key==='tipo_examen'){
        const comparison = SSTProfiles.compareExamTypes
          ? SSTProfiles.compareExamTypes(localValue, aiValue)
          : { equivalent:semanticSignature(localValue)===semanticSignature(aiValue), materialConflict:false };
        if(highProfile){
          out[key]=localValue;
          if(comparison.materialConflict) reviewFlags.push('discrepancia IA: tipo_examen');
        } else if(comparison.equivalent){
          out[key]=localValue;
        } else {
          out[key]=aiValue;
        }
        continue;
      }

      if(semanticSignature(localValue)===semanticSignature(aiValue)) { out[key]=key==='observaciones'?SSTProfiles.normalizeClinicalText(aiValue):aiValue; continue; }
      const narrative=['observaciones','remisiones','lugar'].includes(key);
      if(narrative){
        const l=semanticSignature(localValue), a=semanticSignature(aiValue);
        if(l.includes(a)||a.includes(l)) out[key]=a.length>l.length?aiValue:localValue;
        else if(highProfile) reviewFlags.push(`discrepancia IA: ${key}`);
        else out[key]=aiValue;
      } else if(highProfile) {
        reviewFlags.push(`discrepancia IA: ${key}`);
      } else out[key]=aiValue;
    }
    if (Array.isArray(ai.examenes_realizados) && ai.examenes_realizados.length) {
      const localExams=local.examenes_lista||[];
      out.examenes_lista=mergeDetailedTextLists([...(localExams||[]),...ai.examenes_realizados]);
      if(highProfile && localExams.length && ai.examenes_realizados.length && Math.abs(localExams.length-ai.examenes_realizados.length)>=2) reviewFlags.push('discrepancia IA: exámenes realizados');
    }
    const aiMap = aiMapToObject(ai);
    out.recomendaciones_por_examen = mergeRecommendationMaps(local.recomendaciones_por_examen || {}, aiMap);
    out.estado_por_examen = mergeExamStatuses(local.estado_por_examen || {}, ai.estados_por_examen || ai.estado_por_examen || {}, out.examenes_lista || []);
    out.recomendaciones_lista = Object.entries(out.recomendaciones_por_examen || {}).flatMap(([exam,recs]) =>
      (recs || []).map((rec) => exam === 'Recomendaciones generales' ? rec : `${exam}: ${rec}`));
    if (Array.isArray(ai.restricciones_laborales)) out.restricciones_lista = mergeRestrictions(local.restricciones_lista||[], ai.restricciones_laborales);
    else out.restricciones_lista=mergeRestrictions(local.restricciones_lista||[],[]);
    if (Array.isArray(ai.vigilancia_programa)) {
      out.vigilancia_lista = mergeDetailedTextLists([...(local.vigilancia_lista||[]),...ai.vigilancia_programa]);
      out.vigilancia_programa = out.vigilancia_lista.join(', ') || local.vigilancia_programa || 'Ninguno';
    }
    out.evidencias = ai.evidencias || out.evidencias || {};
    out.validado_ia = true;
    out.modo_validacion = `V10.3 · ${out.perfil_documental || 'formato detectado'} + auditoría visual IA + fusión semántica sin pérdida`;
    const missing = [];
    if (!String(out.nombre || '').trim()) missing.push('nombre');
    if (!String(out.cargo || '').trim()) missing.push('cargo');
    if (!(out.examenes_lista || []).length) missing.push('exámenes realizados');
    if (!(out.recomendaciones_lista || []).length && !(out.restricciones_lista || []).length) missing.push('recomendaciones/restricciones');
    // Un examen cuya celda derecha dice REALIZADO/NORMAL/NO APLICA es un caso resuelto,
    // no una recomendación faltante. Solo conserva la alerta general de Gemini cuando
    // persiste una incertidumbre verificable después de fusionar recomendaciones y estados.
    const unresolvedCoverage = unresolvedExamCoverage(out);
    if(ai.revision_requerida===true && (unresolvedCoverage.length || reviewFlags.some((x)=>String(x).includes('discrepancia')) || missing.length)) reviewFlags.push('auditoría IA solicita revisión');
    out.campos_revision = [...new Set([...reviewFlags,...missing].filter(Boolean))];
    out.calidad_extraccion = out.campos_revision.length ? 'Revisar' : 'Alta';
    return out;
  }

  async function ensureLegacyParserForFallback() {
    if (state.parserReady) return true;
    try {
      await SSTParser.init((msg,p) => updateProcessing('Activando respaldo clínico', msg, Math.min(.18, p*.18)));
      state.parserReady = true;
      return true;
    } catch (error) {
      console.warn('Parser legado no disponible:', error);
      return false;
    }
  }

  async function runBoundedPool(items, concurrency, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.max(1, Math.min(concurrency || 1, items.length)) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) break;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }

  async function processUploadedFileV10(file, index, total, context) {
    const { aiEnabled, aiReady, ocrEnabled, options, deferAi = false } = context;
    updateProcessing(`Procesando lote · ${index+1}/${total}`, `${file.name} · lectura estructural`, index/total);
    const buffer = await file.arrayBuffer();
    const hash = await SSTUtils.sha256Bytes(buffer.slice(0));
    const cached = state.documents.find((d) => d.hash === hash) || (await SSTDB.getByIndex(SSTDB.stores.documents, 'hash', hash))[0];
    const cacheVigente = cached && cached.pipelineVersion === APP_CONFIG.pipelineVersion && !options.force;
    if (cacheVigente) {
      if (!state.documents.some((d) => d.id === cached.id)) state.documents.unshift(cached);
      state.selectedBatchIds.add(cached.id);
      if (!deferAi && aiEnabled && aiReady && needsAutomaticAiAudit(cached)) {
        try { await runAutomaticAiAudit(cached, { buffer, sourceText:cached.text || '', title:`IA ${index+1}/${total}`, ratio:(index+.86)/total }); }
        catch (error) { console.warn('IA sobre caché:', error); }
      }
      return { reused:true, row:cached };
    }

    const staleId = cached?.id || null;
    if (staleId) {
      await SSTDB.delete(SSTDB.stores.outputs, staleId);
      state.outputs = state.outputs.filter((o) => o.id !== staleId);
    }

    const blob = new Blob([buffer], { type:'application/pdf' });
    let extraction = await SSTPdf.extract(blob, { ocrEnabled, onProgress: (p) => {
      const fractional = (index + ((p.page-1) + .45) / Math.max(1,p.total)) / total;
      updateProcessing(`Lectura ${index+1}/${total}`, `${file.name} · ${p.message}`, fractional);
    }});

    // V10: primero usa un motor determinístico especializado por formato. Pyodide queda como respaldo.
    let data = SSTProfiles.analyze(extraction.text);
    const profileConfidence = Number(data?.confianza_formato || 0);
    const requiresFallback = data?.perfil_detectado?.id === 'GENERICO' || profileConfidence < Number(APP_CONFIG.highConfidenceProfileThreshold || 92) || (data?.campos_revision || []).length >= 2;
    if (requiresFallback && await ensureLegacyParserForFallback()) {
      try {
        const legacy = await SSTParser.analyze(extraction.text);
        data = SSTProfiles.merge(data, legacy);
        data.modo_validacion = `${data.modo_validacion || 'Motor por formato V10'} + respaldo clínico`;
      } catch (error) { console.warn('Parser legado:', error); }
    }

    // OCR integral solo se usa cuando la estructura sigue incompleta; ya no se aplica indiscriminadamente.
    if (ocrEnabled && needsOcrRescue(data, extraction) && profileConfidence < 96) {
      try {
        updateProcessing(`OCR de rescate ${index+1}/${total}`, `${file.name} · solo por baja confianza`, (index+.67)/total);
        const ocrExtraction = await SSTPdf.extract(blob, { ocrEnabled:true, forceOcr:true, onProgress: (p) => {
          updateProcessing(`OCR ${index+1}/${total}`, `${file.name} · ${p.message}`, (index+.7)/total);
        }});
        let ocrData = SSTProfiles.analyze(ocrExtraction.text);
        if ((ocrData?.campos_revision || []).length >= 2 && await ensureLegacyParserForFallback()) {
          try { ocrData = SSTProfiles.merge(ocrData, await SSTParser.analyze(ocrExtraction.text)); } catch (_) {}
        }
        if (extractionScore(ocrData) > extractionScore(data) + 2 || Number(ocrData?.confianza_formato || 0) > profileConfidence) {
          extraction = ocrExtraction;
          data = ocrData;
          data.modo_validacion = `${data.modo_validacion || 'Motor por formato V10'} + OCR de rescate`;
        }
      } catch (error) { console.warn('OCR de rescate:', error); }
    }

    data.fecha = data.fecha || SSTUtils.todayIso();
    data.lugar = data.lugar || 'Tunja';
    let aiError = '';
    if (!deferAi && aiEnabled && aiReady && file.size <= APP_CONFIG.maxGeminiPdfMb*1024*1024) {
      try {
        updateProcessing(`Auditoría IA ${index+1}/${total}`, `${file.name} · ${data.perfil_documental || 'formato detectado'}`, (index+.82)/total);
        const aiData = await SSTBackend.call('geminiAnalyze', {
          fileName:file.name,
          pdfBase64:SSTUtils.arrayBufferToBase64(buffer),
          text:extraction.text.slice(0,50000),
          localData:data,
          profileId:data?.perfil_detectado?.id || '',
          profileConfidence:Number(data?.confianza_formato || 0),
          model:await SSTDB.getSetting('geminiModel', APP_CONFIG.defaultGeminiModel)
        }, { timeout:195000 });
        data = fuseAiV10(data, aiData);
      } catch (error) {
        aiError = error.message;
        console.warn('Gemini:', error);
        data.modo_validacion = `${data.modo_validacion || 'Motor por formato V10'} · IA pendiente`;
      }
    } else if (aiEnabled && file.size > APP_CONFIG.maxGeminiPdfMb*1024*1024) {
      aiError = `PDF mayor a ${APP_CONFIG.maxGeminiPdfMb} MB; no puede enviarse a la validación IA.`;
    } else if (aiEnabled && !aiReady) {
      aiError = state.aiStatus?.detail || 'Gemini pendiente de autorización.';
    }

    const now = new Date().toISOString();
    const aiWasValidated = !deferAi && !aiError && aiEnabled && aiReady && file.size <= APP_CONFIG.maxGeminiPdfMb*1024*1024;
    const row = {
      id:staleId || crypto.randomUUID(), hash, fileName:file.name, size:file.size, type:'application/pdf', blob,
      text:extraction.text, pageCount:extraction.pageCount, usedOcr:extraction.usedOcr,
      layoutStats:extraction.layoutStats || {}, aiError, data,
      pipelineVersion:APP_CONFIG.pipelineVersion,
      aiValidationStatus: aiWasValidated ? 'validated' : (file.size > APP_CONFIG.maxGeminiPdfMb*1024*1024 ? 'skipped_size' : (!aiReady ? 'pending_auth' : (aiError ? 'error' : 'pending'))),
      aiValidationVersion: aiWasValidated ? APP_CONFIG.aiValidationVersion : '',
      aiValidatedAt: aiWasValidated ? now : '', aiLastAttemptAt: aiError ? now : '',
      dirty:false, createdAt:cached?.createdAt || now, updatedAt:now
    };
    await SSTDB.put(SSTDB.stores.documents, row);
    const oldIndex = state.documents.findIndex((d) => d.id === row.id);
    if (oldIndex >= 0) state.documents.splice(oldIndex,1);
    state.documents.unshift(row);
    state.selectedBatchIds.add(row.id);
    return { reused:false, row };
  }

  async function handleFiles(fileList, options = {}) {
    let files = [...fileList].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) return toast('Selecciona archivos PDF', 'No se encontraron certificados compatibles.', 'warn');
    if (files.length > Number(APP_CONFIG.maxBatchFiles || 50)) {
      toast('Lote limitado', `Se procesarán los primeros ${APP_CONFIG.maxBatchFiles || 50} PDF. Divide lotes mayores para conservar estabilidad y trazabilidad.`, 'warn', 9000);
      files = files.slice(0, Number(APP_CONFIG.maxBatchFiles || 50));
    }
    $('processingBanner').classList.remove('hidden');
    const failures = [];
    let completed = 0;
    try {
      const aiEnabled = true;
      const ocrEnabled = await SSTDB.getSetting('ocrEnabled', true);
      const aiReady = await ensureAiReady({ notify:false });
      if (!aiReady) toast('IA pendiente', state.aiStatus?.detail || 'El motor especializado seguirá extrayendo; la generación quedará bloqueada hasta completar la auditoría IA.', 'warn', 8500);
      const concurrency = Math.max(1, Number(APP_CONFIG.localConcurrency || 3));
      updateProcessing('Preparando lote', `${files.length} PDF · ${concurrency} procesos simultáneos`, .02);

      // Fase 1: lectura local de TODO el lote. La latencia de la API no bloquea PDF.js/OCR/perfiles.
      const localResults = await runBoundedPool(files, concurrency, async (file,index) => {
        try {
          const result = await processUploadedFileV10(file, index, files.length, { aiEnabled, aiReady, ocrEnabled, options, deferAi:true });
          completed += 1;
          updateProcessing(`Lectura local ${completed}/${files.length}`, `${result?.row?.data?.nombre || file.name} · estructura lista`, .55 * (completed/files.length));
          return result;
        } catch (error) {
          console.error(`Error procesando ${file.name}:`, error);
          failures.push({ file:file.name, message:error?.message || String(error) });
          completed += 1;
          updateProcessing(`Lectura local ${completed}/${files.length}`, `${file.name} · error; se continúa`, .55 * (completed/files.length));
          return null;
        }
      });

      // Fase 2: auditoría visual en una cola independiente y limitada. Esto mejora el
      // rendimiento de lotes de 20–50 PDF y evita que una respuesta lenta congele la extracción.
      const rowsForAi = localResults.map((x) => x?.row).filter(Boolean).filter((doc) => needsAutomaticAiAudit(doc));
      if (aiReady && rowsForAi.length) {
        let aiDone = 0;
        const aiConcurrency = Math.max(1, Number(APP_CONFIG.aiConcurrency || 3));
        updateProcessing('Auditoría IA por lotes', `${rowsForAi.length} PDF · ${aiConcurrency} auditorías simultáneas`, .57);
        await runBoundedPool(rowsForAi, aiConcurrency, async (doc) => {
          try {
            const buffer = await doc.blob.arrayBuffer();
            await runAutomaticAiAudit(doc, {
              buffer, sourceText:doc.text || '',
              title:`Auditoría IA ${aiDone+1}/${rowsForAi.length}`,
              ratio:.57 + .40 * ((aiDone+1)/rowsForAi.length)
            });
          } catch (error) {
            console.warn(`Auditoría IA ${doc.fileName}:`, error);
            failures.push({ file:doc.fileName, message:`IA: ${error?.message || String(error)}` });
          } finally {
            aiDone += 1;
            updateProcessing(`Auditoría IA ${aiDone}/${rowsForAi.length}`, `${doc.data?.nombre || doc.fileName}`, .57 + .40 * (aiDone/rowsForAi.length));
          }
        });
      }

      const processedDocs = localResults.map((x) => x?.row).filter(Boolean);
      if (state.backendOnline && !state.localMode && processedDocs.length) {
        try {
          const sync = await syncDocumentsToBackend(processedDocs, { silent:true });
          updateProcessing('Sincronización con Sheets', `${sync.saved} certificado(s) guardados en DocumentosProcesados`, .985);
        } catch (error) {
          processedDocs.forEach((doc) => { doc.remoteSyncStatus='error'; doc.remoteSyncError=error.message; });
          failures.push({ file:'Google Sheets', message:error.message });
        }
      }

      state.documents.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      state.selectedDocId = state.documents[0]?.id || state.selectedDocId;
      state.selectedOriginalId = state.documents[0]?.id || state.selectedOriginalId;
      await renderAll();
      showView('documents');
      if (failures.length) {
        toast('Lote procesado con novedades', `${files.length-failures.length} archivo(s) correctos; ${failures.length} con error. ${failures.slice(0,2).map((x)=>`${x.file}: ${x.message}`).join(' | ')}`, 'warn', 12000);
      } else {
        toast('Lote completado', `${files.length} PDF procesados con motores especializados y auditoría IA.`, 'success', 6500);
      }
    } catch (error) {
      console.error(error);
      toast('No fue posible iniciar el procesamiento', error.message, 'error', 8000);
    } finally {
      setTimeout(() => $('processingBanner').classList.add('hidden'), 500);
    }
  }

  function updateProcessing(title, detail, ratio) { $('processingTitle').textContent = title; $('processingDetail').textContent = detail; $('processingProgress').style.width = `${Math.round(Math.max(0,Math.min(1,ratio))*100)}%`; }

  async function deleteDocumentById(id, options = {}) {
    const doc = state.documents.find((d) => d.id === id);
    if (!doc) return;
    if (!options.skipConfirm && !confirm(`¿Eliminar "${doc.fileName}"?\n\nSe borrarán el PDF cargado, su extracción y la salida generada de ESTE navegador. No se libera ni reutiliza un consecutivo que ya haya sido asignado en el backend.`)) return;
    await SSTDB.delete(SSTDB.stores.documents, id);
    await SSTDB.delete(SSTDB.stores.outputs, id);
    state.documents = state.documents.filter((d) => d.id !== id);
    state.outputs = state.outputs.filter((o) => o.id !== id && o.documentId !== id);
    state.selectedBatchIds.delete(id);
    if (state.selectedDocId === id) state.selectedDocId = state.documents[0]?.id || null;
    if (state.selectedOriginalId === id) { state.selectedOriginalId = state.documents[0]?.id || null; state.originalPage = 1; }
    if (state.selectedOutputId === id) state.selectedOutputId = state.outputs[0]?.id || null;
    await renderAll();
    if (!options.silent) toast('Archivo eliminado', `${doc.fileName} ya no participa en el lote ni en la caché.`, 'success');
  }

  async function clearLoadedDocuments() {
    if (!state.documents.length && !state.outputs.length) return toast('Sin archivos', 'No hay documentos cargados para eliminar.', 'warn');
    if (!confirm(`¿Eliminar los ${state.documents.length} archivo(s) cargados?\n\nEsto limpia PDFs, extracciones y documentos generados de ESTE navegador. Se conservan usuario, configuración, plantilla, firma e historial de correos.`)) return;
    await SSTDB.clear(SSTDB.stores.documents);
    await SSTDB.clear(SSTDB.stores.outputs);
    state.documents = [];
    state.outputs = [];
    state.selectedDocId = null;
    state.selectedOriginalId = null;
    state.selectedOutputId = null;
    state.selectedBatchIds.clear();
    state.originalPage = 1;
    state.lastCacheStats = { generated:0, reused:0 };
    await renderAll();
    toast('Lote limpiado', 'Los archivos cargados y sus extracciones fueron eliminados. Puedes iniciar un lote limpio.', 'success', 6500);
  }

  async function validateSelectedWithAi() {
    syncEditorToState();
    const doc = selectedDocument();
    if (!doc?.blob) return toast('Sin PDF', 'Selecciona un certificado para validar con IA.', 'warn');
    if (!state.backendOnline || state.localMode) return toast('Backend requerido', 'Conecta Google Apps Script para usar la auditoría visual con IA.', 'warn');
    if (doc.size > APP_CONFIG.maxGeminiPdfMb * 1024 * 1024) return toast('PDF demasiado grande', `La validación visual admite hasta ${APP_CONFIG.maxGeminiPdfMb} MB.`, 'warn');
    try {
      $('processingBanner').classList.remove('hidden');
      updateProcessing('Auditoría visual con IA', `${doc.fileName} · relectura completa del PDF`, .18);
      if (!state.parserReady) { await SSTParser.init((msg,p) => updateProcessing('Preparando motor clínico', msg, p*.15)); state.parserReady = true; }
      let sourceText = doc.text || '';
      if (!sourceText) {
        const extraction = await SSTPdf.extract(doc.blob, { ocrEnabled:true, onProgress:(p) => updateProcessing('Reconstruyendo documento', `${doc.fileName} · ${p.message}`, .18 + .28*((p.page||1)/Math.max(1,p.total||1))) });
        sourceText = extraction.text;
        doc.text = sourceText;
        doc.pageCount = extraction.pageCount;
        doc.usedOcr = extraction.usedOcr;
      }
      const buffer = await doc.blob.arrayBuffer();
      updateProcessing('Auditoría visual con IA', `${doc.fileName} · comprobando tablas, remisiones, PVE y observaciones`, .62);
      const aiData = await SSTBackend.call('geminiAnalyze', {
        fileName:doc.fileName,
        pdfBase64:SSTUtils.arrayBufferToBase64(buffer),
        text:sourceText.slice(0,50000),
        localData:doc.data,
        profileId:doc.data?.perfil_detectado?.id || '',
        profileConfidence:Number(doc.data?.confianza_formato || 0),
        model:await SSTDB.getSetting('geminiModel', APP_CONFIG.defaultGeminiModel)
      }, { timeout:195000 });
      doc.data = fuseAiV10(doc.data, aiData);
      doc.data.validado_ia = true;
      doc.aiError = '';
      doc.aiValidationStatus = 'validated';
      doc.aiValidationVersion = APP_CONFIG.aiValidationVersion;
      doc.aiValidatedAt = new Date().toISOString();
      doc.pipelineVersion = APP_CONFIG.pipelineVersion;
      doc.updatedAt = doc.aiValidatedAt;
      doc.dirty = state.outputs.some((o) => o.id === doc.id || o.documentId === doc.id);
      await SSTDB.put(SSTDB.stores.documents, doc);
      try { await syncDocumentsToBackend([doc], { silent:true }); } catch (syncError) { doc.remoteSyncStatus='error'; doc.remoteSyncError=syncError.message; await SSTDB.put(SSTDB.stores.documents, doc); }
      updateProcessing('Auditoría completada', `${doc.data?.modo_validacion || 'IA + motor clínico'} · calidad ${doc.data?.calidad_extraccion || '—'}`, 1);
      await renderAll();
      toast('Validación IA completada', `${doc.data?.nombre || doc.fileName} · ${(doc.data?.campos_revision || []).length ? 'quedan campos por revisar' : 'sin alertas estructurales'}.`, (doc.data?.campos_revision || []).length ? 'warn' : 'success', 7500);
    } catch (error) {
      doc.aiError = error.message;
      doc.aiValidationStatus = 'error';
      doc.aiValidationVersion = APP_CONFIG.aiValidationVersion;
      doc.aiLastAttemptAt = new Date().toISOString();
      doc.updatedAt = doc.aiLastAttemptAt;
      await SSTDB.put(SSTDB.stores.documents, doc);
      renderDocumentList(); renderEditor();
      toast('La IA no pudo validar', error.message, 'error', 9000);
    } finally {
      setTimeout(() => $('processingBanner').classList.add('hidden'), 500);
    }
  }

  async function reanalyzeSelected() {
    const doc = selectedDocument();
    if (!doc?.blob) return toast('Sin PDF', 'Selecciona un certificado para reanalizar.', 'warn');
    try {
      const file = new File([doc.blob], doc.fileName || 'certificado.pdf', { type:'application/pdf' });
      await handleFiles([file], { force:true });
    } catch (error) { toast('No se pudo reanalizar', error.message, 'error', 8000); }
  }

  async function generateSelected() {
    syncEditorToState(); const doc = selectedDocument(); if (!doc) return;
    const missing = validateForGeneration(doc); if (missing.length) return toast('Revisión incompleta', `Resuelve: ${missing.join(', ')}.`, 'warn', 6500);
    try {
      updateProcessing('Generando documento', doc.data.nombre || doc.fileName, .35); $('processingBanner').classList.remove('hidden');
      const { output, reused } = await SSTGenerator.generate(doc); doc.dirty = false; await SSTDB.put(SSTDB.stores.documents, doc); try { await syncDocumentsToBackend([doc], { silent:true }); } catch (syncError) { doc.remoteSyncStatus='error'; doc.remoteSyncError=syncError.message; await SSTDB.put(SSTDB.stores.documents, doc); }
      const idx = state.outputs.findIndex((x) => x.id === output.id); if (idx >= 0) state.outputs[idx] = output; else state.outputs.unshift(output); state.selectedOutputId = output.id;
      state.lastCacheStats = { generated: reused ? 0 : 1, reused: reused ? 1 : 0 };
      await renderAll(); showView('generated'); toast(reused ? 'Vista reutilizada' : 'Documento generado', reused ? 'No hubo cambios; se conservó la salida existente.' : output.filename, 'success');
    } catch (error) { console.error(error); toast('Error al generar', error.message, 'error', 7000); }
    finally { $('processingBanner').classList.add('hidden'); }
  }

  function selectedBatchDocuments() {
    return state.documents.filter((d) => state.selectedBatchIds.has(d.id));
  }

  async function generateDocumentsBatch(documents, label = 'lote') {
    if (!documents.length) return toast('Sin selección', 'Selecciona al menos un certificado.', 'warn');
    const invalid = documents.filter((d) => validateForGeneration(d).length);
    if (invalid.length) {
      const first = invalid[0];
      const detail = invalid.slice(0,4).map((d) => `${d.data?.nombre || d.fileName}: ${validateForGeneration(d).join(', ')}`).join(' | ');
      state.selectedDocId = first.id; renderDocumentList(); renderEditor();
      return toast('Lote pendiente de validación', detail, 'warn', 9500);
    }
    try {
      $('processingBanner').classList.remove('hidden');
      const result = await SSTGenerator.generateAll(documents, null, (done,total,doc,status) => updateProcessing(`Generando ${label} · ${done}/${total}`, `${doc.data?.nombre || doc.fileName}${status==='reused'?' · sin reproceso':''}`, total ? done/total : 0));
      state.outputs = (await SSTDB.getAll(SSTDB.stores.outputs)).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      for (const doc of documents) { doc.dirty = false; await SSTDB.put(SSTDB.stores.documents, doc); }
      try { await syncDocumentsToBackend(documents, { silent:true }); } catch (syncError) { console.warn('Sincronización del lote:', syncError); }
      state.lastCacheStats = { generated: result.generated, reused: result.reused };
      if (result.outputs?.[0]) state.selectedOutputId = result.outputs[0].id;
      await renderAll(); showView('generated');
      toast('Vista previa lista', `${result.generated} generado(s) · ${result.reused} reutilizado(s) sin reproceso.`, 'success', 7000);
    } catch (error) { console.error(error); toast('No fue posible completar la vista previa', error.message, 'error', 9000); }
    finally { $('processingBanner').classList.add('hidden'); }
  }

  async function generateSelectedBatch() {
    return generateDocumentsBatch(selectedBatchDocuments(), 'selección');
  }

  async function generateAll() {
    if (!state.documents.length) return toast('No hay documentos', 'Carga certificados antes de generar el lote.', 'warn');
    return generateDocumentsBatch(state.documents, 'todo el lote');
  }

  function renderOriginalPreviewPage() {
    const doc = state.documents.find((d) => d.id === state.selectedOriginalId);
    if (!doc || !isViewActive('originals')) return;
    const canvas = $('originalCanvas');
    const stage = canvas.parentElement;
    const sequence = ++originalRenderSequence;
    requestAnimationFrame(async () => {
      try {
        const result = await SSTPdf.renderPage(doc.blob, state.originalPage, canvas, { container:stage });
        if (sequence !== originalRenderSequence) return;
        $('originalViewerMeta').textContent = `${doc.fileName} · Ajustado al ancho`;
        if (result?.pageCount && result.pageCount !== doc.pageCount) {
          doc.pageCount = result.pageCount;
          $('originalPageLabel').textContent = `${state.originalPage} / ${result.pageCount}`;
        }
      } catch (e) {
        if (sequence === originalRenderSequence) toast('No se pudo renderizar el PDF', e.message, 'error');
      }
    });
  }

  function scheduleOriginalPreviewRefit() {
    clearTimeout(originalResizeTimer);
    originalResizeTimer = setTimeout(() => renderOriginalPreviewPage(), 120);
  }

  function renderOriginals() {
    $('originalList').innerHTML = state.documents.length ? state.documents.map((d) => `<div class="document-item ${d.id===state.selectedOriginalId?'active':''}" data-original-id="${d.id}"><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || d.fileName)}</strong><small>${d.pageCount || '—'} página(s) · ${SSTUtils.bytesLabel(d.size)}</small><em>${d.usedOcr?'OCR utilizado':'Texto PDF'}</em></div><button class="item-delete" type="button" data-delete-doc="${d.id}" title="Eliminar este archivo">×</button></div>`).join('') : '<div class="empty-state compact"><span>◫</span><strong>Sin PDF originales</strong></div>';
    const doc = state.documents.find((d) => d.id === state.selectedOriginalId);
    if (!doc) { originalRenderSequence++; $('originalViewerTitle').textContent='Selecciona un PDF'; $('originalViewerMeta').textContent='—'; $('originalPageLabel').textContent='0 / 0'; $('originalCanvas').style.display='none'; $('originalEmpty').classList.remove('hidden'); return; }
    $('originalViewerTitle').textContent = doc.data?.nombre || doc.fileName; $('originalViewerMeta').textContent = `${doc.fileName} · Ajustando…`; $('originalPageLabel').textContent = `${state.originalPage} / ${doc.pageCount || 1}`; $('originalEmpty').classList.add('hidden'); $('originalCanvas').style.display='block';
    renderOriginalPreviewPage();
  }

  function renderGenerated() {
    $('generatedCount').textContent = state.outputs.length;
    $('generatedList').innerHTML = state.outputs.length ? state.outputs.map((o) => { const doc = state.documents.find((d)=>d.id===o.id); return `<div class="document-item ${o.id===state.selectedOutputId?'active':''}" data-output-id="${o.id}"><div class="doc-icon">${o.format==='Word'?'DOC':'OUT'}</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(o.personName || o.filename)}</strong><small>${SSTUtils.escapeHtml(o.filename)}</small><em>${doc?.dirty?'Desactualizado por edición':`Consecutivo ${SSTUtils.escapeHtml(o.consecutive || '—')} · ${SSTUtils.escapeHtml(o.templateName || 'Plantilla institucional')}`}</em></div><span class="mini-status ${doc?.dirty?'warn':'ai'}"></span></div>`; }).join('') : '<div class="empty-state compact"><span>⇩</span><strong>No hay documentos generados</strong></div>';
    const out = selectedOutput(); const preview = $('generatedPreview');
    if (!out) { $('generatedViewerTitle').textContent='Selecciona un documento'; $('generatedViewerMeta').textContent='—'; preview.innerHTML='<div class="empty-state tall"><span>⇩</span><strong>Aún no hay vista previa</strong><p>Genera un documento desde la sección Documentos.</p></div>'; return; }
    $('generatedViewerTitle').textContent = out.personName || out.filename; $('generatedViewerMeta').textContent = `${out.format} · ${out.consecutive || '—'} · ${out.templateName || 'Plantilla institucional'}`;
    if (out.format === 'PDF') { preview.innerHTML=''; if (isViewActive('generated')) requestAnimationFrame(() => SSTPdf.renderAll(out.blob, preview).catch((e) => { preview.innerHTML=`<iframe title="Vista previa" srcdoc="${SSTUtils.escapeHtml(out.previewHtml)}"></iframe>`; console.warn(e); })); else preview.innerHTML='<div class="empty-state tall"><span>⇩</span><strong>PDF listo</strong><p>Abre esta sección para renderizar la vista previa.</p></div>'; }
    else { preview.innerHTML=''; const iframe=document.createElement('iframe'); iframe.title='Vista previa'; iframe.srcdoc=out.previewHtml; preview.appendChild(iframe); }
  }

  function emailFormats() {
    return state.emailFormat === 'Ambos' ? ['PDF','Word'] : [state.emailFormat === 'Word' ? 'Word' : 'PDF'];
  }

  function emailTemplateContext(items = []) {
    const names = items.map((x) => x.doc?.data?.nombre || x.output?.personName || x.doc?.fileName || '').filter(Boolean);
    if (state.emailMode === 'common') {
      return {
        nombre: items.length === 1 ? (names[0] || 'el colaborador') : `${items.length} documentos seleccionados`,
        identificacion: items.length === 1 ? String(items[0]?.doc?.data?.identificacion || '') : '',
        cantidad: String(items.length),
        nombres: names.join(', '),
        fecha: SSTUtils.formatDateEs(SSTUtils.todayIso())
      };
    }
    return items[0]?.doc?.data || {};
  }

  function applyEmailTemplate(text, data) {
    let source = String(text || '');
    if (state.emailMode === 'common') {
      if (source === String(APP_CONFIG.emailSubject || '')) source = String(APP_CONFIG.emailBulkSubject || source);
      if (source === String(APP_CONFIG.emailBody || '')) source = String(APP_CONFIG.emailBulkBody || source);
    }
    const base = SSTUtils.template(source, data || {});
    return String(base)
      .replaceAll('{cantidad}', String(data?.cantidad ?? ''))
      .replaceAll('{nombres}', String(data?.nombres ?? ''))
      .replaceAll('{fecha}', String(data?.fecha ?? SSTUtils.formatDateEs(SSTUtils.todayIso())));
  }

  function ensureEmailTemplateForMode() {
    const subject = $('emailSubject').value;
    const body = $('emailBody').value;
    if (state.emailMode === 'common') {
      if (subject === String(APP_CONFIG.emailSubject || '')) $('emailSubject').value = String(APP_CONFIG.emailBulkSubject || subject);
      if (body === String(APP_CONFIG.emailBody || '')) $('emailBody').value = String(APP_CONFIG.emailBulkBody || body);
    } else {
      if (subject === String(APP_CONFIG.emailBulkSubject || '')) $('emailSubject').value = String(APP_CONFIG.emailSubject || subject);
      if (body === String(APP_CONFIG.emailBulkBody || '')) $('emailBody').value = String(APP_CONFIG.emailBody || body);
    }
  }

  function syncEmailModeUi() {
    qsa('[data-email-mode]').forEach((b) => b.classList.toggle('active', b.dataset.emailMode === state.emailMode));
    qsa('[data-email-format]').forEach((b) => b.classList.toggle('active', b.dataset.emailFormat === state.emailFormat));
    $('emailCommonToWrap').classList.toggle('hidden', state.emailMode !== 'common');
    qsa('.recipient-row').forEach((row) => row.classList.toggle('common-mode', state.emailMode === 'common'));
    $('emailAttachmentSummary').textContent = `${state.emailFormat} · ${state.emailMode === 'common' ? 'destinatario único' : 'envío individual'}`;
  }

  function renderEmail() {
    ensureEmailTemplateForMode();
    const generatedDocs = state.outputs.map((o) => ({ o, d: state.documents.find((d) => d.id === o.id) })).filter((x) => x.d);
    const validIds = new Set(generatedDocs.map((x) => x.o.id));
    state.selectedEmailIds = new Set([...state.selectedEmailIds].filter((id) => validIds.has(id)));
    $('emailRecipients').innerHTML = generatedDocs.length ? generatedDocs.map(({o,d}) => `<label class="recipient-row ${state.emailMode==='common'?'common-mode':''}"><input type="checkbox" class="email-select" data-email-id="${o.id}" ${state.selectedEmailIds.has(o.id)?'checked':''}><div class="recipient-fields"><div><strong>${SSTUtils.escapeHtml(d.data?.nombre || o.personName)}</strong><small>${SSTUtils.escapeHtml(d.fileName || o.sourceName || o.filename)}</small><span class="recipient-file-format">${SSTUtils.escapeHtml(state.emailFormat)}</span></div><input class="email-to" data-email-to="${o.id}" type="email" value="${SSTUtils.escapeHtml(d.data?.correo || '')}" placeholder="correo@empresa.com"></div></label>`).join('') : '<div class="empty-state compact"><span>✉</span><strong>No hay documentos generados</strong></div>';
    syncEmailModeUi();
    updateEmailPreview();
  }

  function selectedEmailItems() {
    return [...state.selectedEmailIds].map((id) => {
      const output=state.outputs.find((o)=>o.id===id), doc=state.documents.find((d)=>d.id===id); const input=document.querySelector(`[data-email-to="${CSS.escape(id)}"]`);
      return output&&doc ? { output, doc, to:input?.value.trim().toLowerCase() || String(doc.data?.correo || '').trim().toLowerCase() } : null;
    }).filter(Boolean);
  }

  function updateEmailPreview() {
    const items = selectedEmailItems();
    $('emailSelectionCount').textContent = `${items.length} seleccionado${items.length===1?'':'s'}`;
    $('btnSelectAllEmail').textContent = state.outputs.length && items.length === state.outputs.length ? 'Quitar selección' : 'Seleccionar todos';
    syncEmailModeUi();
    const formats = emailFormats();
    if (!items.length) {
      $('emailPreviewCards').innerHTML = '<div class="empty-state compact"><span>✉</span><strong>Selecciona los documentos que deseas enviar</strong></div>';
      return;
    }
    if (state.emailMode === 'common') {
      const to = $('emailCommonTo').value.trim().toLowerCase();
      const ctx = emailTemplateContext(items);
      const names = items.slice(0,8).map(({doc}) => `<li>${SSTUtils.escapeHtml(doc.data?.nombre || doc.fileName)} · ${formats.join(' + ')}</li>`).join('');
      const more = items.length > 8 ? `<li>+ ${items.length-8} documento(s) adicional(es)</li>` : '';
      $('emailPreviewCards').innerHTML = `<div class="email-preview-card common"><strong>${SSTUtils.escapeHtml(to || 'Destinatario común pendiente')} · ${items.length} documento(s)</strong><small>${SSTUtils.escapeHtml(applyEmailTemplate($('emailSubject').value,ctx))}</small><span class="attachment-line">${formats.length * items.length} adjunto(s) previstos · ${SSTUtils.escapeHtml(formats.join(' + '))}</span><ul class="email-preview-list">${names}${more}</ul></div>`;
      return;
    }
    $('emailPreviewCards').innerHTML = items.map(({doc,output,to}) => `<div class="email-preview-card"><strong>${SSTUtils.escapeHtml(doc.data?.nombre || output.personName)} · ${SSTUtils.escapeHtml(to || 'Sin correo')}</strong><small>${SSTUtils.escapeHtml(applyEmailTemplate($('emailSubject').value,doc.data))}</small><span class="attachment-line">${SSTUtils.escapeHtml(formats.join(' + '))}</span></div>`).join('');
  }

  async function buildEmailAttachments(items, formats) {
    const result = [];
    for (let i=0; i<items.length; i++) {
      const {doc} = items[i];
      for (const format of formats) {
        $('btnSendEmails').textContent = `Preparando ${i+1}/${items.length} · ${format}…`;
        const generated = await SSTGenerator.generateForEmail(doc, format);
        const output = generated.output;
        result.push({ doc, output, size:Number(output.blob?.size || 0) });
      }
    }
    return result;
  }

  function groupEmailAttachments(attachments, maxBytes) {
    const groups=[]; let current=[], size=0;
    for (const item of attachments) {
      if (item.size > maxBytes) throw new Error(`${item.output.filename} supera el tamaño seguro permitido para correo.`);
      if (current.length && size + item.size > maxBytes) { groups.push(current); current=[]; size=0; }
      current.push(item); size += item.size;
    }
    if (current.length) groups.push(current);
    return groups;
  }

  async function serializeAttachments(items) {
    const out=[];
    for (const item of items) {
      const buffer=await item.output.blob.arrayBuffer();
      out.push({filename:item.output.filename,mime:item.output.mime,base64:SSTUtils.arrayBufferToBase64(buffer)});
    }
    return out;
  }

  function correspondenceRecord(doc, recipient, formats, attachments = []) {
    return {
      documentKey:String(doc?.hash || doc?.id || ''),
      consecutive:String(doc?.data?.consecutivo || ''),
      worker:String(doc?.data?.nombre || ''),
      identification:String(doc?.data?.identificacion || ''),
      date:String(doc?.data?.fecha || ''),
      role:String(doc?.data?.cargo || ''),
      exam:String(doc?.data?.tipo_examen || ''),
      sourceFile:String(doc?.fileName || ''),
      recipient:String(recipient || ''),
      formats:Array.isArray(formats) ? formats : [String(formats || '')].filter(Boolean),
      attachments:Array.isArray(attachments) ? attachments : []
    };
  }

  async function sendEmails() {
    if (!state.backendOnline || state.localMode) return toast('Backend requerido', 'Configura Google Apps Script para enviar correos.', 'warn');
    if (!backendVersionCompatible()) return toast('Apps Script desactualizado', `${backendVersionLabel()}. Actualiza Code.gs antes de usar el nuevo módulo de correo.`, 'error', 9000);
    const items = selectedEmailItems(); if (!items.length) return toast('Selecciona archivos', 'Marca al menos un documento para enviar.', 'warn');
    if (!$('emailConfirm').checked) return toast('Falta confirmación', 'Marca la casilla de revisión antes de enviar.', 'warn');
    const cc=SSTUtils.parseEmails($('emailCc').value), bcc=SSTUtils.parseEmails($('emailBcc').value); const invalidCopies=[...cc,...bcc].filter((x)=>!SSTUtils.validEmail(x));
    if (invalidCopies.length) return toast('Revisa CC/CCO', invalidCopies.join(', '), 'warn');
    const commonTo=$('emailCommonTo').value.trim().toLowerCase();
    if (state.emailMode === 'common' && !SSTUtils.validEmail(commonTo)) return toast('Destinatario común inválido','Escribe el correo de la persona que recibirá todos los archivos.','warn');
    if (state.emailMode === 'individual') {
      const invalid=items.filter((x)=>!SSTUtils.validEmail(x.to)); if (invalid.length) return toast('Correos inválidos', invalid.map((x)=>x.doc.data?.nombre || x.doc.fileName).join(', '), 'warn');
    }
    const subjectTpl=$('emailSubject').value.trim(), bodyTpl=$('emailBody').value.trim(); if (!subjectTpl||!bodyTpl) return toast('Mensaje incompleto','El asunto y el cuerpo no pueden estar vacíos.','warn');
    const formats=emailFormats();
    $('btnSendEmails').disabled=true; let ok=0; const errors=[];
    try {
      const attachments = await buildEmailAttachments(items, formats);
      if (state.emailMode === 'common') {
        const maxBytes = Math.max(1, Number(APP_CONFIG.maxEmailRawBatchMb || 14)) * 1024 * 1024;
        const groups = groupEmailAttachments(attachments, maxBytes);
        const ctx = emailTemplateContext(items);
        for (let i=0;i<groups.length;i++) {
          $('btnSendEmails').textContent=`Enviando paquete ${i+1} de ${groups.length}…`;
          try {
            const list = await serializeAttachments(groups[i]);
            const subjectBase=applyEmailTemplate(subjectTpl,ctx);
            const subject=groups.length>1 ? `${subjectBase} · paquete ${i+1}/${groups.length}` : subjectBase;
            const groupDocs=[...new Map(groups[i].map((a)=>[a.doc.id,a.doc])).values()];
            const records=groupDocs.map((doc)=>correspondenceRecord(doc,commonTo,[...new Set(groups[i].filter((a)=>a.doc.id===doc.id).map((a)=>a.output.format))],groups[i].filter((a)=>a.doc.id===doc.id).map((a)=>a.output.filename)));
            const response=await SSTBackend.call('sendEmail',{to:commonTo,cc,bcc,subject,body:applyEmailTemplate(bodyTpl,ctx),attachments:list,formats:formats.join(' + '),records,sourceFile:groupDocs.map((d)=>d.fileName).join(' | '),personName:groupDocs.length===1?(groupDocs[0].data?.nombre||''):`${groupDocs.length} documentos seleccionados`},{timeout:150000});
            ok++; if (response?.history) state.emailHistory.unshift(response.history); if (response?.correspondence?.ok===false) errors.push(`Paquete ${i+1}: correo enviado, pero no se actualizó CORRESPONDENCIA ENVIADA SST 2026 / Hoja 1: ${response.correspondence.error}`);
          } catch (error) { errors.push(`Paquete ${i+1}: ${error.message}`); }
        }
      } else {
        const byDoc = new Map();
        for (const attachment of attachments) (byDoc.get(attachment.doc.id) || (byDoc.set(attachment.doc.id,[]), byDoc.get(attachment.doc.id))).push(attachment);
        for (let i=0;i<items.length;i++) {
          const {doc,to}=items[i]; $('btnSendEmails').textContent=`Enviando ${i+1} de ${items.length}…`;
          try {
            const list=await serializeAttachments(byDoc.get(doc.id) || []);
            const records=[correspondenceRecord(doc,to,formats,list.map((a)=>a.filename))];
            const response=await SSTBackend.call('sendEmail',{to,cc,bcc,subject:applyEmailTemplate(subjectTpl,doc.data),body:applyEmailTemplate(bodyTpl,doc.data),attachments:list,formats:formats.join(' + '),records,sourceFile:doc.fileName,personName:doc.data?.nombre || ''},{timeout:120000});
            ok++; if (response?.history) state.emailHistory.unshift(response.history); if (response?.correspondence?.ok===false) errors.push(`${doc.data?.nombre || doc.fileName}: correo enviado, pero no se actualizó CORRESPONDENCIA ENVIADA SST 2026 / Hoja 1: ${response.correspondence.error}`);
          } catch (error) { errors.push(`${doc.data?.nombre || doc.fileName}: ${error.message}`); }
        }
      }
      await SSTDB.setSetting('emailSubject', subjectTpl); await SSTDB.setSetting('emailBody', bodyTpl); await SSTDB.setSetting('emailMode', state.emailMode); await SSTDB.setSetting('emailAttachmentFormat', state.emailFormat); await SSTDB.setSetting('emailCommonTo', commonTo);
      renderDashboard(); renderControlTable(); $('emailConfirm').checked=false;
      if (ok) toast('Envío completado', state.emailMode==='common' ? `${ok} paquete(s) enviados a ${commonTo}.` : `${ok} de ${items.length} correo(s) enviados.`, 'success', 7000); if (errors.length) toast('Algunos correos fallaron', errors.join(' | '), 'error', 10000);
    } catch (error) {
      console.error(error); toast('No se pudo preparar el envío', error.message, 'error', 9000);
    } finally { $('btnSendEmails').disabled=false; $('btnSendEmails').textContent='Confirmar y enviar'; }
  }

  function renderControlTable() {
    const pill=(text,type='')=>`<span class="table-pill ${type}">${SSTUtils.escapeHtml(text)}</span>`;
    let headers=[], rows=[];
    if (state.controlTab==='validation') {
      headers=['PDF','Trabajador','Motor','Calidad','Apps Script','Campos a revisar','Exámenes','Recomendaciones','Pendientes','Versión'];
      rows=state.documents.map((d)=>[d.fileName,d.data?.nombre||'',d.data?.modo_validacion||'Motor local',d.data?.calidad_extraccion||'—',d.remoteSyncStatus==='synced'?'Sincronizado':(d.remoteSyncStatus==='error'?'Error de sincronización':'Pendiente'),(d.data?.campos_revision||[]).join(', '),(d.data?.examenes_lista||[]).length,(d.data?.recomendaciones_lista||[]).length,(d.data?.recomendaciones_pendientes_revision||[]).length,d.pipelineVersion||'Anterior']);
    } else if (state.controlTab==='package') {
      headers=['Trabajador','PDF origen','Estado','Archivo final','Consecutivo'];
      rows=state.documents.map((d)=>{const o=state.outputs.find((x)=>x.id===d.id);return[d.data?.nombre||'Sin nombre',d.fileName,o?(d.dirty?'Desactualizado':'Listo'):'Pendiente',o?.filename||'—',o?.consecutive||'—'];});
    } else if (state.controlTab==='originals') {
      headers=['PDF','Trabajador','Páginas','Tamaño','OCR']; rows=state.documents.map((d)=>[d.fileName,d.data?.nombre||'',d.pageCount||0,SSTUtils.bytesLabel(d.size),d.usedOcr?'Sí':'No']);
    } else {
      headers=['Fecha','Trabajador','Destinatario','CC','CCO','Asunto','Archivo','Estado','Detalle']; rows=state.emailHistory.slice(0,200).map((h)=>[h.date||h.fecha||h.createdAt||'',h.worker||h.trabajador||h.personName||'',h.to||h.destinatario||'',h.cc||'',h.bcc||h.cco||'',h.subject||h.asunto||'',h.file||h.archivo||'',h.status||h.estado||'',h.detail||h.detalle||'']);
    }
    if (!rows.length) { $('controlTable').innerHTML='<div class="empty-state compact"><span>▤</span><strong>Sin registros para mostrar</strong></div>'; return; }
    $('controlTable').innerHTML=`<table class="data-table"><thead><tr>${headers.map((h)=>`<th>${SSTUtils.escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${row.map((v,i)=>`<td>${(headers[i]==='Estado'||headers[i]==='Motor'||headers[i]==='Calidad'||headers[i]==='Apps Script')?pill(String(v),/listo|enviado|ia|alta/i.test(String(v))?'ok':(/error|desactualizado|revisar/i.test(String(v))?'error':'warn')):SSTUtils.escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  async function syncSharedAssets() {
    if (!state.backendOnline || state.localMode) return;
    const meta = await SSTBackend.call('getSharedAssetsMeta');
    for (const kind of ['template','signature']) {
      const remote = meta?.[kind];
      const local = await SSTDB.get(SSTDB.stores.assets, kind);
      // Si el administrador restauró la plantilla/firma base, no conservar una copia
      // compartida obsoleta en IndexedDB de otros equipos.
      if (!remote) {
        if (local?.shared === true) await SSTDB.delete(SSTDB.stores.assets, kind);
        continue;
      }
      if (local?.hash && remote.hash && local.hash === remote.hash) continue;
      const asset = await SSTBackend.call('getSharedAsset', { kind }, { timeout: 60000 });
      if (!asset?.found || !asset.base64) continue;
      const bytes = SSTUtils.base64ToUint8(asset.base64);
      const blob = new Blob([bytes], { type: asset.mime || 'application/octet-stream' });
      const row = { key:kind, name:asset.name, mime:blob.type, blob, hash:asset.hash || await SSTUtils.sha256Bytes(bytes.buffer), updatedAt:asset.updatedAt || new Date().toISOString(), shared:true };
      if (kind === 'template') row.validation = await SSTDocx.validateTemplate(await blob.arrayBuffer());
      await SSTDB.put(SSTDB.stores.assets, row);
    }
  }

  async function renderAssetSettings() {
    let template=await SSTDB.get(SSTDB.stores.assets,'template'), signature=await SSTDB.get(SSTDB.stores.assets,'signature');
    if (template?.blob && !template.validation) {
      try {
        template.validation = await SSTDocx.validateTemplate(await template.blob.arrayBuffer());
        await SSTDB.put(SSTDB.stores.assets, template);
      } catch (error) { template.validation = {valid:false,error:error.message,criticalMissing:[]}; }
    }
    const validation = template?.validation;
    if (template) {
      $('templateStatus').textContent = validation?.valid ? 'Validada' : 'Revisar plantilla';
      $('templateStatus').className = `status-badge ${validation?.valid ? 'success' : 'warn'}`;
      $('templateFileName').textContent = `${template.name}${validation?.markerCount != null ? ` · ${validation.markerCount}/${validation.totalMarkers} marcadores` : ''}`;
      if ($('templateValidationDetail')) $('templateValidationDetail').textContent = validation?.valid
        ? `Esta plantilla será la fuente real para Word, PDF y vista previa.${validation.recommendedMissing?.length ? ` Marcadores opcionales ausentes: ${validation.recommendedMissing.join(', ')}` : ''}`
        : `La plantilla no puede generar documentos: ${validation?.criticalMissing?.join(', ') || validation?.error || 'estructura no válida'}`;
    } else {
      $('templateStatus').textContent='Plantilla base'; $('templateStatus').className='status-badge'; $('templateFileName').textContent='Se usa la plantilla base incluida';
      if ($('templateValidationDetail')) $('templateValidationDetail').textContent='La plantilla base incluida será usada para Word, PDF y vista previa.';
    }
    $('signatureStatus').textContent=signature?'Firma cargada':'Sin firma'; $('signatureStatus').className=`status-badge ${signature?'success':''}`; $('signatureFileName').textContent=signature?.name || 'Se insertará antes del coordinador SST';
    if (signature?.blob) { $('signaturePreview').classList.remove('hidden'); const url=URL.createObjectURL(signature.blob); $('signaturePreview').innerHTML=`<img src="${url}" alt="Firma">`; setTimeout(()=>URL.revokeObjectURL(url),1000); } else { $('signaturePreview').classList.add('hidden'); $('signaturePreview').innerHTML=''; }
  }

  async function saveBackendUrl(inputId) {
    try {
      const url=SSTBackend.normalizeUrl($(inputId).value); if (!url) throw new Error('Ingresa la URL del backend.');
      await SSTDB.setSetting('backendUrl',url); $('setupBackendUrl').value=url; $('settingsBackendUrl').value=url;
      const ready=await SSTBackend.setUrl(url); if (!ready) throw new Error(SSTBackend.lastError || 'La Web App no respondió. Verifica que esté implementada como “Cualquiera” y uses la URL /exec.');
      state.backendInfo=await SSTBackend.ping(); setBackendUi(true);
      if (!backendVersionCompatible()) {
        $('settingsBackendStatus').textContent='Actualizar Apps Script'; $('settingsBackendStatus').className='status-badge warn';
        if ($('backendDiagnosticsDetail')) $('backendDiagnosticsDetail').textContent = `${backendVersionLabel()}. El frontend puede conectar, pero la sincronización de certificados no funcionará hasta publicar la V10.8 del backend.`;
        toast('Backend conectado pero desactualizado', backendVersionLabel(), 'warn', 9000);
      } else toast('Backend conectado',`${state.backendInfo.message||'Google Apps Script está listo.'} · ${state.backendInfo.backendVersion}`,'success');
      return true;
    } catch (error) { setBackendUi(false,error.message); toast('No se pudo conectar',error.message,'error',7000); return false; }
  }

  async function saveAiSettings() {
    const model=$('settingsGeminiModel').value.trim()||APP_CONFIG.defaultGeminiModel; const key=$('settingsGeminiKey').value.trim();
    await SSTDB.setSetting('aiEnabled',true); $('toggleAi').checked = true; $('toggleAi').disabled = true; await SSTDB.setSetting('geminiModel',model);
    if (!state.backendOnline||state.localMode) return toast('Preferencia local guardada','Conecta Apps Script para guardar la API key.','warn');
    try {
      await SSTBackend.call('saveAiConfig',{model,apiKey:key});
      $('settingsGeminiKey').value='';
      const ready = await ensureAiReady({ notify:true });
      if (ready) {
        toast('IA configurada','Gemini está listo. Los PDF pendientes se auditarán automáticamente.','success');
        await autoAuditPendingDocuments();
      }
    } catch(error){toast('No se pudo guardar la IA',error.message,'error');}
  }

  async function invalidateGeneratedOutputs(reason = 'La plantilla o firma cambió') {
    if (!state.outputs.length) return;
    await SSTDB.clear(SSTDB.stores.outputs);
    state.outputs = [];
    state.selectedOutputId = null;
    for (const doc of state.documents) {
      doc.dirty = true;
      doc.updatedAt = new Date().toISOString();
      await SSTDB.put(SSTDB.stores.documents, doc);
    }
    toast('Vistas previas invalidadas', `${reason}. Se regenerarán desde la plantilla activa, sin volver a analizar los PDF.`, 'warn', 7000);
  }

  async function uploadAsset(kind,file) {
    if (!file) return;
    const buffer=await file.arrayBuffer();
    const hash=await SSTUtils.sha256Bytes(buffer.slice(0));
    const blob=new Blob([buffer],{type:file.type||'application/octet-stream'});
    let validation = null;
    if (kind === 'template') {
      validation = await SSTDocx.validateTemplate(buffer.slice(0));
      if (!validation.valid) {
        throw new Error(`Plantilla rechazada. Faltan marcadores obligatorios: ${validation.criticalMissing.join(', ')}`);
      }
    }
    await SSTDB.put(SSTDB.stores.assets,{key:kind,name:file.name,mime:blob.type,blob,hash,validation,updatedAt:new Date().toISOString(),shared:false});
    let shared = false;
    if (state.backendOnline && !state.localMode && state.user?.role === 'admin') {
      try {
        await SSTBackend.call('saveSharedAsset',{kind,name:file.name,mime:blob.type,hash,base64:SSTUtils.arrayBufferToBase64(buffer)},{timeout:90000});
        const saved = await SSTDB.get(SSTDB.stores.assets,kind); saved.shared=true; await SSTDB.put(SSTDB.stores.assets,saved); shared=true;
      } catch (error) { toast('Recurso guardado solo en este navegador',error.message,'warn',6500); }
    }
    if (kind === 'template') await invalidateGeneratedOutputs('Se cargó una nueva plantilla institucional');
    await renderAssetSettings(); toast(kind==='template'?'Plantilla validada y guardada':'Firma guardada',kind==='template'?`${file.name} · será usada en Word, PDF y vista previa${shared?' · compartida con el equipo':''}`:(shared?`${file.name} · compartida con el equipo`:file.name),'success');
  }

  function openOriginalModal(doc) {
    if (!doc) return; const root=$('modalRoot'); root.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><div class="modal-head"><h3>${SSTUtils.escapeHtml(doc.data?.nombre||doc.fileName)} · PDF original</h3><button class="modal-close">×</button></div><div class="modal-body"><div class="pdf-stage" id="modalPdfStage"></div></div><div class="modal-actions"><button class="btn secondary modal-close-action">Cerrar</button></div></div></div>`;
    const close=()=>root.innerHTML=''; root.querySelector('.modal-close').onclick=close; root.querySelector('.modal-close-action').onclick=close; root.querySelector('.modal-backdrop').addEventListener('click',(e)=>{if(e.target===e.currentTarget)close();});
    SSTPdf.renderAll(doc.blob,$('modalPdfStage')).catch((e)=>toast('No se pudo abrir el PDF',e.message,'error'));
  }

  function bindEvents() {
    qsa('[data-auth-tab]').forEach((b)=>b.addEventListener('click',()=>switchAuthTab(b.dataset.authTab)));
    $('btnTestBackend').addEventListener('click',()=>saveBackendUrl('setupBackendUrl'));
    $('btnSaveBackend').addEventListener('click',async()=>{if(await saveBackendUrl('setupBackendUrl')) await showAuth();});
    $('btnLocalMode').addEventListener('click',async()=>{await clearWorkspaceForNewSession();state.localMode=true;state.user={name:'Revisión local',role:'local'};setBackendUi(false,'Modo local');await enterApp();toast('Sesión local limpia','El espacio de trabajo anterior fue eliminado. IA y correo requieren Apps Script.','warn',6500);});
    $('loginForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const r=await SSTBackend.call('login',{username:$('loginUser').value,password:$('loginPassword').value});await SSTDB.setAuth('sessionToken',r.sessionToken);state.user=r.user;state.localMode=false;if(APP_CONFIG.clearWorkspaceOnExplicitLogin)await clearWorkspaceForNewSession();await enterApp();}catch(error){toast('Acceso rechazado',error.message,'error');}});
    $('registerForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const r=await SSTBackend.call('register',{name:$('registerName').value,username:$('registerUser').value,password:$('registerPassword').value});await SSTDB.setAuth('sessionToken',r.sessionToken);state.user=r.user;state.localMode=false;if(APP_CONFIG.clearWorkspaceOnExplicitLogin)await clearWorkspaceForNewSession();await enterApp();}catch(error){toast('No fue posible crear la cuenta',error.message,'error');}});
    $('passwordForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await SSTBackend.call('changePasswordPublic',{username:$('passwordUser').value,oldPassword:$('passwordOld').value,newPassword:$('passwordNew').value});toast('Contraseña actualizada','Ya puedes iniciar sesión con la nueva clave.','success');switchAuthTab('login');}catch(error){toast('No se pudo cambiar la clave',error.message,'error');}});
    qsa('.nav-item[data-view]').forEach((b)=>b.addEventListener('click',()=>showView(b.dataset.view)));
    qsa('[data-go]').forEach((b)=>b.addEventListener('click',()=>showView(b.dataset.go)));
    $('btnSidebar').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
    window.addEventListener('resize',scheduleOriginalPreviewRefit,{passive:true});
    if (window.ResizeObserver) {
      const originalStage = $('originalCanvas')?.parentElement;
      if (originalStage) new ResizeObserver(() => { if (isViewActive('originals')) scheduleOriginalPreviewRefit(); }).observe(originalStage);
    }
    $('btnLogout').addEventListener('click',async()=>{try{if(state.backendOnline&&!state.localMode)await SSTBackend.call('logout');}catch(_){}await SSTDB.setAuth('sessionToken','');await clearWorkspaceForNewSession();state.user=null;state.localMode=false;await showAuth();});
    const openFile=()=>$('pdfInput').click(); $('btnQuickUpload').addEventListener('click',()=>{showView('documents');openFile();}); $('btnUploadMain').addEventListener('click',openFile); $('dropZone').addEventListener('click',openFile); $('pdfInput').addEventListener('change',(e)=>{handleFiles(e.target.files);e.target.value='';});
    for(const type of ['dragenter','dragover'])$('dropZone').addEventListener(type,(e)=>{e.preventDefault();$('dropZone').classList.add('dragover');}); for(const type of ['dragleave','drop'])$('dropZone').addEventListener(type,(e)=>{e.preventDefault();$('dropZone').classList.remove('dragover');}); $('dropZone').addEventListener('drop',(e)=>handleFiles(e.dataTransfer.files));
    $('documentSearch').addEventListener('input',renderDocumentList); $('documentList').addEventListener('click',async(e)=>{const check=e.target.closest('.batch-select');if(check){e.stopPropagation();const id=check.dataset.batchId;check.checked?state.selectedBatchIds.add(id):state.selectedBatchIds.delete(id);renderBatchSelectionSummary();return;}const del=e.target.closest('[data-delete-doc]');if(del){e.preventDefault();e.stopPropagation();await deleteDocumentById(del.dataset.deleteDoc);return;}const item=e.target.closest('[data-doc-id]');if(item){state.selectedDocId=item.dataset.docId;renderDocumentList();renderEditor();}}); $('recentDocuments').addEventListener('click',(e)=>{const item=e.target.closest('[data-dashboard-doc]');if(item){state.selectedDocId=item.dataset.dashboardDoc;showView('documents');renderDocumentList();renderEditor();}});
    ['fieldName','fieldId','fieldEmail','fieldRole','fieldExamType','fieldDate','fieldPlace','fieldSurveillance','fieldObservations','fieldReferrals','fieldRestrictions','fieldExams','fieldPending'].forEach((id)=>$(id).addEventListener('input',syncEditorToState));
    $('recommendationGroups').addEventListener('input',syncEditorToState); $('recommendationGroups').addEventListener('click',(e)=>{if(e.target.classList.contains('remove-group')){e.target.closest('.recommendation-card').remove();syncEditorToState();}}); $('btnAddRecommendationGroup').addEventListener('click',()=>{const wrapper=document.createElement('div');wrapper.className='recommendation-card';wrapper.innerHTML='<div class="recommendation-card-head"><input class="rec-exam" value="Nuevo examen" aria-label="Examen"><button class="remove-group" type="button">×</button></div><textarea class="rec-text" rows="4" placeholder="Detalle completo del examen. Puedes separar hallazgos por línea; al generar se integrarán en un solo párrafo."></textarea>';$('recommendationGroups').appendChild(wrapper);wrapper.querySelector('.rec-exam').select();syncEditorToState();});
    $('btnDeleteSelected').addEventListener('click',()=>{const d=selectedDocument();if(d)deleteDocumentById(d.id);else toast('Sin selección','Selecciona un certificado.','warn');}); $('btnResolveQualityReview')?.addEventListener('click',async()=>{const doc=selectedDocument();if(!doc)return;syncEditorToState();doc.data.campos_revision=[];doc.data.revision_manual_at=new Date().toISOString();doc.dirty=true;doc.updatedAt=doc.data.revision_manual_at;await SSTDB.put(SSTDB.stores.documents,doc);try{await syncDocumentsToBackend([doc],{silent:true});}catch(syncError){doc.remoteSyncStatus='error';doc.remoteSyncError=syncError.message;await SSTDB.put(SSTDB.stores.documents,doc);}renderEditor();renderDocumentList();renderDashboard();renderControlTable();toast('Revisión manual registrada','El control de calidad quedó marcado como resuelto para este certificado.','success');}); $('btnValidateAiSelected').addEventListener('click',validateSelectedWithAi); $('btnGenerateSelected').addEventListener('click',generateSelected); $('btnGenerateSelectedBatch')?.addEventListener('click',generateSelectedBatch); $('btnGenerateAll').addEventListener('click',generateAll); $('btnGenerateAll2').addEventListener('click',generateAll); $('btnSelectAllDocs')?.addEventListener('click',()=>{state.documents.forEach((d)=>state.selectedBatchIds.add(d.id));renderDocumentList();}); $('btnClearDocSelection')?.addEventListener('click',()=>{state.selectedBatchIds.clear();renderDocumentList();}); $('btnPreviewOriginal').addEventListener('click',()=>openOriginalModal(selectedDocument())); $('btnClearLoaded').addEventListener('click',clearLoadedDocuments);
    $('originalList').addEventListener('click',async(e)=>{const del=e.target.closest('[data-delete-doc]');if(del){e.preventDefault();e.stopPropagation();await deleteDocumentById(del.dataset.deleteDoc);return;}const item=e.target.closest('[data-original-id]');if(item){state.selectedOriginalId=item.dataset.originalId;state.originalPage=1;renderOriginals();}}); $('btnPrevPage').addEventListener('click',()=>{if(state.originalPage>1){state.originalPage--;renderOriginals();}}); $('btnNextPage').addEventListener('click',()=>{const d=state.documents.find((x)=>x.id===state.selectedOriginalId);if(d&&state.originalPage<(d.pageCount||1)){state.originalPage++;renderOriginals();}}); $('btnDownloadOriginal').addEventListener('click',()=>{const d=state.documents.find((x)=>x.id===state.selectedOriginalId);if(d)SSTUtils.downloadBlob(d.blob,`ORIGINAL_${d.fileName}`);}); $('btnIndexOriginals').addEventListener('click',()=>{renderOriginals();toast('Índice actualizado',`${state.documents.length} PDF disponibles sin reprocesar.`,'success');});
    $('generatedList').addEventListener('click',(e)=>{const item=e.target.closest('[data-output-id]');if(item){state.selectedOutputId=item.dataset.outputId;renderGenerated();}}); $('btnDownloadGenerated').addEventListener('click',()=>{const o=selectedOutput();if(o)SSTUtils.downloadBlob(o.blob,o.filename);}); $('btnDownloadZip').addEventListener('click',async()=>{if(!state.outputs.length)return toast('Sin archivos','No hay documentos para comprimir.','warn');try{const zip=await SSTGenerator.makeZip(state.outputs);SSTUtils.downloadBlob(zip,`Lote_SST_JER_SA_${SSTUtils.todayIso().replaceAll('-','')}.zip`);}catch(e){toast('No se pudo crear el ZIP',e.message,'error');}});
    $('emailRecipients').addEventListener('input',(e)=>{if(e.target.matches('.email-to')){const id=e.target.dataset.emailTo,d=state.documents.find((x)=>x.id===id);if(d){d.data.correo=e.target.value.trim();d.updatedAt=new Date().toISOString();SSTDB.put(SSTDB.stores.documents,d);}}updateEmailPreview();}); $('emailRecipients').addEventListener('change',(e)=>{if(e.target.matches('.email-select')){const id=e.target.dataset.emailId;e.target.checked?state.selectedEmailIds.add(id):state.selectedEmailIds.delete(id);}updateEmailPreview();}); $('emailSubject').addEventListener('input',updateEmailPreview); $('emailBody').addEventListener('input',updateEmailPreview); $('emailCommonTo').addEventListener('input',updateEmailPreview); $('btnSelectAllEmail').addEventListener('click',()=>{const allSelected=state.outputs.length&&state.selectedEmailIds.size===state.outputs.length;state.selectedEmailIds=allSelected?new Set():new Set(state.outputs.map((o)=>o.id));renderEmail();}); qsa('[data-email-mode]').forEach((b)=>b.addEventListener('click',async()=>{state.emailMode=b.dataset.emailMode;await SSTDB.setSetting('emailMode',state.emailMode);renderEmail();})); qsa('[data-email-format]').forEach((b)=>b.addEventListener('click',async()=>{state.emailFormat=b.dataset.emailFormat;await SSTDB.setSetting('emailAttachmentFormat',state.emailFormat);renderEmail();})); $('btnSendEmails').addEventListener('click',sendEmails);
    qsa('[data-control-tab]').forEach((b)=>b.addEventListener('click',()=>{state.controlTab=b.dataset.controlTab;qsa('[data-control-tab]').forEach((x)=>x.classList.toggle('active',x===b));renderControlTable();}));
    $('btnSettingsTestBackend').addEventListener('click',()=>saveBackendUrl('settingsBackendUrl')); $('btnBackendWriteProbe')?.addEventListener('click',testBackendWrite); $('btnSettingsSaveBackend').addEventListener('click',async()=>{if(await saveBackendUrl('settingsBackendUrl'))await showAuthIfNeeded();}); $('btnSaveAi').addEventListener('click',saveAiSettings); $('btnTestAi')?.addEventListener('click',async()=>{const ready=await ensureAiReady({notify:true});if(ready){toast('IA lista','Gemini está autorizado. Se validarán automáticamente los PDF pendientes.','success');await autoAuditPendingDocuments();}}); $('btnRefreshConsecutive').addEventListener('click',refreshBackendDiagnostics); $('btnSaveConsecutive').addEventListener('click',saveConsecutiveSettings);
    $('btnUploadTemplate').addEventListener('click',()=>$('templateInput').click()); $('templateInput').addEventListener('change',async(e)=>{try{await uploadAsset('template',e.target.files[0]);}catch(error){toast('Plantilla no válida',error.message,'error',8500);}finally{e.target.value='';}}); $('btnRemoveTemplate').addEventListener('click',async()=>{await SSTDB.delete(SSTDB.stores.assets,'template');if(state.backendOnline&&!state.localMode&&state.user?.role==='admin'){try{await SSTBackend.call('removeSharedAsset',{kind:'template'});}catch(e){toast('Plantilla local eliminada',e.message,'warn');}}await invalidateGeneratedOutputs('Se restauró la plantilla base');await renderAssetSettings();toast('Plantilla restaurada','Se utilizará la plantilla base incluida en todas las nuevas vistas previas.','success');});
    $('btnUploadSignature').addEventListener('click',()=>$('signatureInput').click()); $('signatureInput').addEventListener('change',async(e)=>{try{await uploadAsset('signature',e.target.files[0]);}catch(error){toast('No se pudo guardar la firma',error.message,'error');}finally{e.target.value='';}}); $('btnRemoveSignature').addEventListener('click',async()=>{await SSTDB.delete(SSTDB.stores.assets,'signature');if(state.backendOnline&&!state.localMode&&state.user?.role==='admin'){try{await SSTBackend.call('removeSharedAsset',{kind:'signature'});}catch(e){toast('Firma local eliminada',e.message,'warn');}}await renderAssetSettings();toast('Firma eliminada','','success');});
    $('btnSavePreferences').addEventListener('click',async()=>{await SSTDB.setSetting('outputFormat',$('settingsOutputFormat').value);await SSTDB.setSetting('ocrEnabled',$('toggleOcr').checked);toast('Preferencias guardadas','Se aplicarán a las próximas cargas y generaciones.','success');renderDashboard();});
    $('btnChangePasswordLogged').addEventListener('click',async()=>{if(state.localMode)return toast('Modo local','No hay una cuenta remota que modificar.','warn');try{await SSTBackend.call('changePassword',{oldPassword:$('settingsOldPassword').value,newPassword:$('settingsNewPassword').value});$('settingsOldPassword').value='';$('settingsNewPassword').value='';toast('Contraseña actualizada','','success');}catch(e){toast('No se pudo cambiar la contraseña',e.message,'error');}});
    $('btnClearLocalData').addEventListener('click',async()=>{if(!confirm('Esto eliminará PDF, salidas, plantilla, firma e historial almacenados en ESTE navegador. La cuenta y el backend no se eliminan. ¿Continuar?'))return;await SSTDB.clearAllLocalData();state.documents=[];state.outputs=[];state.emailHistory=[];state.selectedDocId=null;state.selectedOutputId=null;state.selectedOriginalId=null;state.selectedBatchIds.clear();state.selectedEmailIds.clear();await renderAll();await renderAssetSettings();toast('Caché local borrada','El portal quedó limpio en este navegador.','success');});
  }

  async function showAuthIfNeeded(){ if(!state.user&&!state.localMode)await showAuth(); }

  init();
})();
