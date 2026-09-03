from pathlib import Path
root = Path(__file__).resolve().parents[1]
docx = (root/'js/docx-engine.js').read_text(encoding='utf-8')
generator = (root/'js/generator.js').read_text(encoding='utf-8')
pdf = (root/'js/pdf-service.js').read_text(encoding='utf-8')
css = (root/'css/styles.css').read_text(encoding='utf-8')
config = (root/'js/config.js').read_text(encoding='utf-8')

assert "exams.map((x) => `✓  ${x}`)" in docx
assert "`✓  ${x}${states[x]" not in docx
assert "const runs = [{ text:'Recomendaciones: ', bold:true }]" in docx
assert "`Para ${exam}: `" in docx
assert "replaceParagraphWithRichRuns(doc, p, runs)" in docx
assert "<li>${e(x)}</li>" in generator
assert "recommendationParagraph" in generator
assert "ctx.setTransform(" not in pdf
assert "transform, background:'#ffffff'" in pdf
assert "display:block;text-align:center" in css
assert "v10.6" in config
print('OK · V10.6 conserva salida compacta + visor PDF ajustado')
