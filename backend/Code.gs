const APP_NAME = 'Portal SST · Recomendaciones Médicas';
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const SESSION_HOURS = 8;
const USER_SHEET = 'Usuarios';
const EMAIL_SHEET = 'HistorialCorreos';
const CONSECUTIVE_SHEET = 'Consecutivos';
const CONSECUTIVE_LEDGER_SHEET = 'ConsecutivosControl';
const CONSECUTIVE_LEDGER_HEADERS = ['document_key','consecutivo','spreadsheet_id','sheet_name','creado_en'];
const CONSECUTIVE_HEADERS = ['consecutivo','numero','anio','fecha_documento','trabajador','identificacion','cargo','tipo_examen','pdf_origen','hash_documento','usuario','creado_en'];

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || 'bridge');
  if (mode === 'bridge') {
    return HtmlService.createHtmlOutputFromFile('BackendBridge')
      .setTitle('Portal SST · Backend Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutput('<h3>Portal SST Backend</h3><p>Servicio activo.</p>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let envelope;
  try {
    const raw = String((e && e.parameter && e.parameter.request) || '');
    if (!raw) throw new Error('No se recibió la solicitud.');
    const req = JSON.parse(raw);
    const result = apiDispatch(req);
    envelope = {
      channel: 'sst-backend-http',
      id: String(req.id || ''),
      nonce: String(req.nonce || ''),
      ok: true,
      data: result
    };
  } catch (error) {
    let req = {};
    try { req = JSON.parse(String((e && e.parameter && e.parameter.request) || '{}')); } catch (_) {}
    envelope = {
      channel: 'sst-backend-http',
      id: String(req.id || ''),
      nonce: String(req.nonce || ''),
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }

  const json = JSON.stringify(envelope)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const html = '<!doctype html><html><head><meta charset="UTF-8"></head><body>' +
    '<script>(function(){var message=' + json + ';' +
    'try{window.top.postMessage(message,"*");}' +
    'catch(e){try{window.parent.postMessage(message,"*");}catch(_){}}' +
    '})();</script></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Portal SST · Respuesta segura')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiDispatch(requestJson) {
  try {
    const req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson;
    if (!req || !req.action) throw new Error('Solicitud inválida.');
    const action = String(req.action);
    const payload = req.payload || {};
    const sessionToken = String(req.session || '');

    switch (action) {
      case 'ping': return { ok: true, message: 'Google Apps Script conectado', app: APP_NAME, time: new Date().toISOString() };
      case 'bootstrapStatus': return bootstrapStatus_();
      case 'register': return register_(payload);
      case 'login': return login_(payload);
      case 'changePasswordPublic': return changePasswordPublic_(payload);
      case 'sessionInfo': return { user: requireSession_(sessionToken) };
      case 'logout': return logout_(sessionToken);
      case 'changePassword': return changePassword_(requireSession_(sessionToken), payload);
      case 'saveAiConfig': return saveAiConfig_(requireAdmin_(sessionToken), payload);
      case 'saveSharedAsset': return saveSharedAsset_(requireAdmin_(sessionToken), payload);
      case 'removeSharedAsset': return removeSharedAsset_(requireAdmin_(sessionToken), payload);
      case 'getSharedAssetsMeta': return getSharedAssetsMeta_(requireSession_(sessionToken));
      case 'getSharedAsset': return getSharedAsset_(requireSession_(sessionToken), payload);
      case 'geminiAnalyze': return geminiAnalyze_(requireSession_(sessionToken), payload);
      case 'nextConsecutive': return nextConsecutive_(requireSession_(sessionToken), payload);
      case 'consecutiveStatus': return consecutiveStatus_(requireSession_(sessionToken));
      case 'saveConsecutiveConfig': return saveConsecutiveConfig_(requireAdmin_(sessionToken), payload);
      case 'mailStatus': return mailStatus_(requireSession_(sessionToken));
      case 'sendEmail': return sendEmail_(requireSession_(sessionToken), payload);
      case 'emailHistory': return emailHistory_(requireSession_(sessionToken), payload);
      default: throw new Error('Acción no soportada: ' + action);
    }
  } catch (error) {
    throw new Error(error && error.message ? error.message : String(error));
  }
}

function bootstrapStatus_() {
  const sheet = getSheet_(USER_SHEET, ['usuario','salt','password_hash','nombre','rol','creado_en','activo']);
  return { hasUsers: sheet.getLastRow() > 1, app: APP_NAME };
}

function getDb_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('PORTAL_DB_SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (_) { props.deleteProperty('PORTAL_DB_SPREADSHEET_ID'); }
  }
  const ss = SpreadsheetApp.create('Portal SST - Base de datos');
  props.setProperty('PORTAL_DB_SPREADSHEET_ID', ss.getId());
  initializeSheet_(ss, USER_SHEET, ['usuario','salt','password_hash','nombre','rol','creado_en','activo']);
  initializeSheet_(ss, EMAIL_SHEET, ['fecha','pdf_origen','trabajador','destinatario','cc','cco','asunto','archivo','estado','detalle']);
  initializeSheet_(ss, CONSECUTIVE_SHEET, CONSECUTIVE_HEADERS);
  initializeSheet_(ss, CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS);
  return ss;
}

function initializeSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#dbeafe');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function getSheet_(name, headers) {
  return initializeSheet_(getDb_(), name, headers);
}

