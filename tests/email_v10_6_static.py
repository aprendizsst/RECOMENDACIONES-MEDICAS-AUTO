from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'js/app.js').read_text(encoding='utf-8')
html=(ROOT/'index.html').read_text(encoding='utf-8')
backend=(ROOT/'backend/Code.gs').read_text(encoding='utf-8')
gen=(ROOT/'js/generator.js').read_text(encoding='utf-8')
config=(ROOT/'js/config.js').read_text(encoding='utf-8')
checks={
 'modo común':'data-email-mode="common"' in html and "state.emailMode === 'common'" in app,
 'formato ambos':'data-email-format="Ambos"' in html and "state.emailFormat === 'Ambos'" in app,
 'selección persistente':'selectedEmailIds: new Set()' in app,
 'generación transitoria':'generateForEmail' in gen and 'persist:false' in gen,
 'multi adjuntos backend':'payload.attachments' in backend and 'attachments:blobs' in backend,
 'backend v10.6':"2026.09.03-v10.6-email-batch" in backend and "2026.09.03-v10.6-email-batch" in config,
 'partición por tamaño':'groupEmailAttachments' in app and 'maxEmailRawBatchMb' in config,
}
failed=[k for k,v in checks.items() if not v]
if failed: raise SystemExit('FAIL: '+', '.join(failed))
print('OK · V10.6 correo masivo PDF/Word y destinatario común')
