const APP_NAME = 'Portal SST · Recomendaciones Médicas';
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const SESSION_HOURS = 8;
const USER_SHEET = 'Usuarios';
const EMAIL_SHEET = 'HistorialCorreos';

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
    vigilancia_programa:{type:'array',items:{type:'string'}}, observaciones:{type:'string'}, remisiones:{type:'string'}
  }, required:['nombre','cargo','identificacion','correo','tipo_examen','lugar','fecha','examenes_realizados','recomendaciones_medicas','recomendaciones_por_examen','vigilancia_programa','observaciones','remisiones'] };
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

function geminiAnalyze_(user, payload) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('GEMINI_API_KEY') || '').trim();
  if (!apiKey) throw new Error('Configura la API key de Gemini desde Configuración con una cuenta administradora.');
  const pdfBase64 = String(payload.pdfBase64 || '');
  if (!pdfBase64) throw new Error('No se recibió el PDF para validación visual.');
  const localData = payload.localData || {};
  const text = String(payload.text || '').slice(0,30000);
  const preferred = String(payload.model || props.getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).replace(/^models\//,'').trim();
  const models = [preferred, DEFAULT_GEMINI_MODEL, 'gemini-3.1-flash-lite'].filter(function(v,i,a){ return v && a.indexOf(v) === i; });
  const prompt = `Eres un extractor documental para Seguridad y Salud en el Trabajo.\nLee visualmente TODAS las páginas del PDF adjunto, incluidas tablas, columnas, celdas y textos escaneados.\nDevuelve únicamente los datos presentes en el documento.\nReglas obligatorias:\n- No diagnostiques, no recomiendes y no inventes información.\n- Transcribe cada recomendación COMPLETA desde su inicio hasta su punto final, aunque continúe en otra línea o celda.\n- Une correctamente los saltos de línea que pertenecen a una misma recomendación.\n- No resumas, no parafrasees y no cortes frases.\n- Convierte los bloques totalmente en mayúsculas a redacción normal, respetando nombres propios y siglas.\n- Corrige únicamente ortografía, tildes, espacios y puntuación evidentes sin cambiar el sentido.\n- No dupliques exámenes ni recomendaciones.\n- Relaciona cada recomendación con el examen que la origina en recomendaciones_por_examen.\n- Incluye todos los exámenes realizados; si uno no tiene recomendación explícita, usa lista vacía.\n- Extrae identificación y correo solo cuando aparezcan explícitamente.\n- Omite consentimientos, habeas data, firmas y texto legal.\n- Si un dato no aparece, usa cadena vacía o lista vacía.\n- Revisa el PDF completo una segunda vez antes de responder.\n\nExtracción local de referencia (puede estar incompleta):\n${JSON.stringify(localData)}\n\nTEXTO EXTRAÍDO LOCALMENTE COMO APOYO:\n${text}`;
  let lastError = '';
  for (let i=0;i<models.length;i++) {
    const model = models[i];
    try {
      let data = geminiRequest_(apiKey, model, pdfBase64, prompt);
      data._modelo_usado = model; data._segunda_revision_ia = false; data._fragmentos_pendientes = [];
      const localCount = Array.isArray(localData.recomendaciones_lista) ? localData.recomendaciones_lista.length : 0;
      const recs = Array.isArray(data.recomendaciones_medicas) ? data.recomendaciones_medicas : [];
      const suspicious = recs.some(function(r){ const s=String(r||'').trim(); return s && s.length < 22; }) || (localCount >= 3 && recs.length < Math.max(1,Math.floor(localCount/2)));
      if (suspicious) {
        try {
          const reviewPrompt = `Realiza una segunda auditoría visual completa del PDF adjunto.\nLa primera lectura produjo:\n${JSON.stringify(data)}\nDevuelve TODO el JSON del certificado nuevamente. Lee todas las páginas y tablas. Cada recomendación debe estar completa; no inventes texto, no repitas elementos y conserva listas vacías cuando no exista recomendación explícita.`;
          const reviewed = geminiRequest_(apiKey, model, pdfBase64, reviewPrompt);
          if ((reviewed.recomendaciones_medicas || []).length >= recs.length) data = reviewed;
          data._segunda_revision_ia = true; data._modelo_usado = model; data._fragmentos_pendientes = [];
        } catch (_) { data._segunda_revision_ia = false; }
      }
      return data;
    } catch (error) {
      lastError = error.message;
      if (error.status !== 404 && error.status !== 429 && error.status !== 503) break;
    }
  }
  throw new Error(lastError || 'Gemini no devolvió una extracción utilizable.');
}

function nextConsecutive_(user, payload) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const props = PropertiesService.getScriptProperties();
    const year = new Date().getFullYear();
    const key = 'CONSECUTIVE_' + year;
    const next = Number(props.getProperty(key) || '0') + 1;
    props.setProperty(key, String(next));
    return { consecutive: 'SST-' + year + '-' + next };
  } finally { lock.releaseLock(); }
}

function cleanEmailList_(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/);
  const seen = {};
  return source.map(function(x){return String(x||'').trim().toLowerCase();}).filter(function(x){if(!x||seen[x])return false;seen[x]=true;return true;});
}

function validEmail_(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim()); }

function sendEmail_(user, payload) {
  const to = String(payload.to || '').trim().toLowerCase();
  if (!validEmail_(to)) throw new Error('El destinatario no es válido: ' + (to || '(vacío)'));
  const cc = cleanEmailList_(payload.cc).filter(validEmail_).filter(function(x){return x !== to;});
  const bcc = cleanEmailList_(payload.bcc).filter(validEmail_).filter(function(x){return x !== to && cc.indexOf(x) < 0;});
  const subject = String(payload.subject || '').trim(), body = String(payload.body || '').trim();
  if (!subject || !body) throw new Error('El asunto y el cuerpo del mensaje no pueden estar vacíos.');
  const attachment = payload.attachment || {};
  if (!attachment.base64 || !attachment.filename) throw new Error('No se recibió el documento adjunto.');
  const bytes = Utilities.base64Decode(String(attachment.base64));
  const blob = Utilities.newBlob(bytes, String(attachment.mime || 'application/octet-stream'), String(attachment.filename));
  const options = { attachments:[blob], name:'Seguridad y Salud en el Trabajo - JER S.A.' };
  if (cc.length) options.cc = cc.join(',');
  if (bcc.length) options.bcc = bcc.join(',');
  GmailApp.sendEmail(to, subject, body, options);
  const history = { date:new Date().toISOString(), sourceFile:String(payload.sourceFile||''), worker:String(payload.personName||''), to:to, cc:cc.join(', '), bcc:bcc.join(', '), subject:subject, file:String(attachment.filename), status:'Enviado', detail:'Mensaje aceptado por GmailApp.' };
  appendEmailHistory_(history);
  return { sent:true, history:history, remainingQuota:MailApp.getRemainingDailyQuota() };
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