function findUserRow_(username) {
  const normalized = normalizeUsername_(username);
  const sheet = getSheet_(USER_SHEET, ['usuario','salt','password_hash','nombre','rol','creado_en','activo']);
  const last = sheet.getLastRow();
  if (last <= 1) return null;
  const values = sheet.getRange(2,1,last-1,7).getValues();
  for (let i=0;i<values.length;i++) {
    if (String(values[i][0]).toLowerCase() === normalized) return { sheet: sheet, row: i+2, values: values[i] };
  }
  return null;
}

function normalizeUsername_(value) {
  const user = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(user)) throw new Error('El usuario debe tener 3 a 64 caracteres y usar letras, números, punto, guion o guion bajo.');
  return user;
}

function validatePassword_(value) {
  const password = String(value || '');
  if (password.length < 6) throw new Error('La contraseña debe tener mínimo 6 caracteres.');
  if (password.length > 200) throw new Error('La contraseña es demasiado larga.');
  return password;
}

function pepper_() {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty('PASSWORD_PEPPER');
  if (!pepper) { pepper = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('PASSWORD_PEPPER', pepper); }
  return pepper;
}

function hexDigest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function(b){ const n = b < 0 ? b + 256 : b; return ('0' + n.toString(16)).slice(-2); }).join('');
}

function passwordHash_(password, salt) { return hexDigest_(String(salt) + '|' + String(password) + '|' + pepper_()); }

function register_(payload) {
  const name = String(payload.name || '').trim();
  const username = normalizeUsername_(payload.username);
  const password = validatePassword_(payload.password);
  if (!name) throw new Error('Ingresa el nombre completo.');
  if (findUserRow_(username)) throw new Error('Ese usuario ya existe.');
  const sheet = getSheet_(USER_SHEET, ['usuario','salt','password_hash','nombre','rol','creado_en','activo']);
  const role = sheet.getLastRow() <= 1 ? 'admin' : 'user';
  const salt = Utilities.getUuid();
  sheet.appendRow([username, salt, passwordHash_(password,salt), name, role, new Date(), true]);
  return createSession_({ username: username, name: name, role: role });
}

function login_(payload) {
  const username = normalizeUsername_(payload.username);
  const password = String(payload.password || '');
  const row = findUserRow_(username);
  if (!row || row.values[6] === false || String(row.values[6]).toLowerCase() === 'false') throw new Error('Usuario o contraseña incorrectos.');
  const expected = String(row.values[2]);
  if (passwordHash_(password, String(row.values[1])) !== expected) throw new Error('Usuario o contraseña incorrectos.');
  return createSession_({ username: username, name: String(row.values[3]), role: String(row.values[4] || 'user') });
}

function changePasswordPublic_(payload) {
  const username = normalizeUsername_(payload.username);
  const oldPassword = String(payload.oldPassword || '');
  const newPassword = validatePassword_(payload.newPassword);
  const row = findUserRow_(username);
  if (!row || passwordHash_(oldPassword, String(row.values[1])) !== String(row.values[2])) throw new Error('La contraseña actual no es correcta.');
  const salt = Utilities.getUuid();
  row.sheet.getRange(row.row,2,1,2).setValues([[salt,passwordHash_(newPassword,salt)]]);
  return { changed: true };
}

function changePassword_(user, payload) {
  return changePasswordPublic_({ username: user.username, oldPassword: payload.oldPassword, newPassword: payload.newPassword });
}

function createSession_(user) {
  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  const key = 'SESSION_' + hexDigest_(token);
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({ user: user, expiresAt: expiresAt }));
  return { sessionToken: token, user: user, expiresAt: new Date(expiresAt).toISOString() };
}

function requireSession_(token) {
  if (!token) throw new Error('La sesión ha expirado. Ingresa nuevamente.');
  const props = PropertiesService.getScriptProperties();
  const key = 'SESSION_' + hexDigest_(token);
  const raw = props.getProperty(key);
  if (!raw) throw new Error('La sesión ha expirado. Ingresa nuevamente.');
  let session;
  try { session = JSON.parse(raw); } catch (_) { props.deleteProperty(key); throw new Error('Sesión inválida.'); }
  if (!session.expiresAt || Number(session.expiresAt) < Date.now()) { props.deleteProperty(key); throw new Error('La sesión ha expirado. Ingresa nuevamente.'); }
  session.expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  props.setProperty(key, JSON.stringify(session));
  return session.user;
}

function requireAdmin_(token) {
  const user = requireSession_(token);
  if (String(user.role) !== 'admin') throw new Error('Esta configuración requiere una cuenta administradora.');
  return user;
}

function logout_(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('SESSION_' + hexDigest_(token));
  return { loggedOut: true };
}

