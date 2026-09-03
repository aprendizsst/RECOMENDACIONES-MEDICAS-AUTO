(() => {
  const MONTHS = { ene:1, enero:1, feb:2, febrero:2, mar:3, marzo:3, abr:4, abril:4, may:5, mayo:5, jun:6, junio:6, jul:7, julio:7, ago:8, agosto:8, sep:9, sept:9, septiembre:9, oct:10, octubre:10, nov:11, noviembre:11, dic:12, diciembre:12 };
  const EXAMS = [
    ['EXAMEN MEDICO OCUPACIONAL DE SEGUIMIENTO OSTEOMUSCULAR','Examen médico ocupacional de seguimiento osteomuscular'],
    ['EXAMEN MEDICO OCUPACIONAL','Examen médico ocupacional'],
    ['EVALUACION MEDICO OCUPACIONAL DE SEGUIMIENTO O CONTROL','Evaluación médico ocupacional de seguimiento o control'],
    ['EVALUACION MEDICO OCUPACIONAL','Evaluación médico ocupacional'],
    ['ENFASIS OSTEOMUSCULAR','Énfasis osteomuscular'],
    ['ENFASIS CARDIOVASCULAR','Énfasis cardiovascular'],
    ['OPTOMETRIA','Optometría'], ['VISIOMETRIA','Visiometría'], ['AUDIOMETRIA','Audiometría'],
    ['ESPIROMETRIA','Espirometría'], ['ELECTROCARDIOGRAMA','Electrocardiograma'], ['GLICEMIA','Glicemia'],
    ['PERFIL LIPIDICO','Perfil lipídico'], ['KOH DE UNAS','KOH de uñas'], ['KOH UNAS','KOH de uñas'],
    ['COPROLOGICO','Coprológico'], ['FROTIS FARINGEO','Frotis faríngeo'],
    ['CUADRO HEMATICO','Cuadro hemático'], ['HEMOGRAMA','Hemograma'],
    ['PARCIAL DE ORINA','Parcial de orina'], ['PSICOSENSOMETRICO','Psicosensométrico'], ['RAYOS X','Rayos X']
  ];
  const STOP = [
    'CONCEPTO LABORAL','CONCEPTO DE APTITUD','OBSERVACIONES','TIPO DE RESTRICCION','TIPO DE RESTRICCIÓN',
    'INGRESAR AL PROGRAMA','INFORMACION DE REMISIONES','INFORMACIÓN DE REMISIONES','OTRAS OBSERVACIONES Y RECOMENDACIONES',
    'FIRMA','CONSENTIMIENTO','AUTORIZACION','AUTORIZACIÓN'
  ];

  const clean = (v) => String(v ?? '').replace(/\u00a0/g,' ').replace(/[ ]{2,}/g,' ').trim();
  const fold = (v) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9@._%+\-/:]+/g,' ').replace(/\s+/g,' ').trim();
  const lines = (text) => String(text || '').split(/\n+/).map(clean).filter(Boolean);
  const cols = (line) => String(line || '').split(/\t+/).map(clean).filter(Boolean);
  const uniq = (arr) => { const out=[]; const seen=new Set(); for(const value of arr||[]){ const x=clean(value).replace(/^[•✓✔☑\-–—]+\s*/,''); const k=fold(x); if(x && !seen.has(k)){seen.add(k);out.push(x);} } return out; };
  const endsSection = (line) => STOP.some((s) => fold(line).includes(fold(s)));

  function normalizeClinicalText(value) {
    let s = clean(value);
    if (!s) return '';
    const originalLetters = s.match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g) || [];
    const originalUppers = s.match(/[A-ZÁÉÍÓÚÑÜ]/g) || [];
    const wasMostlyUpper = originalLetters.length >= 8 && originalUppers.length / originalLetters.length > .78;
    const fixes = [
      [/\brealziad([oa]s?)\b/gi,'realizad$1'], [/\bseguimineto\b/gi,'seguimiento'], [/\brecomendaicones\b/gi,'recomendaciones'],
      [/\brecomendacines\b/gi,'recomendaciones'], [/\bprotecion\b/gi,'protección'], [/\brestriccion\b/gi,'restricción'],
      [/\baudiometria\b/gi,'audiometría'], [/\bvisiometria\b/gi,'visiometría'], [/\bespirometria\b/gi,'espirometría'],
      [/\boptometria\b/gi,'optometría'], [/\bperiodic([oa]s?)\b/gi,'periódic$1'], [/\bmedic([oa]s?)\b/gi,'médic$1'], [/\bevaluacion\b/gi,'evaluación'],
      [/\bvaloracion\b/gi,'valoración'], [/\bproteccion\b/gi,'protección'], [/\balimentacion\b/gi,'alimentación'], [/\bhabitos\b/gi,'hábitos'],
      [/\boptica\b/gi,'óptica'], [/\bfisica\b/gi,'física'], [/\benfasis\b/gi,'énfasis'], [/\bclinica\b/gi,'clínica'],
      [/\bduracion\b/gi,'duración'], [/\bprorroga\b/gi,'prórroga'], [/\brehabilitacion\b/gi,'rehabilitación'],
      [/\banalgesic([oa]s?)\b/gi,'analgésic$1'], [/\badecuacion\b/gi,'adecuación'], [/\bergonomic([oa]s?)\b/gi,'ergonómic$1'],
      [/\bnutricion\b/gi,'nutrición'], [/\bremision\b/gi,'remisión'], [/\bprevencion\b/gi,'prevención'], [/\bpromocion\b/gi,'promoción'],
      [/\bvibracion\b/gi,'vibración'], [/\bidentificacion\b/gi,'identificación']
    ];
    for (const [rx,to] of fixes) s = s.replace(rx,to);
    s = s.replace(/\s+([,.;:])/g,'$1').replace(/([,.;:])(?=\S)/g,'$1 ').replace(/\s+/g,' ').trim();
    if (wasMostlyUpper) {
      s = s.toLocaleLowerCase('es-CO').replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (_,a,b) => a + b.toLocaleUpperCase('es-CO'));
    }
    // Restaurar siglas clínicas y administrativas sin alterar dosis, tiempos o unidades.
    for (const [raw, label] of [['sst','SST'],['pve','PVE'],['sve','SVE'],['dme','DME'],['epp','EPP'],['rx','RX'],['eps','EPS'],['arl','ARL'],['afp','AFP'],['imc','IMC'],['ppyp','PPyP']]) {
      s = s.replace(new RegExp(`\\b${raw}\\b`,'gi'), label);
    }
    return s;
  }


  // V10.3: normalización semántica del tipo de examen. El objetivo no es
  // reescribir el texto clínico, sino comparar categorías equivalentes sin
  // generar falsos positivos por diferencias de redacción entre motor local e IA.
  function examTypeCategory(value) {
    const n = fold(value);
    if (!n) return '';
    // Orden de mayor especificidad a menor especificidad.
    if (/POST\s*INCAPACIDAD|POSTINCAPACIDAD|REINTEGRO|REINCORPORACION|RETORNO\s+LABORAL/.test(n)) return 'POST_INCAPACIDAD';
    if (/CAMBIO\s+(?:DE\s+)?CARGO|CAMBIO\s+(?:DE\s+)?PUESTO/.test(n)) return 'CAMBIO_CARGO';
    if (/EGRESO|RETIRO/.test(n)) return 'EGRESO';
    if (/PRE\s*INGRESO|PREINGRESO|PRE\s*OCUPACIONAL|PREOCUPACIONAL|(?:^| )INGRESO(?: |$)/.test(n) && !/REINGRESO/.test(n)) return 'INGRESO';
    if (/SEGUIMIENTO|CONTROL\s+(?:DE\s+)?SEGUIMIENTO|CONTROL\s+LABORAL/.test(n)) return 'SEGUIMIENTO';
    if (/PERIODIC/.test(n)) return 'PERIODICO';
    return '';
  }

  function compareExamTypes(localValue, aiValue) {
    const localText = clean(localValue), aiText = clean(aiValue);
    const l = fold(localText), a = fold(aiText);
    const localCategory = examTypeCategory(localText), aiCategory = examTypeCategory(aiText);
    if (!localText || !aiText) {
      return { equivalent:false, materialConflict:false, localCategory, aiCategory, reason:'missing_value' };
    }
    if (l === a || (l.length >= 8 && a.length >= 8 && (l.includes(a) || a.includes(l)))) {
      return { equivalent:true, materialConflict:false, localCategory, aiCategory, reason:'text_equivalent' };
    }
    if (localCategory && aiCategory && localCategory === aiCategory) {
      return { equivalent:true, materialConflict:false, localCategory, aiCategory, reason:'same_category' };
    }
    // Solo existe contradicción material cuando AMBAS fuentes se pueden clasificar
    // con seguridad y pertenecen a categorías distintas. Una paráfrasis no
    // clasificada nunca debe bloquear un documento de perfil conocido.
    if (localCategory && aiCategory && localCategory !== aiCategory) {
      return { equivalent:false, materialConflict:true, localCategory, aiCategory, reason:'different_category' };
    }
    return { equivalent:false, materialConflict:false, localCategory, aiCategory, reason:'wording_difference' };
  }

  function findLabelValue(ls, labels, options={}) {
    const labelsFold = labels.map(fold);
    for (let i=0;i<ls.length;i++) {
      const f = fold(ls[i]);
      for (const lab of labelsFold) {
        const pos = f.indexOf(lab);
        if (pos < 0) continue;
        const original = ls[i];
        const startsAsLabel = f === lab || f.startsWith(lab + ' ') || new RegExp('^\\s*' + lab.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*[:\\-]?', 'i').test(f);
        if (!startsAsLabel && !original.includes(':')) continue;
        const c = cols(original);
        if (c.length > 1) {
          const idx = c.findIndex((x) => fold(x).includes(lab));
          if (idx >= 0 && c[idx+1] && !labelsFold.some((l) => fold(c[idx+1]).includes(l))) return clean(c[idx+1].replace(/^[:\-]+/,''));
        }
        const m = original.match(/:\s*(.+)$/);
        if (m && clean(m[1])) return clean(m[1]);
        for (let j=i+1;j<Math.min(ls.length,i+(options.lookahead||4));j++) {
          const candidate = clean(ls[j]); const cf=fold(candidate);
          if (!candidate || labelsFold.some((l)=>cf.includes(l))) continue;
          if (options.reject && options.reject.some((x)=>cf.includes(fold(x)))) continue;
          return candidate;
        }
      }
    }
    return '';
  }

  function parseDateAndPlace(raw) {
    const s = clean(raw); if(!s) return {fecha:'', lugar:''};
    let fecha=''; let lugar=''; let dateEnd=-1;
    let m = s.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(20\d{2})\b/);
    if (m) { fecha = `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; dateEnd=(m.index||0)+m[0].length; }
    if (!fecha) {
      m = s.match(/\b(\d{1,2})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.]+)\.?\s+(20\d{2})\b/);
      if (m) { const mon=MONTHS[fold(m[2]).toLowerCase().replace(/\./g,'')]; if(mon) { fecha=`${m[3]}-${String(mon).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; dateEnd=(m.index||0)+m[0].length; } }
    }
    if (!fecha) {
      // Formato tabular convertido a texto: 15 07 2026 PUERTO BOYACÁ (...)
      m = s.match(/\b(\d{1,2})\s+(\d{1,2})\s+(20\d{2})\b/);
      if (m) { fecha = `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; dateEnd=(m.index||0)+m[0].length; }
    }
    if (dateEnd >= 0) {
      const after = clean(s.slice(dateEnd).replace(/^[\s,;:\-–—]+/,''));
      if (after && !/^D[IÍ]A\b|^MES\b|^A[NÑ]O\b/i.test(after)) lugar = after;
    }
    const dash = s.split(/\s+-\s+/).map(clean).filter(Boolean);
    if (!lugar && dash.length >= 2) lugar = dash.slice(1).join(' - ');
    lugar = clean(lugar).replace(/\bBOYACA\b/gi,'Boyacá').replace(/\bPUERTO BOYACA\b/gi,'Puerto Boyacá');
    return {fecha, lugar};
  }

  function detectProfile(text) {
    const n = fold(text);
    const jer = ['INFORMACION DE LA EMPRESA','INFORMACION DEL PACIENTE','EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS','CONCEPTO LABORAL'].filter((k)=>n.includes(k)).length;
    const control = ['CONCEPTO MEDICO OCUPACIONAL','CONTROL PERIODICO CON RECOMENDACIONES','RESTRICCIONES LABORALES','RECOMENDACIONES MEDICAS','RECOMENDACIONES OCUPACIONALES'].filter((k)=>n.includes(k)).length;
    if (jer >= 3) return { id:'JER_TABLA', name:'JER · examen / recomendación / restricción', confidence:Math.min(1,.55+jer*.11) };
    if (control >= 3) return { id:'CONTROL_PERIODICO', name:'Control periódico · recomendaciones por columnas', confidence:Math.min(1,.52+control*.1) };
    return { id:'GENERICO', name:'Formato no catalogado', confidence:.35 };
  }

  function plausibleExamLabel(value) {
    const raw=clean(value), n=fold(raw);
    if(!raw || n.length < 3 || n.length > 90) return false;
    if (STOP.some((s)=>n.includes(fold(s)))) return false;
    if (/^(REALIZAD[OA]S?|NORMAL|NO APLICA|N A|APTO|SI|NO)$/.test(n)) return false;
    if (/^(RECOMENDACIONES?|RESULTADO|OBSERVACIONES?|PERMANENTE|TIPO|CONDICIONES|FACTORES|AGENTES)$/.test(n)) return false;
    // En el formato JER la columna izquierda del bloque clínico es, por definición,
    // el nombre del examen. Admitimos nombres no catalogados para no perder pruebas
    // como KOH de uñas, coprológico, frotis faríngeo o futuros exámenes del proveedor.
    const words=n.split(' ').filter(Boolean);
    if (words.length > 12) return false;
    return /[A-Z]/.test(n) && !/[.!?]{2,}/.test(raw);
  }

  function examCanon(value, structural=false) {
    const n=fold(value); if(!n) return '';
    for(const [key,label] of EXAMS) if(n.includes(key)) return label;
    if (/^EXAMEN\b/.test(n) && n.split(' ').length <= 12) return normalizeClinicalText(value);
    if (structural && plausibleExamLabel(value)) return normalizeClinicalText(value);
    return '';
  }

  function examStatus(value) {
    const n=fold(value).replace(/[.:;,-]+$/,'').trim();
    if (/^REALIZAD[OA]S?$/.test(n)) return 'Realizado';
    if (/^NORMAL$/.test(n)) return 'Normal';
    if (/^(NO APLICA|N A)$/.test(n)) return 'No aplica';
    if (/^APTO$/.test(n)) return 'Apto';
    return '';
  }

  function collectExamRows(ls, startTerms, endTerms) {
    let active=false, current=''; const exams=[]; const map={}; const states={};
    for (const line of ls) {
      const n=fold(line);
      if (!active && startTerms.some((t)=>n.includes(fold(t)))) { active=true; continue; }
      if (!active) continue;
      if (endTerms.some((t)=>n.includes(fold(t)))) break;
      const c=cols(line);
      let exam=''; let rest='';
      if(c.length>=2){ exam=examCanon(c[0], true); rest=c.slice(1).join(' '); }
      if(!exam){
        const colon=line.match(/^(.{3,80}?):\s*(.+)$/); if(colon){ exam=examCanon(colon[1]); rest=colon[2]; }
      }
      if(!exam){ const direct=examCanon(line); if(direct && fold(line).length < 95){ exam=direct; rest=''; } }
      if(exam){
        current=exam; if(!exams.includes(exam))exams.push(exam); map[exam] ||= [];
        if(rest){ const status=examStatus(rest); if(status) states[exam]=status; else map[exam].push(normalizeClinicalText(rest)); }
        continue;
      }
      if(current && line && !endsSection(line)) {
        const nline=fold(line), status=examStatus(line);
        if(status){ states[current]=status; continue; }
        if(nline.length>8) {
          const arr=map[current]||[]; if(arr.length) arr[arr.length-1]=normalizeClinicalText(arr[arr.length-1]+' '+line);
        }
      }
    }
    for(const k of Object.keys(map)) map[k]=uniq(map[k]);
    return {exams,map,states};
  }

  function semanticAssign(exams, recs) {
    const map={}; exams.forEach((e)=>map[e]=[]); const general=[];
    const keys = [
      [/OPTOMET|VISUAL|OPTIC|PRESB|ASTIGMAT/i,/OPTOMET|VISIOMET|VISUAL/i],
      [/OSTEOMUSC|ORTOPED|ERGONOM|POSTURAL|ESPALDA|MIEMBRO|PAUSA ACTIVA/i,/OSTEOMUSC|MUSCULO/i],
      [/AUDIT|RUIDO|OIDO/i,/AUDIOMET/i], [/RESPIR|ESPIROM|POLVO|HUMO/i,/ESPIROM/i], [/CARDIO|ELECTROCARD/i,/ELECTROCARD/i]
    ];
    for(const rec0 of recs){ const rec=normalizeClinicalText(rec0); if(!rec)continue; let target=''; for(const [rxRec,rxExam] of keys){ if(rxRec.test(fold(rec))){ const hit=exams.find((e)=>rxExam.test(fold(e))); if(hit){target=hit;break;} } } if(target) map[target].push(rec); else general.push(rec); }
    for(const k of Object.keys(map)) map[k]=uniq(map[k]); if(general.length) map['Recomendaciones generales']=uniq(general); return map;
  }

  function extractJer(text) {
    const ls=lines(text); const out={}; const ev={};
    out.nombre=findLabelValue(ls,['Paciente','Nombre paciente','Nombre del paciente'],{reject:['Género','Fecha']});
    out.identificacion=findLabelValue(ls,['Identificación','Documento de identificación','Cédula','Cedula']);
    out.correo=findLabelValue(ls,['Correo Electrónico','Correo electronico','Email']);
    out.cargo=findLabelValue(ls,['Cargo'],{reject:['Peso','Talla']});
    const fl=findLabelValue(ls,['Fecha y Lugar','Fecha y lugar']); const dp=parseDateAndPlace(fl); out.fecha=dp.fecha; out.lugar=dp.lugar || 'Tunja';
    const rows=collectExamRows(ls,['EXÁMENES DE DIAGNÓSTICO LABORAL REALIZADOS','EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS'],['CONCEPTO LABORAL','CONCEPTO DE APTITUD']);
    out.examenes_lista=rows.exams; out.recomendaciones_por_examen=rows.map; out.estado_por_examen=rows.states;
    const conceptIdx=ls.findIndex((x)=>fold(x).includes('CONCEPTO LABORAL'));
    if(conceptIdx>=0){ for(let i=conceptIdx+1;i<Math.min(ls.length,conceptIdx+5);i++){ const n=fold(ls[i]); if(n && !n.includes('OBSERVACIONES')){ out.tipo_examen=normalizeClinicalText(ls[i]); break; } } }
    if(!out.tipo_examen){ const ex=out.examenes_lista.find((x)=>/SEGUIMIENTO|PERIODIC|INGRESO|EGRESO/i.test(fold(x))); out.tipo_examen=ex || 'Seguimiento laboral'; }
    const obsStart=ls.findIndex((x)=>fold(x).startsWith('OBSERVACIONES'));
    if(obsStart>=0){ const pieces=[]; const first=ls[obsStart].replace(/^\s*Observaciones\s*[:.]?\s*/i,''); if(clean(first))pieces.push(first); for(let i=obsStart+1;i<ls.length;i++){ if(fold(ls[i]).includes('TIPO DE RESTRICCION'))break; if(ls[i])pieces.push(ls[i]); } out.observaciones=normalizeClinicalText(pieces.join(' ')); }
    const restrictions=[]; let inRest=false;
    for(const line of ls){ const n=fold(line); if(n.includes('TIPO DE RESTRICCION')){inRest=true;continue;} if(inRest && (n.includes('INGRESAR AL PROGRAMA')||n.includes('INFORMACION DE REMISIONES')))break; if(!inRest)continue; const c=cols(line); const candidate=clean(c[0]||line); const cn=fold(candidate); if(!candidate||['TIPO DE RESTRICCION','CONDICIONES FACTORES AGENTES ASOCIADOS','PERMANENTE','N'].includes(cn))continue; if(cn.length>12) restrictions.push({tipo:(c[2]&&/^S[IÍ]$/i.test(c[2]))?'Permanente':'Temporal/según certificado',texto:normalizeClinicalText(candidate)}); }
    out.restricciones_lista=dedupeRestrictions(restrictions);
    out.vigilancia_lista=[]; let inVig=false;
    for(const line of ls){ const n=fold(line); if(n.includes('INGRESAR AL PROGRAMA DE VIGILANCIA')){inVig=true;continue;} if(inVig && n.includes('INFORMACION DE REMISIONES'))break; if(inVig){ if(/OSTEOMUSC/i.test(n)) out.vigilancia_lista.push('Prevención osteomuscular (DME)'); if(/VISUAL/i.test(n)) out.vigilancia_lista.push('Conservación visual'); if(/AUDIT/i.test(n))out.vigilancia_lista.push('Conservación auditiva'); } }
    out.vigilancia_lista=uniq(out.vigilancia_lista); out.vigilancia_programa=out.vigilancia_lista.join(', ') || 'Ninguno';
    let inRem=false; const rem=[]; for(const line of ls){ const n=fold(line); if(n.includes('INFORMACION DE REMISIONES')){inRem=true;continue;} if(!inRem)continue; if(/FIRMA|CONSENTIMIENTO|AUTORIZACION/.test(n))break; const c=cols(line); for(const cell of c){ const cn=fold(cell); if(cell && cn.length>3 && !cn.includes('INFORMACION DE REMISIONES') && !/^(NO|N A|NINGUNA)$/.test(cn)) rem.push(normalizeClinicalText(cell)); } } out.remisiones=uniq(rem).join('; ') || 'No';
    out.recomendaciones_lista=flattenMap(out.recomendaciones_por_examen);
    ev.perfil='Encabezados JER + tabla examen/recomendación + sección de restricciones'; out.evidencias=ev;
    return finalize(out,'JER_TABLA');
  }

  function dedupeRestrictions(items){ const seen=new Set(),out=[]; for(const r of items||[]){const text=normalizeClinicalText(r?.texto||r);const k=fold(text);if(text&&!seen.has(k)){seen.add(k);out.push({tipo:clean(r?.tipo||''),texto:text});}}return out; }
  function flattenMap(map){ const out=[]; for(const [exam,recs] of Object.entries(map||{})){ for(const rec of recs||[]) out.push(exam==='Recomendaciones generales'?rec:`${exam}: ${rec}`); } return uniq(out); }


  function splitNumberedRecommendations(value) {
    const s=clean(value).replace(/^CONTROL\s+PERI[ÓO]DICO\s+CON\s+RECOMENDACIONES\s*/i,'');
    if(!s)return [];
    const parts=s.split(/\s+(?=\d{1,2}[.)]\s+)/).map((x)=>clean(x.replace(/^\d{1,2}[.)]\s*/,''))).filter(Boolean);
    return parts.length>1?parts:[s];
  }

  function mergePreferDetailed(values) {
    const out=[];
    for(const raw of values||[]){
      const value=normalizeClinicalText(raw); const key=fold(value); if(!value||key.length<4)continue;
      let merged=false;
      for(let i=0;i<out.length;i++){
        const a=fold(out[i]);
        if(a===key){merged=true;break;}
        // Si una recomendación es ampliación textual de otra, conservar la versión con mayor detalle.
        if(a.includes(key) || key.includes(a)) { if(key.length>a.length) out[i]=value; merged=true; break; }
        const aLead=a.split(' ').slice(0,7).join(' '), kLead=key.split(' ').slice(0,7).join(' ');
        if(aLead.length>22 && aLead===kLead){ if(key.length>a.length)out[i]=value; merged=true; break; }
      }
      if(!merged)out.push(value);
    }
    return uniq(out);
  }

  function extractControl(text) {
    const ls=lines(text); const out={};
    out.nombre=findLabelValue(ls,['APELLIDOS Y NOMBRES','NOMBRES Y APELLIDOS'],{lookahead:5,reject:['GÉNERO','DOCUMENTO']});
    out.identificacion=findLabelValue(ls,['Documento de Identificación','Documento de Identificacion','Identificación','Identificacion']);
    out.cargo=findLabelValue(ls,['Cargo'],{lookahead:3,reject:['EPS','AFP','ARL']});
    const rawDate=findLabelValue(ls,['FECHA Y CIUDAD DE REALIZACIÓN DEL EXAMEN','FECHA Y CIUDAD DE REALIZACION DEL EXAMEN'],{lookahead:7});
    const dp=parseDateAndPlace(rawDate); out.fecha=dp.fecha; out.lugar=dp.lugar;
    if(!out.fecha){ const joined=ls.slice(0,25).join(' '); const m=joined.match(/\b(\d{1,2})\s+(\d{1,2})\s+(20\d{2})\b/); if(m)out.fecha=`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
    if(!out.lugar){ const cityLine=ls.slice(0,25).find((x)=>/PUERTO BOYACA|TUNJA|DUITAMA|SOGAMOSO|CHIQUINQUIRA|BOYACA/i.test(fold(x))); if(cityLine){ const city=clean(cityLine.replace(/^.*?\b(?:20\d{2})\b[\s,:;\-]*/,'').replace(/^(?:D[IÍ]A|MES|A[NÑ]O)\b.*$/i,'')); if(city)out.lugar=normalizeClinicalText(city); } }
    out.tipo_examen=findLabelValue(ls,['CONCEPTO DE APTITUD OCUPACIONAL'],{lookahead:4}) || 'Control periódico con recomendaciones';
    const whole=fold(text); let exams=[]; for(const [key,label] of EXAMS){ if(whole.includes(key) && !exams.includes(label))exams.push(label); }
    exams = exams.filter((exam) => !exams.some((other) => other !== exam && fold(other).includes(fold(exam))));
    out.examenes_lista=exams;
    const restrictions=[]; let inRest=false; const restRecs=[];
    for(const line of ls){ const n=fold(line); if(n==='RESTRICCIONES LABORALES' || n.startsWith('RESTRICCIONES LABORALES ')){inRest=true;continue;} if(inRest && n.includes('EL CONCEPTO DE APTITUD')){inRest=false;break;} if(!inRest)continue; const c=cols(line); if(c.length>=2){ const typeCell=c.find((x)=>/TEMPORAL|PERMANENTE/i.test(fold(x)))||''; const rec=c[c.length-1]; if(rec && !/^(RECOMENDACIONES|TIPO)$/i.test(fold(rec)) && fold(rec).length>8){ restrictions.push({tipo:/PERMANENTE/i.test(fold(typeCell))?'Permanente':'Temporal',texto:normalizeClinicalText(rec)}); restRecs.push(rec); } } }
    out.restricciones_lista=dedupeRestrictions(restrictions);
    const columnRecs=[]; let inCols=false;
    for(const line of ls){ const n=fold(line); if(n.includes('RECOMENDACIONES MEDICAS')&&n.includes('RECOMENDACIONES OCUPACIONALES')){inCols=true;continue;} if(inCols && n.includes('OTRAS OBSERVACIONES Y RECOMENDACIONES'))break; if(!inCols)continue; for(const cell of cols(line)){ const cn=fold(cell); if(!cell||/^(RECOMENDACIONES MEDICAS|RECOMENDACIONES OCUPACIONALES|HABITOS Y ESTILO DE VIDA SALUDABLES)$/.test(cn))continue; if(cn.length>4)columnRecs.push(cell); } }
    const otherIdx=ls.findIndex((x)=>fold(x).includes('OTRAS OBSERVACIONES Y RECOMENDACIONES'));
    if(otherIdx>=0){
      const more=[];
      for(let i=otherIdx+1;i<ls.length;i++){
        const n=fold(ls[i]); if(/FIRMA|CONSENTIMIENTO|AUTORIZACION/.test(n))break;
        if(n.length>8) more.push(...splitNumberedRecommendations(ls[i]));
      }
      const supplementary=[];
      for(const candidate of more){
        const c=fold(candidate); if(!c)continue;
        let match=-1;
        for(let i=0;i<restrictions.length;i++){
          const rr=fold(restrictions[i]?.texto||''); if(!rr)continue;
          const a=rr.split(' ').slice(0,7).join(' '), b=c.split(' ').slice(0,7).join(' ');
          if(rr.includes(c)||c.includes(rr)||(a.length>22&&a===b)){match=i;break;}
        }
        if(match>=0){
          // "Otras observaciones y recomendaciones" suele repetir y ampliar la fila corta.
          // Si trae más detalle, se conserva la versión ampliada como restricción.
          if(c.length>fold(restrictions[match].texto).length) restrictions[match].texto=normalizeClinicalText(candidate);
        } else supplementary.push(candidate);
      }
      columnRecs.push(...supplementary);
    }
    out.restricciones_lista=dedupeRestrictions(restrictions);
    // Las filas de "RESTRICCIONES LABORALES" se conservan exclusivamente como restricciones
    // para no repetirlas como recomendaciones. Las observaciones extensas complementan las
    // columnas, conservando la versión más detallada de cada recomendación.
    const allRecs=mergePreferDetailed(columnRecs);
    out.recomendaciones_por_examen=semanticAssign(exams,allRecs); out.recomendaciones_lista=flattenMap(out.recomendaciones_por_examen);
    out.observaciones=''; out.remisiones='No'; out.vigilancia_lista=[];
    for(const rec of allRecs){ const n=fold(rec); if(/SVE\s*OSTEOMUSC|PVE\s*OSTEOMUSC/.test(n))out.vigilancia_lista.push('Prevención osteomuscular (DME)'); if(/SVE\s*VISUAL|PVE\s*VISUAL/.test(n))out.vigilancia_lista.push('Conservación visual'); }
    out.vigilancia_lista=uniq(out.vigilancia_lista); out.vigilancia_programa=out.vigilancia_lista.join(', ')||'Ninguno';
    out.evidencias={perfil:'Concepto médico ocupacional + restricciones laborales + tres columnas de recomendaciones'};
    return finalize(out,'CONTROL_PERIODICO');
  }

  function finalize(out, profileId) {
    out.nombre=clean(out.nombre); out.identificacion=clean(out.identificacion).replace(/\D/g,'') || clean(out.identificacion); out.cargo=clean(out.cargo);
    out.correo=clean(out.correo); out.lugar=clean(out.lugar)||'Tunja'; out.fecha=clean(out.fecha); out.tipo_examen=normalizeClinicalText(out.tipo_examen||'');
    out.examenes_lista=uniq(out.examenes_lista||[]); out.recomendaciones_por_examen=out.recomendaciones_por_examen||{}; out.recomendaciones_lista=uniq(out.recomendaciones_lista||flattenMap(out.recomendaciones_por_examen));
    out.estado_por_examen=out.estado_por_examen||{};
    out.restricciones_lista=dedupeRestrictions(out.restricciones_lista||[]); out.observaciones=normalizeClinicalText(out.observaciones||''); out.remisiones=clean(out.remisiones)||'No';
    out.vigilancia_lista=uniq(out.vigilancia_lista||[]); out.vigilancia_programa=clean(out.vigilancia_programa)||'Ninguno';
    const missing=[]; if(!out.nombre)missing.push('nombre'); if(!out.cargo)missing.push('cargo'); if(!out.examenes_lista.length)missing.push('exámenes realizados'); if(!out.recomendaciones_lista.length&&!out.restricciones_lista.length)missing.push('recomendaciones/restricciones');
    const base = profileId==='GENERICO'?45:88; const confidence=Math.max(0,Math.min(99,base-missing.length*12+(out.identificacion?2:0)+(out.fecha?2:0)));
    out.perfil_documental = profileId==='JER_TABLA'?'Formato JER · tabla clínica':profileId==='CONTROL_PERIODICO'?'Formato control periódico · matriz clínica':'Formato genérico';
    out.motor_formato='Perfil V10.3'; out.confianza_formato=confidence; out.calidad_extraccion=confidence>=92?'Alta':confidence>=78?'Media':'Revisar'; out.campos_revision=missing; out.recomendaciones_pendientes_revision=[]; out.modo_validacion=`Motor por formato V10.3 · ${out.perfil_documental}`;
    return out;
  }

  function merge(primary, fallback) {
    const a=primary||{}, b=fallback||{}; const out={...b,...a};
    for(const key of ['nombre','cargo','identificacion','correo','tipo_examen','lugar','fecha','observaciones','remisiones','vigilancia_programa']) if(!clean(a[key]))out[key]=b[key];
    if(!(a.examenes_lista||[]).length)out.examenes_lista=b.examenes_lista||[];
    if(!(a.recomendaciones_lista||[]).length){out.recomendaciones_lista=b.recomendaciones_lista||[];out.recomendaciones_por_examen=b.recomendaciones_por_examen||{};}
    if(!(a.restricciones_lista||[]).length)out.restricciones_lista=b.restricciones_lista||[];
    out.campos_revision=uniq([...(a.campos_revision||[]),...(b.campos_revision||[])]).filter((field)=>{
      const n=fold(field); if(n.includes('NOMBRE')&&out.nombre)return false; if(n.includes('CARGO')&&out.cargo)return false; if(n.includes('EXAMEN')&&(out.examenes_lista||[]).length)return false; if(n.includes('RECOMEND')&&((out.recomendaciones_lista||[]).length||(out.restricciones_lista||[]).length))return false; return true;
    });
    return out;
  }

  function analyze(text) {
    const profile=detectProfile(text); let data;
    if(profile.id==='JER_TABLA')data=extractJer(text); else if(profile.id==='CONTROL_PERIODICO')data=extractControl(text); else data=finalize({},'GENERICO');
    data.perfil_detectado=profile; return data;
  }

  window.SSTProfiles={ detectProfile, analyze, merge, normalizeClinicalText, examTypeCategory, compareExamTypes };
})();
