(() => {
  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const state = {
    documents: [], outputs: [], emailHistory: [], selectedDocId: null,
    selectedOriginalId: null, originalPage: 1, selectedOutputId: null,
    user: null, localMode: false, backendOnline: false, backendInfo: null,
    controlTab: 'validation', lastCacheStats: { generated: 0, reused: 0 },
    parserReady: false, authBootstrap: null
  };

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
      $('toggleAi').checked = await SSTDB.getSetting('aiEnabled', true);
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
    }
    if (!state.selectedDocId && state.documents[0]) state.selectedDocId = state.documents[0].id;
    if (!state.selectedOriginalId && state.documents[0]) state.selectedOriginalId = state.documents[0].id;
    if (!state.selectedOutputId && state.outputs[0]) state.selectedOutputId = state.outputs[0].id;
    await renderAll();
    await renderAssetSettings();
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
    $('metricDocs').textContent = state.documents.length; $('metricDocsSub').textContent = state.documents.length ? `${state.documents.length} disponibles en caché` : 'Sin documentos';
    $('metricAi').textContent = aiCount; $('metricGenerated').textContent = state.outputs.length; $('metricCache').textContent = `${state.lastCacheStats.reused} reutilizados`;
    $('metricEmails').textContent = state.emailHistory.filter((x) => String(x.status || x.estado || '').toLowerCase().includes('enviado')).length;
    $('qualityOcr').textContent = $('toggleOcr').checked ? 'Activo' : 'Desactivado'; $('qualityCache').textContent = 'Activo';
    const recent = state.documents.slice(0,5);
    $('recentDocuments').className = recent.length ? 'recent-list' : 'empty-state compact';
    $('recentDocuments').innerHTML = recent.length ? recent.map((d) => `<div class="document-item" data-dashboard-doc="${d.id}"><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || d.fileName)}</strong><small>${SSTUtils.escapeHtml(d.fileName)}</small><em>${d.data?.modo_validacion ? SSTUtils.escapeHtml(d.data.modo_validacion) : 'Respaldo local'}</em></div><span class="mini-status ${d.data?.validado_ia ? 'ai' : ''}"></span></div>`).join('') : '<span>▣</span><strong>No hay documentos cargados</strong><p>Los certificados aparecerán aquí al cargarlos.</p>';
  }

  function documentMatches(d, query) {
    const text = `${d.fileName} ${d.data?.nombre || ''} ${d.data?.identificacion || ''} ${d.data?.cargo || ''}`.toLowerCase();
    return text.includes(String(query || '').trim().toLowerCase());
  }

  function renderDocumentList() {
    const query = $('documentSearch')?.value || '';
    const docs = state.documents.filter((d) => documentMatches(d, query));
    $('docListCount').textContent = state.documents.length;
    $('documentList').innerHTML = docs.length ? docs.map((d) => `<div class="document-item ${d.id === state.selectedDocId ? 'active' : ''}" data-doc-id="${d.id}"><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || 'Sin nombre')}</strong><small>${SSTUtils.escapeHtml(d.fileName)}</small><em>${d.dirty ? 'Editado · requiere actualizar salida' : (d.data?.validado_ia ? 'IA + respaldo local' : 'Respaldo local')}</em></div><span class="mini-status ${d.data?.validado_ia ? 'ai' : (d.dirty ? 'warn' : '')}"></span></div>`).join('') : '<div class="empty-state compact"><span>▣</span><strong>Sin certificados</strong></div>';
  }

  function selectedDocument() { return state.documents.find((d) => d.id === state.selectedDocId) || null; }
  function selectedOutput() { return state.outputs.find((o) => o.id === state.selectedOutputId) || null; }

  function normalizedMap(data) {
    const source = data?.recomendaciones_por_examen || {};
    const map = {};
    if (Array.isArray(source)) for (const item of source) if (item?.examen) map[item.examen] = Array.isArray(item.recomendaciones) ? item.recomendaciones : [];
    else for (const [k,v] of Object.entries(source)) map[k] = Array.isArray(v) ? v : [];
    for (const exam of data?.examenes_lista || []) if (!(exam in map)) map[exam] = [];
    if (!Object.keys(map).length && data?.recomendaciones_lista?.length) map['Recomendaciones generales'] = [...data.recomendaciones_lista];
    return map;
  }

  function renderEditor() {
    const doc = selectedDocument();
    $('editorEmpty').classList.toggle('hidden', !!doc); $('editorContent').classList.toggle('hidden', !doc);
    if (!doc) return;
    const d = doc.data || {};
    $('editorSourceFile').textContent = doc.fileName; $('editorPersonTitle').textContent = d.nombre || 'Trabajador sin identificar'; $('editorValidationMode').textContent = d.modo_validacion || 'Respaldo local';
    $('editorStatusText').textContent = doc.dirty ? 'Cambios sin regenerar' : 'Revisión disponible'; $('editorStatusDot').className = `status-dot ${doc.dirty ? 'warn' : 'success'}`;
    const values = { fieldName:d.nombre, fieldId:d.identificacion, fieldEmail:d.correo, fieldRole:d.cargo, fieldExamType:d.tipo_examen, fieldDate:d.fecha || SSTUtils.todayIso(), fieldPlace:d.lugar || 'Tunja', fieldSurveillance:d.vigilancia_programa, fieldObservations:d.observaciones, fieldReferrals:d.remisiones };
    for (const [id,value] of Object.entries(values)) $(id).value = value ?? '';
    $('fieldExams').value = (d.examenes_lista || []).join('\n');
    const pending = d.recomendaciones_pendientes_revision || [];
    $('pendingReviewBox').classList.toggle('hidden', !pending.length); $('fieldPending').value = pending.join('\n');
    renderRecommendationGroups(normalizedMap(d));
    $('saveState').textContent = doc.dirty ? 'Cambios guardados · salida pendiente de actualizar' : 'Cambios guardados automáticamente';
  }

  function renderRecommendationGroups(map) {
    const entries = Object.entries(map || {});
    $('recommendationGroups').innerHTML = (entries.length ? entries : [['Recomendaciones generales',[]]]).map(([exam,recs],i) => `<div class="recommendation-card" data-rec-group="${i}"><div class="recommendation-card-head"><input class="rec-exam" value="${SSTUtils.escapeHtml(exam)}" aria-label="Examen"><button class="remove-group" type="button" title="Eliminar grupo">×</button></div><textarea class="rec-text" rows="4" placeholder="Una recomendación por línea">${SSTUtils.escapeHtml((recs || []).join('\n'))}</textarea></div>`).join('');
  }

  const saveSelectedDebounced = SSTUtils.debounce(async () => {
    const doc = selectedDocument(); if (!doc) return; doc.updatedAt = new Date().toISOString(); await SSTDB.put(SSTDB.stores.documents, doc); renderDocumentList(); renderDashboard(); renderControlTable();
  }, 280);

  function syncEditorToState() {
    const doc = selectedDocument(); if (!doc) return;
    const d = doc.data;
    const fieldMap = { fieldName:'nombre',fieldId:'identificacion',fieldEmail:'correo',fieldRole:'cargo',fieldExamType:'tipo_examen',fieldDate:'fecha',fieldPlace:'lugar',fieldSurveillance:'vigilancia_programa',fieldObservations:'observaciones',fieldReferrals:'remisiones' };
    for (const [id,key] of Object.entries(fieldMap)) d[key] = $(id).value.trim();
    d.examenes_lista = $('fieldExams').value.split('\n').map((x) => x.trim()).filter(Boolean);
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
    if (!String(d.nombre || '').trim()) missing.push('nombre'); if (!String(d.cargo || '').trim()) missing.push('cargo'); if (!(d.examenes_lista || []).length) missing.push('exámenes realizados');
    const pending = d.recomendaciones_pendientes_revision || [];
    if (pending.length) missing.push('fragmentos pendientes de revisión');
    return missing;
  }

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) return toast('Selecciona archivos PDF', 'No se encontraron certificados compatibles.', 'warn');
    $('processingBanner').classList.remove('hidden');
    try {
      if (!state.parserReady) await SSTParser.init((msg,p) => updateProcessing('Preparando motor clínico', msg, p*0.15));
      state.parserReady = true;
      const aiEnabled = await SSTDB.getSetting('aiEnabled', true);
      const ocrEnabled = await SSTDB.getSetting('ocrEnabled', true);
      for (let index=0; index<files.length; index++) {
        const file = files[index];
        updateProcessing(`Procesando ${index+1} de ${files.length}`, file.name, index/files.length);
        const buffer = await file.arrayBuffer(); const hash = await SSTUtils.sha256Bytes(buffer.slice(0));
        const cached = state.documents.find((d) => d.hash === hash) || (await SSTDB.getByIndex(SSTDB.stores.documents, 'hash', hash))[0];
        if (cached) {
          if (!state.documents.some((d) => d.id === cached.id)) state.documents.unshift(cached);
          state.selectedDocId = cached.id; updateProcessing(`Reutilizando ${index+1} de ${files.length}`, `${file.name} ya estaba procesado`, (index+1)/files.length); continue;
        }
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const extraction = await SSTPdf.extract(blob, { ocrEnabled, onProgress: (p) => {
          const fractional = (index + ((p.page-1) + .55) / Math.max(1,p.total)) / files.length;
          updateProcessing(`Procesando ${index+1} de ${files.length}`, `${file.name} · ${p.message}`, fractional);
        }});
        updateProcessing(`Analizando ${index+1} de ${files.length}`, `${file.name} · reglas clínicas`, (index+.7)/files.length);
        let data = await SSTParser.analyze(extraction.text);
        data.fecha = data.fecha || SSTUtils.todayIso(); data.lugar = data.lugar || 'Tunja';
        let aiError = '';
        if (aiEnabled && state.backendOnline && !state.localMode && file.size <= APP_CONFIG.maxGeminiPdfMb*1024*1024) {
          try {
            updateProcessing(`Validando con IA ${index+1} de ${files.length}`, `${file.name} · lectura visual completa`, (index+.82)/files.length);
            const aiData = await SSTBackend.call('geminiAnalyze', { fileName:file.name, pdfBase64:SSTUtils.arrayBufferToBase64(buffer), text:extraction.text.slice(0,30000), localData:data, model:await SSTDB.getSetting('geminiModel', APP_CONFIG.defaultGeminiModel) }, { timeout: 195000 });
            data = await SSTParser.fuse(data, aiData, extraction.text);
          } catch (error) { aiError = error.message; console.warn('Gemini:', error); data.modo_validacion = 'Respaldo local · IA no disponible'; }
        } else if (aiEnabled && file.size > APP_CONFIG.maxGeminiPdfMb*1024*1024) aiError = `PDF mayor a ${APP_CONFIG.maxGeminiPdfMb} MB; se usó análisis local.`;
        const row = { id:crypto.randomUUID(), hash, fileName:file.name, size:file.size, type:'application/pdf', blob, text:extraction.text, pageCount:extraction.pageCount, usedOcr:extraction.usedOcr, aiError, data, dirty:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
        await SSTDB.put(SSTDB.stores.documents, row); state.documents.unshift(row); state.selectedDocId = row.id; state.selectedOriginalId = row.id;
        updateProcessing(`Completado ${index+1} de ${files.length}`, data.nombre || file.name, (index+1)/files.length);
      }
      state.documents.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      await renderAll(); showView('documents'); toast('Carga completada', `${files.length} archivo(s) procesados o recuperados de caché.`, 'success');
    } catch (error) { console.error(error); toast('No fue posible procesar el lote', error.message, 'error', 8000); }
    finally { setTimeout(() => $('processingBanner').classList.add('hidden'), 500); }
  }

  function updateProcessing(title, detail, ratio) { $('processingTitle').textContent = title; $('processingDetail').textContent = detail; $('processingProgress').style.width = `${Math.round(Math.max(0,Math.min(1,ratio))*100)}%`; }

  async function generateSelected() {
    syncEditorToState(); const doc = selectedDocument(); if (!doc) return;
    const missing = validateForGeneration(doc); if (missing.length) return toast('Revisión incompleta', `Resuelve: ${missing.join(', ')}.`, 'warn', 6500);
    try {
      updateProcessing('Generando documento', doc.data.nombre || doc.fileName, .35); $('processingBanner').classList.remove('hidden');
      const { output, reused } = await SSTGenerator.generate(doc); doc.dirty = false; await SSTDB.put(SSTDB.stores.documents, doc);
      const idx = state.outputs.findIndex((x) => x.id === output.id); if (idx >= 0) state.outputs[idx] = output; else state.outputs.unshift(output); state.selectedOutputId = output.id;
      state.lastCacheStats = { generated: reused ? 0 : 1, reused: reused ? 1 : 0 };
      await renderAll(); showView('generated'); toast(reused ? 'Vista reutilizada' : 'Documento generado', reused ? 'No hubo cambios; se conservó la salida existente.' : output.filename, 'success');
    } catch (error) { console.error(error); toast('Error al generar', error.message, 'error', 7000); }
    finally { $('processingBanner').classList.add('hidden'); }
  }

  async function generateAll() {
    if (!state.documents.length) return toast('No hay documentos', 'Carga certificados antes de generar el lote.', 'warn');
    const invalid = state.documents.filter((d) => validateForGeneration(d).length);
    if (invalid.length) return toast('Lote incompleto', `Revisa: ${invalid.slice(0,5).map((d) => d.data?.nombre || d.fileName).join(', ')}${invalid.length>5?'…':''}`, 'warn', 7500);
    try {
      $('processingBanner').classList.remove('hidden');
      const result = await SSTGenerator.generateAll(state.documents, null, (done,total,doc,status) => updateProcessing(`Generando lote · ${done}/${total}`, `${doc.data?.nombre || doc.fileName}${status==='reused'?' · reutilizado':''}`, total ? done/total : 0));
      state.outputs = (await SSTDB.getAll(SSTDB.stores.outputs)).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      for (const doc of state.documents) { doc.dirty = false; await SSTDB.put(SSTDB.stores.documents, doc); }
      state.lastCacheStats = { generated: result.generated, reused: result.reused }; await renderAll(); showView('generated'); toast('Lote listo', `${result.generated} generado(s) · ${result.reused} reutilizado(s).`, 'success', 6500);
    } catch (error) { console.error(error); toast('No fue posible completar el lote', error.message, 'error', 8000); }
    finally { $('processingBanner').classList.add('hidden'); }
  }

  function renderOriginals() {
    $('originalList').innerHTML = state.documents.length ? state.documents.map((d) => `<div class="document-item ${d.id===state.selectedOriginalId?'active':''}" data-original-id="${d.id}"><div class="doc-icon">PDF</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(d.data?.nombre || d.fileName)}</strong><small>${d.pageCount || '—'} página(s) · ${SSTUtils.bytesLabel(d.size)}</small><em>${d.usedOcr?'OCR utilizado':'Texto PDF'}</em></div></div>`).join('') : '<div class="empty-state compact"><span>◫</span><strong>Sin PDF originales</strong></div>';
    const doc = state.documents.find((d) => d.id === state.selectedOriginalId);
    if (!doc) { $('originalViewerTitle').textContent='Selecciona un PDF'; $('originalViewerMeta').textContent='—'; $('originalPageLabel').textContent='0 / 0'; $('originalCanvas').style.display='none'; $('originalEmpty').classList.remove('hidden'); return; }
    $('originalViewerTitle').textContent = doc.data?.nombre || doc.fileName; $('originalViewerMeta').textContent = doc.fileName; $('originalPageLabel').textContent = `${state.originalPage} / ${doc.pageCount || 1}`; $('originalEmpty').classList.add('hidden'); $('originalCanvas').style.display='block';
    if (isViewActive('originals')) requestAnimationFrame(() => SSTPdf.renderPage(doc.blob, state.originalPage, $('originalCanvas')).catch((e) => toast('No se pudo renderizar el PDF', e.message, 'error')));
  }

  function renderGenerated() {
    $('generatedCount').textContent = state.outputs.length;
    $('generatedList').innerHTML = state.outputs.length ? state.outputs.map((o) => { const doc = state.documents.find((d)=>d.id===o.id); return `<div class="document-item ${o.id===state.selectedOutputId?'active':''}" data-output-id="${o.id}"><div class="doc-icon">${o.format==='Word'?'DOC':'OUT'}</div><div class="doc-main"><strong>${SSTUtils.escapeHtml(o.personName || o.filename)}</strong><small>${SSTUtils.escapeHtml(o.filename)}</small><em>${doc?.dirty?'Desactualizado por edición':`Consecutivo ${SSTUtils.escapeHtml(o.consecutive || '—')}`}</em></div><span class="mini-status ${doc?.dirty?'warn':'ai'}"></span></div>`; }).join('') : '<div class="empty-state compact"><span>⇩</span><strong>No hay documentos generados</strong></div>';
    const out = selectedOutput(); const preview = $('generatedPreview');
    if (!out) { $('generatedViewerTitle').textContent='Selecciona un documento'; $('generatedViewerMeta').textContent='—'; preview.innerHTML='<div class="empty-state tall"><span>⇩</span><strong>Aún no hay vista previa</strong><p>Genera un documento desde la sección Documentos.</p></div>'; return; }
    $('generatedViewerTitle').textContent = out.personName || out.filename; $('generatedViewerMeta').textContent = `${out.format} · ${out.consecutive || '—'}`;
    if (out.format === 'PDF') { preview.innerHTML=''; if (isViewActive('generated')) requestAnimationFrame(() => SSTPdf.renderAll(out.blob, preview).catch((e) => { preview.innerHTML=`<iframe title="Vista previa" srcdoc="${SSTUtils.escapeHtml(out.previewHtml)}"></iframe>`; console.warn(e); })); else preview.innerHTML='<div class="empty-state tall"><span>⇩</span><strong>PDF listo</strong><p>Abre esta sección para renderizar la vista previa.</p></div>'; }
    else { preview.innerHTML=''; const iframe=document.createElement('iframe'); iframe.title='Vista previa'; iframe.srcdoc=out.previewHtml; preview.appendChild(iframe); }
  }

  function renderEmail() {
    const generatedDocs = state.outputs.map((o) => ({ o, d: state.documents.find((d) => d.id === o.id) })).filter((x) => x.d);
    $('emailRecipients').innerHTML = generatedDocs.length ? generatedDocs.map(({o,d}) => `<label class="recipient-row"><input type="checkbox" class="email-select" data-email-id="${o.id}"><div class="recipient-fields"><div><strong>${SSTUtils.escapeHtml(d.data?.nombre || o.personName)}</strong><small>${SSTUtils.escapeHtml(o.filename)}</small></div><input class="email-to" data-email-to="${o.id}" type="email" value="${SSTUtils.escapeHtml(d.data?.correo || '')}" placeholder="correo@empresa.com"></div></label>`).join('') : '<div class="empty-state compact"><span>✉</span><strong>No hay documentos generados</strong></div>';
    updateEmailPreview();
  }

  function selectedEmailItems() {
    return qsa('.email-select:checked').map((cb) => {
      const id=cb.dataset.emailId, output=state.outputs.find((o)=>o.id===id), doc=state.documents.find((d)=>d.id===id); const input=document.querySelector(`[data-email-to="${CSS.escape(id)}"]`);
      return output&&doc ? { output, doc, to:input?.value.trim().toLowerCase() || '' } : null;
    }).filter(Boolean);
  }

  function updateEmailPreview() {
    const items = selectedEmailItems();
    $('emailPreviewCards').innerHTML = items.map(({doc,output,to}) => `<div class="email-preview-card"><strong>${SSTUtils.escapeHtml(doc.data?.nombre || output.personName)} · ${SSTUtils.escapeHtml(to || 'Sin correo')}</strong><small>${SSTUtils.escapeHtml(SSTUtils.template($('emailSubject').value,doc.data))} · ${SSTUtils.escapeHtml(output.filename)}</small></div>`).join('');
  }

  async function sendEmails() {
    if (!state.backendOnline || state.localMode) return toast('Backend requerido', 'Configura Google Apps Script para enviar correos.', 'warn');
    const items = selectedEmailItems(); if (!items.length) return toast('Selecciona destinatarios', 'Marca al menos un documento.', 'warn');
    if (!$('emailConfirm').checked) return toast('Falta confirmación', 'Marca la casilla de revisión antes de enviar.', 'warn');
    const cc=SSTUtils.parseEmails($('emailCc').value), bcc=SSTUtils.parseEmails($('emailBcc').value); const invalidCopies=[...cc,...bcc].filter((x)=>!SSTUtils.validEmail(x));
    if (invalidCopies.length) return toast('Revisa CC/CCO', invalidCopies.join(', '), 'warn');
    const invalid=items.filter((x)=>!SSTUtils.validEmail(x.to)); if (invalid.length) return toast('Correos inválidos', invalid.map((x)=>x.doc.data?.nombre || x.doc.fileName).join(', '), 'warn');
    const subjectTpl=$('emailSubject').value.trim(), bodyTpl=$('emailBody').value.trim(); if (!subjectTpl||!bodyTpl) return toast('Mensaje incompleto','El asunto y el cuerpo no pueden estar vacíos.','warn');
    $('btnSendEmails').disabled=true; let ok=0; const errors=[];
    try {
      for (let i=0;i<items.length;i++) {
        const {output,doc,to}=items[i]; $('btnSendEmails').textContent=`Enviando ${i+1} de ${items.length}…`;
        try {
          const buffer=await output.blob.arrayBuffer();
          const response=await SSTBackend.call('sendEmail',{to,cc,bcc,subject:SSTUtils.template(subjectTpl,doc.data),body:SSTUtils.template(bodyTpl,doc.data),attachment:{filename:output.filename,mime:output.mime,base64:SSTUtils.arrayBufferToBase64(buffer)},sourceFile:doc.fileName,personName:doc.data?.nombre || ''},{timeout:90000});
          ok++; if (response?.history) state.emailHistory.unshift(response.history);
        } catch (error) { errors.push(`${doc.data?.nombre || doc.fileName}: ${error.message}`); }
      }
      await SSTDB.setSetting('emailSubject', subjectTpl); await SSTDB.setSetting('emailBody', bodyTpl);
      renderDashboard(); renderControlTable(); $('emailConfirm').checked=false;
      if (ok) toast('Envío completado', `${ok} de ${items.length} correo(s) enviados.`, 'success', 6500); if (errors.length) toast('Algunos correos fallaron', errors.join(' | '), 'error', 9000);
    } finally { $('btnSendEmails').disabled=false; $('btnSendEmails').textContent='Confirmar y enviar correos'; }
  }

  function renderControlTable() {
    const pill=(text,type='')=>`<span class="table-pill ${type}">${SSTUtils.escapeHtml(text)}</span>`;
    let headers=[], rows=[];
    if (state.controlTab==='validation') {
      headers=['PDF','Trabajador','Motor','Exámenes','Recomendaciones','Pendientes','Versión'];
      rows=state.documents.map((d)=>[d.fileName,d.data?.nombre||'',d.data?.modo_validacion||'Respaldo local',(d.data?.examenes_lista||[]).length,(d.data?.recomendaciones_lista||[]).length,(d.data?.recomendaciones_pendientes_revision||[]).length,APP_CONFIG.pipelineVersion]);
    } else if (state.controlTab==='package') {
      headers=['Trabajador','PDF origen','Estado','Archivo final','Consecutivo'];
      rows=state.documents.map((d)=>{const o=state.outputs.find((x)=>x.id===d.id);return[d.data?.nombre||'Sin nombre',d.fileName,o?(d.dirty?'Desactualizado':'Listo'):'Pendiente',o?.filename||'—',o?.consecutive||'—'];});
    } else if (state.controlTab==='originals') {
      headers=['PDF','Trabajador','Páginas','Tamaño','OCR']; rows=state.documents.map((d)=>[d.fileName,d.data?.nombre||'',d.pageCount||0,SSTUtils.bytesLabel(d.size),d.usedOcr?'Sí':'No']);
    } else {
      headers=['Fecha','Trabajador','Destinatario','CC','CCO','Asunto','Archivo','Estado','Detalle']; rows=state.emailHistory.slice(0,200).map((h)=>[h.date||h.fecha||h.createdAt||'',h.worker||h.trabajador||h.personName||'',h.to||h.destinatario||'',h.cc||'',h.bcc||h.cco||'',h.subject||h.asunto||'',h.file||h.archivo||'',h.status||h.estado||'',h.detail||h.detalle||'']);
    }
    if (!rows.length) { $('controlTable').innerHTML='<div class="empty-state compact"><span>▤</span><strong>Sin registros para mostrar</strong></div>'; return; }
    $('controlTable').innerHTML=`<table class="data-table"><thead><tr>${headers.map((h)=>`<th>${SSTUtils.escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${row.map((v,i)=>`<td>${(headers[i]==='Estado'||headers[i]==='Motor')?pill(String(v),/listo|enviado|ia/i.test(String(v))?'ok':(/error|desactualizado/i.test(String(v))?'error':'warn')):SSTUtils.escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  async function syncSharedAssets() {
    if (!state.backendOnline || state.localMode) return;
    const meta = await SSTBackend.call('getSharedAssetsMeta');
    for (const kind of ['template','signature']) {
      const remote = meta?.[kind];
      if (!remote) continue;
      const local = await SSTDB.get(SSTDB.stores.assets, kind);
      if (local?.hash && remote.hash && local.hash === remote.hash) continue;
      const asset = await SSTBackend.call('getSharedAsset', { kind }, { timeout: 60000 });
      if (!asset?.found || !asset.base64) continue;
      const bytes = SSTUtils.base64ToUint8(asset.base64);
      const blob = new Blob([bytes], { type: asset.mime || 'application/octet-stream' });
      await SSTDB.put(SSTDB.stores.assets, { key:kind, name:asset.name, mime:blob.type, blob, hash:asset.hash || await SSTUtils.sha256Bytes(bytes.buffer), updatedAt:asset.updatedAt || new Date().toISOString(), shared:true });
    }
  }

  async function renderAssetSettings() {
    const template=await SSTDB.get(SSTDB.stores.assets,'template'), signature=await SSTDB.get(SSTDB.stores.assets,'signature');
    $('templateStatus').textContent=template?'Personalizada':'Plantilla base'; $('templateStatus').className=`status-badge ${template?'success':''}`; $('templateFileName').textContent=template?.name || 'Se usa la plantilla base incluida';
    $('signatureStatus').textContent=signature?'Firma cargada':'Sin firma'; $('signatureStatus').className=`status-badge ${signature?'success':''}`; $('signatureFileName').textContent=signature?.name || 'Se insertará antes del coordinador SST';
    if (signature?.blob) { $('signaturePreview').classList.remove('hidden'); const url=URL.createObjectURL(signature.blob); $('signaturePreview').innerHTML=`<img src="${url}" alt="Firma">`; setTimeout(()=>URL.revokeObjectURL(url),1000); } else { $('signaturePreview').classList.add('hidden'); $('signaturePreview').innerHTML=''; }
  }

  async function saveBackendUrl(inputId) {
    try {
      const url=SSTBackend.normalizeUrl($(inputId).value); if (!url) throw new Error('Ingresa la URL del backend.');
      await SSTDB.setSetting('backendUrl',url); $('setupBackendUrl').value=url; $('settingsBackendUrl').value=url;
      const ready=await SSTBackend.setUrl(url); if (!ready) throw new Error('La Web App no respondió. Verifica que esté implementada como “Cualquiera” y uses la URL /exec.');
      state.backendInfo=await SSTBackend.ping(); setBackendUi(true); toast('Backend conectado',state.backendInfo.message||'Google Apps Script está listo.','success'); return true;
    } catch (error) { setBackendUi(false,error.message); toast('No se pudo conectar',error.message,'error',7000); return false; }
  }

  async function saveAiSettings() {
    const model=$('settingsGeminiModel').value.trim()||APP_CONFIG.defaultGeminiModel; const key=$('settingsGeminiKey').value.trim();
    await SSTDB.setSetting('aiEnabled',$('toggleAi').checked); await SSTDB.setSetting('geminiModel',model);
    if (!state.backendOnline||state.localMode) return toast('Preferencia local guardada','Conecta Apps Script para guardar la API key.','warn');
    try { await SSTBackend.call('saveAiConfig',{model,apiKey:key}); $('settingsGeminiKey').value=''; toast('IA configurada','La clave quedó guardada en Script Properties, fuera de GitHub Pages.','success'); }
    catch(error){toast('No se pudo guardar la IA',error.message,'error');}
  }

  async function uploadAsset(kind,file) {
    if (!file) return; const buffer=await file.arrayBuffer(); const hash=await SSTUtils.sha256Bytes(buffer.slice(0)); const blob=new Blob([buffer],{type:file.type||'application/octet-stream'});
    await SSTDB.put(SSTDB.stores.assets,{key:kind,name:file.name,mime:blob.type,blob,hash,updatedAt:new Date().toISOString(),shared:false});
    let shared = false;
    if (state.backendOnline && !state.localMode && state.user?.role === 'admin') {
      try {
        await SSTBackend.call('saveSharedAsset',{kind,name:file.name,mime:blob.type,hash,base64:SSTUtils.arrayBufferToBase64(buffer)},{timeout:90000});
        const saved = await SSTDB.get(SSTDB.stores.assets,kind); saved.shared=true; await SSTDB.put(SSTDB.stores.assets,saved); shared=true;
      } catch (error) { toast('Recurso guardado solo en este navegador',error.message,'warn',6500); }
    }
    await renderAssetSettings(); toast(kind==='template'?'Plantilla guardada':'Firma guardada',shared?`${file.name} · compartida con el equipo`:file.name,'success');
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
    $('btnLocalMode').addEventListener('click',async()=>{state.localMode=true;state.user={name:'Revisión local',role:'local'};setBackendUi(false,'Modo local');await enterApp();toast('Modo local','Gemini y correo permanecerán desactivados hasta conectar Apps Script.','warn',6500);});
    $('loginForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const r=await SSTBackend.call('login',{username:$('loginUser').value,password:$('loginPassword').value});await SSTDB.setAuth('sessionToken',r.sessionToken);state.user=r.user;state.localMode=false;await enterApp();}catch(error){toast('Acceso rechazado',error.message,'error');}});
    $('registerForm').addEventListener('submit',async(e)=>{e.preventDefault();try{const r=await SSTBackend.call('register',{name:$('registerName').value,username:$('registerUser').value,password:$('registerPassword').value});await SSTDB.setAuth('sessionToken',r.sessionToken);state.user=r.user;state.localMode=false;await enterApp();}catch(error){toast('No fue posible crear la cuenta',error.message,'error');}});
    $('passwordForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await SSTBackend.call('changePasswordPublic',{username:$('passwordUser').value,oldPassword:$('passwordOld').value,newPassword:$('passwordNew').value});toast('Contraseña actualizada','Ya puedes iniciar sesión con la nueva clave.','success');switchAuthTab('login');}catch(error){toast('No se pudo cambiar la clave',error.message,'error');}});
    qsa('.nav-item[data-view]').forEach((b)=>b.addEventListener('click',()=>showView(b.dataset.view)));
    qsa('[data-go]').forEach((b)=>b.addEventListener('click',()=>showView(b.dataset.go)));
    $('btnSidebar').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
    $('btnLogout').addEventListener('click',async()=>{try{if(state.backendOnline&&!state.localMode)await SSTBackend.call('logout');}catch(_){}await SSTDB.setAuth('sessionToken','');state.user=null;state.localMode=false;await showAuth();});
    const openFile=()=>$('pdfInput').click(); $('btnQuickUpload').addEventListener('click',()=>{showView('documents');openFile();}); $('btnUploadMain').addEventListener('click',openFile); $('dropZone').addEventListener('click',openFile); $('pdfInput').addEventListener('change',(e)=>{handleFiles(e.target.files);e.target.value='';});
    for(const type of ['dragenter','dragover'])$('dropZone').addEventListener(type,(e)=>{e.preventDefault();$('dropZone').classList.add('dragover');}); for(const type of ['dragleave','drop'])$('dropZone').addEventListener(type,(e)=>{e.preventDefault();$('dropZone').classList.remove('dragover');}); $('dropZone').addEventListener('drop',(e)=>handleFiles(e.dataTransfer.files));
    $('documentSearch').addEventListener('input',renderDocumentList); $('documentList').addEventListener('click',(e)=>{const item=e.target.closest('[data-doc-id]');if(item){state.selectedDocId=item.dataset.docId;renderDocumentList();renderEditor();}}); $('recentDocuments').addEventListener('click',(e)=>{const item=e.target.closest('[data-dashboard-doc]');if(item){state.selectedDocId=item.dataset.dashboardDoc;showView('documents');renderDocumentList();renderEditor();}});
    ['fieldName','fieldId','fieldEmail','fieldRole','fieldExamType','fieldDate','fieldPlace','fieldSurveillance','fieldObservations','fieldReferrals','fieldExams','fieldPending'].forEach((id)=>$(id).addEventListener('input',syncEditorToState));
    $('recommendationGroups').addEventListener('input',syncEditorToState); $('recommendationGroups').addEventListener('click',(e)=>{if(e.target.classList.contains('remove-group')){e.target.closest('.recommendation-card').remove();syncEditorToState();}}); $('btnAddRecommendationGroup').addEventListener('click',()=>{const wrapper=document.createElement('div');wrapper.className='recommendation-card';wrapper.innerHTML='<div class="recommendation-card-head"><input class="rec-exam" value="Nuevo examen" aria-label="Examen"><button class="remove-group" type="button">×</button></div><textarea class="rec-text" rows="4" placeholder="Una recomendación por línea"></textarea>';$('recommendationGroups').appendChild(wrapper);wrapper.querySelector('.rec-exam').select();syncEditorToState();});
    $('btnGenerateSelected').addEventListener('click',generateSelected); $('btnGenerateAll').addEventListener('click',generateAll); $('btnGenerateAll2').addEventListener('click',generateAll); $('btnPreviewOriginal').addEventListener('click',()=>openOriginalModal(selectedDocument()));
    $('originalList').addEventListener('click',(e)=>{const item=e.target.closest('[data-original-id]');if(item){state.selectedOriginalId=item.dataset.originalId;state.originalPage=1;renderOriginals();}}); $('btnPrevPage').addEventListener('click',()=>{if(state.originalPage>1){state.originalPage--;renderOriginals();}}); $('btnNextPage').addEventListener('click',()=>{const d=state.documents.find((x)=>x.id===state.selectedOriginalId);if(d&&state.originalPage<(d.pageCount||1)){state.originalPage++;renderOriginals();}}); $('btnDownloadOriginal').addEventListener('click',()=>{const d=state.documents.find((x)=>x.id===state.selectedOriginalId);if(d)SSTUtils.downloadBlob(d.blob,`ORIGINAL_${d.fileName}`);}); $('btnIndexOriginals').addEventListener('click',()=>{renderOriginals();toast('Índice actualizado',`${state.documents.length} PDF disponibles sin reprocesar.`,'success');});
    $('generatedList').addEventListener('click',(e)=>{const item=e.target.closest('[data-output-id]');if(item){state.selectedOutputId=item.dataset.outputId;renderGenerated();}}); $('btnDownloadGenerated').addEventListener('click',()=>{const o=selectedOutput();if(o)SSTUtils.downloadBlob(o.blob,o.filename);}); $('btnDownloadZip').addEventListener('click',async()=>{if(!state.outputs.length)return toast('Sin archivos','No hay documentos para comprimir.','warn');try{const zip=await SSTGenerator.makeZip(state.outputs);SSTUtils.downloadBlob(zip,`Lote_SST_JER_SA_${SSTUtils.todayIso().replaceAll('-','')}.zip`);}catch(e){toast('No se pudo crear el ZIP',e.message,'error');}});
    $('emailRecipients').addEventListener('input',(e)=>{if(e.target.matches('.email-to')){const id=e.target.dataset.emailTo,d=state.documents.find((x)=>x.id===id);if(d){d.data.correo=e.target.value.trim();d.updatedAt=new Date().toISOString();SSTDB.put(SSTDB.stores.documents,d);}}updateEmailPreview();}); $('emailRecipients').addEventListener('change',updateEmailPreview); $('emailSubject').addEventListener('input',updateEmailPreview); $('emailBody').addEventListener('input',updateEmailPreview); $('btnSelectAllEmail').addEventListener('click',()=>{qsa('.email-select').forEach((x)=>x.checked=true);updateEmailPreview();}); $('btnSendEmails').addEventListener('click',sendEmails);
    qsa('[data-control-tab]').forEach((b)=>b.addEventListener('click',()=>{state.controlTab=b.dataset.controlTab;qsa('[data-control-tab]').forEach((x)=>x.classList.toggle('active',x===b));renderControlTable();}));
    $('btnSettingsTestBackend').addEventListener('click',()=>saveBackendUrl('settingsBackendUrl')); $('btnSettingsSaveBackend').addEventListener('click',async()=>{if(await saveBackendUrl('settingsBackendUrl'))await showAuthIfNeeded();}); $('btnSaveAi').addEventListener('click',saveAiSettings);
    $('btnUploadTemplate').addEventListener('click',()=>$('templateInput').click()); $('templateInput').addEventListener('change',(e)=>{uploadAsset('template',e.target.files[0]);e.target.value='';}); $('btnRemoveTemplate').addEventListener('click',async()=>{await SSTDB.delete(SSTDB.stores.assets,'template');if(state.backendOnline&&!state.localMode&&state.user?.role==='admin'){try{await SSTBackend.call('removeSharedAsset',{kind:'template'});}catch(e){toast('Plantilla local eliminada',e.message,'warn');}}await renderAssetSettings();toast('Plantilla restaurada','Se utilizará la plantilla base incluida.','success');});
    $('btnUploadSignature').addEventListener('click',()=>$('signatureInput').click()); $('signatureInput').addEventListener('change',(e)=>{uploadAsset('signature',e.target.files[0]);e.target.value='';}); $('btnRemoveSignature').addEventListener('click',async()=>{await SSTDB.delete(SSTDB.stores.assets,'signature');if(state.backendOnline&&!state.localMode&&state.user?.role==='admin'){try{await SSTBackend.call('removeSharedAsset',{kind:'signature'});}catch(e){toast('Firma local eliminada',e.message,'warn');}}await renderAssetSettings();toast('Firma eliminada','','success');});
    $('btnSavePreferences').addEventListener('click',async()=>{await SSTDB.setSetting('outputFormat',$('settingsOutputFormat').value);await SSTDB.setSetting('ocrEnabled',$('toggleOcr').checked);toast('Preferencias guardadas','Se aplicarán a las próximas cargas y generaciones.','success');renderDashboard();});
    $('btnChangePasswordLogged').addEventListener('click',async()=>{if(state.localMode)return toast('Modo local','No hay una cuenta remota que modificar.','warn');try{await SSTBackend.call('changePassword',{oldPassword:$('settingsOldPassword').value,newPassword:$('settingsNewPassword').value});$('settingsOldPassword').value='';$('settingsNewPassword').value='';toast('Contraseña actualizada','','success');}catch(e){toast('No se pudo cambiar la contraseña',e.message,'error');}});
    $('btnClearLocalData').addEventListener('click',async()=>{if(!confirm('Esto eliminará PDF, salidas, plantilla, firma e historial almacenados en ESTE navegador. La cuenta y el backend no se eliminan. ¿Continuar?'))return;await SSTDB.clearAllLocalData();state.documents=[];state.outputs=[];state.emailHistory=[];state.selectedDocId=null;state.selectedOutputId=null;state.selectedOriginalId=null;await renderAll();await renderAssetSettings();toast('Caché local borrada','El portal quedó limpio en este navegador.','success');});
  }

  async function showAuthIfNeeded(){ if(!state.user&&!state.localMode)await showAuth(); }

  init();
})();