function saveAiConfig_(user, payload) {
  const props = PropertiesService.getScriptProperties();
  const model = String(payload.model || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  if (model) props.setProperty('GEMINI_MODEL', model);
  const apiKey = String(payload.apiKey || '').trim();
  if (apiKey) props.setProperty('GEMINI_API_KEY', apiKey);
  return { saved: true, model: model || DEFAULT_GEMINI_MODEL, hasApiKey: !!props.getProperty('GEMINI_API_KEY') };
}


function assetsFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('ASSETS_FOLDER_ID');
  if (existing) {
    try { return DriveApp.getFolderById(existing); } catch (_) { props.deleteProperty('ASSETS_FOLDER_ID'); }
  }
  const folder = DriveApp.createFolder('Portal SST - Recursos compartidos');
  props.setProperty('ASSETS_FOLDER_ID', folder.getId());
  return folder;
}

function assetKey_(kind) {
  const clean = String(kind || '').toLowerCase();
  if (clean !== 'template' && clean !== 'signature') throw new Error('Tipo de recurso no válido.');
  return 'SHARED_ASSET_' + clean;
}

function saveSharedAsset_(user, payload) {
  const kind = String(payload.kind || '').toLowerCase();
  const key = assetKey_(kind);
  const base64 = String(payload.base64 || '');
  const name = String(payload.name || (kind === 'template' ? 'plantilla.docx' : 'firma.png'));
  const mime = String(payload.mime || 'application/octet-stream');
  const hash = String(payload.hash || '');
  if (!base64) throw new Error('No se recibió el archivo.');
  const props = PropertiesService.getScriptProperties();
  const oldRaw = props.getProperty(key);
  if (oldRaw) {
    try { const old = JSON.parse(oldRaw); if (old.fileId) DriveApp.getFileById(old.fileId).setTrashed(true); } catch (_) {}
  }
  const file = assetsFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, name));
  const meta = { fileId:file.getId(), name:name, mime:mime, hash:hash, updatedAt:new Date().toISOString(), updatedBy:user.username };
  props.setProperty(key, JSON.stringify(meta));
  return { saved:true, meta:meta };
}

function removeSharedAsset_(user, payload) {
  const key = assetKey_(payload.kind);
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(key);
  if (raw) {
    try { const meta = JSON.parse(raw); if (meta.fileId) DriveApp.getFileById(meta.fileId).setTrashed(true); } catch (_) {}
  }
  props.deleteProperty(key);
  return { removed:true };
}

function getSharedAssetsMeta_(user) {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  ['template','signature'].forEach(function(kind){
    const raw = props.getProperty(assetKey_(kind));
    if (raw) { try { const meta = JSON.parse(raw); out[kind] = { name:meta.name,mime:meta.mime,hash:meta.hash,updatedAt:meta.updatedAt }; } catch (_) {} }
  });
  return out;
}

function getSharedAsset_(user, payload) {
  const kind = String(payload.kind || '').toLowerCase();
  const raw = PropertiesService.getScriptProperties().getProperty(assetKey_(kind));
  if (!raw) return { found:false };
  const meta = JSON.parse(raw);
  const blob = DriveApp.getFileById(meta.fileId).getBlob();
  return { found:true, kind:kind, name:meta.name, mime:meta.mime, hash:meta.hash, updatedAt:meta.updatedAt, base64:Utilities.base64Encode(blob.getBytes()) };
}

function geminiSchema_() {
  return { type:'object', properties:{
    nombre:{type:'string'}, cargo:{type:'string'}, identificacion:{type:'string'}, correo:{type:'string'}, tipo_examen:{type:'string'}, lugar:{type:'string'}, fecha:{type:'string',description:'AAAA-MM-DD o vacío'},
    examenes_realizados:{type:'array',items:{type:'string'}}, recomendaciones_medicas:{type:'array',items:{type:'string'}}, recomendaciones_por_examen:{type:'array',items:{type:'object',properties:{examen:{type:'string'},recomendaciones:{type:'array',items:{type:'string'}}},required:['examen','recomendaciones']}},
    vigilancia_programa:{type:'array',items:{type:'string'}}, observaciones:{type:'string'}, remisiones:{type:'string'},
    evidencias:{type:'object',properties:{
      recomendaciones:{type:'array',items:{type:'string'}}, observaciones:{type:'string'}, remisiones:{type:'string'}, vigilancia_programa:{type:'string'}
    },required:['recomendaciones','observaciones','remisiones','vigilancia_programa']}
  }, required:['nombre','cargo','identificacion','correo','tipo_examen','lugar','fecha','examenes_realizados','recomendaciones_medicas','recomendaciones_por_examen','vigilancia_programa','observaciones','remisiones','evidencias'] };
}

function geminiPayload_(pdfBase64, prompt, model) {
  return { model:model, input:[{type:'document',data:pdfBase64,mime_type:'application/pdf'},{type:'text',text:prompt}], response_format:{type:'text',mime_type:'application/json',schema:geminiSchema_()}, generation_config:{temperature:0} };
}

