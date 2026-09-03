const assert=require('assert');
global.window={};
require('../js/profile-engine.js');
const P=window.SSTProfiles;

const JER=`INFORMACIÓN DE LA EMPRESA.
INFORMACIÓN DEL PACIENTE.
Fecha y Lugar:\t11 mar. 2026 - TUNJA - BOYACA
Identificación:\t1054658726
Paciente:\tJOSE ALBEIRO VEGA VEGA
Correo Electrónico:\talbeiro952@hotmail.com
Cargo:\tRECAUDADOR
EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES.
EXAMEN MEDICO OCUPACIONAL DE SEGUIMIENTO OSTEOMUSCULAR\tPACIENTE ASISTE A EVALUACION MEDICA DE SEGUIMIENTO LABORAL - NO APORTA HISTORIA CLINICA DE ESPECIALISTA TRATANTE - SE RECOMIENDA REALIZAR PAUSAS ACTIVAS CADA 2 HORAS CON DURACION NO MENOR DE 5 MINUTOS Y ENFASIS EN MIEMBROS SUPERIORES
CONCEPTO LABORAL
EXAMEN DE SEGUIMIENTO CON RESTRICCIONES
Observaciones: SE DA PRORROGA DE RESTRICCION LABORAL HASTA SER EVALUADO POR MEDICO ESPECIALISTA TRATANTE PARA EVALUAR CONDUCTA Y CONCEPTO FAVORABLE DE REHABILITACION
Tipo de Restricción\tCondiciones, Factores, Agentes Asociados\tPermanente
MANEJO DE CARGAS (LEVANTAR, HALAR Y/O EMPUJAR) HASTA 10 KG DE PESO BIMANUAL\t\tN
LIMITAR LABORES QUE IMPLIQUEN ELEVAR EL BRAZO IZQUIERDO POR ENCIMA DEL HOMBRO, LIMITAR LABORES QUE PUEDAN GENERAR VIBRACIÓN MIEMBROS SUPERIORES.\t\tN
Ingresar al Programa de Vigilancia Epidemiológica o Programa de Prevención y Promoción
OSTEOMUSCULAR\tPPyP
Información de Remisiones
ORTOPEDIA`;

const CONTROL=`CONCEPTO MÉDICO OCUPACIONAL
FECHA Y CIUDAD DE REALIZACIÓN DEL EXAMEN
15\t07\t2026\tPUERTO BOYACÁ (BOYACÁ, COLOMBIA)
DATOS DEL TRABAJADOR / ASPIRANTE
Apellidos y Nombres
DIAZ ROSERO DORA VIVIANA
Documento de Identificación
36756619
Cargo
ASESOR DE VENTA
CONCEPTO DE APTITUD OCUPACIONAL
CONTROL PERIÓDICO CON RECOMENDACIONES
RESTRICCIONES LABORALES\tTIPO\tRECOMENDACIONES
RECOMENDACIONES\tTEMPORAL\tSEGUIMIENTO POR ORTOPEDIA Y MANEJO ANALGESICO
RECOMENDACIONES\tTEMPORAL\tPAUSAS ACTIVAS CADA HORA E HIGIENE POSTURAL CON ADECUACION ERGONOMICA DEL PUESTO DE TRABAJO
RECOMENDACIONES\tTEMPORAL\tUTILIZAR UN MOUSE ERGONÓMICO
El concepto de Aptitud se definió a partir de los siguientes exámenes practicados:
EVALUACION MEDICO OCUPACIONAL DE SEGUIMIENTO O CONTROL
RECOMENDACIONES MÉDICAS\tRECOMENDACIONES OCUPACIONALES\tHABITOS Y ESTILO DE VIDA SALUDABLES
CONTINUAR MANEJO MEDICO: SEGUIMIENTO POR ORTOPEDIA\tUSO DE EPP\tHÁBITOS SALUDABLES
VALORACIÓN POR EPS: NUTRICION\tPAUSAS ACTIVAS E HIGIENE POSTURAL : CADA HORA\tCONTROL DE PESO
\tSVE OSTEOMUSCULAR\tHACER DEPORTE
OTRAS OBSERVACIONES Y RECOMENDACIONES
CONTROL PERIÓDICO CON RECOMENDACIONES 1. SEGUIMIENTO POR ORTOPEDIA Y MANEJO ANALGESICO 2. PAUSAS ACTIVAS CADA HORA E HIGIENE POSTURAL`;

const b=P.analyze(JER);
assert.equal(b.perfil_detectado.id,'JER_TABLA');
assert.equal(b.nombre,'JOSE ALBEIRO VEGA VEGA');
assert.equal(b.fecha,'2026-03-11');
assert.equal(b.restricciones_lista.length,2);
assert.ok(b.observaciones.includes('prórroga'));
assert.equal(b.remisiones,'Ortopedia');
assert.ok(b.recomendaciones_lista.join(' ').includes('duración no menor de 5 minutos'));

