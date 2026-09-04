const APP_NAME = 'Portal SST · Recomendaciones Médicas';
const BACKEND_VERSION = '2026.09.04-v10.9-two-sheet-routing';
const GEMINI_GENERATE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const SESSION_HOURS = 8;
const USER_SHEET = 'Usuarios';
const EMAIL_SHEET = 'HistorialCorreos';
const CORRESPONDENCE_SHEET = 'Correspondencia Enviada';
const SST_LOG_SPREADSHEET_NAME = 'CORRESPONDENCIA ENVIADA SST 2026';
const SST_LOG_SHEET_NAME = 'Hoja 1';
const CONSECUTIVE_SPREADSHEET_NAME = 'CORRESPONDENCIA ENVIADA (1)';
const CONSECUTIVE_EXTERNAL_SHEET_NAME = 'CONSECUTIVOS 2026';
const SST_LOG_HEADERS = ['CONSECUTIVO','FECHA','NOMBRE','CARGO','EXAMEN'];
const CONSECUTIVE_REGISTER_HEADERS = ['CONSECUTIVO','FECHA','NOMBRE','ASUNTO'];
const RECOMMENDATION_REGISTER_LABEL = 'RECOMENDACIÓN MEDICA';
const CORRESPONDENCE_FIELDS = [
  {key:'sentAt', header:'FECHA ENVIO', aliases:['fecha envio','fecha de envio','fecha enviada','fecha','fecha correspondencia']},
  {key:'consecutive', header:'CONSECUTIVO', aliases:['consecutivo','consecutivo sst','numero consecutivo','numero de consecutivo','n consecutivo','nro consecutivo']},
  {key:'worker', header:'TRABAJADOR', aliases:['trabajador','colaborador','funcionario','nombre','nombre trabajador','nombre del trabajador']},
  {key:'identification', header:'IDENTIFICACION', aliases:['identificacion','identificación','cedula','cédula','numero identificacion','número identificación','numero de identificacion','documento identidad']},
  {key:'recipient', header:'DESTINATARIO', aliases:['destinatario','correo destinatario','email destinatario','para','correo']},
  {key:'cc', header:'CC', aliases:['cc','copia','con copia']},
  {key:'bcc', header:'CCO', aliases:['cco','bcc','copia oculta']},
  {key:'subject', header:'ASUNTO', aliases:['asunto','descripcion','descripción','tipo correspondencia','tipo de correspondencia']},
  {key:'exam', header:'TIPO EXAMEN', aliases:['tipo examen','tipo de examen','examen medico','examen médico']},
  {key:'sourceFile', header:'PDF ORIGEN', aliases:['pdf origen','pdf_origen','archivo origen','documento origen','archivo fuente']},
  {key:'attachments', header:'ARCHIVOS ENVIADOS', aliases:['archivos enviados','archivo enviado','adjuntos','anexos','archivo','documentos enviados']},
  {key:'formats', header:'FORMATO', aliases:['formato','tipo archivo','tipo de archivo','formato envio','formato de envio']},
  {key:'status', header:'ESTADO', aliases:['estado','estado envio','estado de envio']},
  {key:'detail', header:'DETALLE', aliases:['detalle','observaciones','observacion','resultado']},
  {key:'documentKey', header:'DOCUMENT_KEY', aliases:['document_key','document key','hash_documento','hash documento','hash']},
  {key:'user', header:'USUARIO', aliases:['usuario','enviado por','responsable']},
  {key:'updatedAt', header:'ACTUALIZADO EN', aliases:['actualizado en','actualizado_en','timestamp','fecha registro']}
];
const CONSECUTIVE_SHEET = 'Consecutivos';
const CONSECUTIVE_LEDGER_SHEET = 'ConsecutivosControl';
const CONSECUTIVE_LEDGER_HEADERS = ['document_key','consecutivo','spreadsheet_id','sheet_name','creado_en'];
const DOCUMENT_SHEET = 'DocumentosProcesados';
const DOCUMENT_HEADERS = ['document_key','pdf_origen','trabajador','identificacion','correo','cargo','tipo_examen','fecha_examen','lugar','examenes_realizados','estados_examenes','recomendaciones','restricciones','observaciones','remisiones','vigilancia_programa','perfil_documental','calidad_extraccion','validado_ia','campos_revision','consecutivo','estado_sincronizacion','usuario','creado_en','actualizado_en'];

// V10.7: la hoja externa de consecutivos deja de ser solo un contador. Cuando un
// certificado ya tiene consecutivo, la MISMA fila se completa con su ficha SST.
// Los encabezados existentes se respetan; únicamente se agregan al final los campos
// que no tengan una columna equivalente reconocible.
const CONSECUTIVE_DATA_FIELDS = [
  { key:'date', header:'FECHA DOCUMENTO', aliases:['fecha_documento','fecha documento','fecha','fecha examen','fecha del examen'] },
  { key:'name', header:'TRABAJADOR', aliases:['trabajador','nombre','colaborador','nombre trabajador','nombre del trabajador'] },
  { key:'identification', header:'IDENTIFICACION', aliases:['identificacion','identificación','cedula','cédula','numero identificacion','número identificación','numero de identificacion'] },
  { key:'role', header:'CARGO', aliases:['cargo','rol','puesto','puesto de trabajo'] },
  { key:'exam', header:'TIPO EXAMEN', aliases:['tipo_examen','tipo examen','tipo de examen','examen medico','examen médico','tipo examen medico','tipo de examen medico'] },
  { key:'subject', header:'ASUNTO', aliases:['asunto','tipo documento','tipo de documento','descripcion documento','descripción documento'] },
  { key:'sourceFile', header:'PDF ORIGEN', aliases:['pdf_origen','pdf origen','archivo','archivo origen','documento origen'] },
  { key:'exams', header:'EXAMENES REALIZADOS', aliases:['examenes realizados','exámenes realizados','lista examenes','lista de examenes'] },
  { key:'statuses', header:'ESTADOS EXAMENES', aliases:['estados examenes','estados exámenes','estado por examen','estados por examen'] },
  { key:'recommendations', header:'RECOMENDACIONES', aliases:['recomendaciones','recomendaciones medicas','recomendaciones médicas','detalle recomendaciones'] },
  { key:'restrictions', header:'RESTRICCIONES', aliases:['restricciones','restricciones laborales','restriccion','restricción'] },
  { key:'observations', header:'OBSERVACIONES', aliases:['observaciones','observacion','observación'] },
  { key:'referrals', header:'REMISIONES', aliases:['remisiones','remision','remisión','informacion de remisiones','información de remisiones'] },
  { key:'surveillance', header:'PROGRAMA VIGILANCIA', aliases:['programa vigilancia','programa de vigilancia','vigilancia programa','pve','sve'] },
  { key:'location', header:'LUGAR', aliases:['lugar','ciudad','sede'] },
  { key:'profile', header:'PERFIL DOCUMENTAL', aliases:['perfil documental','formato detectado','perfil detectado'] },
  { key:'quality', header:'CALIDAD EXTRACCION', aliases:['calidad extraccion','calidad extracción','confianza extraccion','confianza extracción'] },
  { key:'aiValidated', header:'VALIDADO IA', aliases:['validado ia','validacion ia','validación ia'] },
  { key:'reviewFields', header:'CAMPOS REVISION', aliases:['campos revision','campos revisión','pendientes revision','pendientes revisión'] },
  { key:'syncState', header:'ESTADO SINCRONIZACION', aliases:['estado sincronizacion','estado sincronización','sincronizacion','sincronización'] },
  { key:'documentKey', header:'DOCUMENT_KEY', aliases:['hash_documento','hash documento','document_key','document key','hash'] },
  { key:'user', header:'USUARIO', aliases:['usuario','creado por','actualizado por'] },
  { key:'updatedAt', header:'ACTUALIZADO EN', aliases:['actualizado_en','actualizado en','fecha actualizacion','fecha actualización'] }
];
const DIAGNOSTIC_SHEET = 'DiagnosticoBackend';
const DIAGNOSTIC_HEADERS = ['fecha','usuario','backend_version','prueba','resultado'];
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
      case 'ping': return { ok: true, message: 'Google Apps Script conectado', app: APP_NAME, backendVersion: BACKEND_VERSION, capabilities:['documentSync','sheetDiagnostics','batchConsecutives','twoSheetRouting','sstLogSync','correspondenceSync','geminiAudit','email','emailMultiAttachment'], time: new Date().toISOString() };
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
      case 'aiStatus': return aiStatus_(requireSession_(sessionToken));
      case 'nextConsecutive': return nextConsecutive_(requireSession_(sessionToken), payload);
      case 'reserveConsecutives': return reserveConsecutives_(requireSession_(sessionToken), payload);
      case 'consecutiveStatus': return consecutiveStatus_(requireSession_(sessionToken));
      case 'saveConsecutiveConfig': return saveConsecutiveConfig_(requireAdmin_(sessionToken), payload);
      case 'syncConsecutiveRecord': return syncConsecutiveRecords_(requireSession_(sessionToken), {items:[payload]});
      case 'syncConsecutiveRecords': return syncConsecutiveRecords_(requireSession_(sessionToken), payload);
      case 'correspondenceStatus': return correspondenceStatus_(requireSession_(sessionToken));
      case 'saveDocumentRecord': return saveDocumentRecords_(requireSession_(sessionToken), {items:[payload]} );
      case 'saveDocumentRecords': return saveDocumentRecords_(requireSession_(sessionToken), payload);
      case 'documentSyncStatus': return documentSyncStatus_(requireSession_(sessionToken));
      case 'backendDiagnostics': return backendDiagnostics_(requireSession_(sessionToken), payload);
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
  initializeSheet_(ss, DOCUMENT_SHEET, DOCUMENT_HEADERS);
  initializeSheet_(ss, DIAGNOSTIC_SHEET, DIAGNOSTIC_HEADERS);
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
  return { type:'OBJECT', properties:{
    nombre:{type:'STRING'}, cargo:{type:'STRING'}, identificacion:{type:'STRING'}, correo:{type:'STRING'}, tipo_examen:{type:'STRING'}, lugar:{type:'STRING'}, fecha:{type:'STRING',description:'AAAA-MM-DD o vacío'},
    examenes_realizados:{type:'ARRAY',items:{type:'STRING'}}, estados_por_examen:{type:'ARRAY',items:{type:'OBJECT',properties:{examen:{type:'STRING'},estado:{type:'STRING'}},required:['examen','estado']}}, recomendaciones_medicas:{type:'ARRAY',items:{type:'STRING'}}, recomendaciones_por_examen:{type:'ARRAY',items:{type:'OBJECT',properties:{examen:{type:'STRING'},recomendaciones:{type:'ARRAY',items:{type:'STRING'}}},required:['examen','recomendaciones']}},
    restricciones_laborales:{type:'ARRAY',items:{type:'OBJECT',properties:{tipo:{type:'STRING'},texto:{type:'STRING'}},required:['tipo','texto']}},
    vigilancia_programa:{type:'ARRAY',items:{type:'STRING'}}, observaciones:{type:'STRING'}, remisiones:{type:'STRING'}, revision_requerida:{type:'BOOLEAN'},
    evidencias:{type:'OBJECT',properties:{
      recomendaciones:{type:'ARRAY',items:{type:'STRING'}}, restricciones:{type:'ARRAY',items:{type:'STRING'}}, observaciones:{type:'STRING'}, remisiones:{type:'STRING'}, vigilancia_programa:{type:'STRING'}
    },required:['recomendaciones','restricciones','observaciones','remisiones','vigilancia_programa']}
  }, required:['nombre','cargo','identificacion','correo','tipo_examen','lugar','fecha','examenes_realizados','estados_por_examen','recomendaciones_medicas','recomendaciones_por_examen','restricciones_laborales','vigilancia_programa','observaciones','remisiones','revision_requerida','evidencias'] };
}