function extractGeminiJson_(bodyText) {
  const body = JSON.parse(bodyText);
  let fragments = [];
  (body.steps || []).forEach(function(step){ if (step.type === 'model_output') (step.content || []).forEach(function(c){ if (c.text) fragments.push(c.text); }); });
  (body.outputs || []).forEach(function(out){ if (out.text) fragments.push(out.text); });
  let text = fragments.join('').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  if (!text) throw new Error('Gemini respondió sin JSON utilizable.');
  return JSON.parse(text);
}

function geminiRequest_(apiKey, model, pdfBase64, prompt) {
  const response = UrlFetchApp.fetch(GEMINI_INTERACTIONS_URL, {
    method:'post', contentType:'application/json', muteHttpExceptions:true,
    headers:{'x-goog-api-key':apiKey,'Api-Revision':'2026-05-20'}, payload:JSON.stringify(geminiPayload_(pdfBase64,prompt,model))
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    const detail = response.getContentText().slice(0,800);
    const err = new Error('Gemini HTTP ' + status + ': ' + detail); err.status = status; throw err;
  }
  return extractGeminiJson_(response.getContentText());
}

function uniqueStrings_(items) {
  const out = [], seen = {};
  (items || []).forEach(function(v){ const x=String(v||'').replace(/\s+/g,' ').trim(); const k=x.toLowerCase(); if(x&&!seen[k]){seen[k]=true;out.push(x);} });
  return out;
}

function mergeGeminiAudits_(first, second) {
  // La segunda lectura es una auditoría correctiva, no otra fuente acumulativa.
  if (!second) return first;
  const out = Object.assign({}, first || {});
  ['nombre','cargo','identificacion','correo','tipo_examen','lugar','fecha','observaciones','remisiones'].forEach(function(k){
    if (Object.prototype.hasOwnProperty.call(second, k)) out[k] = second[k];
  });
  ['examenes_realizados','recomendaciones_medicas','vigilancia_programa','recomendaciones_por_examen'].forEach(function(k){
    if (Array.isArray(second[k])) out[k] = second[k];
  });
  if (second.evidencias && typeof second.evidencias === 'object') out.evidencias = second.evidencias;
  return out;
}

function geminiAnalyze_(user, payload) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  if (!apiKey) throw new Error('Configura la API key de Gemini desde Configuración con una cuenta administradora.');
  const pdfBase64 = String(payload.pdfBase64 || '');
  if (!pdfBase64) throw new Error('No se recibió el PDF para validación visual.');
  const localData = payload.localData || {};
  const text = String(payload.text || '').slice(0,50000);
  const preferred = String(payload.model || props.getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  const models = [preferred, DEFAULT_GEMINI_MODEL, 'gemini-3.1-flash-lite'].filter(function(v,i,a){ return v && a.indexOf(v) === i; });
  const prompt = `Eres un AUDITOR DOCUMENTAL especializado en conceptos médicos ocupacionales colombianos. Tu tarea es EXTRAER lo que está escrito o marcado visualmente en el PDF; nunca completar por conocimiento clínico ni inferir datos que el documento no indique.

MÉTODO OBLIGATORIO:
A. Recorre visualmente cada página completa.
B. Identifica primero si cada bloque es tabla por filas, tabla por columnas, etiqueta/valor, casillas/checks o texto corrido.
C. Conserva las relaciones espaciales. Que una recomendación mencione «optometría» no significa que pertenezca a Optometría.
D. Usa el motor local y el texto reconstruido solo como apoyo; el PDF visual es la fuente de verdad.
E. Haz una segunda comprobación de recomendaciones, observaciones, PVE/SVE y remisiones antes de responder.

FORMATO TIPO A — MATRIZ + TRES COLUMNAS DE RECOMENDACIONES:
- Puede decir «El concepto de Aptitud se definió a partir de los siguientes exámenes practicados» y listar exámenes en dos columnas con chulos/checks.
- Después puede tener «RECOMENDACIONES MÉDICAS», «RECOMENDACIONES OCUPACIONALES» y «HÁBITOS Y ESTILO DE VIDA SALUDABLES».
- Todo lo de esas tres columnas es recomendación GENERAL, salvo relación explícita con examen.
- NO asocies «SVE VISUAL: ... CONTROL ANUAL POR OPTOMETRÍA» a Optometría solo por contener OPTOMETRÍA. Sí puede sustentar vigilancia visual porque dice SVE VISUAL.
- No descartes indicaciones cortas: «USO DE EPP», «CONTROL DE PESO», «HACER DEPORTE», «DIETA BALANCEADA», «HÁBITOS SALUDABLES».

FORMATO TIPO B — EXAMEN IZQUIERDA / RECOMENDACIÓN DERECHA:
- Puede decir «EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES».
- La celda izquierda es examen; la derecha es su recomendación.
- «OPTOMETRÍA | controles preventivos...» => recomendación de Optometría.
- «GLICEMIA | REALIZADO» => Glicemia sí es examen realizado, pero «REALIZADO» NO es recomendación.

REGLAS ESTRICTAS:
1. RECOMENDACIONES POR EXAMEN: relaciona solo por misma fila/celda, encabezado inequívoco o prefijo «Examen: recomendación». Nunca por palabras internas.
2. RECOMENDACIONES GENERALES: conserva recomendaciones médicas, ocupacionales y hábitos sin examen explícito. No resumas ni elimines recomendaciones cortas.
3. OBSERVACIONES: si existe el campo exacto «Observaciones: ...», conserva TODO su contenido como observación aunque diga «CONTROL DE PESO», «VALORACIÓN POR NUTRICIÓN», «PAUTAS ERGONÓMICAS» o «USO DE CORRECCIÓN ÓPTICA». Solo en «OTRAS OBSERVACIONES Y RECOMENDACIONES» separa observaciones descriptivas de recomendaciones.
4. REMISIONES: dentro de «Información de Remisiones» / «Remisiones», cada destino listado (ej. «NUTRICIÓN», «MEDICINA GENERAL EPS») ES remisión aunque no repita «remitir». Fuera de esa sección exige «se remite», «remisión a», «remitir a» o «interconsulta». Si dice No/No aplica/Sin remisiones, devuelve «No».
5. VIGILANCIA: dentro del bloque «Ingresar al Programa de Vigilancia Epidemiológica...» una fila «VISUAL | SVE» significa vigilancia visual. Una mención «SVE VISUAL: ...» también es evidencia. No infieras PVE/SVE solo por temática si no aparece PVE/SVE/programa o no está en el bloque dedicado.
6. EXÁMENES: conserva todos los listados/marcados como realizados. No conviertas «examen visual de control en un año» en examen realizado.
7. No mezcles restricciones, concepto de aptitud, consentimiento, firmas, diagnósticos o texto legal.
8. No inventes, no resumas, no parafrasees. Corrige solo espacios/tildes/OCR evidente.
9. EVIDENCIAS: devuelve fragmentos breves y literales del PDF para recomendaciones, observaciones, remisiones y vigilancia. Si no hay evidencia, no agregues el dato.

Motor local a auditar:
${JSON.stringify(localData)}

Texto reconstruido por geometría. Las tabulaciones representan separaciones físicas de columnas:
${text}`;
  let lastError = '';
  for (let i=0;i<models.length;i++) {
    const model = models[i];
    try {
      let first = geminiRequest_(apiKey, model, pdfBase64, prompt);
      let data = first;
      try {
        const auditPrompt = `AUDITORÍA FINAL ADVERSARIAL. Relee el PDF completo sin asumir que la primera extracción es correcta.

Verifica obligatoriamente:
- Tabla examen/recomendación: relación por FILA, no por palabras internas.
- Tres columnas médicas/ocupacionales/hábitos: conservar como generales salvo asociación explícita.
- «REALIZADO» es estado, no recomendación.
- «Observaciones:» conserva todo el campo.
- En «Información de Remisiones», NUTRICIÓN o MEDICINA GENERAL EPS son remisiones.
- En «Ingresar al Programa de Vigilancia...», «VISUAL | SVE» es vigilancia visual.
- Fuera de PVE/SVE no infieras programa por temática.
- No conviertas «control por ...» dentro de Observaciones en remisión.

Primera extracción (puede contener falsos positivos y puedes eliminarlos):
${JSON.stringify(first)}

Motor local (también puede equivocarse):
${JSON.stringify(localData)}

Devuelve el JSON COMPLETO corregido. Si algo no tiene evidencia visual, elimínalo. Incluye evidencias literales breves.`;
        const second = geminiRequest_(apiKey, model, pdfBase64, auditPrompt);
        data = mergeGeminiAudits_(first, second);
        data._segunda_revision_ia = true;
      } catch (_) { data._segunda_revision_ia = false; }
      data._modelo_usado = model;
      data._fragmentos_pendientes = [];
      return data;
    } catch (error) {
      lastError = error.message;
      if (error.status !== 404 && error.status !== 429 && error.status !== 503) break;
    }
  }
  throw new Error(lastError || 'Gemini no devolvió una extracción utilizable.');
}

function normalizeSheetId_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const id = match ? match[1] : raw;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('La URL o ID de Google Sheets no es válido.');
  return id;
}

