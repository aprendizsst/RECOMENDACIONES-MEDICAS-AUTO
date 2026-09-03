from pathlib import Path
root = Path(__file__).resolve().parents[1]
code = (root/'Code.gs').read_text(encoding='utf-8')
app = (root/'js/app.js').read_text(encoding='utf-8')
config = (root/'js/config.js').read_text(encoding='utf-8')
index = (root/'index.html').read_text(encoding='utf-8')
assert "BACKEND_VERSION = '2026.09.03-v10.6-email-batch'" in code
assert "case 'saveDocumentRecords'" in code
assert "function saveDocumentRecords_" in code
assert "DOCUMENT_SHEET = 'DocumentosProcesados'" in code
assert "function backendDiagnostics_" in code
assert "writeProbe === true" in code
assert "Consecutivos_BOT" not in code
assert "no creará otra pestaña silenciosamente" in code
assert "requiredBackendVersion: \"2026.09.03-v10.6-email-batch\"" in config
assert "function syncDocumentsToBackend" in app
assert "saveDocumentRecords" in app
assert "btnBackendWriteProbe" in app and "btnBackendWriteProbe" in index
assert "DocumentosProcesados" in index
assert (root/'Code.gs').read_bytes() == (root/'backend/Code.gs').read_bytes()
assert (root/'app.js').read_bytes() == (root/'js/app.js').read_bytes()
assert (root/'config.js').read_bytes() == (root/'js/config.js').read_bytes()
print('OK · V10.6 conserva sincronización real Apps Script + Sheets')