function geminiPayload_(pdfBase64, prompt) {
  return {
    contents:[{ role:'user', parts:[
      { inlineData:{ mimeType:'application/pdf', data:pdfBase64 } },
      { text:prompt }
    ]}],
    generationConfig:{
      responseMimeType:'application/json',
      responseSchema:geminiSchema_(),
      // Extracción documental estructurada: 'low' reduce latencia en lotes sin desactivar
      // la comprobación multimodal. El esquema JSON mantiene la salida determinística.
      thinkingConfig:{ thinkingLevel:'low' }
    }
  };
}

function extractGeminiJson_(bodyText) {
  const body = JSON.parse(bodyText);
  const parts = (((body.candidates || [])[0] || {}).content || {}).parts || [];
  let text = parts.map(function(part){ return part && part.text ? part.text : ''; }).join('').trim();
  text = text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  if (!text) {
    const reason = (((body.candidates || [])[0] || {}).finishReason || body.promptFeedback?.blockReason || 'sin contenido');
    throw new Error('Gemini respondió sin JSON utilizable (' + reason + ').');
  }
  try { return JSON.parse(text); }
  catch (error) { throw new Error('Gemini devolvió JSON inválido: ' + text.slice(0,600)); }
}

function geminiRequest_(apiKey, model, pdfBase64, prompt) {
  const cleanModel = String(model || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  const url = GEMINI_GENERATE_BASE_URL + encodeURIComponent(cleanModel) + ':generateContent';
  let lastError = null;
  for (let attempt=0; attempt<3; attempt++) {
    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        method:'post',
        contentType:'application/json',
        muteHttpExceptions:true,
        headers:{'x-goog-api-key':apiKey},
        payload:JSON.stringify(geminiPayload_(pdfBase64,prompt))
      });
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      if (/script\.external_request|UrlFetchApp|permiso|permission|authorization/i.test(msg)) {
        throw new Error('Gemini no está autorizado en Apps Script. Ejecuta manualmente authorizePortalServices() desde el editor, acepta el permiso de solicitudes externas y vuelve a publicar una nueva versión de la Web App. Detalle: ' + msg);
      }
      lastError = error;
      if (attempt < 2) { Utilities.sleep(900 * Math.pow(2,attempt)); continue; }
      throw error;
    }
    const status = response.getResponseCode();
    if (status >= 200 && status < 300) return extractGeminiJson_(response.getContentText());
    const detail = response.getContentText().slice(0,1200);
    const err = new Error('Gemini HTTP ' + status + ': ' + detail); err.status = status; lastError = err;
    // En procesamiento masivo, 429/503 pueden ser transitorios. Reintenta el mismo modelo
    // con backoff antes de saltar a otro modelo o marcar el PDF como pendiente.
    if ((status === 429 || status === 503 || status === 500) && attempt < 2) {
      Utilities.sleep(1200 * Math.pow(2,attempt));
      continue;
    }
    throw err;
  }
  throw lastError || new Error('Gemini no respondió.');
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
  ['examenes_realizados','estados_por_examen','recomendaciones_medicas','restricciones_laborales','vigilancia_programa','recomendaciones_por_examen'].forEach(function(k){
    if (Array.isArray(second[k])) out[k] = second[k];
  });
  if (Object.prototype.hasOwnProperty.call(second, 'revision_requerida')) out.revision_requerida = !!second.revision_requerida;
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
  const profileId = String(payload.profileId || localData?.perfil_detectado?.id || '').trim();
  const profileConfidence = Number(payload.profileConfidence || localData?.confianza_formato || 0);
  const text = String(payload.text || '').slice(0,50000);
  const preferred = String(payload.model || props.getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  const models = [preferred, DEFAULT_GEMINI_MODEL, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(function(v,i,a){ return v && a.indexOf(v) === i; });
  const prompt = `Eres un AUDITOR DOCUMENTAL especializado en conceptos médicos ocupacionales colombianos. Tu tarea es EXTRAER lo que está escrito o marcado visualmente en el PDF; nunca completar por conocimiento clínico ni inferir datos que el documento no indique.

MÉTODO OBLIGATORIO:
A. Recorre visualmente cada página completa.
B. Identifica primero si cada bloque es tabla por filas, tabla por columnas, etiqueta/valor, casillas/checks o texto corrido.
C. Conserva las relaciones espaciales. Que una recomendación mencione «optometría» no significa que pertenezca a Optometría.
D. Usa el motor local y el texto reconstruido solo como apoyo; el PDF visual es la fuente de verdad.
E. Haz una comprobación interna de recomendaciones, restricciones, observaciones, PVE/SVE y remisiones antes de responder.
F. El motor determinístico detectó el perfil "${profileId || 'NO_DETERMINADO'}" con confianza ${profileConfidence || 0}/100. Úsalo como pista, nunca como fuente de verdad.

FORMATO TIPO A — MATRIZ + TRES COLUMNAS DE RECOMENDACIONES:
- Puede decir «El concepto de Aptitud se definió a partir de los siguientes exámenes practicados» y listar exámenes en dos columnas con chulos/checks.
- Después puede tener «RECOMENDACIONES MÉDICAS», «RECOMENDACIONES OCUPACIONALES» y «HÁBITOS Y ESTILO DE VIDA SALUDABLES».
- Conserva íntegramente las tres columnas. Primero clasifica cada frase como recomendación transversal o como recomendación asociable a un examen.
- En este formato SÍ puedes asociar una recomendación a un examen cuando exista una relación semántica fuerte e inequívoca: visual/óptica/optometría/astigmatismo/presbicia → Optometría; ortopedia/espalda/ergonomía/higiene postural/pausas activas → Énfasis osteomuscular; auditivo/audiometría/ruido → Audiometría; respiratorio/espirometría → Espirometría; cardiaco/electrocardiograma → Electrocardiograma.
- NO fuerces asociación para recomendaciones transversales como «USO DE EPP», «HÁBITOS SALUDABLES», «CONTROL DE PESO», «HACER DEPORTE» o «DIETA BALANCEADA»; déjalas en Recomendaciones generales.
- «EXAMEN VISUAL DE CONTROL EN UN AÑO» y «SVE VISUAL: ... CONTROL ANUAL POR OPTOMETRÍA» son recomendaciones visuales y pueden asociarse a Optometría sin resumir su texto. La mención SVE VISUAL además sustenta vigilancia visual.
- No descartes indicaciones cortas y no resumas ninguna recomendación.

FORMATO TIPO B — EXAMEN IZQUIERDA / RECOMENDACIÓN DERECHA:
- Puede decir «EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES».
- La celda izquierda es examen; la derecha es su recomendación.
- EJEMPLO REAL que debes respetar literalmente:
  OPTOMETRÍA | CONTROL ANUAL // CONTINUAR USO PERMANENTE DE RX ÓPTICA // PAUSAS ACTIVAS VISUALES
  EXAMEN MÉDICO OCUPACIONAL | CONTINUAR CON USO ADECUADO DE ELEMENTOS DE PROTECCIÓN PERSONAL, SEGUIR PAUTAS DE HIGIENE POSTURAL, REALIZAR PAUSAS ACTIVAS DE 5 MINUTOS POR LO MENOS CADA 2 HORAS, AUTORREGULADAS, HÁBITOS DE VIDA SALUDABLE, EN LO POSIBLE REALIZAR ACTIVIDAD FÍSICA REGULAR
  ÉNFASIS OSTEOMUSCULAR | REALIZADO
  Resultado esperado: conserva COMPLETAS las dos primeras recomendaciones; «REALIZADO» es estado del tercer examen y no debe convertirse en recomendación.
- «OPTOMETRÍA | controles preventivos...» => recomendación de Optometría.
- «GLICEMIA | REALIZADO» => Glicemia sí es examen realizado, pero «REALIZADO» NO es recomendación. Debe aparecer también en estados_por_examen como {examen:"Glicemia", estado:"Realizado"}.
- La misma regla aplica a cualquier examen, incluso si su nombre no está en ejemplos previos: PERFIL LIPÍDICO, KOH DE UÑAS, COPROLÓGICO, FROTIS FARÍNGEO, ÉNFASIS CARDIOVASCULAR, ÉNFASIS OSTEOMUSCULAR y futuros nombres del proveedor.
- Si la recomendación se parte en varias líneas visuales, une todas esas líneas a la misma fila/examen hasta que empiece otro examen o una nueva sección. No pierdas palabras por saltos de línea.

TIPO DE EXAMEN — REGLA ESPECIAL V10.3:
- Si el PDF tiene un campo o valor explícito de tipo de examen/concepto (por ejemplo «EXAMEN DE SEGUIMIENTO CON RESTRICCIONES» o «CONTROL PERIÓDICO CON RECOMENDACIONES»), copia ese texto con la mayor fidelidad posible en tipo_examen; no lo reemplaces por una paráfrasis más corta.
- Expresiones equivalentes de una misma familia no constituyen contradicción por sí solas: «seguimiento laboral», «seguimiento ocupacional», «control de seguimiento» y «examen de seguimiento con restricciones» pertenecen a SEGUIMIENTO; «control periódico con recomendaciones», «examen periódico» y «evaluación médica ocupacional periódica» pertenecen a PERIÓDICO; «preingreso/preocupacional» a INGRESO; «retiro» a EGRESO; «post incapacidad/reintegro/reincorporación» a POST INCAPACIDAD.
- revision_requerida NO debe activarse únicamente porque el motor local y tu salida usen redacciones diferentes dentro de la misma familia semántica.
- Sí debe existir revisión cuando las categorías sean materialmente distintas (por ejemplo INGRESO vs EGRESO, PERIÓDICO vs SEGUIMIENTO) y el PDF no permita resolver cuál es correcta.

REGLAS ESTRICTAS:
1. RECOMENDACIONES POR EXAMEN: en el formato B relaciona por misma fila/celda, encabezado inequívoco o prefijo «Examen: recomendación». En el formato A permite relación semántica FUERTE según las reglas anteriores. Incluye TODOS los exámenes realizados en recomendaciones_por_examen; si un examen no tiene recomendación sustentada usa lista vacía. Si su celda dice REALIZADO/NORMAL/NO APLICA/APTO, deja recomendaciones vacías y registra ese valor en estados_por_examen.
2. RECOMENDACIONES GENERALES: conserva las recomendaciones transversales y las que no puedan asociarse con suficiente certeza. No resumas, no parafrasees y no elimines detalles; cada elemento debe conservar el texto clínico completo.
3. OBSERVACIONES: si existe el campo exacto «Observaciones: ...», conserva TODO su contenido como observación aunque diga «CONTROL DE PESO», «VALORACIÓN POR NUTRICIÓN», «PAUTAS ERGONÓMICAS» o «USO DE CORRECCIÓN ÓPTICA». Solo en «OTRAS OBSERVACIONES Y RECOMENDACIONES» separa observaciones descriptivas de recomendaciones.
4. REMISIONES: dentro de «Información de Remisiones» / «Remisiones», cada destino listado (ej. «NUTRICIÓN», «MEDICINA GENERAL EPS») ES remisión aunque no repita «remitir». Fuera de esa sección exige «se remite», «remisión a», «remitir a» o «interconsulta». Si dice No/No aplica/Sin remisiones, devuelve «No».
5. VIGILANCIA: dentro del bloque «Ingresar al Programa de Vigilancia Epidemiológica...» una fila «VISUAL | SVE» significa vigilancia visual. Una mención «SVE VISUAL: ...» también es evidencia. No infieras PVE/SVE solo por temática si no aparece PVE/SVE/programa o no está en el bloque dedicado.
6. EXÁMENES: conserva todos los listados/marcados como realizados. No conviertas «examen visual de control en un año» en examen realizado.
7. RESTRICCIONES: extrae exclusivamente las restricciones laborales explícitas. En el formato JER están bajo «Tipo de Restricción / Condiciones, Factores, Agentes Asociados». En el formato de control periódico pueden aparecer en la tabla «RESTRICCIONES LABORALES | TIPO | RECOMENDACIONES»; conserva el tipo TEMPORAL/PERMANENTE y el texto completo. No dupliques una misma frase como restricción y recomendación salvo que el PDF la presente explícitamente en ambos bloques.
8. No mezcles concepto de aptitud, consentimiento, firmas, diagnósticos o texto legal.
9. ORTOGRAFÍA: corrige únicamente tildes, espacios y errores OCR evidentes. No cambies dosis, frecuencia, pesos, tiempos, lateralidad, especialidad ni sentido clínico.
10. No inventes, no resumas, no parafrasees.
11. ESTADOS POR EXAMEN: devuelve exclusivamente estados explícitos de la celda del examen (REALIZADO, NORMAL, NO APLICA, APTO). Un estado explícito resuelve esa fila y por sí solo NUNCA obliga a revision_requerida=true.
12. REVISION_REQUERIDA: usa true solo si después de inspeccionar visualmente el PDF queda una ambigüedad real (texto ilegible, fila cortada, asociación espacial incierta o contradicción material). No la actives porque un examen tenga lista de recomendaciones vacía cuando su estado sea REALIZADO/NORMAL/NO APLICA/APTO.
13. EVIDENCIAS: devuelve fragmentos breves y literales del PDF para recomendaciones, observaciones, remisiones y vigilancia. Si no hay evidencia, no agregues el dato.

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
      const secondAuditRequired = profileConfidence < 92 || first.revision_requerida === true || (Array.isArray(first.recomendaciones_medicas) && first.recomendaciones_medicas.length === 0);
      if (secondAuditRequired) try {
        const auditPrompt = `AUDITORÍA FINAL ADVERSARIAL. Relee el PDF completo sin asumir que la primera extracción es correcta.

Verifica obligatoriamente:
- Tipo de examen: prioriza el valor explícito del PDF y no marques revisión por simples sinónimos de la misma categoría (p. ej. seguimiento laboral = examen de seguimiento con restricciones; periódico = control periódico con recomendaciones).
- Tabla examen/recomendación: relación por FILA, no por palabras internas.
- Tres columnas médicas/ocupacionales/hábitos: conservar todo; asociar solo relaciones semánticas fuertes por examen y mantener generales las recomendaciones transversales.
- «REALIZADO» es estado, no recomendación; consérvalo en estados_por_examen.
- «Observaciones:» conserva todo el campo.
- En «Información de Remisiones», NUTRICIÓN o MEDICINA GENERAL EPS son remisiones.
- En «Ingresar al Programa de Vigilancia...», «VISUAL | SVE» es vigilancia visual.
- Fuera de PVE/SVE no infieras programa por temática.
- No conviertas «control por ...» dentro de Observaciones en remisión.
- Revisa la sección de restricciones y conserva tipo + texto sin resumir.

Primera extracción (puede contener falsos positivos y puedes eliminarlos):
${JSON.stringify(first)}

Motor local (también puede equivocarse):
${JSON.stringify(localData)}

Devuelve el JSON COMPLETO corregido. Si algo no tiene evidencia visual, elimínalo. Incluye evidencias literales breves.`;
        const second = geminiRequest_(apiKey, model, pdfBase64, auditPrompt);
        data = mergeGeminiAudits_(first, second);
        data._segunda_revision_ia = true;
      } catch (_) { data._segunda_revision_ia = false; }
      else { data._segunda_revision_ia = false; data._auditoria_optimizada = true; }
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

function compactCell_(value, maxLen) {
  const limit = Number(maxLen || 45000);
  const text = Array.isArray(value) ? value.map(function(x){ return typeof x === 'string' ? x : JSON.stringify(x); }).filter(Boolean).join('\n') : String(value == null ? '' : value);
  return text.length > limit ? text.slice(0, limit - 20) + '\n[TRUNCADO]' : text;
}

function normalizeDocumentKey_(item) {
  return String((item && (item.documentKey || item.hash || item.id)) || '').trim();
}

function documentRecordRow_(item, user, createdAt) {
  const data = (item && item.data) || item || {};
  const key = normalizeDocumentKey_(item);
  if (!key) throw new Error('No se recibió document_key para sincronizar el certificado.');
  const exams = data.examenes_lista || data.examenes_realizados || [];
  const statuses = data.estado_por_examen || data.estados_por_examen || {};
  const recommendations = data.recomendaciones_por_examen || {};
  const restrictions = data.restricciones_lista || data.restricciones || [];
  const review = data.campos_revision || [];
  return [
    key,
    String(item.fileName || item.sourceFile || data.pdf_origen || ''),
    String(data.nombre || ''),
    String(data.identificacion || ''),
    String(data.correo || ''),
    String(data.cargo || ''),
    String(data.tipo_examen || ''),
    String(data.fecha || ''),
    String(data.lugar || ''),
    compactCell_(exams),
    compactCell_(typeof statuses === 'string' ? statuses : JSON.stringify(statuses)),
    compactCell_(typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations)),
    compactCell_(typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions)),
    compactCell_(data.observaciones || ''),
    compactCell_(data.remisiones || ''),
    compactCell_(data.vigilancia_programa || ''),
    String(data.perfil_documental || (data.perfil_detectado && (data.perfil_detectado.nombre || data.perfil_detectado.id)) || ''),
    String(data.calidad_extraccion || ''),
    data.validado_ia === true || String(item.aiValidationStatus || '') === 'validated' ? 'SI' : 'NO',
    compactCell_(review),
    String(data.consecutivo || item.consecutive || ''),
    String(item.syncState || 'SINCRONIZADO'),
    String((user && user.username) || ''),
    createdAt || new Date(),
    new Date()
  ];
}

function loadDocumentKeyIndex_(sheet) {
  const out = {};
  const last = sheet.getLastRow();
  if (last <= 1) return out;
  const keys = sheet.getRange(2,1,last-1,1).getDisplayValues();
  for (let i=0;i<keys.length;i++) {
    const key = String(keys[i][0] || '').trim();
    if (key) out[key] = i + 2;
  }
  return out;
}

function saveDocumentRecords_(user, payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items.slice(0, 50) : [];
  if (!items.length) return { saved:0, updated:0, inserted:0, sheetName:DOCUMENT_SHEET, backendVersion:BACKEND_VERSION };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const db = getDb_();
    const sheet = initializeSheet_(db, DOCUMENT_SHEET, DOCUMENT_HEADERS);
    const index = loadDocumentKeyIndex_(sheet);
    const appendRows = [];
    let updated = 0;
    items.forEach(function(item){
      const key = normalizeDocumentKey_(item);
      if (!key) return;
      const existingRow = index[key] || 0;
      let createdAt = new Date();
      if (existingRow) {
        const existingCreated = sheet.getRange(existingRow,24).getValue();
        if (existingCreated) createdAt = existingCreated;
      }
      const row = documentRecordRow_(item, user, createdAt);
      if (existingRow) {
        sheet.getRange(existingRow,1,1,DOCUMENT_HEADERS.length).setValues([row]);
        updated++;
      } else {
        appendRows.push(row);
        index[key] = sheet.getLastRow() + appendRows.length;
      }
    });
    if (appendRows.length) sheet.getRange(sheet.getLastRow()+1,1,appendRows.length,DOCUMENT_HEADERS.length).setValues(appendRows);
    const consecutiveSheetSync = syncDocumentsToConsecutiveSheet_(user, items);
    SpreadsheetApp.flush();
    return {
      saved: updated + appendRows.length,
      updated: updated,
      inserted: appendRows.length,
      sheetName: sheet.getName(),
      spreadsheetName: db.getName(),
      spreadsheetId: db.getId(),
      totalRows: Math.max(0, sheet.getLastRow()-1),
      consecutiveSheetSync: consecutiveSheetSync,
      backendVersion: BACKEND_VERSION
    };
  } finally {
    lock.releaseLock();
  }
}

function documentSyncStatus_(user) {
  const db = getDb_();
  const sheet = initializeSheet_(db, DOCUMENT_SHEET, DOCUMENT_HEADERS);
  return {
    backendVersion: BACKEND_VERSION,
    spreadsheetName: db.getName(),
    spreadsheetId: db.getId(),
    sheetName: sheet.getName(),
    rows: Math.max(0, sheet.getLastRow()-1)
  };
}

function backendDiagnostics_(user, payload) {
  const db = getDb_();
  const documentSheet = initializeSheet_(db, DOCUMENT_SHEET, DOCUMENT_HEADERS);
  const diagnostics = initializeSheet_(db, DIAGNOSTIC_SHEET, DIAGNOSTIC_HEADERS);
  let writeProbe = null;
  if (payload && payload.writeProbe === true) {
    diagnostics.appendRow([new Date(), String(user.username || ''), BACKEND_VERSION, 'WRITE_PROBE', 'OK']);
    SpreadsheetApp.flush();
    writeProbe = { ok:true, row:diagnostics.getLastRow(), sheet:diagnostics.getName() };
  }
  let consecutive = null;
  let consecutiveData = null;
  try {
    consecutive = consecutiveStatus_(user);
    const css = consecutiveSpreadsheet_();
    const cinfo = locateConsecutiveSheet_(css);
    const cols = consecutiveRegisterColumns_(cinfo);
    const logInfo = locateSstLogSheet_();
    consecutiveData = {
      ok:true,
      spreadsheetName:css.getName(), spreadsheetId:css.getId(), sheetName:cinfo.sheet.getName(), headerRow:cinfo.headerRow,
      structure:['CONSECUTIVO','FECHA','NOMBRE','RECOMENDACIÓN MEDICA'],
      columns:cols,
      sstLog:{spreadsheetName:logInfo.spreadsheet.getName(),spreadsheetId:logInfo.spreadsheet.getId(),sheetName:logInfo.sheet.getName(),structure:SST_LOG_HEADERS}
    };
  }
  catch (error) { consecutive = consecutive || { ok:false, error:String(error && error.message || error) }; consecutiveData = {ok:false,error:String(error && error.message || error)}; }
  return {
    ok:true,
    backendVersion:BACKEND_VERSION,
    capabilities:['documentSync','sheetDiagnostics','batchConsecutives','twoSheetRouting','sstLogSync','correspondenceSync','geminiAudit','email','emailMultiAttachment'],
    portalDatabase:{ name:db.getName(), id:db.getId(), documentSheet:documentSheet.getName(), documentRows:Math.max(0,documentSheet.getLastRow()-1) },
    consecutive:consecutive,
    consecutiveData:consecutiveData,
    correspondence:(function(){try{return correspondenceStatus_(user);}catch(e){return {ok:false,error:String(e&&e.message||e)};}})(),
    writeProbe:writeProbe
  };
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

function spreadsheetIdsByExactName_(name) {
  const ids = [];
  const files = DriveApp.getFilesByName(String(name || '').trim());
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) ids.push(file.getId());
  }
  return ids;
}

function resolveUniqueSpreadsheetByName_(name, label) {
  const ids = spreadsheetIdsByExactName_(name);
  if (!ids.length) throw new Error('No se encontró el archivo de Google Sheets "' + name + '" para ' + label + '.');
  if (ids.length > 1) throw new Error('Hay ' + ids.length + ' archivos llamados "' + name + '". Configura la URL/ID exacta para evitar usar el archivo equivocado.');
  return SpreadsheetApp.openById(ids[0]);
}

function consecutiveConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: String(props.getProperty('CONSECUTIVE_SPREADSHEET_ID') || ''),
    sheetName: CONSECUTIVE_EXTERNAL_SHEET_NAME,
    prefix: String(props.getProperty('CONSECUTIVE_PREFIX') || 'SST').replace(/[^A-Za-z0-9_-]/g,'').toUpperCase() || 'SST'
  };
}

function consecutiveSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const cfg = consecutiveConfig_();
  if (cfg.spreadsheetId) {
    try {
      const stored = SpreadsheetApp.openById(cfg.spreadsheetId);
      if (normalizeHeader_(stored.getName()) === normalizeHeader_(CONSECUTIVE_SPREADSHEET_NAME)) return stored;
      props.deleteProperty('CONSECUTIVE_SPREADSHEET_ID');
    } catch (_) { props.deleteProperty('CONSECUTIVE_SPREADSHEET_ID'); }
  }
  const ss = resolveUniqueSpreadsheetByName_(CONSECUTIVE_SPREADSHEET_NAME, 'la validación de consecutivos');
  props.setProperty('CONSECUTIVE_SPREADSHEET_ID', ss.getId());
  return ss;
}

function sstLogSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const stored = String(props.getProperty('SST_LOG_SPREADSHEET_ID') || '');
  if (stored) {
    try { return SpreadsheetApp.openById(stored); } catch (_) { props.deleteProperty('SST_LOG_SPREADSHEET_ID'); }
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && normalizeHeader_(active.getName()) === normalizeHeader_(SST_LOG_SPREADSHEET_NAME)) {
      props.setProperty('SST_LOG_SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (_) {}
  const ss = resolveUniqueSpreadsheetByName_(SST_LOG_SPREADSHEET_NAME, 'el registro SST');
  props.setProperty('SST_LOG_SPREADSHEET_ID', ss.getId());
  return ss;
}

function locateSstLogSheet_() {
  const ss = sstLogSpreadsheet_();
  const sheet = ss.getSheetByName(SST_LOG_SHEET_NAME);
  if (!sheet) throw new Error('No existe la pestaña "' + SST_LOG_SHEET_NAME + '" en "' + SST_LOG_SPREADSHEET_NAME + '".');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,SST_LOG_HEADERS.length).setValues([SST_LOG_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return { spreadsheet:ss, sheet:sheet, headerRow:1, consecutiveCol:1 };
}

function upsertSstLogRecord_(record, user) {
  record = record || {};
  const info = locateSstLogSheet_();
  const consecutive = String(record.consecutive || (record.data && record.data.consecutivo) || '').trim();
  if (!consecutive) return {skipped:true,reason:'sin_consecutivo',sheetName:info.sheet.getName(),spreadsheetName:info.spreadsheet.getName()};
  const data = record.data || record;
  const values = [
    consecutive,
    String(data.fecha || record.date || ''),
    String(data.nombre || record.name || record.worker || ''),
    String(data.cargo || record.role || ''),
    String(data.tipo_examen || record.exam || '')
  ];
  const start = info.headerRow + 1, last = info.sheet.getLastRow();
  let targetRow = 0;
  if (last >= start) {
    const existing = info.sheet.getRange(start,1,last-start+1,1).getDisplayValues();
    for (let i=existing.length-1;i>=0;i--) {
      if (String(existing[i][0] || '').trim() === consecutive) { targetRow = start + i; break; }
    }
  }
  if (!targetRow) targetRow = info.sheet.getLastRow() + 1;
  info.sheet.getRange(targetRow,1,1,SST_LOG_HEADERS.length).setValues([values]);
  return {skipped:false,row:targetRow,inserted:targetRow>last,sheetName:info.sheet.getName(),spreadsheetName:info.spreadsheet.getName(),spreadsheetId:info.spreadsheet.getId()};
}

function locateConsecutiveSheet_(ss) {
  const cfg = consecutiveConfig_();
  const sheet = ss.getSheetByName(cfg.sheetName);
  if (!sheet) throw new Error('No existe la pestaña "' + cfg.sheetName + '" en "' + ss.getName() + '". Debe ser "' + CONSECUTIVE_EXTERNAL_SHEET_NAME + '".');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,CONSECUTIVE_REGISTER_HEADERS.length).setValues([CONSECUTIVE_REGISTER_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const maxRows = Math.min(Math.max(sheet.getLastRow(),1), 15);
  const maxCols = Math.min(Math.max(sheet.getLastColumn(), CONSECUTIVE_REGISTER_HEADERS.length), 20);
  const values = sheet.getRange(1,1,maxRows,maxCols).getDisplayValues();
  const accepted = ['CONSECUTIVO','CONSECUTIVO SST','NUMERO DE CONSECUTIVO','NUMERO CONSECUTIVO','N CONSECUTIVO','NRO CONSECUTIVO','NO CONSECUTIVO','NUM CONSECUTIVO','NUMERO'];
  let headerRow = -1, consecutiveCol = -1;
  for (let r=0;r<values.length;r++) {
    for (let c=0;c<values[r].length;c++) {
      const h = normalizeHeader_(values[r][c]);
      if (accepted.indexOf(h) >= 0) { headerRow=r+1; consecutiveCol=c+1; break; }
    }
    if (consecutiveCol > 0) break;
  }
  if (consecutiveCol < 0) {
    const colA = sheet.getRange(1,1,Math.min(Math.max(sheet.getLastRow(),1),50),1).getDisplayValues();
    const hasData = colA.some(function(r){ return /SST\s*[-_\/]?\s*20\d{2}\s*[-_\/]?\s*\d+/i.test(String(r[0]||'')); });
    if (hasData) return {sheet:sheet,headerRow:0,headers:[],map:{},consecutiveCol:1};
    throw new Error('No se encontró la columna CONSECUTIVO en "' + sheet.getName() + '".');
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
  // Excel/Sheets suele mostrar consecutivos como 42.613 o 42,613. Eso representa
  // cuarenta y dos mil seiscientos trece, NO el consecutivo 613.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g,'')) || 0;
  if (/^\d+$/.test(raw)) return Number(raw) || 0;
  const years = raw.match(/20\d{2}/g) || [];
  if (years.length && years.indexOf(String(year)) < 0) return 0;
  const m = raw.match(/(\d[\d.,]*)\s*$/);
  if (!m) return 0;
  const tail = m[1];
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(tail)) return Number(tail.replace(/[.,]/g,'')) || 0;
  return Number(tail.replace(/\D/g,'')) || 0;
}

function formatNextConsecutive_(maxRaw, next, year, prefix) {
  const raw = String(maxRaw || '').trim();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) return String(next).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  if (/^\d{1,3}(?:,\d{3})+$/.test(raw)) return String(next).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  if (/^\d+$/.test(raw)) return String(next);
  if (raw && /\d[\d.,]*\s*$/.test(raw)) return raw.replace(/\d[\d.,]*\s*$/, String(next));
  return prefix + '-' + year + '-' + next;
}

function findHeaderCol_(info, names) {
  for (let i=0;i<names.length;i++) { const col=info.map[normalizeHeader_(names[i])]; if(col)return col; }
  return 0;
}

function scanConsecutives_(info, year, prefix, documentKey) {
  const start = info.headerRow + 1, last = info.sheet.getLastRow();
  if (last < start) return { max:0, maxRaw:'', existing:'', rows:0 };
  const values = info.sheet.getRange(start,1,last-start+1,Math.max(info.sheet.getLastColumn(), info.consecutiveCol)).getDisplayValues();
  const keyCol = findHeaderCol_(info, ['hash_documento','hash documento','document_key','document key','hash']);
  const yearCol = findHeaderCol_(info, ['anio','año','year']);
  let max = 0, maxRaw = '', existing = '', rows = 0;
  values.forEach(function(row){
    const raw = String(row[info.consecutiveCol-1] || '').trim();
    if (!raw) return;
    if (yearCol) {
      const rowYear = String(row[yearCol-1] || '').match(/20\d{2}/);
      if (rowYear && rowYear[0] !== String(year)) return;
    }
    const parsed = parseConsecutiveNumber_(raw, year, prefix);
    if (parsed > 0) { if (parsed > max) { max = parsed; maxRaw = raw; } rows++; }
    if (documentKey && keyCol && String(row[keyCol-1]||'').trim() === documentKey) existing = raw;
  });
  return { max:max, maxRaw:maxRaw, existing:existing, rows:rows };
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

function ensureConsecutiveDataColumns_(info) {
  let nextCol = Math.max(info.sheet.getLastColumn(), info.headers.length, info.consecutiveCol);
  const additions = [];
  CONSECUTIVE_DATA_FIELDS.forEach(function(field){
    if (!findHeaderCol_(info, field.aliases)) {
      nextCol++;
      additions.push({ col:nextCol, header:field.header });
      info.headers[nextCol-1] = field.header;
      info.map[normalizeHeader_(field.header)] = nextCol;
    }
  });
  if (additions.length) {
    additions.forEach(function(add){ info.sheet.getRange(info.headerRow, add.col).setValue(add.header); });
    info.sheet.getRange(info.headerRow, additions[0].col, 1, additions.length).setFontWeight('bold').setBackground('#dbeafe');
  }
  return info;
}

function documentExternalValues_(item, user) {
  const data = (item && item.data) || item || {};
  const statuses = data.estado_por_examen || data.estados_por_examen || {};
  const recs = data.recomendaciones_por_examen || data.recomendaciones_lista || {};
  const profile = data.perfil_documental || (data.perfil_detectado && (data.perfil_detectado.nombre || data.perfil_detectado.id)) || '';
  return {
    consecutive:String(data.consecutivo || item.consecutive || ''),
    date:String(data.fecha || item.date || ''),
    name:String(data.nombre || item.name || ''),
    identification:String(data.identificacion || item.identification || ''),
    role:String(data.cargo || item.role || ''),
    exam:String(data.tipo_examen || item.exam || ''),
    subject:'RECOMENDACIONES MEDICAS',
    sourceFile:String(item.fileName || item.sourceFile || data.pdf_origen || ''),
    exams:compactCell_(data.examenes_lista || data.examenes_realizados || []),
    statuses:compactCell_(typeof statuses === 'string' ? statuses : JSON.stringify(statuses)),
    recommendations:compactCell_(typeof recs === 'string' ? recs : JSON.stringify(recs)),
    restrictions:compactCell_(data.restricciones_lista || data.restricciones || []),
    observations:compactCell_(data.observaciones || ''),
    referrals:compactCell_(data.remisiones || ''),
    surveillance:compactCell_(data.vigilancia_programa || ''),
    location:String(data.lugar || ''),
    profile:String(profile || ''),
    quality:String(data.calidad_extraccion || ''),
    aiValidated:data.validado_ia === true || String(item.aiValidationStatus || '') === 'validated' ? 'SI' : 'NO',
    reviewFields:compactCell_(data.campos_revision || []),
    syncState:String(item.syncState || 'SINCRONIZADO'),
    documentKey:normalizeDocumentKey_(item),
    user:String((user && user.username) || ''),
    updatedAt:new Date()
  };
}

function findConsecutiveDataRow_(info, consecutive, documentKey) {
  const start = info.headerRow + 1;
  const last = info.sheet.getLastRow();
  if (last < start) return 0;
  const width = Math.max(info.sheet.getLastColumn(), info.consecutiveCol);
  const rows = info.sheet.getRange(start,1,last-start+1,width).getDisplayValues();
  const keyCol = findHeaderCol_(info, ['hash_documento','hash documento','document_key','document key','hash']);
  const wantedConsecutive = String(consecutive || '').trim();
  const wantedKey = String(documentKey || '').trim();
  for (let i=rows.length-1;i>=0;i--) {
    if (wantedKey && keyCol && String(rows[i][keyCol-1] || '').trim() === wantedKey) return start + i;
    if (wantedConsecutive && String(rows[i][info.consecutiveCol-1] || '').trim() === wantedConsecutive) return start + i;
  }
  return 0;
}

function applyExternalValuesToRow_(info, row, values) {
  const width = Math.max(info.sheet.getLastColumn(), info.headers.length, info.consecutiveCol);
  const current = row > 0 ? info.sheet.getRange(row,1,1,width).getValues()[0] : new Array(width).fill('');
  while (current.length < width) current.push('');
  function put(aliases, value, allowBlank) {
    const col = findHeaderCol_(info, aliases);
    if (!col) return;
    if (allowBlank || !(value === '' || value === null || typeof value === 'undefined')) current[col-1] = value;
  }
  put(['consecutivo','consecutivo sst','numero de consecutivo','numero consecutivo','n consecutivo','nro consecutivo','no consecutivo','num consecutivo','numero'], values.consecutive, false);
  CONSECUTIVE_DATA_FIELDS.forEach(function(field){ put(field.aliases, values[field.key], true); });
  const targetRow = row > 0 ? row : info.sheet.getLastRow() + 1;
  info.sheet.getRange(targetRow,1,1,width).setValues([current]);
  return targetRow;
}

function syncDocumentToConsecutiveSheet_(user, item) {
  // V10.9: la ficha SST NO se expande en CONSECUTIVOS 2026. Esa hoja conserva
  // únicamente CONSECUTIVO, FECHA, NOMBRE y RECOMENDACIÓN MEDICA.
  // El detalle operativo se registra en CORRESPONDENCIA ENVIADA SST 2026 / Hoja 1.
  return upsertSstLogRecord_(item, user);
}

function syncDocumentsToConsecutiveSheet_(user, items) {
  const result = { updated:0, inserted:0, skipped:0, errors:[], sheetName:SST_LOG_SHEET_NAME, spreadsheetName:SST_LOG_SPREADSHEET_NAME };
  (items || []).forEach(function(item){
    try {
      const hit = syncDocumentToConsecutiveSheet_(user, item);
      if (hit.skipped) { result.skipped++; return; }
      hit.inserted ? result.inserted++ : result.updated++;
      result.sheetName = hit.sheetName || result.sheetName;
      result.spreadsheetName = hit.spreadsheetName || result.spreadsheetName;
    } catch (error) { result.errors.push(String(error && error.message || error)); }
  });
  return result;
}


function syncConsecutiveRecords_(user, payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items.slice(0,200) : [];
  if (!items.length) return {updated:0,inserted:0,skipped:0,errors:[],backendVersion:BACKEND_VERSION};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const result = syncDocumentsToConsecutiveSheet_(user, items);
    SpreadsheetApp.flush();
    result.backendVersion = BACKEND_VERSION;
    if (result.errors.length) throw new Error(result.errors.join(' | '));
    return result;
  } finally { lock.releaseLock(); }
}

function consecutiveRegisterColumns_(info) {
  return {
    consecutive: findHeaderCol_(info,['consecutivo','consecutivo sst','numero de consecutivo','numero consecutivo']) || 1,
    date: findHeaderCol_(info,['fecha','fecha documento','fecha_documento']) || 2,
    name: findHeaderCol_(info,['nombre','trabajador','colaborador','nombre trabajador']) || 3,
    subject: findHeaderCol_(info,['asunto','tipo','tipo documento','descripcion','descripción']) || 4
  };
}

function buildConsecutiveRegisterRow_(info, values) {
  const cols = consecutiveRegisterColumns_(info);
  const width = Math.max(info.sheet.getLastColumn(), cols.consecutive, cols.date, cols.name, cols.subject, 4);
  const row = new Array(width).fill('');
  row[cols.consecutive-1] = values.consecutive;
  row[cols.date-1] = values.date || '';
  row[cols.name-1] = values.name || '';
  row[cols.subject-1] = RECOMMENDATION_REGISTER_LABEL;
  return row;
}

function appendConsecutive_(info, values) {
  const row = buildConsecutiveRegisterRow_(info, values);
  info.sheet.getRange(info.sheet.getLastRow()+1,1,1,row.length).setValues([row]);
}

function buildConsecutiveRow_(info, values) {
  return buildConsecutiveRegisterRow_(info, values);
}

function loadConsecutiveIndex_(info, year, prefix) {
  const start = info.headerRow + 1, last = info.sheet.getLastRow();
  const out = { max:0, maxRaw:'', rows:0, byKey:{}, values:{}, duplicateConsecutives:[], conflictingKeys:[] };
  if (last < start) return out;
  const width = Math.max(info.sheet.getLastColumn(), info.consecutiveCol);
  const rows = info.sheet.getRange(start,1,last-start+1,width).getDisplayValues();
  const keyCol = findHeaderCol_(info, ['hash_documento','hash documento','document_key','document key','hash']);
  const yearCol = findHeaderCol_(info, ['anio','año','year']);
  const duplicateSet = {}, conflictSet = {};
  rows.forEach(function(row){
    if (yearCol) { const y=String(row[yearCol-1]||'').match(/20\d{2}/); if (y && y[0] !== String(year)) return; }
    const raw=String(row[info.consecutiveCol-1]||'').trim(); if(!raw)return;
    const parsed=parseConsecutiveNumber_(raw,year,prefix); if(parsed>0){ if(parsed>out.max){out.max=parsed;out.maxRaw=raw;} out.rows++; }
    if(out.values[raw]) duplicateSet[raw]=true; out.values[raw]=true;
    if(keyCol){ const key=String(row[keyCol-1]||'').trim(); if(key){ if(out.byKey[key] && out.byKey[key]!==raw) conflictSet[key]=true; else out.byKey[key]=raw; } }
  });
  out.duplicateConsecutives=Object.keys(duplicateSet);
  out.conflictingKeys=Object.keys(conflictSet);
  return out;
}

function loadLedgerMap_(spreadsheetId, sheetName) {
  const map={}; const sheet=getSheet_(CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS); const last=sheet.getLastRow();
  if(last<=1)return map;
  const rows=sheet.getRange(2,1,last-1,5).getDisplayValues();
  rows.forEach(function(r){ if(String(r[2]||'').trim()===String(spreadsheetId||'') && String(r[3]||'').trim()===String(sheetName||'')){ const key=String(r[0]||'').trim(); if(key)map[key]=String(r[1]||'').trim(); } });
  return map;
}

function ledgerSaveBatch_(rows) {
  if(!rows || !rows.length)return;
  const sheet=getSheet_(CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS);
  sheet.getRange(sheet.getLastRow()+1,1,rows.length,5).setValues(rows);
}

function consecutiveStatus_(user) {
  const cfg = consecutiveConfig_();
  const ss = consecutiveSpreadsheet_();
  const info = locateConsecutiveSheet_(ss);
  const year = new Date().getFullYear();
  const scan = loadConsecutiveIndex_(info, year, cfg.prefix);
  const db = getDb_();
  const ledger = getSheet_(CONSECUTIVE_LEDGER_SHEET, CONSECUTIVE_LEDGER_HEADERS);
  let sstLog = null;
  try {
    const logInfo = locateSstLogSheet_();
    sstLog = {ok:true,spreadsheetName:logInfo.spreadsheet.getName(),spreadsheetId:logInfo.spreadsheet.getId(),sheetName:logInfo.sheet.getName(),rows:Math.max(0,logInfo.sheet.getLastRow()-1),headers:SST_LOG_HEADERS};
  } catch (error) { sstLog = {ok:false,error:String(error && error.message || error),spreadsheetName:SST_LOG_SPREADSHEET_NAME,sheetName:SST_LOG_SHEET_NAME}; }
  return {
    configured:true,
    spreadsheetName:ss.getName(), spreadsheetId:ss.getId(), sheetName:info.sheet.getName(), prefix:cfg.prefix,
    expectedSpreadsheetName:CONSECUTIVE_SPREADSHEET_NAME, expectedSheetName:CONSECUTIVE_EXTERNAL_SHEET_NAME,
    current:scan.max, currentDisplay:scan.maxRaw || String(scan.max), next:scan.max+1,
    nextDisplay:formatNextConsecutive_(scan.maxRaw, scan.max+1, year, cfg.prefix), rowsRead:scan.rows,
    headerRow:info.headerRow, consecutiveColumn:info.consecutiveCol,
    duplicateConsecutives:scan.duplicateConsecutives, conflictingDocumentKeys:scan.conflictingKeys,
    sstLog:sstLog,
    controlSpreadsheetName:db.getName(), controlSpreadsheetId:db.getId(), controlSheet:ledger.getName(), controlRows:Math.max(0,ledger.getLastRow()-1)
  };
}

function saveConsecutiveConfig_(user, payload) {
  const props = PropertiesService.getScriptProperties();
  const raw = String(payload.spreadsheetUrlOrId || '').trim();
  const id = raw ? normalizeSheetId_(raw) : '';
  const sheetName = CONSECUTIVE_EXTERNAL_SHEET_NAME;
  const prefix = String(payload.prefix || 'SST').replace(/[^A-Za-z0-9_-]/g,'').toUpperCase() || 'SST';
  if (id) {
    const ss = SpreadsheetApp.openById(id);
    if (normalizeHeader_(ss.getName()) !== normalizeHeader_(CONSECUTIVE_SPREADSHEET_NAME)) throw new Error('El archivo configurado se llama "' + ss.getName() + '". Debes seleccionar "' + CONSECUTIVE_SPREADSHEET_NAME + '".');
    props.setProperty('CONSECUTIVE_SPREADSHEET_ID', ss.getId());
  } else {
    const ss = resolveUniqueSpreadsheetByName_(CONSECUTIVE_SPREADSHEET_NAME, 'la validación de consecutivos');
    props.setProperty('CONSECUTIVE_SPREADSHEET_ID', ss.getId());
  }
  props.setProperty('CONSECUTIVE_SHEET_NAME', sheetName);
  props.setProperty('CONSECUTIVE_PREFIX', prefix);
  const external = consecutiveSpreadsheet_();
  locateConsecutiveSheet_(external);
  locateSstLogSheet_();
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
      const existingFormatted=scan.existing;
      const enriched = Object.assign({}, payload, { consecutive:existingFormatted, data:Object.assign({}, payload.data || {}, {consecutivo:existingFormatted}) });
      try { syncDocumentToConsecutiveSheet_(user, enriched); } catch (_) {}
      ledgerSave_(documentKey, existingFormatted, ss.getId(), info.sheet.getName());
      return { consecutive:existingFormatted, reused:true, source:'Google Sheets', sheetName:info.sheet.getName() };
    }
    const ledgerExisting = ledgerLookup_(documentKey, ss.getId(), info.sheet.getName());
    if (ledgerExisting && consecutiveExists_(info, ledgerExisting)) {
      const enriched = Object.assign({}, payload, { consecutive:ledgerExisting, data:Object.assign({}, payload.data || {}, {consecutivo:ledgerExisting}) });
      try { syncDocumentToConsecutiveSheet_(user, enriched); } catch (_) {}
      return { consecutive:ledgerExisting, reused:true, source:'Google Sheets + control', sheetName:info.sheet.getName() };
    }
    const next = scan.max + 1;
    const consecutive = formatNextConsecutive_(scan.maxRaw, next, year, cfg.prefix);
    appendConsecutive_(info, {
      number:next, consecutive:consecutive, year:year, date:String(payload.date||''), name:String(payload.name||''),
      identification:String(payload.identification||''), role:String(payload.role||''), exam:String(payload.exam||''),
      sourceFile:String(payload.sourceFile||''), documentKey:documentKey, user:String(user.username||''), item:payload
    });
    const enrichedNew = Object.assign({}, payload, { consecutive:consecutive, data:Object.assign({}, payload.data || {}, {consecutivo:consecutive}) });
    try { upsertSstLogRecord_(enrichedNew, user); } catch (logError) { throw new Error('Se reservó ' + consecutive + ' en CONSECUTIVOS 2026, pero falló el registro en Hoja 1: ' + (logError.message || logError)); }
    SpreadsheetApp.flush();
    ledgerSave_(documentKey, consecutive, ss.getId(), info.sheet.getName());
    return { consecutive:consecutive, reused:false, source:'Google Sheets', sheetName:info.sheet.getName(), number:next };
  } finally { lock.releaseLock(); }
}

function reserveConsecutives_(user, payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items.slice(0, 200) : [];
  if (!items.length) return { items:[] };
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const cfg = consecutiveConfig_();
    const ss = consecutiveSpreadsheet_();
    const info = locateConsecutiveSheet_(ss);
    const year = new Date().getFullYear();
    const index = loadConsecutiveIndex_(info, year, cfg.prefix);
    const ledgerMap = loadLedgerMap_(ss.getId(), info.sheet.getName());
    let max = index.max, maxRaw = index.maxRaw || '';
    const result = [], newSheetRows = [], newLedgerRows = [];
    const width = Math.max(info.sheet.getLastColumn(), info.headers.length, 4);

    for (let i=0;i<items.length;i++) {
      const item = items[i] || {};
      const documentKey = String(item.documentKey || item.hash || '').trim();
      let existing = documentKey ? (index.byKey[documentKey] || ledgerMap[documentKey] || '') : '';
      if (existing && !index.values[existing]) existing = '';
      if (existing) {
        const enriched = Object.assign({}, item, { consecutive:existing, data:Object.assign({}, item.data || {}, {consecutivo:existing}) });
        try { syncDocumentToConsecutiveSheet_(user, enriched); } catch (_) {}
        result.push({ documentKey:documentKey, consecutive:existing, reused:true, source:'Google Sheets + control' });
        continue;
      }
      const next = max + 1;
      const consecutive = formatNextConsecutive_(maxRaw, next, year, cfg.prefix);
      const row = buildConsecutiveRow_(info, {
        number:next, consecutive:consecutive, year:year, date:String(item.date||''), name:String(item.name||''),
        identification:String(item.identification||''), role:String(item.role||''), exam:String(item.exam||''),
        sourceFile:String(item.sourceFile||''), documentKey:documentKey, user:String(user.username||''), item:item
      });
      while (row.length < width) row.push('');
      newSheetRows.push(row);
      if (documentKey) {
        index.byKey[documentKey] = consecutive;
        ledgerMap[documentKey] = consecutive;
        newLedgerRows.push([documentKey, consecutive, ss.getId(), info.sheet.getName(), new Date()]);
      }
      index.values[consecutive] = true;
      result.push({ documentKey:documentKey, consecutive:consecutive, reused:false, source:'Google Sheets', number:next });
      max = next; maxRaw = consecutive;
    }

    if (newSheetRows.length) info.sheet.getRange(info.sheet.getLastRow()+1,1,newSheetRows.length,width).setValues(newSheetRows);
    for (let i=0;i<items.length;i++) {
      const assigned = result[i] && result[i].consecutive;
      if (!assigned) continue;
      const enrichedLog = Object.assign({}, items[i], {consecutive:assigned,data:Object.assign({},items[i].data||{},{consecutivo:assigned})});
      upsertSstLogRecord_(enrichedLog,user);
    }
    ledgerSaveBatch_(newLedgerRows);
    SpreadsheetApp.flush();
    return { items:result, source:'Google Sheets', sheetName:info.sheet.getName(), sstLogSheet:SST_LOG_SHEET_NAME, reserved:newSheetRows.length, reused:result.length-newSheetRows.length };
  } finally { lock.releaseLock(); }
}

function cleanEmailList_(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/);
  const seen = {};
  return source.map(function(x){return String(x||'').trim().toLowerCase();}).filter(function(x){if(!x||seen[x])return false;seen[x]=true;return true;});
}

function validEmail_(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }

function forceReauthorizePortalServices() {
  // Compatibilidad con versiones anteriores. La autorización real se obtiene al
  // ejecutar authorizePortalServices() desde el editor; no es necesario invalidar
  // scopes ni usar ScriptApp.requireScopes().
  console.log('Ejecuta authorizePortalServices() desde el editor y acepta todos los permisos solicitados.');
  return { reset:false, next:'Ejecuta authorizePortalServices()' };
}

function authorizePortalServices() {
  // EJECUTAR MANUALMENTE desde el editor de Apps Script. Al tocar directamente
  // los servicios, Apps Script solicita los scopes declarados en appsscript.json.
  const external = UrlFetchApp.fetch('https://www.google.com/generate_204', {
    method:'get', muteHttpExceptions:true, followRedirects:true
  });
  const quota = MailApp.getRemainingDailyQuota();
  const db = getDb_();
  const rootName = DriveApp.getRootFolder().getName();
  const props = PropertiesService.getScriptProperties();
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && normalizeHeader_(active.getName()) === normalizeHeader_(SST_LOG_SPREADSHEET_NAME)) props.setProperty('SST_LOG_SPREADSHEET_ID', active.getId());
  } catch (_) {}
  const sstLog = locateSstLogSheet_();
  const consecutiveSs = consecutiveSpreadsheet_();
  const consecutiveInfo = locateConsecutiveSheet_(consecutiveSs);
  const result = {
    authorized:true,
    externalRequest:external.getResponseCode() >= 200 && external.getResponseCode() < 400,
    externalResponseCode:external.getResponseCode(),
    mailQuota:quota,
    database:db.getName(),
    driveRoot:rootName,
    sstLog:sstLog.spreadsheet.getName() + ' / ' + sstLog.sheet.getName(),
    consecutiveSource:consecutiveSs.getName() + ' / ' + consecutiveInfo.sheet.getName(),
    message:'Servicios autorizados. Registro SST: ' + SST_LOG_SPREADSHEET_NAME + ' / ' + SST_LOG_SHEET_NAME + '. Consecutivos: ' + CONSECUTIVE_SPREADSHEET_NAME + ' / ' + CONSECUTIVE_EXTERNAL_SHEET_NAME + '.'
  };
  console.log(JSON.stringify(result));
  return result;
}

function aiStatus_(user) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  const model = String(props.getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  if (!apiKey) return { ready:false, apiKeyConfigured:false, model:model, detail:'No hay API key de Gemini configurada.' };
  try {
    // V8: prueba el endpoint de listado de modelos. La V7 consultaba una URL de modelo
    // sin método :generateContent y podía reportar un falso fallo aunque UrlFetchApp sí funcionara.
    const response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey), {
      method:'get', muteHttpExceptions:true, followRedirects:true
    });
    const status = response.getResponseCode();
    const ok = status >= 200 && status < 300;
    return {
      ready:ok,
      apiKeyConfigured:true,
      externalRequest:true,
      model:model,
      status:status,
      detail:ok ? 'Gemini y UrlFetchApp autorizados.' : response.getContentText().slice(0,500)
    };
  } catch (error) {
    return {
      ready:false,
      apiKeyConfigured:true,
      externalRequest:false,
      authorizationError:/script\.external_request|UrlFetchApp|permiso|permission|authorization/i.test(String(error && error.message || error)),
      model:model,
      detail:String(error && error.message || error)
    };
  }
}

function testGeminiPermission() {
  const response = UrlFetchApp.fetch('https://www.google.com/generate_204', {
    method:'get', muteHttpExceptions:true, followRedirects:true
  });
  const result = { ok:response.getResponseCode() >= 200 && response.getResponseCode() < 400, responseCode:response.getResponseCode() };
  console.log(JSON.stringify(result));
  return result;
}

function testGeminiApi() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  if (!apiKey) throw new Error('No hay GEMINI_API_KEY guardada.');
  const model = String(props.getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).replace(/^models\//,'');
  const url = GEMINI_GENERATE_BASE_URL + encodeURIComponent(model) + ':generateContent';
  const response = UrlFetchApp.fetch(url, {
    method:'post', contentType:'application/json', muteHttpExceptions:true,
    headers:{'x-goog-api-key':apiKey},
    payload:JSON.stringify({ contents:[{role:'user',parts:[{text:'Responde únicamente OK'}]}] })
  });
  const result = { ok:response.getResponseCode() >= 200 && response.getResponseCode() < 300, status:response.getResponseCode(), body:response.getContentText().slice(0,500) };
  console.log(JSON.stringify(result));
  return result;
}


function appendCorrespondenceRecords_(user, records, envelope) {
  records = Array.isArray(records) ? records : [];
  if (!records.length) return {ok:true,inserted:0,updated:0,skipped:true,spreadsheetName:SST_LOG_SPREADSHEET_NAME,sheetName:SST_LOG_SHEET_NAME};
  let inserted=0, updated=0, skipped=0;
  records.forEach(function(record){
    const payload = {
      consecutive:String(record.consecutive || ''),
      date:String(record.date || ''),
      name:String(record.worker || record.name || ''),
      role:String(record.role || ''),
      exam:String(record.exam || ''),
      data:{consecutivo:String(record.consecutive || ''),fecha:String(record.date || ''),nombre:String(record.worker || record.name || ''),cargo:String(record.role || ''),tipo_examen:String(record.exam || '')}
    };
    const hit = upsertSstLogRecord_(payload,user);
    if (hit.skipped) skipped++; else if (hit.inserted) inserted++; else updated++;
  });
  SpreadsheetApp.flush();
  const info=locateSstLogSheet_();
  return {ok:true,inserted:inserted,updated:updated,skipped:skipped,sheetName:info.sheet.getName(),spreadsheetName:info.spreadsheet.getName(),spreadsheetId:info.spreadsheet.getId()};
}

function correspondenceStatus_(user) {
  const info=locateSstLogSheet_();
  return {ok:true,spreadsheetName:info.spreadsheet.getName(),spreadsheetId:info.spreadsheet.getId(),sheetName:info.sheet.getName(),rows:Math.max(0,info.sheet.getLastRow()-1),headers:SST_LOG_HEADERS};
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
  const attachmentsInput = Array.isArray(payload.attachments) && payload.attachments.length ? payload.attachments : (payload.attachment ? [payload.attachment] : []);
  const fileNames = attachmentsInput.map(function(a){ return String(a && a.filename || ''); }).filter(Boolean);
  const baseHistory = { date:new Date().toISOString(), sourceFile:String(payload.sourceFile||''), worker:String(payload.personName||''), to:to, cc:cc.join(', '), bcc:bcc.join(', '), subject:subject, file:fileNames.join(' | ') };
  try {
    if (!validEmail_(to)) throw new Error('El destinatario no es válido: ' + (to || '(vacío)'));
    if (!subject || !body) throw new Error('El asunto y el cuerpo del mensaje no pueden estar vacíos.');
    if (!attachmentsInput.length) throw new Error('No se recibieron documentos adjuntos.');
    if (attachmentsInput.length > 100) throw new Error('El correo supera el máximo de 100 adjuntos por paquete.');

    let totalBytes = 0;
    const blobs = attachmentsInput.map(function(attachment){
      if (!attachment || !attachment.base64 || !attachment.filename) throw new Error('Uno de los adjuntos está incompleto.');
      const bytes = Utilities.base64Decode(String(attachment.base64));
      totalBytes += bytes.length;
      if (bytes.length > 20 * 1024 * 1024) throw new Error('El adjunto ' + String(attachment.filename) + ' supera 20 MB.');
      return Utilities.newBlob(bytes, String(attachment.mime || 'application/octet-stream'), String(attachment.filename));
    });
    if (totalBytes > 20 * 1024 * 1024) throw new Error('El conjunto de adjuntos supera 20 MB. El portal debe dividirlo en más de un correo.');

    const options = {
      to:to, subject:subject, body:body, htmlBody:String(body).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'),
      attachments:blobs, name:'Seguridad y Salud en el Trabajo - JER S.A.'
    };
    if (cc.length) options.cc = cc.join(',');
    if (bcc.length) options.bcc = bcc.join(',');
    MailApp.sendEmail(options);
    let correspondence = {ok:true,inserted:0,skipped:true};
    let correspondenceError = '';
    try {
      const records = Array.isArray(payload.records) ? payload.records : [];
      correspondence = appendCorrespondenceRecords_(user, records, {
        to:to, cc:cc.join(', '), bcc:bcc.join(', '), subject:subject,
        status:'ENVIADO', detail:'Mensaje aceptado por MailApp con ' + blobs.length + ' adjunto(s).',
        attachments:fileNames.join(' | '), formats:String(payload.formats || '')
      });
    } catch (recordError) {
      correspondenceError = String(recordError && recordError.message || recordError);
      correspondence = {ok:false,error:correspondenceError,inserted:0};
    }
    const detail = 'Mensaje aceptado por MailApp con ' + blobs.length + ' adjunto(s).' + (correspondenceError ? ' ADVERTENCIA: no se pudo registrar en Correspondencia Enviada: ' + correspondenceError : ' Registro de correspondencia: ' + Number(correspondence.inserted || 0) + ' fila(s).');
    const history = Object.assign({}, baseHistory, { status:correspondenceError ? 'Enviado / registro pendiente' : 'Enviado', detail:detail });
    appendEmailHistory_(history);
    return { sent:true, history:history, correspondence:correspondence, attachmentCount:blobs.length, totalBytes:totalBytes, remainingQuota:MailApp.getRemainingDailyQuota() };
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