function normalizeHeader_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}

function consecutiveConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: String(props.getProperty('CONSECUTIVE_SPREADSHEET_ID') || ''),
    sheetName: String(props.getProperty('CONSECUTIVE_SHEET_NAME') || CONSECUTIVE_SHEET),
    prefix: String(props.getProperty('CONSECUTIVE_PREFIX') || 'SST').replace(/[^A-Za-z0-9_-]/g,'').toUpperCase() || 'SST'
  };
}

function consecutiveSpreadsheet_() {
  const cfg = consecutiveConfig_();
  if (cfg.spreadsheetId) return SpreadsheetApp.openById(cfg.spreadsheetId);
  return getDb_();
}

function locateConsecutiveSheet_(ss) {
  const cfg = consecutiveConfig_();
  let sheet = ss.getSheetByName(cfg.sheetName);
  if (!sheet) sheet = ss.insertSheet(cfg.sheetName);
  if (sheet.getLastRow() === 0) initializeSheet_(ss, sheet.getName(), CONSECUTIVE_HEADERS);
  const maxRows = Math.min(Math.max(sheet.getLastRow(),1), 10);
  const maxCols = Math.min(Math.max(sheet.getLastColumn(), CONSECUTIVE_HEADERS.length), 50);
  const values = sheet.getRange(1,1,maxRows,maxCols).getDisplayValues();
  const accepted = [
    'CONSECUTIVO','CONSECUTIVO SST','NUMERO DE CONSECUTIVO','NUMERO CONSECUTIVO',
    'N CONSECUTIVO','NRO CONSECUTIVO','NO CONSECUTIVO','NUM CONSECUTIVO','NUMERO'
  ];
  let headerRow = -1, consecutiveCol = -1;
  for (let r=0;r<values.length;r++) {
    for (let c=0;c<values[r].length;c++) {
      const h = normalizeHeader_(values[r][c]);
      const matches = accepted.indexOf(h) >= 0 || /^(?:N|NO|NRO|NUM|NUMERO)?\s*CONSECUTIVO(?:\s+SST)?$/.test(h);
      if (matches) { headerRow=r+1; consecutiveCol=c+1; break; }
    }
    if (consecutiveCol > 0) break;
  }
  if (consecutiveCol < 0) {
    // No se pisa una hoja existente incompatible: se crea una hoja administrada por el bot.
    if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      let alt = ss.getSheetByName(CONSECUTIVE_SHEET + '_BOT');
      if (!alt) alt = ss.insertSheet(CONSECUTIVE_SHEET + '_BOT');
      if (alt.getLastRow() === 0) initializeSheet_(ss, alt.getName(), CONSECUTIVE_HEADERS);
      return locateConsecutiveSheetByName_(alt);
    }
  }
  return locateConsecutiveSheetByName_(sheet, headerRow, consecutiveCol);
}