const a=P.analyze(CONTROL);
assert.equal(a.perfil_detectado.id,'CONTROL_PERIODICO');
assert.equal(a.fecha,'2026-07-15');
assert.equal(a.lugar,'PUERTO BOYACÁ (BOYACÁ, COLOMBIA)');
assert.equal(a.restricciones_lista.length,3);
assert.ok(a.restricciones_lista.some(r=>r.texto==='Seguimiento por ortopedia y manejo analgésico'));
assert.ok(a.recomendaciones_lista.includes('Uso de EPP'));
assert.ok(a.recomendaciones_lista.includes('SVE osteomuscular'));
assert.ok(!a.recomendaciones_lista.some(x=>x==='Seguimiento por ortopedia y manejo analgésico'));
console.log('OK · perfiles V10 JER_TABLA + CONTROL_PERIODICO');


const JER_ESTADOS=`INFORMACIÓN DE LA EMPRESA.
INFORMACIÓN DEL PACIENTE.
Fecha y Lugar:\t03 sep. 2026 - TUNJA - BOYACA
Identificación:\t123456789
Paciente:\tPRUEBA USUARIO
Cargo:\tAUXILIAR
EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS - RECOMENDACIONES.
AUDIOMETRIA\t1. CONTROL ANUAL, 2. PAUTAS DE CUIDADO AUDITIVO, 3. USO DE ELEMENTOS DE PROTECCIÓN AUDITIVA EN EXPOSICIÓN A RUIDO
ESPIROMETRIA\tREALIZAR ACTIVIDAD FÍSICA, UTILIZAR ELEMENTOS DE PROTECCIÓN RESPIRATORIA, CONTROL ANUAL.
OPTOMETRIA\tUSO DE GAFAS CON PROTECCIÓN SOLAR
EXAMEN MEDICO OCUPACIONAL\tUSO DE ELEMENTOS DE PROTECCION PERSONAL, SEGUIR PAUTAS DE HIGIENE POSTURAL, REALIZAR PAUSAS ACTIVAS DE 5 MINUTOS POR LO MENOS CADA 2 HORAS
PERFIL LIPIDICO\tRealizado
KOH DE UÑAS\tRealizado
COPROLOGICO\tRealizado
FROTIS FARINGEO\tRealizado
ENFASIS CARDIOVASCULAR\tREALIZADO
ENFASIS OSTEOMUSCULAR\tREALIZADO
CONCEPTO LABORAL
APTO`;
const c=P.analyze(JER_ESTADOS);
assert.equal(c.perfil_detectado.id,'JER_TABLA');
assert.equal(c.examenes_lista.length,10);
for (const exam of ['Perfil lipídico','KOH de uñas','Coprológico','Frotis faríngeo','Énfasis cardiovascular','Énfasis osteomuscular']) {
  assert.ok(c.examenes_lista.includes(exam), `Falta examen ${exam}`);
  assert.equal(c.estado_por_examen[exam], 'Realizado', `Estado incorrecto para ${exam}`);
  assert.deepEqual(c.recomendaciones_por_examen[exam], [], `REALIZADO no debe ser recomendación para ${exam}`);
}
assert.equal(c.campos_revision.length,0);
console.log('OK · formato JER con exámenes de estado REALIZADO');


// Regresión V10.3: diferencias de redacción dentro de la misma familia de
// tipo de examen no son contradicciones materiales.
const eqSeguimiento=P.compareExamTypes('EXAMEN DE SEGUIMIENTO CON RESTRICCIONES','Seguimiento laboral');
assert.equal(eqSeguimiento.equivalent,true);
assert.equal(eqSeguimiento.materialConflict,false);
assert.equal(eqSeguimiento.localCategory,'SEGUIMIENTO');
assert.equal(eqSeguimiento.aiCategory,'SEGUIMIENTO');

const eqPeriodico=P.compareExamTypes('CONTROL PERIÓDICO CON RECOMENDACIONES','Evaluación médica ocupacional periódica');
assert.equal(eqPeriodico.equivalent,true);
assert.equal(eqPeriodico.materialConflict,false);
assert.equal(eqPeriodico.localCategory,'PERIODICO');

const eqIngreso=P.compareExamTypes('EXAMEN PREOCUPACIONAL','Ingreso');
assert.equal(eqIngreso.equivalent,true);
assert.equal(eqIngreso.localCategory,'INGRESO');

const conflict=P.compareExamTypes('EXAMEN DE INGRESO','EXAMEN DE EGRESO');
assert.equal(conflict.equivalent,false);
assert.equal(conflict.materialConflict,true);
assert.equal(conflict.localCategory,'INGRESO');
assert.equal(conflict.aiCategory,'EGRESO');

const wording=P.compareExamTypes('EXAMEN MÉDICO OCUPACIONAL','VALORACIÓN OCUPACIONAL');
assert.equal(wording.materialConflict,false);
console.log('OK · V10.3 normalización semántica de tipo de examen');
