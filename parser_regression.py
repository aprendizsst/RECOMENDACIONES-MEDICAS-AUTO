from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('parser_v6', ROOT / 'parser.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

FORMATO_A = '''CONCEPTO MÉDICO OCUPACIONAL
FECHA Y CIUDAD DE REALIZACIÓN DEL EXAMEN
12   08   2026   PUERTO BOYACÁ (BOYACÁ, COLOMBIA)
TIPO DE EXAMEN MEDICO OCUPACIONAL
EVALUACION MEDICO OCUPACIONAL PERIODICO
DATOS DEL TRABAJADOR / ASPIRANTE
Apellidos y Nombres\tGénero\tEdad\tDocumento de Identificación
CIFUENTES FLOREZ MARIA ALICIA\tFEMENINO\t44 AÑOS 11 MESES 25 DIAS\tCC\t52844123
Cargo
ASESORA DE VENTAS
CONCEPTO DE APTITUD OCUPACIONAL
CONTROL PERIÓDICO CON RECOMENDACIONES
Observaciones: NO APLICA
El concepto de Aptitud se definió a partir de los siguientes exámenes practicados:
ESPIROMETRÍA OCUPACIONAL\tEXAMEN OCUPACIONAL ENFASIS OSTEOMUSCULAR
OPTOMETRÍA\tELECTROCARDIOGRAMA DE RITMO O DE SUPERFICIE
AUDIOMETRÍA OCUPACIONAL
RECOMENDACIONES MÉDICAS\tRECOMENDACIONES OCUPACIONALES\tHABITOS Y ESTILO DE VIDA SALUDABLES
CONTINUAR MANEJO MÉDICO: CONTINUAR MANEJO POR ORTOPEDIA EPS, APORTAR HISTORIAL CLÍNICO EN PROXIMA VALORACIÓN\tUSO DE EPP\tHÁBITOS SALUDABLES
EXAMEN VISUAL DE CONTROL EN UN AÑO\tSVE VISUAL: ASTIGMATISMO, PRESBICIA, CONTROL ANUAL POR OPTOMETRÍA\tCONTROL DE PESO
\tPAUSAS ACTIVAS E HIGIENE POSTURAL: CADA 2 HORAS\tHACER DEPORTE
\t\tDIETA BALANCEADA
OTRAS OBSERVACIONES Y RECOMENDACIONES
CONTROL PERIÓDICO CON RECOMENDACIONES
'''

FORMATO_B = '''INFORMACIÓN DE LA EMPRESA:
Empresa: JER S A
INFORMACIÓN DEL PACIENTE.
Fecha y Lugar: 31 JUL. 2026 - TUNJA - BOYACA
Paciente: JUAN PABLO URIBE PUENTES\tIdentificación: 1049654063
Escolaridad: BACHILLERATO\tCargo: COORDINADOR DE CALIDAD
Correo Electrónico: juanpablou330@gmail.com
EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES.
OPTOMETRIA\tCONTROLES PREVENTIVOS Y DE SEGUIMIENTO POR OPTOMETRIA ANUALMENTE// USO DE RX OPTICA PERMANENTE CON FILTROS PARA PROTECCION VISUAL - OCULAR// PAUSAS ACTIVAS Y EJERCICIOS VISUALES DE ENFOQUE
EXAMEN MEDICO OCUPACIONAL\tPAUSAS ACTIVAS CON EJERCICIOS PARA FORTALECIMIENTO DE ESPALDA, HIGIENE POSTURAL
GLICEMIA\tRealizado
PERFIL LIPIDICO\tRealizado
ENFASIS OSTEOMUSCULAR\tREALIZADO
CONCEPTO LABORAL
EXAMEN PERIODICO SATISFACTORIO
Observaciones: CONTROL POR EAPB, CONTROL DE PESO, VALORACION POR NUTRICION. PAUTAS ERGONOMICAS EN EL PUESTO DE TRABAJO. USO DE CORRECCION OPTICA PERMANENTE CON FILTROS PARA PROTECCION VISUAL
TIPO DE RESTRICCIÓN
NO
Ingresar al Programa de Vigilancia Epidemiológica o Programa de Prevención y Promoción
VISUAL\tSVE
Información de Remisiones
NUTRICION
MEDICINA GENERAL EPS
'''


def assert_contains(items, fragment):
    assert any(fragment.lower() in str(x).lower() for x in items), (fragment, items)


def test_formato_a():
    d = p.analizar_pdf_inteligente(FORMATO_A)
    assert d['nombre'] == 'Cifuentes Florez Maria Alicia'
    assert d['identificacion'] == '52844123'
    assert len(d['examenes_lista']) >= 5
    for ex in ['Espirometría', 'Optometría', 'Audiometría', 'Electrocardiograma']:
        assert_contains(d['examenes_lista'], ex)
    generales = d['recomendaciones_por_examen'].get('Recomendaciones generales', [])
    for rec in ['Uso de EPP', 'Control de peso', 'Hacer deporte', 'Dieta balanceada']:
        assert_contains(generales, rec)
    # V7 asocia por semántica fuerte las recomendaciones visuales y osteomusculares, sin mover transversales.
    assert_contains(d['recomendaciones_por_examen'].get('Optometría', []), 'Examen visual de control en un año')
    assert_contains(d['recomendaciones_por_examen'].get('Optometría', []), 'Astigmatismo')
    assert_contains(d['recomendaciones_por_examen'].get('Énfasis osteomuscular', []), 'ortopedia')
    assert_contains(d['recomendaciones_por_examen'].get('Énfasis osteomuscular', []), 'Pausas activas e higiene postural')
    assert 'visual' in d['vigilancia_programa'].lower()
    assert d['observaciones'].lower().startswith('ninguna')
    assert d['remisiones'].lower() == 'no'


def test_formato_b():
    d = p.analizar_pdf_inteligente(FORMATO_B)
    assert d['nombre'] == 'Juan Pablo Uribe Puentes'
    assert d['lugar'] == 'Tunja'
    assert_contains(d['recomendaciones_por_examen']['Optometría'], 'controles preventivos')
    assert_contains(d['recomendaciones_por_examen']['Examen clínico ocupacional'], 'fortalecimiento de espalda')
    assert d['recomendaciones_por_examen']['Glicemia'] == []
    assert 'control por eapb' in d['observaciones'].lower()
    assert 'nutricion' in d['remisiones'].lower()
    assert 'medicina general eps' in d['remisiones'].lower()
    assert 'visual' in d['vigilancia_programa'].lower()


def test_ai_does_not_relocate_or_invent():
    local = p.analizar_pdf_inteligente(FORMATO_A)
    fake_ai = {
        'nombre':'CIFUENTES FLOREZ MARIA ALICIA','cargo':'ASESORA DE VENTAS','identificacion':'52844123','correo':'',
        'tipo_examen':'PERIODICO','lugar':'PUERTO BOYACA','fecha':'2026-08-12',
        'examenes_realizados':['OPTOMETRIA'],
        'recomendaciones_medicas':['CONTROL DE PESO','TOMAR MUCHA AGUA'],
        'recomendaciones_por_examen':[{'examen':'OPTOMETRIA','recomendaciones':['CONTROL DE PESO','TOMAR MUCHA AGUA']}],
        'vigilancia_programa':['CONSERVACION VISUAL','CONSERVACION AUDITIVA'],
        'observaciones':'NO APLICA','remisiones':'NO',
        'evidencias':{'recomendaciones':['CONTROL DE PESO'],'observaciones':'NO APLICA','remisiones':'','vigilancia_programa':'SVE VISUAL'}
    }
    fused = p.fusionar_validacion_ia(local, fake_ai, FORMATO_A)
    assert_contains(fused['recomendaciones_por_examen'].get('Optometría', []), 'Examen visual de control en un año')
    assert 'control de peso' not in ' '.join(fused['recomendaciones_por_examen'].get('Optometría', [])).lower()
    assert 'tomar mucha agua' not in ' '.join(fused['recomendaciones_lista']).lower()
    assert 'auditiva' not in fused['vigilancia_programa'].lower()


if __name__ == '__main__':
    test_formato_a()
    test_formato_b()
    test_ai_does_not_relocate_or_invent()
    print('OK · regresiones V7 doble formato superadas')

# Regresión V8: algunos PDF.js entregan la fila visual completa sin tabulación.
FORMATO_B_SIN_COLUMNAS = '''EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES.
OPTOMETRIA CONTROL ANUAL // CONTINUAR USO PERMANENTE DE RX OPTICA // PAUSAS ACTIVAS VISUALES
EXAMEN MEDICO OCUPACIONAL CONTINUAR CON USO ADECUADO DE ELEMENTOS DE PROTECCION PERSONAL, SEGUIR PAUTAS DE HIGIENE POSTURAL, REALIZAR PAUSAS ACTIVAS DE 5
MINUTOS POR LO MENOS CADA 2 HORAS, AUTORREGULADAS, HÁBITOS DE VIDA SALUDABLE, EN LO POSIBLE REALIZAR ACTIVIDAD FÍSICA REGULAR
ENFASIS OSTEOMUSCULAR REALIZADO
CONCEPTO LABORAL
Observaciones CONTROL POR EAPB, CONTROL DE PESO, VALORACION POR NUTRICION. PAUTAS ERGONOMICAS EN EL PUESTO DE TRABAJO. USO DE CORRECCION OPTICA PERMANENTE CON FILTROS PARA PROTECCION VISUAL
Ingresar al Programa de Vigilancia
Epidemiológica o Programa de Prevención y Promoción
VISUAL SVE
Información de Remisiones NUTRICION
MEDICINA GENERAL EPS
'''


def test_formato_b_sin_columnas_v8():
    d = p.analizar_pdf_inteligente(FORMATO_B_SIN_COLUMNAS)
    assert_contains(d['recomendaciones_por_examen']['Optometría'], 'CONTROL ANUAL')
    assert_contains(d['recomendaciones_por_examen']['Optometría'], 'RX óptica')
    assert_contains(d['recomendaciones_por_examen']['Examen clínico ocupacional'], 'elementos de protección personal')
    assert_contains(d['recomendaciones_por_examen']['Examen clínico ocupacional'], 'CADA 2 HORAS')
    assert d.get('estado_por_examen', {}).get('Énfasis osteomuscular') == 'Realizado'
    assert 'control por eapb' in d['observaciones'].lower()
    assert 'visual' in d['vigilancia_programa'].lower()
    assert 'nutricion' in d['remisiones'].lower()
    assert 'medicina general eps' in d['remisiones'].lower()


if __name__ == '__main__':
    test_formato_b_sin_columnas_v8()