function locateConsecutiveSheetByName_(sheet, knownHeaderRow, knownConsecutiveCol) {
  const maxCols = Math.max(sheet.getLastColumn(), CONSECUTIVE_HEADERS.length);
  let headerRow = knownHeaderRow || 1;
  let headers = sheet.getRange(headerRow,1,1,maxCols).getDisplayValues()[0];
  let map = {};
  headers.forEach(function(h,i){ const n=normalizeHeader_(h); if(n) map[n]=i+1; });
  let consecutiveCol = knownConsecutiveCol || map['CONSECUTIVO'] || map['CONSECUTIVO SST'] || map['NUMERO DE CONSECUTIVO'] || map['NUMERO CONSECUTIVO'] || map['N CONSECUTIVO'] || map['NRO CONSECUTIVO'] || map['NO CONSECUTIVO'] || map['NUM CONSECUTIVO'] || map['NUMERO'] || 1;
  return { sheet:sheet, headerRow:headerRow, headers:headers, map:map, consecutiveCol:consecutiveCol };
}

function parseConsecutiveNumber_(value, year, prefix) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  const years = raw.match(/20\d{2}/g) || [];
  if (years.length && years.indexOf(String(year)) < 0) return 0;
  const m = raw.match(/(\d+)\s*$/);
  return m ? Number(m[1]) || 0 : 0;
}

function findHeaderCol_(info, names) {
  for (let i=0;i<names.length;i++) { const col=info.map[normalizeHeader_(names[i])]; if(col)return col; }
  return 0;
}

function scanConsecutives_(info, year, prefix, documentKey) {
  const start = info.headerRow + 1, last = info.sheet.getLastRow();
  if (last < start) return { max:0, existing:'', rows:0 };
  const values = info.sheet.getRange(start,1,last-start+1,Math.max(info.sheet.getLastColumn(), info.consecutiveCol)).getDisplayValues();
  const keyCol = findHeaderCol_(info, ['hash_documento','hash documento','document_key','document key','hash']);
  const yearCol = findHeaderCol_(info, ['anio','año','year']);
  let max = 0, existing = '', rows = 0;
  values.forEach(function(row){
    const raw = String(row[info.consecutiveCol-1] || '').trim();
    if (!raw) return;
    if (yearCol) {
      const rowYear = String(row[yearCol-1] || '').match(/20\d{2}/);
      if (rowYear && rowYear[0] !== String(year)) return;
    }
    const parsed = parseConsecutiveNumber_(raw, year, prefix);
    if (parsed > 0) { max = Math.max(max, parsed); rows++; }
    if (documentKey && keyCol && String(row[keyCol-1]||'').trim() === documentKey) existing = raw;
  });
  return { max:max, existing:existing, rows:rows };
}

function consecutiveExists_(info, value) {
  const candidate = String(value || '').trim();
  if (!candidate) return false;
  const start = info.headerRow + 1, last = info.sheet.getLastRow();
  if (last < start) return false;
  const values = info.sheet.getRange(start, info.consecutiveCol, last-start+1, 1).getDisplayValues();
  return values.some(function(row){ return String(row[0] || '').trim() === candidate; });
}

function ledgerLookup_(documentKey, spreadsheetId, sheetName) {
  if (!documentKey) return '';
  const sheet = getSheet_(CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS);
  const last = sheet.getLastRow();
  if (last <= 1) return '';
  const rows = sheet.getRange(2,1,last-1,5).getDisplayValues();
  for (let i=rows.length-1;i>=0;i--) {
    if (String(rows[i][0]||'').trim() === documentKey &&
        String(rows[i][2]||'').trim() === String(spreadsheetId||'') &&
        String(rows[i][3]||'').trim() === String(sheetName||'')) return String(rows[i][1]||'').trim();
  }
  return '';
}

function ledgerSave_(documentKey, consecutive, spreadsheetId, sheetName) {
  if (!documentKey || !consecutive) return;
  const sheet = getSheet_(CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS);
  sheet.appendRow([documentKey, consecutive, spreadsheetId, sheetName, new Date()]);
}

function appendConsecutive_(info, values) {
  const width = Math.max(info.sheet.getLastColumn(), info.headers.length, CONSECUTIVE_HEADERS.length);
  const row = new Array(width).fill('');
  function put(names, value) { const c=findHeaderCol_(info,names); if(c)row[c-1]=value; }
  put(['numero'], values.number);
  put(['consecutivo','numero de consecutivo','n consecutivo','no consecutivo'], values.consecutive);
  put(['anio','año'], values.year);
  put(['fecha_documento','fecha documento','fecha'], values.date);
  put(['trabajador','nombre','colaborador'], values.name);
  put(['identificacion','documento','cedula','cédula'], values.identification);
  put(['cargo','rol'], values.role);
  put(['tipo_examen','tipo examen','examen'], values.exam);
  put(['pdf_origen','pdf origen','archivo','documento origen'], values.sourceFile);
  put(['hash_documento','hash documento','document_key','document key','hash'], values.documentKey);
  put(['usuario'], values.user);
  put(['creado_en','creado en','timestamp'], new Date());
  // Si la hoja solo tiene una columna de consecutivo reconocible, al menos escribe allí.
  if (!row[info.consecutiveCol-1]) row[info.consecutiveCol-1] = values.consecutive;
  info.sheet.getRange(info.sheet.getLastRow()+1,1,1,width).setValues([row]);
}

function consecutiveStatus_(user) {
  const cfg = consecutiveConfig_();
  const ss = consecutiveSpreadsheet_();
  const info = locateConsecutiveSheet_(ss);
  const year = new Date().getFullYear();
  const scan = scanConsecutives_(info, year, cfg.prefix, '');
  return { configured:!!cfg.spreadsheetId, spreadsheetName:ss.getName(), spreadsheetId:ss.getId(), sheetName:info.sheet.getName(), prefix:cfg.prefix, current:scan.max, next:scan.max+1, rowsRead:scan.rows, headerRow:info.headerRow, consecutiveColumn:info.consecutiveCol };
}

function saveConsecutiveConfig_(user, payload) {
  const props = PropertiesService.getScriptProperties();
  const id = normalizeSheetId_(payload.spreadsheetUrlOrId || '');
  const sheetName = String(payload.sheetName || CONSECUTIVE_SHEET).trim() || CONSECUTIVE_SHEET;
  const prefix = String(payload.prefix || 'SST').replace(/[^A-Za-z0-9_-]/g,'').toUpperCase() || 'SST';
  if (id) {
    const ss = SpreadsheetApp.openById(id); // valida permisos antes de guardar
    props.setProperty('CONSECUTIVE_SPREADSHEET_ID', ss.getId());
  } else props.deleteProperty('CONSECUTIVE_SPREADSHEET_ID');
  props.setProperty('CONSECUTIVE_SHEET_NAME', sheetName);
  props.setProperty('CONSECUTIVE_PREFIX', prefix);
  return consecutiveStatus_(user);
}

function nextConsecutive_(user, payload) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const cfg = consecutiveConfig_();
    const ss = consecutiveSpreadsheet_();
    const info = locateConsecutiveSheet_(ss);
    const year = new Date().getFullYear();
    const documentKey = String(payload.documentKey || payload.hash || '').trim();
    const scan = scanConsecutives_(info, year, cfg.prefix, documentKey);
    if (scan.existing) {
      const existingNumber=parseConsecutiveNumber_(scan.existing,year,cfg.prefix);
      const existingFormatted=/^\d+$/.test(scan.existing)?(cfg.prefix+'-'+year+'-'+existingNumber):scan.existing;
      ledgerSave_(documentKey, existingFormatted, ss.getId(), info.sheet.getName());
      return { consecutive:existingFormatted, reused:true, source:'Google Sheets', sheetName:info.sheet.getName() };
    }
    const ledgerExisting = ledgerLookup_(documentKey, ss.getId(), info.sheet.getName());
    if (ledgerExisting && consecutiveExists_(info, ledgerExisting)) {
      return { consecutive:ledgerExisting, reused:true, source:'Google Sheets + control', sheetName:info.sheet.getName() };
    }
    const next = scan.max + 1;
    const consecutive = cfg.prefix + '-' + year + '-' + next;
    appendConsecutive_(info, {
      number:next, consecutive:consecutive, year:year, date:String(payload.date||''), name:String(payload.name||''),
      identification:String(payload.identification||''), role:String(payload.role||''), exam:String(payload.exam||''),
      sourceFile:String(payload.sourceFile||''), documentKey:documentKey, user:String(user.username||'')
    });
    SpreadsheetApp.flush();
    ledgerSave_(documentKey, consecutive, ss.getId(), info.sheet.getName());
    return { consecutive:consecutive, reused:false, source:'Google Sheets', sheetName:info.sheet.getName(), number:next };
  } finally { lock.releaseLock(); }
}

function cleanEmailList_(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/);
  const seen = {};
  return source.map(function(x){return String(x||'').trim().toLowerCase();}).filter(function(x){if(!x||seen[x])return false;seen[x]=true;return true;});
}

function validEmail_(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }

function authorizePortalServices() {
  const quota = MailApp.getRemainingDailyQuota();
  const db = getDb_();
  DriveApp.getRootFolder().getName();
  return { authorized:true, mailQuota:quota, database:db.getName() };
}

function mailStatus_(user) {
  let quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); }
  catch (error) { throw new Error('Apps Script no tiene autorización para enviar correo: ' + (error.message || error)); }
  let sender = '';
  try { sender = Session.getEffectiveUser().getEmail() || ''; } catch (_) {}
  return { ready:quota > 0, remainingQuota:quota, sender:sender, service:'MailApp', detail:quota > 0 ? 'Servicio autorizado.' : 'La cuota diaria de correo está agotada.' };
}

function sendEmail_(user, payload) {
  const to = String(payload.to || '').trim().toLowerCase();
  const cc = cleanEmailList_(payload.cc).filter(validEmail_).filter(function(x){return x !== to;});
  const bcc = cleanEmailList_(payload.bcc).filter(validEmail_).filter(function(x){return x !== to && cc.indexOf(x) < 0;});
  const subject = String(payload.subject || '').trim(), body = String(payload.body || '').trim();
  const attachment = payload.attachment || {};
  const baseHistory = { date:new Date().toISOString(), sourceFile:String(payload.sourceFile||''), worker:String(payload.personName||''), to:to, cc:cc.join(', '), bcc:bcc.join(', '), subject:subject, file:String(attachment.filename||'') };
  try {
    if (!validEmail_(to)) throw new Error('El destinatario no es válido: ' + (to || '(vacío)'));
    if (!subject || !body) throw new Error('El asunto y el cuerpo del mensaje no pueden estar vacíos.');
    if (!attachment.base64 || !attachment.filename) throw new Error('No se recibió el documento adjunto.');
    const bytes = Utilities.base64Decode(String(attachment.base64));
    if (bytes.length > 20 * 1024 * 1024) throw new Error('El adjunto supera 20 MB. Reduce el tamaño antes de enviarlo.');
    const blob = Utilities.newBlob(bytes, String(attachment.mime || 'application/octet-stream'), String(attachment.filename));
    const options = {
      to:to, subject:subject, body:body, htmlBody:String(body).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'),
      attachments:[blob], name:'Seguridad y Salud en el Trabajo - JER S.A.'
    };
    if (cc.length) options.cc = cc.join(',');
    if (bcc.length) options.bcc = bcc.join(',');
    MailApp.sendEmail(options);
    const history = Object.assign({}, baseHistory, { status:'Enviado', detail:'Mensaje aceptado por MailApp.' });
    appendEmailHistory_(history);
    return { sent:true, history:history, remainingQuota:MailApp.getRemainingDailyQuota() };
  } catch (error) {
    const history = Object.assign({}, baseHistory, { status:'Error', detail:error && error.message ? error.message : String(error) });
    try { appendEmailHistory_(history); } catch (_) {}
    throw new Error(history.detail);
  }
}

function appendEmailHistory_(h) {
  const sheet = getSheet_(EMAIL_SHEET, ['fecha','pdf_origen','trabajador','destinatario','cc','cco','asunto','archivo','estado','detalle']);
  sheet.appendRow([new Date(h.date),h.sourceFile,h.worker,h.to,h.cc,h.bcc,h.subject,h.file,h.status,h.detail]);
}

function emailHistory_(user, payload) {
  const limit = Math.max(1,Math.min(500,Number(payload.limit || 200)));
  const sheet = getSheet_(EMAIL_SHEET, ['fecha','pdf_origen','trabajador','destinatario','cc','cco','asunto','archivo','estado','detalle']);
  const last = sheet.getLastRow(); if (last <= 1) return { items:[] };
  const start = Math.max(2,last-limit+1), count = last-start+1;
  const rows = sheet.getRange(start,1,count,10).getValues().reverse();
  return { items: rows.map(function(r){return {date:r[0] instanceof Date?r[0].toISOString():String(r[0]||''),sourceFile:String(r[1]||''),worker:String(r[2]||''),to:String(r[3]||''),cc:String(r[4]||''),bcc:String(r[5]||''),subject:String(r[6]||''),file:String(r[7]||''),status:String(r[8]||''),detail:String(r[9]||'')};}) };
}
