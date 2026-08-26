import re
import datetime
import unicodedata
import json

_ETIQUETAS_CORTE = [
    "APELLIDOS Y NOMBRES", "NOMBRES Y APELLIDOS", "NOMBRE DEL TRABAJADOR",
    "NOMBRE TRABAJADOR", "NOMBRE COMPLETO", "TRABAJADOR", "PACIENTE",
    "CARGO ACTUAL", "CARGO", "OCUPACIÓN", "OCUPACION", "OFICIO", "PUESTO",
    "DOCUMENTO", "IDENTIFICACIÓN", "IDENTIFICACION", "CÉDULA", "CEDULA", "C.C.",
    "CC", "GÉNERO", "GENERO", "EDAD", "TELÉFONO", "TELEFONO", "CELULAR",
    "EPS", "AFP", "ARL", "EMPRESA", "NIT", "FECHA", "CIUDAD", "MUNICIPIO",
    "LUGAR", "SEDE", "DIRECCIÓN", "DIRECCION", "TIPO DE EXAMEN", "TIPO EXAMEN", "EVALUACION"
]

_RUIDO_IDENTIDAD = {
    "DATOS", "DATOS DEL TRABAJADOR", "INFORMACION DEL TRABAJADOR",
    "INFORMACIÓN DEL TRABAJADOR", "APELLIDOS Y NOMBRES", "NOMBRES Y APELLIDOS",
    "NOMBRE", "TRABAJADOR", "PACIENTE", "GENERO", "GÉNERO", "EDAD",
    "DOCUMENTO", "IDENTIFICACION", "IDENTIFICACIÓN", "CEDULA", "CÉDULA",
    "EMPRESA", "IPS", "EPS", "AFP", "ARL", "FIRMA", "CERTIFICADO"
}

_RUIDO_CARGO = {
    "CARGO", "CARGO ACTUAL", "OCUPACION", "OCUPACIÓN", "OFICIO", "PUESTO",
    "TRABAJADOR", "DATOS", "EMPRESA", "EPS", "AFP", "ARL", "GENERO", "GÉNERO",
    "DOCUMENTO", "IDENTIFICACION", "IDENTIFICACIÓN", "CERTIFICADO",
    "TIPO DE EXAMEN", "TIPO DE EXÁMEN", "TIPO EXAMEN", "TIPO DE EVALUACION",
    "TIPO DE EVALUACIÓN", "EVALUACION", "EVALUACIÓN", "PERIODICO", "PERIÓDICO",
    "INGRESO", "EGRESO", "RETIRO", "CAMBIO DE CARGO"
}

_RUIDO_LUGAR = {
    "LUGAR", "CIUDAD", "MUNICIPIO", "SEDE", "FECHA", "DIA", "DÍA", "MES",
    "AÑO", "ANO", "REALIZACION", "REALIZACIÓN", "EXAMEN", "EXÁMEN",
    "CERTIFICADO", "PAGINA", "PÁGINA", "LOGOTIPO", "AM", "PM", "HORA"
}

_PATRONES_LEGALES_RECOMENDACIONES = [
    r"\bconsentimiento(?:\s+informado)?\b", r"\bautorizo\b", 
    r"\bautorización\s+para\s+el\s+tratamiento\s+de\s+datos\b", 
    r"\bautorizacion\s+para\s+el\s+tratamiento\s+de\s+datos\b", 
    r"\btratamiento\s+de\s+datos(?:\s+personales)?\b", r"\bprotección\s+de\s+datos\b", 
    r"\bproteccion\s+de\s+datos\b", r"\bhabeas\s+data\b", r"\bley\s+1581\b", 
    r"\bdeclaro\b", r"\bmanifiesto\b", r"\bhe\s+sido\s+informad[oa]\b", 
    r"\bacepto\s+(?:el|la|los|las)\b", r"\bconstancia\b", r"\briesgos\s+y\s+beneficios\b", 
    r"\bfirma\s+(?:del|de\s+la)\s+(?:trabajador|paciente|usuario|evaluado)\b", 
    r"\bfirma\s+del\s+m[eé]dico\b", r"\bhuella\b", r"\bdocumento\s+de\s+identidad\b", 
    r"\bresponsabilidad\s+del\s+paciente\b", r"\bdeclaración\s+del\s+paciente\b", 
    r"\bdeclaracion\s+del\s+paciente\b", r"\bderechos\s+y\s+deberes\b", 
    r"\binformación\s+suministrada\s+es\s+verdadera\b", r"\binformacion\s+suministrada\s+es\s+verdadera\b"
]

_ENCABEZADOS_LEGALES = [
    "CONSENTIMIENTO INFORMADO", "CONSENTIMIENTO", "AUTORIZACIÓN PARA TRATAMIENTO DE DATOS", 
    "AUTORIZACION PARA TRATAMIENTO DE DATOS", "TRATAMIENTO DE DATOS PERSONALES", 
    "DECLARACIÓN DEL PACIENTE", "DECLARACION DEL PACIENTE", "AUTORIZO", "CONSTANCIA", 
    "FIRMA DEL TRABAJADOR", "FIRMA DEL PACIENTE", "FIRMA DEL USUARIO", "HUELLA", "HABEAS DATA"
]

SVE_CLINICAL_KEYWORDS = {
    "VISUAL": "Conservación Visual", "AUDITIV": "Conservación Auditiva", 
    "RUIDO": "Conservación Auditiva", "OIDO": "Conservación Auditiva", "OÍDO": "Conservación Auditiva",
    "AUDIO": "Conservación Auditiva", "OSTEOMUSCULAR": "Prevención Osteomuscular (DME)",
    "POSTURAL": "Prevención Osteomuscular (DME)", "LUMBAR": "Prevención Osteomuscular (DME)",
    "ERGONOMIC": "Prevención Osteomuscular (DME)", "ESPALDA": "Prevención Osteomuscular (DME)",
    "DME": "Prevención Osteomuscular (DME)", "RESPIRATORI": "Conservación Respiratoria",
    "ESPIROMETR": "Conservación Respiratoria", "POLVO": "Conservación Respiratoria",
    "HUMO": "Conservación Respiratoria", "CARDIOVASCULAR": "Riesgo Cardiovascular"
}

EXAMS_MAP = {
    "AUDIOMETRIA DE TONOS": "Audiometría", "AUDIOMETRIA": "Audiometría",
    "ESPIROMETRIA": "Espirometría", "ESPIROMETRÍA": "Espirometría",
    "OPTOMETRIA": "Optometría", "OPTOMETRÍA": "Optometría",
    "VISIOMETRIA": "Visiometría", "VISIOMETRÍA": "Visiometría",
    "EXAMEN MEDICO OCUPACIONAL": "Examen Clínico Ocupacional", 
    "EXAMEN MEDICO": "Examen Clínico Ocupacional",
    "EXAMEN OCUPACIONAL ENFASIS OSTEOMUSCULAR": "Énfasis Osteomuscular",
    "ENFASIS OSTEOMUSCULAR": "Énfasis Osteomuscular", "ÉNFASIS OSTEOMUSCULAR": "Énfasis Osteomuscular",
    "ELECTROCARDIOGRAMA DE RITMO": "Electrocardiograma", "ELECTROCARDIOGRAMA": "Electrocardiograma", 
    "FROTIS": "Frotis", "CUADRO HEMATICO": "Cuadro Hemático", "CUADRO HEMÁTICO": "Cuadro Hemático",
    "COLESTEROL": "Colesterol", "TRIGLICERIDOS": "Triglicéridos", "PARCIAL DE ORINA": "Parcial de Orina",
    "VSH": "VSH", "PCR": "PCR",
    "GLICEMIA": "Glicemia", "GLUCOSA": "Glicemia", "HEMOGRAMA": "Hemograma",
    "HEMOGRAMA COMPLETO": "Hemograma", "PERFIL LIPIDICO": "Perfil lipídico",
    "PERFIL LIPÍDICO": "Perfil lipídico", "HDL": "Colesterol HDL",
    "LDL": "Colesterol LDL", "CREATININA": "Creatinina", "TRANSAMINASAS": "Transaminasas",
    "TGO": "TGO", "TGP": "TGP", "ACIDO URICO": "Ácido úrico", "ÁCIDO ÚRICO": "Ácido úrico",
    "BACILOSCOPIA": "Baciloscopia", "KOH": "KOH", "COPROLOGICO": "Coprológico",
    "COPROLÓGICO": "Coprológico", "TEST DE COLOR": "Test de color", "ISHIHARA": "Test de Ishihara",
    "RAYOS X": "Rayos X", "RX DE TORAX": "Rayos X de tórax", "RX DE TÓRAX": "Rayos X de tórax",
    "ELECTROENCEFALOGRAMA": "Electroencefalograma", "PSICOSENSOMETRICO": "Psicosensométrico",
    "PSICOSENSOMÉTRICO": "Psicosensométrico", "VALORACION PSICOLOGICA": "Valoración psicológica",
    "VALORACIÓN PSICOLÓGICA": "Valoración psicológica"
}

def corregir_ortografia_sst(texto):
    if not texto: return ""
    diccionario_SST = {
        r'\brealziado\b': 'realizado', r'\brealziados\b': 'realizados',
        r'\baudiometria\b': 'audiometría', r'\bvisiometria\b': 'visiometría',
        r'\bespirometria\b': 'espirometría', r'\boptometria\b': 'optometría',
        r'\bfisica\b': 'física', r'\bmedico\b': 'médico', r'\bperiodico\b': 'periódico',
        r'\bproteccion\b': 'protección', r'\balimentacion\b': 'alimentación',
        r'\brecomendacion\b': 'recomendación', r'\bperfil\s+lipidico\b': 'perfil lipídico',
        r'\benfasis\b': 'énfasis', r'\bosteomuscular\b': 'osteomuscular',
        r'\bregion\b': 'región', r'\bhabitos\b': 'hábitos', r'\badiministrativo\b': 'administrativo',
        r'\brecomendaicones\b': 'recomendaciones', r'\brecomendacines\b': 'recomendaciones',
        r'\balteracion\b': 'alteración', r'\brestriccion\b': 'restricción',
        r'\bvaloracion\b': 'valoración', r'\bevaluacion\b': 'evaluación',
        r'\bocupacionalres\b': 'ocupacionales', r'\bprotecion\b': 'protección',
        r'\bseguimineto\b': 'seguimiento', r'\bperiodicamente\b': 'periódicamente',
        r'\bconservacion\b': 'conservación', r'\boptica\b': 'óptica',
        r'\bprotecion\b': 'protección', r'\bresolucion\b': 'resolución'
    }
    for patron, reemplazo in diccionario_SST.items():
        texto = re.sub(patron, reemplazo, texto, flags=re.IGNORECASE)
    return texto


def a_caso_oracion(texto):
    """Normaliza mayúsculas y ortografía sin alterar el significado del contenido."""
    if not texto:
        return ""
    texto_min = corregir_ortografia_sst(str(texto)).lower()
    texto_min = re.sub(r"[ \t]+", " ", texto_min)
    texto_min = re.sub(r"\s+([,.;:!?])", r"\1", texto_min)
    texto_min = re.sub(r"([,.;:!?])(?=[^\s\n])", r"\1 ", texto_min)
    texto_min = re.sub(r"\n{3,}", "\n\n", texto_min).strip(" \n\t-_:;")
    texto_min = re.sub(
        r'(^|[:.!?]\s+|\n+)([a-zñáéíóúü])',
        lambda m: m.group(1) + m.group(2).upper(),
        texto_min
    )
    for sigla in ["SST", "PVE", "DME", "EPP", "RX", "VSH", "PCR", "TGO", "TGP", "HDL", "LDL", "IMC", "EPS", "ARL", "AFP"]:
        texto_min = re.sub(rf"\b{sigla.lower()}\b", sigla, texto_min, flags=re.IGNORECASE)
    return texto_min


def eliminar_repeticiones_internas(texto):
    """Elimina oraciones repetidas dentro del mismo elemento sin resumir su contenido."""
    texto = re.sub(r"\s+", " ", str(texto or "")).strip()
    if not texto:
        return ""
    segmentos = [s.strip() for s in re.split(r"(?<=[.!?])\s+", texto) if s.strip()]
    if len(segmentos) > 1:
        unicos = []
        firmas = set()
        for segmento in segmentos:
            firma = normalizar_etiqueta(segmento)
            if firma and firma not in firmas:
                firmas.add(firma)
                unicos.append(segmento)
        texto = " ".join(unicos)

    palabras = texto.split()
    if len(palabras) >= 8 and len(palabras) % 2 == 0:
        mitad = len(palabras) // 2
        primera = " ".join(palabras[:mitad])
        segunda = " ".join(palabras[mitad:])
        if normalizar_etiqueta(primera) == normalizar_etiqueta(segunda):
            texto = primera
    return texto


def _separar_prefijo_examen(texto):
    """Separa 'Audiometría: recomendación' sin tratar cualquier dos puntos como examen."""
    texto = str(texto or "").strip()
    if ":" not in texto:
        return "", texto
    posible_prefijo, contenido = texto.split(":", 1)
    prefijo_norm = normalizar_etiqueta(posible_prefijo)
    nombres_examen = {
        normalizar_etiqueta(valor) for valor in EXAMS_MAP.values()
    } | {
        "EXAMEN CLINICO OCUPACIONAL", "EXAMEN MEDICO OCUPACIONAL",
        "PSICOSENSOMETRICO", "ENFASIS OSTEOMUSCULAR"
    }
    es_examen = len(posible_prefijo.split()) <= 6 and any(
        prefijo_norm == nombre or prefijo_norm in nombre or nombre in prefijo_norm
        for nombre in nombres_examen
    )
    return (posible_prefijo.strip(), contenido.strip()) if es_examen else ("", texto)


def recomendacion_parece_incompleta(texto):
    """Detecta cortes OCR evidentes; no intenta completar información que no está en la fuente."""
    _, contenido = _separar_prefijo_examen(texto)
    contenido = re.sub(r"\s+", " ", contenido).strip(" •\t\r\n-_:;,.()[]")
    if not contenido:
        return True
    normal = normalizar_etiqueta(contenido)
    palabras = normal.split()
    compactas_validas = {
        "CONTROL ANUAL", "REPOSOS AUDITIVOS", "EVITAR FROTE OCULAR",
        "PAUTAS DE CUIDADO AUDITIVO", "SIN RESTRICCIONES", "SIN ALTERACIONES",
        "HACER DEPORTE", "DIETA BALANCEADA", "HABITOS SALUDABLES",
        "USO DE EPP", "CONTROL DE PESO"
    }
    if normal in compactas_validas:
        return False
    finales_incompletos = {
        "A", "AL", "ANTE", "BAJO", "CON", "DE", "DEL", "DESDE", "DURANTE",
        "EL", "EN", "ENTRE", "HACIA", "HASTA", "LA", "LAS", "LOS", "O", "PARA",
        "POR", "QUE", "SE", "SEGUN", "SIN", "SOBRE", "SU", "SUS", "TRAS", "UN",
        "UNA", "Y"
    }
    if palabras and (palabras[-1] in finales_incompletos or len(palabras[-1]) == 1):
        return True
    if len(palabras) < 3:
        if any(normal.startswith(x) for x in ["HACER ", "DIETA ", "USO ", "CONTROL ", "HABITOS ", "PAUSA "]):
            return False
        return True
    if re.search(r"(?:/{2,}|\b\d+\s*[.)]\s*$)", contenido):
        return True
    return False


def separar_recomendaciones_atomicas(items):
    """Convierte listas agrupadas en una recomendación completa por elemento."""
    atomicas = []
    pendientes = []
    inicios = (
        "realizar", "utilizar", "usar", "mantener", "evitar", "continuar", "control",
        "controles", "pautas", "reposos", "capacitación", "capacitacion", "fortalecer",
        "asistir", "seguimiento", "manipulación", "manipulacion", "alternancia"
    )
    patron_inicio = "|".join(re.escape(palabra) for palabra in inicios)

    for item in items or []:
        item = re.sub(r"\s+", " ", str(item or "")).strip()
        if not item:
            continue
        prefijo, contenido = _separar_prefijo_examen(item)
        preservar_bloque_sve = bool(re.match(r"^\s*(?:PVE|SVE)\b", normalizar_etiqueta(contenido)))
        contenido = re.sub(
            r"\b(así mismo|asimismo|de igual forma|adicionalmente),\s*",
            lambda m: m.group(1) + "§ ", contenido, flags=re.IGNORECASE
        )
        contenido = re.sub(r"(^|[,;]\s*)\d+\s*[.)-]\s*", lambda m: ("|||" if m.start() == 0 else m.group(1) + "|||"), contenido)
        contenido = re.sub(r"\s*//+\s*|,\s*-\s*|\s+[–—]\s+|\s*[•▪◦]\s*", "|||", contenido)
        if not preservar_bloque_sve:
            contenido = re.sub(
                rf",\s*(?=(?:{patron_inicio})\b)", "|||", contenido, flags=re.IGNORECASE
            )
        contenido = contenido.replace("§", ",")
        partes_base = [parte.strip(" ,;:-") for parte in contenido.split("|||") if parte.strip(" ,;:-")]

        partes = []
        for parte in partes_base:
            oraciones = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ])", parte)
            partes.extend(oracion.strip() for oracion in oraciones if oracion.strip())

        for parte in partes:
            parte = re.sub(r"^\d+\s*[.)-]\s*", "", parte).strip(" ,;:-")
            if not parte or es_contenido_legal_recomendacion(parte):
                continue
            texto_atomico = f"{prefijo}: {parte}" if prefijo else parte
            texto_atomico = eliminar_repeticiones_internas(a_caso_oracion(texto_atomico))
            if recomendacion_parece_incompleta(texto_atomico):
                pendientes.append(texto_atomico)
            else:
                atomicas.append(texto_atomico)

    return deduplicar_textos(atomicas), deduplicar_textos(pendientes)


def canonizar_nombre_examen(nombre, examenes_realizados=None):
    """Conserva un nombre legible y lo relaciona con el catálogo o con los exámenes detectados."""
    nombre = re.sub(r"\s+", " ", str(nombre or "")).strip(" .:-")
    if not nombre:
        return "Recomendaciones generales"
    nombre_norm = normalizar_etiqueta(nombre)
    for examen in examenes_realizados or []:
        examen_norm = normalizar_etiqueta(examen)
        if nombre_norm == examen_norm or nombre_norm in examen_norm or examen_norm in nombre_norm:
            return examen
    for clave, valor in sorted(EXAMS_MAP.items(), key=lambda item: len(item[0]), reverse=True):
        clave_norm = normalizar_etiqueta(clave)
        valor_norm = normalizar_etiqueta(valor)
        if nombre_norm in {clave_norm, valor_norm}:
            return valor
    if nombre_norm in {"GENERAL", "GENERALES", "RECOMENDACIONES GENERALES"}:
        return "Recomendaciones generales"
    return a_caso_oracion(nombre)


def agrupar_recomendaciones_por_examen(examenes_realizados, recomendaciones=None, mapa_existente=None):
    """Agrupa sin inventar: cada recomendación queda bajo su examen explícito o en Generales."""
    examenes = normalizar_lista_clinica(examenes_realizados or [])
    grupos = {examen: [] for examen in examenes}

    def agregar(examen, recomendacion):
        examen = canonizar_nombre_examen(examen, examenes)
        _, contenido = _separar_prefijo_examen(recomendacion)
        atomicas, _ = separar_recomendaciones_atomicas([contenido])
        for item in atomicas:
            _, item_limpio = _separar_prefijo_examen(item)
            item_limpio = normalizar_lista_clinica([item_limpio], cerrar_con_punto=True)
            if not item_limpio:
                continue
            firma_item = normalizar_etiqueta(item_limpio[0])
            if examen == "Recomendaciones generales" and any(
                firma_item in {normalizar_etiqueta(valor) for valor in valores}
                for nombre_grupo, valores in grupos.items()
                if nombre_grupo != "Recomendaciones generales"
            ):
                continue
            if examen != "Recomendaciones generales":
                grupos["Recomendaciones generales"] = [
                    valor for valor in grupos.get("Recomendaciones generales", [])
                    if normalizar_etiqueta(valor) != firma_item
                ]
            grupos.setdefault(examen, [])
            grupos[examen].append(item_limpio[0])

    if isinstance(mapa_existente, dict):
        for examen, elementos in mapa_existente.items():
            if isinstance(elementos, str):
                elementos = [elementos]
            for recomendacion in elementos or []:
                agregar(examen, recomendacion)
    elif isinstance(mapa_existente, list):
        for registro in mapa_existente:
            if not isinstance(registro, dict):
                continue
            examen = registro.get("examen", "Recomendaciones generales")
            elementos = registro.get("recomendaciones", [])
            if isinstance(elementos, str):
                elementos = [elementos]
            for recomendacion in elementos:
                agregar(examen, recomendacion)

    for recomendacion in recomendaciones or []:
        prefijo, contenido = _separar_prefijo_examen(recomendacion)
        agregar(prefijo or "Recomendaciones generales", contenido)

    resultado = {}
    for examen, elementos in grupos.items():
        resultado[examen] = normalizar_lista_clinica(elementos, cerrar_con_punto=True)
    if not resultado.get("Recomendaciones generales"):
        resultado.pop("Recomendaciones generales", None)
    return resultado


def aplanar_recomendaciones_por_examen(mapa):
    """Mantiene compatibilidad con la lista histórica usando el formato «Examen: recomendación»."""
    resultado = []
    for examen, recomendaciones in (mapa or {}).items():
        for recomendacion in recomendaciones or []:
            if examen == "Recomendaciones generales":
                resultado.append(recomendacion)
            else:
                resultado.append(f"{examen}: {recomendacion}")
    return normalizar_lista_clinica(deduplicar_textos(resultado), cerrar_con_punto=True)


def normalizar_lista_clinica(items, cerrar_con_punto=False):
    normalizados = []
    for item in items or []:
        texto = eliminar_repeticiones_internas(a_caso_oracion(item))
        if not texto:
            continue
        if cerrar_con_punto and texto[-1:] not in ".!?":
            texto += "."
        normalizados.append(texto)
    resultado = deduplicar_textos(normalizados)
    if cerrar_con_punto:
        resultado = [texto if texto[-1:] in ".!?" else texto + "." for texto in resultado]
    return resultado


def normalizar_datos_documento(datos):
    """Aplica el mismo formato tanto a resultados de IA como al respaldo local y la edición manual."""
    resultado = dict(datos or {})
    nombre = re.sub(r"\s+", " ", str(resultado.get("nombre", "") or "")).strip()
    cargo = re.sub(r"\s+", " ", str(resultado.get("cargo", "") or "")).strip()
    lugar = re.sub(r"\s+", " ", str(resultado.get("lugar", "") or "")).strip()
    resultado["nombre"] = nombre.title()
    resultado["cargo"] = a_caso_oracion(cargo)
    resultado["lugar"] = lugar.title()
    resultado["tipo_examen"] = a_caso_oracion(resultado.get("tipo_examen", ""))
    resultado["identificacion"] = re.sub(r"\D", "", str(resultado.get("identificacion", "") or ""))
    resultado["correo"] = str(resultado.get("correo", "") or "").strip().lower()
    resultado["examenes_lista"] = normalizar_lista_clinica(resultado.get("examenes_lista", []))
    recomendaciones, pendientes = separar_recomendaciones_atomicas(resultado.get("recomendaciones_lista", []))
    mapa_recomendaciones = agrupar_recomendaciones_por_examen(
        resultado["examenes_lista"], recomendaciones, resultado.get("recomendaciones_por_examen")
    )
    resultado["recomendaciones_por_examen"] = mapa_recomendaciones
    resultado["recomendaciones_lista"] = aplanar_recomendaciones_por_examen(mapa_recomendaciones)
    pendientes_previos = list(resultado.get("recomendaciones_pendientes_revision", []) or [])
    resultado["recomendaciones_pendientes_revision"] = deduplicar_textos(pendientes_previos + pendientes)
    resultado["observaciones"] = a_caso_oracion(resultado.get("observaciones", ""))
    resultado["remisiones"] = a_caso_oracion(resultado.get("remisiones", "No")) or "No"
    programas = re.split(r"[,;\n]+", str(resultado.get("vigilancia_programa", "") or ""))
    programas = normalizar_lista_clinica(programas)
    resultado["vigilancia_programa"] = ", ".join(programas) if programas else "Ninguno"
    return resultado


def es_vacio_o_negativo(texto):
    if not texto: return True
    return texto.strip().lower().strip(" .-_/ '\"") in ["no", "ninguna", "ninguno", "no registra", "sin remisiones", "normal", "n/a", "sin remisión"]


def es_vacio_o_estado(texto):
    if not texto: return True
    t_clean = texto.strip().upper()
    t_clean_norm = re.sub(r'[^A-ZÁÉÍÓÚÑ\s]', '', t_clean).strip()
    t_clean_norm = re.sub(r'\s+', ' ', t_clean_norm)
    
    frases_estado = {
        "REALIZADO", "REALZIADO", "SIN ALTERACIONES", "NORMAL", "SANO", "NEGATIVO", 
        "NO REGISTRA", "NA", "SIN REMISIONES", "SIN REMISIÓN", "VISUAL", "CARDIOVASCULAR", 
        "DME", "OSTEOMUSCULAR", "AUDITIVO", "RESPIRATORIO", "SVE", "SISTEMA", "VIGILANCIA",
        "SANO Y SIN ALTERACIONES", "NINGUNO", "NINGUNA", "NO PRESENTAS", "NO PRESENTA", 
        "NO REGISTRA RECOMENDACIONES", "NORMALES", "NORMAL", "SIN ALTERACION", "NO APLICA",
        "RECOMENDACIONES MÉDICAS", "RECOMENDACIONES OCUPACIONALES", "HABITOS Y ESTILO DE VIDA SALUDABLES",
        "HABITOS SALUDABLES", "OTRAS OBSERVACIONES Y RECOMENDACIONES", "RECOMENDACIONES MEDICAS"
    }
    
    if t_clean_norm in frases_estado: return True
    if len(texto.strip()) <= 3: return True
    return False


def limpiar_linea_ruido_lateral(linea):
    patron_ruido = r'\s{2,}(VISUAL|DME|CARDIOVASCULAR|SVE|AUDITIVO|RESPIRATORIO|SISTEMA|VIGILANCIA)\s*$'
    linea_limpia = re.sub(patron_ruido, '', linea, flags=re.IGNORECASE)
    return linea_limpia.strip()


def limpiar_ruido_columnas_final(texto):
    if not texto: return ""
    patrones_ruido = [
        r'\bvisual\b', r'\bdme\b', r'\bcardiovascular\b', r'\bsve\b', 
        r'\bauditivo\b', r'\brespiratorio\b', r'\bsistema\b', r'\bvigilancia\b'
    ]
    for patron in patrones_ruido:
        texto = re.sub(patron + r'\s*$', '', texto, flags=re.IGNORECASE)
    return texto.strip(" :-,_/")


def intentar_parsear_fecha(fecha_str):
    if not fecha_str: return datetime.date.today()
    fecha_str = fecha_str.lower().strip(" :-,_/.()[]|")
    
    meses_dict = {
        "enero": 1, "ene": 1, "febrero": 2, "feb": 2, "marzo": 3, "mar": 3,
        "abril": 4, "abr": 4, "mayo": 5, "may": 5, "junio": 6, "jun": 6,
        "julio": 7, "jul": 7, "agosto": 8, "ago": 8, "septiembre": 9, "sep": 9, "sept": 9,
        "octubre": 10, "oct": 10, "noviembre": 11, "nov": 11, "diciembre": 12, "dic": 12
    }

    m_letras = re.search(r'(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\.?\s+(?:de\s+)?(20\d{2})', fecha_str)
    if m_letras:
        dia = int(m_letras.group(1))
        mes_str = m_letras.group(2).lower()
        anio = int(m_letras.group(3))
        if mes_str in meses_dict:
            try: return datetime.date(anio, meses_dict[mes_str], dia)
            except ValueError: pass

    m_ymd = re.search(r'\b(20\d{2})[-/.s](\d{1,2})[-/.s](\d{1,2})\b', fecha_str)
    if m_ymd: 
        try: return datetime.date(int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3)))
        except ValueError: pass

    m_dmy = re.search(r'\b(\d{1,2})[-/.s](\d{1,2})[-/.s](20\d{2})\b', fecha_str)
    if m_dmy: 
        try: return datetime.date(int(m_dmy.group(3)), int(m_dmy.group(2)), int(m_dmy.group(1)))
        except ValueError: pass

    return datetime.date.today()


def normalizar_etiqueta(texto):
    if not texto: return ""
    texto = unicodedata.normalize("NFKD", str(texto))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.upper()
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip(" :|_-./")


def dividir_columnas_estructuradas(linea):
    if not linea: return []
    columnas = [re.sub(r"\s+", " ", c).strip(" |/-,_.:") for c in re.split(r"\s{2,}|\t+|\|", linea)]
    return [c for c in columnas if c]


def recortar_en_siguiente_etiqueta(valor):
    if not valor: return ""
    patron = r"\b(?:" + "|".join(sorted((re.escape(e) for e in _ETIQUETAS_CORTE), key=len, reverse=True)) + r")\b"
    coincidencias = list(re.finditer(patron, valor, flags=re.IGNORECASE))
    if coincidencias:
        primera = coincidencias[0]
        if primera.start() > 0: valor = valor[:primera.start()]
    return valor.strip(" |/-,_.:")


def limpiar_candidato_campo(valor, tipo):
    if not valor: return ""
    valor = str(valor).replace("\x00", " ")
    valor = re.sub(r"\s+", " ", valor).strip(" |/-,_.:")
    valor = recortar_en_siguiente_etiqueta(valor)

    valor = re.split(
        r"\b(?:C\.?\s*C\.?|CÉDULA|CEDULA|DOCUMENTO|IDENTIFICACIÓN|IDENTIFICACION|TELÉFONO|TELEFONO|CELULAR|EDAD|GÉNERO|GENERO|EPS|AFP|ARL)\b",
        valor, maxsplit=1, flags=re.IGNORECASE
    )[0].strip(" |/-,_.:")

    if tipo in {"nombre", "cargo"}:
        valor = re.sub(r"\([^)]*\)", "", valor).strip()
    elif tipo == "lugar":
        valor = re.sub(r"\s+\([^)]*(?:PÁGINA|PAGINA|HORA|AM|PM)[^)]*\)", "", valor, flags=re.IGNORECASE)
        valor = re.sub(r"^\s*(?:(?:20\d{2})\s*[|/\-.]\s*\d{1,2}\s*[|/\-.]\s*\d{1,2}|\d{1,2}\s*[|/\-.]\s*\d{1,2}\s*[|/\-.]\s*20\d{2})\s*[|/\-,_.:]*\s*", "", valor)
        if "|" in valor:
            partes_lugar = [p.strip(" |/-,_.:") for p in valor.split("|") if p.strip(" |/-,_.:")]
            partes_con_letras = [p for p in partes_lugar if sum(c.isalpha() for c in p) >= 3]
            if partes_con_letras: valor = partes_con_letras[-1]
    return re.sub(r"\s+", " ", valor).strip(" |/-,_.:")


def candidato_nombre_valido(valor):
    valor = limpiar_candidato_campo(valor, "nombre")
    if not valor or len(valor) < 5 or len(valor) > 100: return False
    if re.search(r"\d|@|https?://", valor): return False
    tokens = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]+", valor)
    if len(tokens) < 2 or len(tokens) > 8: return False
    norm = normalizar_etiqueta(valor)
    if norm in {normalizar_etiqueta(x) for x in _RUIDO_IDENTIDAD}: return False
    if any(ruido in norm for ruido in ["CERTIFICADO", "MEDICINA", "OCUPACIONAL", "EMPRESA", "INSTITUCION", "LABORATORIO", "FIRMA DEL", "NOMBRE DEL"]): return False
    return (sum(c.isalpha() for c in valor) / max(len(valor), 1)) >= 0.65


def candidato_cargo_valido(valor):
    valor = limpiar_candidato_campo(valor, "cargo")
    if not valor or len(valor) < 3 or len(valor) > 120: return False
    norm = normalizar_etiqueta(valor)
    if norm in {normalizar_etiqueta(x) for x in _RUIDO_CARGO}: return False
    if any(ruido in norm for ruido in ["CERTIFICADO", "MÉDICO", "MEDICO", "FIRMA", "DOCUMENTO", "IDENTIFICACION", "GENERO", "TIPO DE EXAMEN", "TIPO DE EXÁMEN", "EVALUACION", "EVALUACIÓN", "PERIODICO", "PERIÓDICO"]): return False
    if re.fullmatch(r"[\d\s./-]+", valor): return False
    return sum(c.isalpha() for c in valor) >= 3


def candidato_lugar_valido(valor):
    valor = limpiar_candidato_campo(valor, "lugar")
    if not valor or len(valor) < 3 or len(valor) > 100: return False
    if re.search(r"https?://|www\.|@", valor, flags=re.IGNORECASE): return False
    if re.fullmatch(r"[\d\s:./-]+", valor): return False
    norm = normalizar_etiqueta(valor)
    if norm in {normalizar_etiqueta(x) for x in _RUIDO_LUGAR}: return False
    if any(ruido in norm for ruido in ["PAGINA", "PÁGINA", "CERTIFICADO", "LOGOTIPO", "FIRMA", "HORA", "AM", "PM"]): return False
    return sum(c.isalpha() for c in valor) >= 3


def elegir_mejor_candidato(candidatos, tipo):
    validadores = {"nombre": candidato_nombre_valido, "cargo": candidato_cargo_valido, "lugar": candidato_lugar_valido}
    validador = validadores[tipo]
    mejores = []

    for puntaje, valor, origen in candidatos:
        limpio = limpiar_candidato_campo(valor, tipo)
        if not validador(limpio): continue
        tokens = limpio.split()
        if tipo == "nombre":
            if 2 <= len(tokens) <= 5: puntaje += 8
            if limpio.upper() == limpio: puntaje += 3
        elif tipo == "cargo" and 1 <= len(tokens) <= 7: puntaje += 4
        elif tipo == "lugar" and 1 <= len(tokens) <= 5: puntaje += 4
        mejores.append((puntaje, -len(limpio), limpio, origen))

    if not mejores: return ""
    mejores.sort(reverse=True)
    valor = mejores[0][2]
    if tipo == "nombre": return valor.title()
    if tipo == "cargo": return corregir_ortografia_sst(valor).title()
    return valor.title()


def _coincide_etiqueta(columna, etiquetas):
    norm = normalizar_etiqueta(columna)
    return any(norm == normalizar_etiqueta(e) or normalizar_etiqueta(e) in norm for e in etiquetas)


def extraer_campo_por_etiquetas(lineas, etiquetas, tipo):
    candidatos = []
    etiquetas_ordenadas = sorted(etiquetas, key=len, reverse=True)
    patron_etiquetas = "|".join(re.escape(e) for e in etiquetas_ordenadas)

    for idx, linea in enumerate(lineas):
        if not linea or not linea.strip(): continue

        m_inline = re.search(rf"(?:{patron_etiquetas})(?:\s*[:=]\s*|\s+-\s+|\s{{2,}}|\|)\s*(.+)$", linea, flags=re.IGNORECASE)
        if m_inline:
            candidatos.append((185, m_inline.group(1), "etiqueta en línea"))
            # Si la misma línea ya contiene el valor, no debe interpretarse además como encabezado de tabla.
            continue

        columnas_header = dividir_columnas_estructuradas(linea)
        indices = [pos for pos, col in enumerate(columnas_header) if _coincide_etiqueta(col, etiquetas)]

        if indices:
            for offset in range(1, 5):
                if idx + offset >= len(lineas): break
                siguiente = lineas[idx + offset].strip()
                if not siguiente: continue
                columnas_valor = dividir_columnas_estructuradas(siguiente)
                for pos in indices:
                    if pos < len(columnas_valor):
                        candidatos.append((140 - offset, columnas_valor[pos], "tabla encabezado/valor"))
                
                norm_linea = normalizar_etiqueta(linea)
                if any(norm_linea == normalizar_etiqueta(e) for e in etiquetas):
                    candidatos.append((100 - offset, siguiente, "línea siguiente"))
                break

        norm_linea = normalizar_etiqueta(linea)
        for etiqueta in etiquetas_ordenadas:
            norm_etiqueta = normalizar_etiqueta(etiqueta)
            if norm_linea.startswith(norm_etiqueta) and len(norm_linea) > len(norm_etiqueta):
                resto = linea[len(etiqueta):].strip(" |/-,_.:")
                if resto: candidatos.append((92, resto, "etiqueta inicial"))
                break

    return elegir_mejor_candidato(candidatos, tipo)


def extraer_fecha_y_lugar_robusto(lineas, texto_completo):
    candidatos_lugar = []
    fechas = []

    patron_fecha_dmy = re.compile(r"\b(\d{1,2})\s*[\s|/\-.]+\s*(\d{1,2})\s*[\s|/\-.]+\s*(20\d{2})\b")
    patron_fecha_ymd = re.compile(r"\b(20\d{2})\s*[\s|/\-.]+\s*(\d{1,2})\s*[\s|/\-.]+\s*(\d{1,2})\b")

    for line in lineas:
        if "NACIMIENTO" in line.upper() or "NACIDA" in line.upper(): continue

        parts = [p.strip() for p in re.split(r'\|', line) if p.strip()]
        for i in range(len(parts) - 2):
            if re.match(r'^\d{1,2}$', parts[i]) and re.match(r'^\d{1,2}$', parts[i+1]) and re.match(r'^20\d{2}$', parts[i+2]):
                try:
                    d, m, y = int(parts[i]), int(parts[i+1]), int(parts[i+2])
                    fechas.append((150, datetime.date(y, m, d)))
                    for j in range(i+3, len(parts)):
                        text_cand_clean = re.sub(r'\(.*?\)', '', parts[j]).strip(" |/-,_.:")
                        text_cand_clean = re.sub(r'\b(CIUDAD|MUNICIPIO|FECHA|REALIZACI[ÓO]N)\b', '', text_cand_clean, flags=re.IGNORECASE).strip(" |/-,_.:")
                        if text_cand_clean and len(text_cand_clean) > 2 and not any(w in text_cand_clean.upper() for w in ["PÁGINA", "PAGINA", "CERTIFICADO", "A.M.", "P.M.", "HORA"]):
                            candidatos_lugar.append((150, text_cand_clean, "grid matricial celda"))
                except ValueError: pass

    for idx, linea in enumerate(lineas):
        if "NACIMIENTO" in linea.upper(): continue
        columnas = dividir_columnas_estructuradas(linea)
        columnas_norm = [normalizar_etiqueta(c) for c in columnas]
        ciudad_indices = [i for i, c in enumerate(columnas_norm) if any(k in c for k in ["CIUDAD", "MUNICIPIO", "LUGAR", "SEDE"])]

        if ciudad_indices and any(k in " ".join(columnas_norm) for k in ["DIA", "MES", "ANO", "FECHA", "REALIZACION"]):
            for offset in range(1, 4):
                if idx + offset >= len(lineas): break
                valores = dividir_columnas_estructuradas(lineas[idx + offset])
                for pos in ciudad_indices:
                    if pos < len(valores):
                        candidatos_lugar.append((125 - offset, valores[pos], "tabla fecha/lugar"))
                linea_valores = lineas[idx + offset]
                m_dmy, m_ymd = patron_fecha_dmy.search(linea_valores), patron_fecha_ymd.search(linea_valores)
                try:
                    if m_ymd: fechas.append((120 - offset, datetime.date(int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3)))))
                    elif m_dmy: fechas.append((120 - offset, datetime.date(int(m_dmy.group(3)), int(m_dmy.group(2)), int(m_dmy.group(1)))))
                except ValueError: pass
                if valores: break

        m_dmy, m_ymd = patron_fecha_dmy.search(linea), patron_fecha_ymd.search(linea)
        m_fecha = m_ymd or m_dmy
        if m_fecha:
            try:
                if m_ymd: fecha_detectada = datetime.date(int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3)))
                else: fecha_detectada = datetime.date(int(m_dmy.group(3)), int(m_dmy.group(2)), int(m_dmy.group(1)))
                fechas.append((90, fecha_detectada))
            except ValueError: pass

            antes, despues = linea[:m_fecha.start()].strip(" |/-,_.:"), linea[m_fecha.end():].strip(" |/-,_.:")
            contexto = normalizar_etiqueta(linea)
            puntaje = 118 if any(k in contexto for k in ["REALIZACION", "CIUDAD", "MUNICIPIO", "LUGAR", "SEDE"]) else 78
            if despues and not any(m in despues.upper() for m in ["PÁGINA", "PAGINA", "CERTIFICADO", "P.M.", "A.M."]):
                candidatos_lugar.append((puntaje, despues, "después de fecha"))
            if antes and len(antes.split()) <= 7:
                antes = re.sub(r"(?i)\b(FECHA|CIUDAD|MUNICIPIO|LUGAR|REALIZACI[ÓO]N|DEL EXAMEN|DEL EXÁMEN)\b", "", antes).strip(" |/-,_.:")
                if antes: candidatos_lugar.append((puntaje - 5, antes, "antes de fecha"))

    meses = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre"
    patron_ciudad_fecha = re.compile(rf"\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{{2,45}}),?\s+(\d{{1,2}}\s+de\s+(?:{meses})\s+de\s+20\d{{2}})\b", flags=re.IGNORECASE)
    for m in patron_ciudad_fecha.finditer(texto_completo):
        lugar = re.split(r"\n|[:;]", m.group(1).strip())[-1].strip()
        candidatos_lugar.append((112, lugar, "ciudad y fecha en letras"))
        try: fechas.append((112, intentar_parsear_fecha(m.group(2))))
        except: pass

    etiquetas_lugar = ["FECHA Y CIUDAD DE REALIZACIÓN", "FECHA Y CIUDAD DE REALIZACION", "CIUDAD DE REALIZACIÓN", "CIUDAD", "MUNICIPIO", "SEDE"]
    lugar_etiquetado = extraer_campo_por_etiquetas(lineas, etiquetas_lugar, "lugar")
    if lugar_etiquetado: candidatos_lugar.append((130, lugar_etiquetado, "etiqueta explícita"))

    lugar_final = elegir_mejor_candidato(candidatos_lugar, "lugar")
    fecha_final = max(fechas, key=lambda item: item[0])[1] if fechas else datetime.date.today()
    return fecha_final, lugar_final


def extraer_identidad_cargo_lugar(texto):
    lineas = [line.rstrip() for line in texto.splitlines()]
    etiquetas_nombre = ["APELLIDOS Y NOMBRES DEL TRABAJADOR", "NOMBRES Y APELLIDOS", "APELLIDOS Y NOMBRES", "NOMBRE DEL TRABAJADOR", "TRABAJADOR", "PACIENTE"]
    etiquetas_cargo = ["CARGO ACTUAL DEL TRABAJADOR", "CARGO DEL TRABAJADOR", "CARGO ACTUAL", "OCUPACIÓN", "OCUPACION", "PUESTO", "CARGO"]

    nombre = extraer_campo_por_etiquetas(lineas, etiquetas_nombre, "nombre")
    if not nombre:
        # Respaldo para formatos compactos con la etiqueta exacta «NOMBRE:», evitando «nombre del médico».
        for linea in lineas[:100]:
            m = re.match(r"(?i)^\s*NOMBRE\s*[:=|/-]\s*(.+?)\s*$", linea)
            if m and candidato_nombre_valido(m.group(1)):
                nombre = limpiar_candidato_campo(m.group(1), "nombre").title()
                break
    cargo = extraer_campo_por_etiquetas(lineas, etiquetas_cargo, "cargo")
    fecha, lugar = extraer_fecha_y_lugar_robusto(lineas, texto)

    return {"nombre": nombre, "cargo": cargo, "fecha": fecha, "lugar": lugar}


def es_contenido_legal_recomendacion(texto):
    if not texto: return False
    limpio = re.sub(r"\s+", " ", str(texto)).strip()
    return any(re.search(patron, limpio, flags=re.IGNORECASE) for patron in _PATRONES_LEGALES_RECOMENDACIONES)


def es_encabezado_legal(texto):
    if not texto: return False
    normalizado = normalizar_etiqueta(texto)
    return any(encabezado in normalizado for encabezado in _ENCABEZADOS_LEGALES)


def recortar_contenido_legal(texto):
    if not texto: return ""
    texto = str(texto)
    posiciones = []
    for patron in _PATRONES_LEGALES_RECOMENDACIONES:
        coincidencia = re.search(patron, texto, flags=re.IGNORECASE)
        if coincidencia: posiciones.append(coincidencia.start())
    if posiciones: texto = texto[:min(posiciones)]
    lineas_validas = []
    for linea in texto.splitlines():
        if es_encabezado_legal(linea) or es_contenido_legal_recomendacion(linea): break
        lineas_validas.append(linea)
    return re.sub(r"\s+", " ", " ".join(lineas_validas)).strip(" .;:-_/|")


def filtrar_recomendaciones_clinicas(recomendaciones):
    resultado = []
    vistos = set()
    for recomendacion in recomendaciones or []:
        limpia = recortar_contenido_legal(recomendacion)
        limpia = re.sub(r"^(?:Audiometría|Espirometría|Optometría|Visiometría|Examen Clínico Ocupacional|Énfasis Osteomuscular|Electrocardiograma|Frotis|Cuadro Hemático|Colesterol|Triglicéridos|Parcial de Orina|VSH|PCR)\s*:\s*$", "", limpia, flags=re.IGNORECASE).strip()
        if not limpia or es_vacio_o_estado(limpia) or es_contenido_legal_recomendacion(limpia): continue
        clave = normalizar_etiqueta(limpia)
        if clave not in vistos:
            vistos.add(clave)
            resultado.append(limpia)
    finales = []
    for idx, item in enumerate(resultado):
        norm_item = normalizar_etiqueta(item)
        contenido_en_otro = any(
            idx != otro_idx and norm_item in normalizar_etiqueta(otro) and len(otro) > len(item) + 8
            for otro_idx, otro in enumerate(resultado)
        )
        if not contenido_en_otro:
            finales.append(item)
    return finales


def extraer_cargo_especifico(texto):
    if not texto: return ""
    
    # Expresión regular mejorada para capturar el cargo independientemente del espacio horizontal
    patrones_cargo = [
        r'(?i)\bCargo\b[ \t]*[:=|\-]*[ \t]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 /.-]{2,80})',
        r'(?i)\bOcupaci[oó]n\b[ \t]*[:=|\-]*[ \t]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 /.-]{2,80})',
        r'(?i)\bPuesto\b[ \t]*[:=|\-]*[ \t]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 /.-]{2,80})'
    ]
    
    for p in patrones_cargo:
        m = re.search(p, texto)
        if m:
            candidato = m.group(1).strip()
            # Freno de corte inmediato en palabras reservadas
            candidato = re.split(r'(?i)\b(?:EPS|ARL|AFP|Empresa|Escolaridad|Estado|Tipo|Tipo\s+de\s+Examen|Evaluaci[oó]n|Per[ií]odico|Identificaci[oó]n|Tel[eé]fono|C[eé]dula|Documento)\b', candidato)[0].strip()
            candidato = re.sub(r'\s+', ' ', candidato).strip(" :-,_./|")
            if candidato_cargo_valido(candidato):
                return corregir_ortografia_sst(candidato).title()
    return ""


def extraer_metadatos_formatos_conocidos(texto_completo):
    meta = {}
    
    # Prioridad 1: Extractor de Cargo Robusto
    cargo_directo = extraer_cargo_especifico(texto_completo)
    if cargo_directo:
        meta["cargo"] = cargo_directo

    # 1. FORMATO A: "Fecha y Lugar: 03 jun. 2026 - TUNJA - BOYACA" / "Paciente: MARIA..."
    m_fyl = re.search(r'Fecha\s+y\s+Lugar:\s*(\d{1,2}\s+[a-zA-Z]{3,4}\.?\s+20\d{2})\s*-\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]+)', texto_completo, re.IGNORECASE)
    if m_fyl:
        f_str, l_str = m_fyl.group(1).strip(), m_fyl.group(2).strip()
        meta["lugar"] = re.split(r'-', l_str)[0].strip().title()
        meta["fecha"] = intentar_parsear_fecha(f_str)
        
    m_pac = re.search(r'Paciente:\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+?)(?=\s+(?:Identificaci[oó]n|Tel[eé]fono|M[oó]vil|G[eé]nero|Edad|C\.?C|CC)|$)', texto_completo, re.IGNORECASE)
    if m_pac:
        nc = m_pac.group(1).strip()
        if len(nc.split()) >= 2 and candidato_nombre_valido(nc):
            meta["nombre"] = nc.title()

    # 2. FORMATO B: "Apellidos y Nombres" / Grillas
    if "nombre" not in meta:
        m_nom_b = re.search(r'Apellidos\s+y\s+Nombres\s*[:\n|]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+?)(?=\s+(?:G[eé]nero|Edad|Documento|CC|C\.C)|$)', texto_completo, re.IGNORECASE)
        if m_nom_b:
            nc = m_nom_b.group(1).strip()
            if len(nc.split()) >= 2 and candidato_nombre_valido(nc):
                meta["nombre"] = nc.title()

    if "cargo" not in meta:
        lines = texto_completo.splitlines()
        for idx, line in enumerate(lines):
            if line.strip().upper() == "CARGO" and idx + 1 < len(lines):
                next_l = lines[idx+1].strip()
                col1 = re.split(r'\s{2,}|\|', next_l)[0].strip()
                if candidato_cargo_valido(col1):
                    meta["cargo"] = corregir_ortografia_sst(col1).title()
                    break

    if "fecha" not in meta or "lugar" not in meta:
        m_grid_b = re.search(r'\b(\d{1,2})\s*[\s|/-]+\s*(\d{1,2})\s*[\s|/-]+\s*(20\d{2})\s*\|\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+?)(?=\(|\n|$)', texto_completo)
        if m_grid_b:
            d, m, y = int(m_grid_b.group(1)), int(m_grid_b.group(2)), int(m_grid_b.group(3))
            lug = m_grid_b.group(4).strip()
            if 1 <= d <= 31 and 1 <= m <= 12: meta["fecha"] = datetime.date(y, m, d)
            if candidato_lugar_valido(lug): meta["lugar"] = lug.title()

    return meta


def deduplicar_textos(items):
    resultado = []
    for item in items or []:
        limpio = re.sub(r"\s+", " ", str(item or "")).strip(" •\t\r\n-_:;.,")
        if not limpio:
            continue
        norm = normalizar_etiqueta(limpio)
        reemplazado = False
        for idx, existente in enumerate(resultado):
            norm_existente = normalizar_etiqueta(existente)
            if norm == norm_existente:
                reemplazado = True
                break
            tokens_a, tokens_b = set(norm.split()), set(norm_existente.split())
            similitud = len(tokens_a & tokens_b) / max(1, len(tokens_a | tokens_b))
            if similitud >= 0.78 or norm in norm_existente or norm_existente in norm:
                if len(limpio) > len(existente):
                    resultado[idx] = limpio
                reemplazado = True
                break
        if not reemplazado:
            resultado.append(limpio)
    return resultado


def extraer_examenes_globales(texto):
    """Recupera exámenes aunque la tabla PDF pierda columnas o saltos de línea."""
    encontrados = []
    dentro_seccion = False
    encabezados_examen = ("EXAMENES REALIZADOS", "EXAMENES PRACTICADOS", "PRUEBAS REALIZADAS", "EXAMENES EFECTUADOS")
    encabezados_salida = ("RECOMENDACIONES", "OBSERVACIONES", "REMISIONES", "VIGILANCIA", "CONSENTIMIENTO")
    verbos_futuros = ("REALIZAR", "SOLICITAR", "REMITIR", "PROGRAMAR", "ORDENAR", "ASISTIR A", "CONTROL POR")
    for linea in texto.splitlines():
        linea_norm = normalizar_etiqueta(linea)
        if any(encabezado in linea_norm for encabezado in encabezados_examen):
            dentro_seccion = True
            continue
        if dentro_seccion and any(encabezado in linea_norm for encabezado in encabezados_salida):
            dentro_seccion = False
        for clave in sorted(EXAMS_MAP, key=len, reverse=True):
            clave_norm = normalizar_etiqueta(clave)
            coincidencia = re.search(rf"(?<![A-Z0-9]){re.escape(clave_norm)}(?![A-Z0-9])", linea_norm)
            if not coincidencia:
                continue
            prefijo = linea_norm[:coincidencia.start()]
            sugerido_para_futuro = any(verbo in prefijo for verbo in verbos_futuros)
            aparece_como_item = coincidencia.start() <= 18 or "REALIZADO" in linea_norm or "PRACTICADO" in linea_norm
            if (dentro_seccion or aparece_como_item) and not sugerido_para_futuro:
                valor = EXAMS_MAP[clave]
                if valor not in encontrados:
                    encontrados.append(valor)
    return encontrados


def extraer_recomendaciones_genericas(texto):
    """Respaldo para recomendaciones envueltas en varias líneas o columnas."""
    encabezados_inicio = (
        "RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES",
        "RECOMENDACIONES GENERALES", "HABITOS Y ESTILO DE VIDA SALUDABLES"
    )
    encabezados_fin = (
        "OTRAS OBSERVACIONES", "OBSERVACIONES:", "INFORMACION DE REMISIONES",
        "INFORMACIÓN DE REMISIONES", "REMISIONES:", "CONSENTIMIENTO",
        "AUTORIZO", "TRATAMIENTO DE DATOS", "FIRMA DEL TRABAJADOR", "ATENTAMENTE"
    )
    dentro = False
    fragmentos = []
    actual = ""
    for linea in texto.splitlines():
        linea = limpiar_linea_ruido_lateral(linea)
        norm = normalizar_etiqueta(linea)
        if not dentro and any(h in norm for h in encabezados_inicio):
            dentro = True
            continue
        if dentro and any(h in norm for h in encabezados_fin):
            break
        if not dentro or not linea.strip():
            continue
        columnas = [c.strip() for c in re.split(r"\s{3,}|\|", linea) if c.strip()]
        for columna in columnas:
            candidato = recortar_contenido_legal(columna)
            candidato = re.sub(r"^\s*(?:[•*-]|\d+[.)-])\s*", "", candidato).strip()
            if es_vacio_o_estado(candidato) or es_contenido_legal_recomendacion(candidato):
                continue
            comienza_nueva = bool(re.match(
                r"^(?:REALIZAR|ASISTIR|UTILIZAR|USAR|MANTENER|EVITAR|CONTINUAR|CONTROLAR|SOLICITAR|SEGUIR)\b",
                normalizar_etiqueta(candidato)
            ))
            if actual and not re.search(r"[.!?;:]$", actual) and not comienza_nueva:
                actual = f"{actual} {candidato}"
            else:
                if actual:
                    fragmentos.append(a_caso_oracion(actual))
                actual = candidato
    if actual:
        fragmentos.append(a_caso_oracion(actual))
    return deduplicar_textos(fragmentos)



# -----------------------------------------------------------------------------
# Motor clínico V5: extracción por secciones, tolerante a cambios de formato.
# -----------------------------------------------------------------------------
_SECCIONES_CLINICAS = {
    "examenes": [
        "EXAMENES REALIZADOS", "EXAMENES PRACTICADOS", "EXAMENES EFECTUADOS",
        "PRUEBAS REALIZADAS", "PARACLINICOS REALIZADOS", "EXAMENES COMPLEMENTARIOS",
        "EXAMENES OCUPACIONALES REALIZADOS", "EXAMENES PARACLINICOS", "PARACLINICOS",
        "AYUDAS DIAGNOSTICAS", "PRUEBAS COMPLEMENTARIAS"
    ],
    "recomendaciones": [
        "RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES",
        "RECOMENDACIONES LABORALES", "RECOMENDACIONES GENERALES",
        "RECOMENDACIONES Y RESTRICCIONES", "RECOMENDACIONES / RESTRICCIONES",
        "INDICACIONES MEDICAS", "HABITOS Y ESTILO DE VIDA SALUDABLES",
        "HABITOS SALUDABLES", "RECOMENDACIONES PARA EL TRABAJADOR",
        "RECOMENDACIONES AL TRABAJADOR", "RECOMENDACIONES ESPECIFICAS",
        "RESTRICCIONES Y RECOMENDACIONES", "CONDUCTA Y RECOMENDACIONES"
    ],
    "observaciones": [
        "OTRAS OBSERVACIONES Y RECOMENDACIONES", "OTRAS OBSERVACIONES",
        "OBSERVACIONES GENERALES", "OBSERVACIONES", "OBSERVACION", "COMENTARIOS",
        "OBSERVACIONES MEDICAS", "OBSERVACIONES DEL MEDICO", "NOTAS MEDICAS"
    ],
    "remisiones": [
        "INFORMACION DE REMISIONES", "INFORMACION DE REMISION",
        "REMISIONES", "REMISION", "INTERCONSULTAS", "INTERCONSULTA",
        "REMISION A ESPECIALISTA", "REMISIONES A ESPECIALISTAS",
        "INTERCONSULTA MEDICA", "REMISIONES MEDICAS"
    ],
    "vigilancia": [
        "INGRESAR AL PROGRAMA DE VIGILANCIA EPIDEMIOLOGICA",
        "INGRESO A PROGRAMA DE VIGILANCIA EPIDEMIOLOGICA",
        "PROGRAMAS DE VIGILANCIA EPIDEMIOLOGICA",
        "PROGRAMA DE VIGILANCIA EPIDEMIOLOGICA",
        "SISTEMA DE VIGILANCIA EPIDEMIOLOGICA",
        "VIGILANCIA EPIDEMIOLOGICA", "PROGRAMAS DE VIGILANCIA",
        "SISTEMAS DE VIGILANCIA", "INGRESO A PVE", "INGRESO A SVE",
        "INCLUSION EN PVE", "INCLUSION EN SVE", "PVE", "SVE"
    ],
}

_NEGACIONES_CLINICAS = {
    "NO", "NINGUNO", "NINGUNA", "NO APLICA", "NO APLICA.", "NO REQUIERE",
    "NO REQUIERE REMISION", "NO REQUIERE REMISIONES", "SIN REMISION",
    "SIN REMISIONES", "NO REGISTRA", "N/A", "NA", "NO INGRESA",
    "NO INGRESAR", "NO REQUIERE INGRESO", "NO SE REQUIERE"
}

_STOPWORDS_SOPORTE = {
    "DE","DEL","LA","LAS","EL","LOS","Y","O","A","AL","EN","CON","SIN",
    "POR","PARA","QUE","SE","SU","SUS","UN","UNA","UNO","COMO","ES","E"
}


def _lineas_clinicas(texto):
    lineas = []
    for raw in str(texto or "").replace("\r", "\n").split("\n"):
        raw = raw.replace("\u00a0", " ").replace("\u200b", " ")
        raw = re.sub(r"[▪◦●■□]", "•", raw)
        raw = re.sub(r"[ \t]+", " ", raw).strip()
        if raw:
            lineas.append(raw)
    return lineas


def _detectar_seccion(linea):
    norm = normalizar_etiqueta(linea)
    if not norm:
        return None, ""
    if es_encabezado_legal(linea):
        return "legal", ""
    mejor = None
    for nombre, aliases in _SECCIONES_CLINICAS.items():
        for alias in aliases:
            alias_norm = normalizar_etiqueta(alias)
            pos = norm.find(alias_norm)
            # Un encabezado clínico suele estar al inicio o en una celda corta de tabla.
            if pos < 0 or (pos > 18 and len(norm) > 100):
                continue
            if alias_norm in {"REMISION", "REMISIONES", "OBSERVACION", "OBSERVACIONES", "PVE", "SVE"}:
                raw = str(linea or "").strip()
                prefijo_raw = raw[:len(alias)]
                cola_raw = raw[len(alias):].lstrip() if normalizar_etiqueta(prefijo_raw) == alias_norm else ""
                encabezado_corto = norm == alias_norm or bool(cola_raw and cola_raw[0] in ":|/-")
                if not encabezado_corto:
                    continue
            puntaje = len(alias_norm) + (25 if pos == 0 else 0)
            if mejor is None or puntaje > mejor[0]:
                mejor = (puntaje, nombre, alias_norm)
    if not mejor:
        return None, ""
    _, nombre, alias_norm = mejor
    # Para capturar contenido en la misma línea se prioriza lo que sigue a ':' o '|'.
    resto = ""
    for sep in [":", "|"]:
        if sep in linea:
            partes = linea.split(sep, 1)
            if normalizar_etiqueta(partes[0]).find(alias_norm) >= 0:
                resto = partes[1].strip(" :-|,;")
                break
    return nombre, resto


def extraer_bloques_clinicos(texto):
    """Segmenta el documento sin depender de una plantilla específica."""
    bloques = {k: [] for k in _SECCIONES_CLINICAS}
    actual = None
    for linea in _lineas_clinicas(texto):
        seccion, resto = _detectar_seccion(linea)
        if seccion == "legal":
            actual = None
            continue
        if seccion:
            actual = seccion
            if resto:
                bloques[actual].append(resto)
            continue
        if actual:
            # Un encabezado administrativo evidente corta la sección clínica.
            norm = normalizar_etiqueta(linea)
            if any(x in norm for x in ["FIRMA DEL", "ATENTAMENTE", "CONSENTIMIENTO", "AUTORIZO", "HABEAS DATA"]):
                actual = None
                continue
            bloques[actual].append(linea)
    return bloques


def _detectar_examen(linea):
    norm = normalizar_etiqueta(linea)
    for clave, canonico in sorted(EXAMS_MAP.items(), key=lambda kv: len(kv[0]), reverse=True):
        k = normalizar_etiqueta(clave)
        m = re.search(rf"(?<![A-Z0-9]){re.escape(k)}(?![A-Z0-9])", norm)
        if m:
            return canonico, m.start(), m.end(), k
    return "", -1, -1, ""


def _es_recomendacion_probable(texto):
    t = recortar_contenido_legal(str(texto or "")).strip(" •-_:;,./")
    if not t or es_vacio_o_estado(t) or es_contenido_legal_recomendacion(t):
        return False
    n = normalizar_etiqueta(t)
    if n in _NEGACIONES_CLINICAS:
        return False
    if any(n.startswith(x) for x in [
        "REALIZAR ", "UTILIZAR ", "USAR ", "MANTENER ", "EVITAR ", "CONTINUAR ",
        "ASISTIR ", "CONTROL ", "CONTROLES ", "SEGUIMIENTO ", "FORTALECER ",
        "PAUTAS ", "REPOSOS ", "CAPACITACION ", "MANIPULACION ", "ALTERNANCIA ",
        "SE RECOMIENDA ", "SE SUGIERE ", "CONSERVAR ", "PORTAR ", "REALICE "
    ]):
        return True
    # En tablas, una recomendación puede ser nominal pero debe tener suficiente contenido.
    return len(n.split()) >= 4 and not any(n.startswith(x) for x in ["APTO", "REALIZADO", "NORMAL", "SIN ALTERACION"])


def _es_recomendacion_accion(texto):
    n = normalizar_etiqueta(texto)
    return any(n.startswith(x) for x in [
        "REALIZAR ", "UTILIZAR ", "USAR ", "MANTENER ", "EVITAR ", "CONTINUAR ",
        "ASISTIR ", "CONTROL ", "CONTROLES ", "SEGUIMIENTO ", "FORTALECER ",
        "PAUTAS ", "REPOSOS ", "CAPACITACION ", "MANIPULACION ", "ALTERNANCIA ",
        "SE RECOMIENDA ", "SE SUGIERE ", "CONSERVAR ", "PORTAR ", "REALICE "
    ])


def _limpiar_recomendacion_tabla(texto):
    t = str(texto or "")
    t = re.sub(r"^\s*(?:[•*-]|\d+\s*[.)-])\s*", "", t)
    t = re.sub(r"^(?:REALIZADO|REALIZADA|NORMAL|APTO|CUMPLE|SI|SÍ)\s*[:|/-]*\s*", "", t, flags=re.IGNORECASE)
    t = recortar_contenido_legal(t)
    return t.strip(" •-_:;,./")


def _lineas_recomendaciones_con_reinicio(texto):
    """Conserva límites entre bloques de recomendaciones para no arrastrar el último examen."""
    salida = []
    activa = False
    for linea in _lineas_clinicas(texto):
        seccion, resto = _detectar_seccion(linea)
        if seccion == "legal":
            activa = False
            continue
        if seccion:
            if seccion == "recomendaciones":
                activa = True
                salida.append("__RESET_GENERAL__")
                if resto:
                    salida.append(resto)
            else:
                activa = False
            continue
        if activa:
            salida.append(linea)
    return salida


def extraer_recomendaciones_por_examen_robusto(texto, examenes_iniciales=None):
    """Extrae recomendaciones por proximidad estructural y evita asignaciones por simple palabra clave."""
    bloques = extraer_bloques_clinicos(texto)
    lineas = _lineas_recomendaciones_con_reinicio(texto)
    if not [l for l in lineas if l != "__RESET_GENERAL__"]:
        # Respaldo: líneas con examen explícito y texto adicional.
        lineas = [l for l in _lineas_clinicas(texto) if _detectar_examen(l)[0]]

    examenes = normalizar_lista_clinica(examenes_iniciales or [])
    mapa = {e: [] for e in examenes}
    generales = []
    actual = ""

    def agregar(examen, valor):
        valor = _limpiar_recomendacion_tabla(valor)
        if not _es_recomendacion_probable(valor):
            return
        atomicas, _ = separar_recomendaciones_atomicas([valor])
        for item in atomicas or [a_caso_oracion(valor)]:
            item = _limpiar_recomendacion_tabla(item)
            if not item:
                continue
            if examen:
                ex = canonizar_nombre_examen(examen, examenes)
                if ex not in examenes and ex != "Recomendaciones generales":
                    examenes.append(ex)
                mapa.setdefault(ex, []).append(item)
            else:
                generales.append(item)

    for linea in lineas:
        if linea == "__RESET_GENERAL__":
            actual = ""
            continue
        columnas = [c for c in re.split(r"\s{2,}|\t+|\|", linea) if c.strip()]
        if not columnas:
            columnas = [linea]
        examen_linea, _, _, _ = _detectar_examen(linea)
        if examen_linea:
            actual = examen_linea
            if actual not in examenes:
                examenes.append(actual)
            mapa.setdefault(actual, [])

        consumio_examen = False
        for col in columnas:
            examen_col, inicio_examen, fin_examen, _ = _detectar_examen(col)
            if examen_col:
                actual = examen_col
                consumio_examen = True
                if actual not in examenes:
                    examenes.append(actual)
                mapa.setdefault(actual, [])
                # Puede venir «Audiometría: usar protección auditiva».
                prefijo, contenido = _separar_prefijo_examen(col)
                if prefijo and contenido:
                    agregar(actual, contenido)
                    continue
                # Usa el intervalo ya detectado para tolerar tildes/OCR en el nombre del examen.
                resto = (col[:inicio_examen] + " " + col[fin_examen:]) if inicio_examen >= 0 else col
                agregar(actual, resto)
            else:
                agregar(actual if actual else "", col)

        # Una línea de texto simple inmediatamente después de un examen pertenece a ese examen.
        if not consumio_examen and len(columnas) == 1 and actual:
            agregar(actual, columnas[0])

    # La sección «otras observaciones y recomendaciones» suele mezclar ambos tipos.
    obs_extra = []
    for linea in bloques.get("observaciones") or []:
        if _es_recomendacion_accion(linea):
            agregar("", linea)
        else:
            limpio = recortar_contenido_legal(linea).strip()
            if limpio and not es_vacio_o_estado(limpio):
                obs_extra.append(limpio)

    if generales:
        mapa["Recomendaciones generales"] = generales
    mapa = agrupar_recomendaciones_por_examen(examenes, [], mapa)
    return examenes, mapa, deduplicar_textos(obs_extra)


def _contenido_seccion(texto, nombre):
    bloques = extraer_bloques_clinicos(texto)
    return "\n".join(bloques.get(nombre) or []).strip()


def extraer_observaciones_robustas(texto, observaciones_extra=None):
    candidatos = list(observaciones_extra or [])
    bloque = _contenido_seccion(texto, "observaciones")
    if bloque and normalizar_etiqueta(bloque) in _NEGACIONES_CLINICAS | {"SIN OBSERVACIONES", "NO REGISTRA OBSERVACIONES"}:
        return "Ninguna."
    for linea in _lineas_clinicas(bloque):
        limpio = recortar_contenido_legal(linea).strip(" •-_:;,./")
        if not limpio or normalizar_etiqueta(limpio) in _NEGACIONES_CLINICAS or _es_recomendacion_accion(limpio):
            continue
        candidatos.append(limpio)
    return a_caso_oracion(" ".join(deduplicar_textos(candidatos))) if candidatos else ("Ninguna." if bloque else "")


def extraer_remisiones_robustas(texto):
    bloque = _contenido_seccion(texto, "remisiones")
    if bloque:
        norm = normalizar_etiqueta(bloque)
        if norm in _NEGACIONES_CLINICAS or any(frase in norm for frase in [
            "NO REQUIERE REMISION", "SIN REMISION", "NO APLICA", "NO SE REQUIERE REMISION"
        ]):
            return "No"
        partes = []
        for linea in _lineas_clinicas(bloque):
            limpio = recortar_contenido_legal(linea).strip(" •-_:;,./")
            nl = normalizar_etiqueta(limpio)
            if not limpio or nl in _NEGACIONES_CLINICAS:
                continue
            # Descarta filas que solo contienen controles/checkboxes SI-NO sin destino de remisión.
            tokens = set(re.findall(r"[A-Z]+", nl))
            if tokens and tokens.issubset({"SI","NO","X","NA","APLICA","REQUIERE","REMISION","REMISIONES"}):
                continue
            partes.append(limpio)
        if partes:
            return a_caso_oracion("; ".join(deduplicar_textos(partes)))
        return "No"

    # Solo se usa respaldo global si existe una expresión inequívoca de remisión/interconsulta.
    patrones = [
        r"(?i)\b(?:SE\s+)?REMITE\s+(?:A|POR)\s+([^\n.;]{3,120})",
        r"(?i)\bREMISI[ÓO]N\s+(?:A|POR)\s+([^\n.;]{3,120})",
        r"(?i)\bINTERCONSULTA\s+(?:A|POR|CON)\s+([^\n.;]{3,120})",
        r"(?i)\bREMITIR\s+(?:A|POR)\s+([^\n.;]{3,120})",
    ]
    hallados = []
    for patron in patrones:
        for m in re.finditer(patron, str(texto or "")):
            candidato = recortar_en_siguiente_etiqueta(m.group(1)).strip(" •-_:;,./")
            if candidato and not es_vacio_o_estado(candidato):
                hallados.append(candidato)
    return a_caso_oracion("; ".join(deduplicar_textos(hallados))) if hallados else "No"


def extraer_programas_vigilancia_robusto(texto):
    bloque = _contenido_seccion(texto, "vigilancia")
    candidatos = []
    if bloque:
        candidatos.extend(_lineas_clinicas(bloque))
    # Frases inequívocas en cualquier parte del documento.
    for linea in _lineas_clinicas(texto):
        n = normalizar_etiqueta(linea)
        if any(v in n for v in ["INGRESAR AL PROGRAMA", "INGRESO A PROGRAMA", "INCLUIR EN PROGRAMA", "CONTINUAR EN PROGRAMA", "PERTENECE AL PROGRAMA", "PVE", "SVE"]):
            candidatos.append(linea)

    encontrados = []
    for candidato in candidatos:
        n = normalizar_etiqueta(candidato)
        if any(frase in n for frase in ["NO INGRESA", "NO INGRESAR", "NO REQUIERE INGRESO", "NO APLICA", "NINGUNO"]):
            # Una negación no invalida otra línea explícitamente positiva.
            if not any(v in n for v in ["SI INGRESA", "SÍ INGRESA", "INGRESAR A", "INCLUIR EN", "CONTINUAR EN"]):
                continue
        for kw, nombre in SVE_CLINICAL_KEYWORDS.items():
            nkw = normalizar_etiqueta(kw)
            pos = n.find(nkw)
            if pos < 0:
                continue
            ventana = n[max(0, pos-18): min(len(n), pos+len(nkw)+32)]
            despues = n[pos+len(nkw): min(len(n), pos+len(nkw)+24)]
            antes = n[max(0, pos-16):pos]
            # En matrices SI/NO evita marcar un programa cuya propia fila/celda está negada.
            negada = bool(re.search(r"^\s*(?:O|VISUAL|AUDITIVO|RESPIRATORIO)?\s*[:=-]?\s*(?:NO|NO APLICA|N A)\b", despues)) or bool(re.search(r"\b(?:NO|NO APLICA)\s*[:=-]?\s*$", antes))
            if not negada and nombre not in encontrados:
                encontrados.append(nombre)
        # Conserva nombres explícitos desconocidos cuando están asociados a «programa».
        m = re.search(r"(?i)(?:PROGRAMA(?:\s+DE\s+VIGILANCIA(?:\s+EPIDEMIOL[ÓO]GICA)?)?\s*[:\-]?|PVE\s*[:\-]?|SVE\s*[:\-]?)\s*([^\n;|]{4,100})", candidato)
        if m:
            raw = m.group(1).strip(" :-,.;")
            nraw = normalizar_etiqueta(raw)
            contiene_keyword_conocida = any(normalizar_etiqueta(kw) in nraw for kw in SVE_CLINICAL_KEYWORDS)
            es_generico = any(x in nraw for x in ["VIGILANCIA", "EPIDEMIOLOG", "PROGRAMA", "INGRESAR AL"])
            if nraw not in _NEGACIONES_CLINICAS and not contiene_keyword_conocida and not es_generico and not any(x in nraw for x in ["SI NO", "MARQUE", "SELECCIONE"]):
                if not any(normalizar_etiqueta(v) in nraw or nraw in normalizar_etiqueta(v) for v in encontrados):
                    encontrados.append(a_caso_oracion(raw))
    return ", ".join(deduplicar_textos(encontrados)) if encontrados else "Ninguno"


def _tokens_soporte(texto):
    return [t for t in re.findall(r"[A-Z0-9]+", normalizar_etiqueta(texto)) if len(t) > 2 and t not in _STOPWORDS_SOPORTE]


def texto_soportado_por_fuente(candidato, fuente, umbral=0.52):
    """Evita que la fusión acepte texto ajeno al documento cuando existe texto extraíble."""
    candidato = str(candidato or "").strip()
    fuente = str(fuente or "")
    if not candidato:
        return False
    nc = normalizar_etiqueta(candidato)
    nf = normalizar_etiqueta(fuente)
    if nc and nc in nf:
        return True
    tc = _tokens_soporte(candidato)
    tf = set(_tokens_soporte(fuente))
    if len(tc) < 3:
        return any(t in tf for t in tc) if tc else False
    cobertura = sum(1 for t in tc if t in tf) / max(1, len(set(tc)))
    return cobertura >= umbral


def _valor_ia_con_evidencia(datos_ia, campo):
    valor = datos_ia.get(campo)
    evidencias = datos_ia.get("evidencias") or {}
    evidencia = evidencias.get(campo, "") if isinstance(evidencias, dict) else ""
    if isinstance(evidencia, list):
        evidencia = " ".join(str(x) for x in evidencia)
    return valor, str(evidencia or "")


def evaluar_calidad_extraccion(datos, texto):
    campos = []
    n = normalizar_etiqueta(texto)
    if not datos.get("nombre"): campos.append("nombre")
    if not datos.get("cargo"): campos.append("cargo")
    if not datos.get("examenes_lista"): campos.append("exámenes realizados")
    if any(x in n for x in ["RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES", "RECOMENDACIONES GENERALES"]):
        if not any((datos.get("recomendaciones_por_examen") or {}).values()): campos.append("recomendaciones")
    if "OBSERVACION" in n and not str(datos.get("observaciones", "")).strip():
        obs = normalizar_etiqueta(_contenido_seccion(texto, "observaciones"))
        if obs and obs not in _NEGACIONES_CLINICAS and "SIN OBSERVACIONES" not in obs: campos.append("observaciones")
    if "REMISION" in n and str(datos.get("remisiones", "No")).strip().lower() in {"", "no", "ninguna", "ninguno"}:
        # Solo marca revisión si el texto de remisiones no es inequívocamente negativo.
        rem = normalizar_etiqueta(_contenido_seccion(texto, "remisiones"))
        if rem and rem not in _NEGACIONES_CLINICAS and not any(x in rem for x in ["NO REQUIERE", "SIN REMISION", "NO APLICA", "NINGUNA", "NINGUNO"]): campos.append("remisiones")
    if "VIGILANCIA" in n and normalizar_etiqueta(datos.get("vigilancia_programa", "")) in {"", "NINGUNO", "NINGUNA"}:
        vig = normalizar_etiqueta(_contenido_seccion(texto, "vigilancia"))
        if vig and not any(x in vig for x in ["NO INGRESA", "NO REQUIERE", "NO APLICA", "NINGUNO"]): campos.append("vigilancia epidemiológica")
    campos = list(dict.fromkeys(campos))
    calidad = "Alta" if not campos else ("Media" if len(campos) <= 2 else "Revisar")
    return calidad, campos

def extraer_identificacion_correo(texto):
    """Recupera cédula y correo sin confundirlos con NIT, teléfonos o consecutivos."""
    resultado = {"identificacion": "", "correo": ""}
    texto = str(texto or "")
    correo = re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", texto, re.IGNORECASE)
    if correo:
        resultado["correo"] = correo.group(0).lower()

    patrones_documento = [
        r"(?:N[ÚU]MERO\s+DE\s+)?(?:DOCUMENTO|IDENTIFICACI[ÓO]N|C[ÉE]DULA)(?:\s+DE\s+CIUDADAN[IÍ]A)?\s*[:#-]?\s*(?:C\.?\s*C\.?\s*)?([0-9][0-9.\s-]{5,17})",
        r"\bC\.?\s*C\.?\s*(?:N[ÚU]MERO|NO\.?|N[°º])?\s*[:#-]?\s*([0-9][0-9.\s-]{5,17})"
    ]
    for patron in patrones_documento:
        coincidencia = re.search(patron, texto, re.IGNORECASE)
        if not coincidencia:
            continue
        numero = re.sub(r"\D", "", coincidencia.group(1))
        if 6 <= len(numero) <= 12:
            resultado["identificacion"] = numero
            break
    return resultado


def deduplicar_mapa_recomendaciones_global(mapa):
    """Evita que la misma recomendación aparezca bajo varios exámenes.
    Prioriza asociaciones específicas y deja las generales al final.
    """
    if not isinstance(mapa, dict):
        return mapa or {}
    salida = {}
    vistos = set()
    items = list(mapa.items())
    items.sort(key=lambda kv: 1 if normalizar_etiqueta(kv[0]) == "RECOMENDACIONES GENERALES" else 0)
    for examen, recs in items:
        limpias = []
        for rec in recs or []:
            firma = normalizar_etiqueta(rec)
            if not firma or firma in vistos or firma in {"REALIZADO", "REALIZADA", "NORMAL", "NO APLICA", "N A"}:
                continue
            vistos.add(firma)
            limpias.append(rec)
        if limpias:
            salida[examen] = limpias
        elif normalizar_etiqueta(examen) != "RECOMENDACIONES GENERALES":
            salida.setdefault(examen, [])
    return salida


def _evidencia_vincula_examen(examen, recomendacion, evidencias):
    exn = normalizar_etiqueta(examen)
    tokens = [t for t in exn.split() if len(t) >= 5 and t not in {"EXAMEN", "MEDICO", "CLINICO", "ENFASIS"}]
    if not tokens:
        tokens = [t for t in exn.split() if len(t) >= 4]
    for evidencia in evidencias or []:
        evn = normalizar_etiqueta(evidencia)
        if not any(t in evn for t in tokens):
            continue
        if texto_soportado_por_fuente(recomendacion, evidencia, 0.30) or texto_soportado_por_fuente(evidencia, recomendacion, 0.30):
            return True
    return False


def fusionar_validacion_ia(datos_locales, datos_ia, texto_fuente):
    """Fusión conservadora: IA visual + reglas locales + evidencia del documento."""
    resultado = dict(datos_locales or {})

    # Identidad y metadatos: la IA corrige formatos variables, pero nunca borra un dato local útil.
    for campo in ["nombre", "cargo", "tipo_examen", "lugar", "identificacion", "correo"]:
        candidato = str(datos_ia.get(campo, "") or "").strip()
        if candidato:
            local = str(resultado.get(campo, "") or "").strip()
            if not local or texto_soportado_por_fuente(candidato, texto_fuente, 0.42):
                resultado[campo] = candidato

    # Exámenes: unión de ambas lecturas. Una variación de formato no debe hacer desaparecer un examen.
    examenes_local = resultado.get("examenes_lista", []) or []
    examenes_ia = datos_ia.get("examenes_realizados", []) or []
    resultado["examenes_lista"] = normalizar_lista_clinica(deduplicar_textos(examenes_local + examenes_ia))

    # Recomendaciones: la asociación local explícita tiene prioridad sobre una asociación distinta de IA.
    recs_ia = filtrar_recomendaciones_clinicas(deduplicar_textos(datos_ia.get("recomendaciones_medicas", []) or []))
    mapa_local = agrupar_recomendaciones_por_examen(
        resultado["examenes_lista"], resultado.get("recomendaciones_lista", []), resultado.get("recomendaciones_por_examen", {}) or {}
    )
    ubicacion_local = {}
    for ex, recs in mapa_local.items():
        for rec in recs or []:
            ubicacion_local[normalizar_etiqueta(rec)] = ex

    mapa_ia_raw = datos_ia.get("recomendaciones_por_examen", []) or []
    if isinstance(mapa_ia_raw, dict):
        mapa_ia_raw = [{"examen": k, "recomendaciones": v} for k, v in mapa_ia_raw.items()]
    evidencia_recs = (datos_ia.get("evidencias") or {}).get("recomendaciones", []) if isinstance(datos_ia.get("evidencias") or {}, dict) else []
    if isinstance(evidencia_recs, str): evidencia_recs = [evidencia_recs]
    evidencia_recs = [str(x or "").strip() for x in evidencia_recs if str(x or "").strip()]
    fuente_recomendaciones = (_contenido_seccion(texto_fuente, "recomendaciones") or _contenido_seccion(texto_fuente, "examenes_recomendaciones") or texto_fuente)

    def evidencia_relacionada(rec):
        return any(
            texto_soportado_por_fuente(rec, ev, 0.34) or texto_soportado_por_fuente(ev, rec, 0.34)
            for ev in evidencia_recs
        )
    mapa_ia_filtrado = []
    firmas_ia_mapeadas = set()
    for registro in mapa_ia_raw:
        if not isinstance(registro, dict): continue
        ex = registro.get("examen", "Recomendaciones generales")
        validas = []
        elementos = registro.get("recomendaciones", [])
        if isinstance(elementos, str): elementos = [elementos]
        for rec in elementos or []:
            firma = normalizar_etiqueta(rec)
            if firma in ubicacion_local and canonizar_nombre_examen(ex, resultado["examenes_lista"]) != ubicacion_local[firma]:
                continue
            if firma not in ubicacion_local:
                # La IA no puede crear una asociación examen→recomendación solo porque
                # ambas palabras existan en el PDF. Debe aportar evidencia de la MISMA
                # fila/bloque que vincule explícitamente el examen y la recomendación.
                if not _evidencia_vincula_examen(ex, rec, evidencia_recs):
                    continue
            validas.append(rec); firmas_ia_mapeadas.add(firma)
        mapa_ia_filtrado.append({"examen": ex, "recomendaciones": validas})
    recs_ia_sueltos = [
        r for r in recs_ia
        if normalizar_etiqueta(r) not in ubicacion_local
        and normalizar_etiqueta(r) not in firmas_ia_mapeadas
        and (texto_soportado_por_fuente(r, fuente_recomendaciones, 0.40) or evidencia_relacionada(r))
    ]
    mapa_fusion = agrupar_recomendaciones_por_examen(resultado["examenes_lista"], recs_ia_sueltos, [
        {"examen": k, "recomendaciones": v} for k, v in mapa_local.items()
    ] + mapa_ia_filtrado)
    mapa_fusion = deduplicar_mapa_recomendaciones_global(mapa_fusion)
    resultado["recomendaciones_por_examen"] = mapa_fusion
    resultado["recomendaciones_lista"] = aplanar_recomendaciones_por_examen(mapa_fusion)

    # Campos sensibles a formato: aceptar IA positiva cuando hay evidencia visual; conservar local si la IA responde vacío/No.
    for campo in ["observaciones", "remisiones"]:
        candidato, evidencia = _valor_ia_con_evidencia(datos_ia, campo)
        candidato = str(candidato or "").strip()
        local = str(resultado.get(campo, "") or "").strip()
        if candidato:
            candidato_neg = es_vacio_o_negativo(candidato)
            local_neg = es_vacio_o_negativo(local)
            seccion_fuente = _contenido_seccion(texto_fuente, "observaciones" if campo == "observaciones" else "remisiones")
            fuente_campo = seccion_fuente or texto_fuente
            evidencia_ok = texto_soportado_por_fuente(candidato, fuente_campo, 0.38) or texto_soportado_por_fuente(evidencia, fuente_campo, 0.35)
            # Un valor positivo de IA sobre un local negativo requiere soporte en la sección correspondiente.
            if (local_neg and not candidato_neg and evidencia_ok) or (not local and candidato and evidencia_ok) or (not local_neg and evidencia_ok):
                resultado[campo] = a_caso_oracion(candidato)

    programas_ia = datos_ia.get("vigilancia_programa", []) or []
    if isinstance(programas_ia, str): programas_ia = re.split(r"[,;\n]+", programas_ia)
    programas_local = re.split(r"[,;\n]+", str(resultado.get("vigilancia_programa", "") or ""))
    programas_local = [x for x in programas_local if normalizar_etiqueta(x) not in {"", "NINGUNO", "NINGUNA", "NO"}]
    evidencia_vig = (datos_ia.get("evidencias") or {}).get("vigilancia_programa", "") if isinstance(datos_ia.get("evidencias") or {}, dict) else ""
    fuente_vig = _contenido_seccion(texto_fuente, "vigilancia")
    evidencia_vig_norm = normalizar_etiqueta(evidencia_vig)
    evidencia_vig_explicita = any(x in evidencia_vig_norm for x in ["PROGRAMA", "PVE", "SVE", "INGRESA", "INGRESAR", "CONTINUA", "INCLUIR", "PERTENECE"])
    programas_ia_validos = []
    for programa in programas_ia:
        if normalizar_etiqueta(programa) in {"", "NINGUNO", "NINGUNA", "NO"}: continue
        soporte_seccion = bool(fuente_vig) and texto_soportado_por_fuente(programa, fuente_vig, 0.30)
        soporte_evidencia = (
            evidencia_vig_explicita
            and texto_soportado_por_fuente(evidencia_vig, texto_fuente, 0.25)
            and texto_soportado_por_fuente(programa, evidencia_vig, 0.30)
        )
        if soporte_seccion or soporte_evidencia:
            programas_ia_validos.append(programa)
    programas = deduplicar_textos(programas_local + programas_ia_validos)
    resultado["vigilancia_programa"] = ", ".join(programas) if programas else "Ninguno"

    fecha_ia = str(datos_ia.get("fecha", "") or "").strip()
    if fecha_ia and re.fullmatch(r"20\d{2}-\d{2}-\d{2}", fecha_ia):
        try: resultado["fecha"] = datetime.datetime.strptime(fecha_ia, "%Y-%m-%d").date()
        except ValueError: pass

    pendientes = list(resultado.get("recomendaciones_pendientes_revision", []) or [])
    pendientes += list(datos_ia.get("_fragmentos_pendientes", []) or [])
    resultado["recomendaciones_pendientes_revision"] = deduplicar_textos(pendientes)
    resultado["validado_ia"] = True
    resultado["modelo_ia"] = datos_ia.get("_modelo_usado", "")
    resultado["segunda_revision_ia"] = bool(datos_ia.get("_segunda_revision_ia"))
    resultado["modo_validacion"] = "IA visual auditada + motor clínico" if resultado["segunda_revision_ia"] else "IA visual + motor clínico"
    resultado = normalizar_datos_documento(resultado)
    calidad, campos = evaluar_calidad_extraccion(resultado, texto_fuente)
    resultado["calidad_extraccion"] = calidad
    resultado["campos_revision"] = campos
    return resultado


# -----------------------------------------------------------------------------
# Motor clínico V6: preservación de columnas + formatos de proveedor.
# Esta capa reemplaza las funciones V5 anteriores sin romper la API pública.
# -----------------------------------------------------------------------------

_SECCIONES_CLINICAS["examenes_recomendaciones"] = [
    "EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS RECOMENDACIONES",
    "EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS - RECOMENDACIONES",
    "EXAMENES REALIZADOS RECOMENDACIONES",
    "EXAMENES REALIZADOS - RECOMENDACIONES",
    "EXAMENES Y RECOMENDACIONES",
    "EXAMENES REALIZADOS Y RECOMENDACIONES",
]

# Ampliación conservadora de programas frecuentes. Solo se activan con evidencia
# dentro de la sección PVE/SVE o con una mención explícita PVE/SVE en la fila.
SVE_CLINICAL_KEYWORDS.update({
    "VISUAL": "Conservación Visual",
    "VISION": "Conservación Visual",
    "VISIÓN": "Conservación Visual",
    "BIOMECANIC": "Prevención Osteomuscular (DME)",
    "MUSCULOESQUELET": "Prevención Osteomuscular (DME)",
    "PSICOSOCIAL": "Riesgo Psicosocial",
    "CARDIOMETABOL": "Riesgo Cardiovascular",
})

_ESTADOS_EXAMEN_V6 = {
    "REALIZADO", "REALIZADA", "REALIZADOS", "REALIZADAS", "NORMAL", "APTO",
    "CUMPLE", "SI", "SÍ", "X", "OK", "NEGATIVO", "POSITIVO", "NO APLICA",
    "N/A", "NA", "SIN ALTERACION", "SIN ALTERACIÓN"
}

_CORTES_OBSERVACIONES_V6 = [
    "TIPO DE RESTRICCION", "TIPO DE RESTRICCIÓN", "RESTRICCIONES LABORALES",
    "RESTRICCIONES", "INGRESAR AL PROGRAMA", "PROGRAMA DE VIGILANCIA",
    "VIGILANCIA EPIDEMIOLOGICA", "VIGILANCIA EPIDEMIOLÓGICA",
    "INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "REMISIONES",
    "FIRMA DEL", "CONSENTIMIENTO", "AUTORIZO", "HABEAS DATA", "CONCEPTO LABORAL"
]

_CORTES_REMISIONES_V6 = [
    "FIRMA DEL", "CONSENTIMIENTO", "AUTORIZO", "HABEAS DATA", "ATENTAMENTE",
    "RECOMENDACIONES", "OBSERVACIONES", "VIGILANCIA EPIDEMIOLOGICA",
    "VIGILANCIA EPIDEMIOLÓGICA", "PROGRAMA DE VIGILANCIA", "TIPO DE RESTRICCION",
    "TIPO DE RESTRICCIÓN"
]


def _lineas_clinicas(texto):
    """Normaliza texto sin destruir las fronteras de columnas entregadas por PDF.js/OCR."""
    lineas = []
    for raw in str(texto or "").replace("\r", "\n").split("\n"):
        raw = raw.replace("\u00a0", " ").replace("\u200b", " ")
        raw = re.sub(r"[▪◦●■□]", "•", raw)
        # Fuentes antiguas podían representar columnas con 3+ espacios.
        raw = re.sub(r" {3,}", "\t", raw)
        celdas = []
        for celda in raw.split("\t"):
            celda = re.sub(r"[ ]+", " ", celda).strip()
            if celda:
                celdas.append(celda)
        linea = "\t".join(celdas).strip()
        if linea:
            lineas.append(linea)
    return lineas


def _columnas_v6(linea):
    linea = str(linea or "").replace("\u00a0", " ")
    if "\t" in linea:
        cols = [re.sub(r"\s+", " ", c).strip(" |/-,_.:") for c in re.split(r"\t+", linea)]
    else:
        cols = [re.sub(r"\s+", " ", c).strip(" |/-,_.:") for c in re.split(r"\s{3,}|\|", linea)]
    return [c for c in cols if c]


def _es_estado_examen_v6(texto):
    n = normalizar_etiqueta(texto)
    if not n:
        return True
    if n in {normalizar_etiqueta(x) for x in _ESTADOS_EXAMEN_V6}:
        return True
    return bool(re.fullmatch(r"(?:REALIZAD[OA]S?|NORMAL|APTO|CUMPLE|SI|NO|X|OK|N/?A)[ .:-]*", n))


def _celda_es_examen_v6(texto):
    """Distingue una celda de examen de una recomendación que solo menciona un examen."""
    ex, inicio, fin, _ = _detectar_examen(texto)
    if not ex or inicio < 0 or inicio > 5:
        return ""
    resto = (str(texto)[:inicio] + " " + str(texto)[fin:]).strip(" :-|,.;")
    nr = normalizar_etiqueta(resto)
    if not nr or _es_estado_examen_v6(resto):
        return ex
    # Calificadores que siguen formando parte del nombre del examen.
    if len(nr.split()) <= 4 and any(x in nr for x in [
        "OCUPACIONAL", "DE SUPERFICIE", "DE TONOS", "CON ENFASIS", "CON ÉNFASIS",
        "ENFASIS", "ÉNFASIS", "RITMO", "TORAX", "TÓRAX"
    ]):
        return ex
    return ""


def _es_recomendacion_probable(texto):
    t = recortar_contenido_legal(str(texto or "")).strip(" •-_:;,./")
    if not t or es_vacio_o_estado(t) or es_contenido_legal_recomendacion(t) or _es_estado_examen_v6(t):
        return False
    n = normalizar_etiqueta(t)
    if n in _NEGACIONES_CLINICAS:
        return False
    if n in {
        "CONTROL PERIODICO CON RECOMENDACIONES", "CONTROL PERIODICO",
        "EXAMEN PERIODICO SATISFACTORIO", "CONCEPTO LABORAL",
        "CONCEPTO DE APTITUD OCUPACIONAL"
    }:
        return False
    if any(n.startswith(x) for x in [
        "REALIZAR ", "UTILIZAR ", "USAR ", "USO DE ", "MANTENER ", "EVITAR ", "CONTINUAR ",
        "ASISTIR ", "CONTROL ", "CONTROLES ", "CONTROL DE ", "SEGUIMIENTO ", "FORTALECER ",
        "PAUTAS ", "PAUSAS ACTIVAS", "REPOSOS ", "CAPACITACION ", "MANIPULACION ", "ALTERNANCIA ",
        "SE RECOMIENDA ", "SE SUGIERE ", "CONSERVAR ", "PORTAR ", "REALICE ", "HACER ",
        "DIETA ", "HABITOS ", "HÁBITOS ", "EJERCICIO ", "EPP", "MANEJO ", "VALORACION ",
        "VALORACIÓN ", "CORRECCION ", "CORRECCIÓN ", "SVE ", "PVE "
    ]):
        return True
    # En celdas de una sección de recomendaciones existen indicaciones nominales cortas:
    # "Control de peso", "Dieta balanceada", "Hacer deporte", etc.
    tokens = n.split()
    if len(tokens) >= 2 and any(k in n for k in [
        "CONTROL", "DIETA", "DEPORTE", "EPP", "PAUSA", "HIGIENE POSTURAL", "HABITO",
        "PROTECCION", "PROTECCIÓN", "MANEJO", "VALORACION", "VALORACIÓN", "OPTICA", "ÓPTICA",
        "SEGUIMIENTO", "SVE", "PVE"
    ]):
        return True
    return len(tokens) >= 4 and not any(n.startswith(x) for x in ["APTO", "REALIZADO", "NORMAL", "SIN ALTERACION", "SIN ALTERACIÓN"])


_extraer_metadatos_formatos_conocidos_v5 = extraer_metadatos_formatos_conocidos

def extraer_metadatos_formatos_conocidos(texto_completo):
    meta = dict(_extraer_metadatos_formatos_conocidos_v5(texto_completo) or {})
    lineas = _lineas_clinicas(texto_completo)
    # Formato de grilla: encabezados en una fila y valores alineados en la siguiente.
    for i, linea in enumerate(lineas[:-1]):
        n = normalizar_etiqueta(linea)
        if "APELLIDOS Y NOMBRES" in n and any(x in n for x in ["GENERO", "EDAD", "DOCUMENTO"]):
            cols = _columnas_v6(lineas[i + 1])
            if cols and candidato_nombre_valido(cols[0]):
                meta["nombre"] = limpiar_candidato_campo(cols[0], "nombre").title()
                break
    return meta


def extraer_examenes_globales(texto):
    encontrados = []
    seccion = None
    for linea in _lineas_clinicas(texto):
        detectada, _ = _detectar_seccion(linea)
        if detectada:
            seccion = detectada
        norm = normalizar_etiqueta(linea)
        contexto_examen = seccion in {"examenes", "examenes_recomendaciones"}
        for col in _columnas_v6(linea):
            ex, _, _, _ = _detectar_examen(col)
            if not ex:
                continue
            col_norm = normalizar_etiqueta(col)
            # Fuera de la tabla solo se acepta si la fila declara realización explícita.
            if contexto_examen or "REALIZAD" in col_norm or "PRACTICAD" in col_norm:
                if ex not in encontrados:
                    encontrados.append(ex)
        if any(x in norm for x in ["CONCEPTO LABORAL", "OBSERVACIONES", "REMISIONES", "RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES"]):
            if seccion in {"examenes", "examenes_recomendaciones"}:
                seccion = None
    return encontrados


def _tabla_examen_recomendacion_v6(texto, examenes_iniciales=None):
    examenes = list(normalizar_lista_clinica(examenes_iniciales or []))
    mapa = {e: [] for e in examenes}
    activa = False
    ultimo_examen = ""

    def registrar_examen(ex):
        nonlocal ultimo_examen
        ex = canonizar_nombre_examen(ex, examenes)
        if ex and ex != "Recomendaciones generales":
            if ex not in examenes:
                examenes.append(ex)
            mapa.setdefault(ex, [])
            ultimo_examen = ex
        return ex

    def registrar_recomendacion(ex, valor):
        valor = _limpiar_recomendacion_tabla(valor)
        if not ex or not valor or _es_estado_examen_v6(valor) or not _es_recomendacion_probable(valor):
            return
        atomicas, _ = separar_recomendaciones_atomicas([valor.replace("//", "; ")])
        for rec in atomicas or [valor]:
            rec = _limpiar_recomendacion_tabla(rec)
            if rec and not _es_estado_examen_v6(rec):
                mapa.setdefault(ex, []).append(rec)

    for linea in _lineas_clinicas(texto):
        n = normalizar_etiqueta(linea)
        if ("EXAMENES" in n and "REALIZAD" in n and "RECOMEND" in n) or any(
            normalizar_etiqueta(a) in n for a in _SECCIONES_CLINICAS.get("examenes_recomendaciones", [])
        ):
            activa = True
            ultimo_examen = ""
            continue
        if activa and any(x in n for x in [
            "CONCEPTO LABORAL", "CONCEPTO DE APTITUD", "OBSERVACIONES", "TIPO DE RESTRICCION",
            "TIPO DE RESTRICCIÓN", "INGRESAR AL PROGRAMA", "INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES"
        ]):
            activa = False
            ultimo_examen = ""

        cols = _columnas_v6(linea)
        if not cols:
            continue
        exam_cols = []
        for idx, col in enumerate(cols):
            ex_celda = _celda_es_examen_v6(col)
            if ex_celda:
                ex, inicio, fin, _ = _detectar_examen(col)
                exam_cols.append((idx, ex, inicio, fin, col))

        # Fuera de la tabla combinada se exige que la PRIMERA celda sea inequívocamente un examen.
        fila_tabular_explicita = "\t" in linea and bool(exam_cols) and exam_cols[0][0] == 0
        if not activa and not fila_tabular_explicita:
            continue

        if len(exam_cols) >= 2:
            # Matrices como el formato Carvajal: dos exámenes en la misma fila, sin recomendación asociada.
            for _, ex, _, _, _ in exam_cols:
                registrar_examen(ex)
            ultimo_examen = ""
            continue

        if len(exam_cols) == 1:
            idx, ex, inicio, fin, col = exam_cols[0]
            ex = registrar_examen(ex)
            # Si la recomendación viene en la misma celda después del examen.
            resto_misma = (col[:inicio] + " " + col[fin:]).strip(" :-|,.;") if inicio >= 0 else ""
            registrar_recomendacion(ex, resto_misma)
            # En el formato JERSA la recomendación está en la celda derecha.
            for candidato in cols[idx + 1:]:
                ex_candidato = _celda_es_examen_v6(candidato)
                if ex_candidato:
                    registrar_examen(ex_candidato)
                else:
                    registrar_recomendacion(ex, candidato)
            continue

        if activa and ultimo_examen and len(cols) == 1 and not _es_estado_examen_v6(cols[0]):
            # Continuación de una recomendación envuelta en la fila siguiente.
            registrar_recomendacion(ultimo_examen, cols[0])

    mapa = {k: normalizar_lista_clinica(v, cerrar_con_punto=True) for k, v in mapa.items()}
    return examenes, mapa


def _lineas_recomendaciones_con_reinicio(texto):
    salida = []
    activa = False
    for linea in _lineas_clinicas(texto):
        seccion, resto = _detectar_seccion(linea)
        if seccion == "legal":
            activa = False
            continue
        if seccion:
            if seccion == "recomendaciones":
                activa = True
                salida.append("__RESET_GENERAL__")
                if resto:
                    salida.append(resto)
            elif seccion == "examenes_recomendaciones":
                activa = False  # esa tabla se procesa con su parser de columnas
            else:
                activa = False
            continue
        if activa:
            salida.append(linea)
    return salida


def extraer_recomendaciones_por_examen_robusto(texto, examenes_iniciales=None):
    # Primera fuente: tablas examen -> recomendación (formato JERSA y variantes).
    examenes, mapa = _tabla_examen_recomendacion_v6(texto, examenes_iniciales)
    generales = []

    def agregar_general(valor):
        valor = _limpiar_recomendacion_tabla(valor)
        if not _es_recomendacion_probable(valor):
            return
        atomicas, _ = separar_recomendaciones_atomicas([valor.replace("//", "; ")])
        for item in atomicas or [valor]:
            item = _limpiar_recomendacion_tabla(item)
            if item:
                generales.append(item)

    def agregar_examen(examen, valor):
        valor = _limpiar_recomendacion_tabla(valor)
        if not _es_recomendacion_probable(valor):
            return
        ex = canonizar_nombre_examen(examen, examenes)
        if ex not in examenes and ex != "Recomendaciones generales":
            examenes.append(ex)
        atomicas, _ = separar_recomendaciones_atomicas([valor.replace("//", "; ")])
        for item in atomicas or [valor]:
            item = _limpiar_recomendacion_tabla(item)
            if item:
                mapa.setdefault(ex, []).append(item)

    # Segunda fuente: bloques generales de recomendaciones en una o varias columnas.
    for linea in _lineas_recomendaciones_con_reinicio(texto):
        if linea == "__RESET_GENERAL__":
            continue
        cols = _columnas_v6(linea) or [linea]
        for col in cols:
            prefijo, contenido = _separar_prefijo_examen(col)
            if prefijo and contenido:
                ex = canonizar_nombre_examen(prefijo, examenes)
                if ex not in examenes:
                    examenes.append(ex)
                mapa.setdefault(ex, [])
                agregar_examen(ex, contenido)
                continue
            ex_celda = _celda_es_examen_v6(col)
            if ex_celda:
                if ex_celda not in examenes:
                    examenes.append(ex_celda)
                mapa.setdefault(ex_celda, [])
                continue
            # Una recomendación puede mencionar Optometría/Audiometría en medio del texto;
            # eso NO la convierte en recomendación de ese examen.
            agregar_general(col)

    # Respaldo para formato sin encabezado combinado pero con filas tabuladas examen/recomendación.
    if not any(mapa.values()):
        ex2, mapa2 = _tabla_examen_recomendacion_v6(texto, examenes)
        examenes = deduplicar_textos(examenes + ex2)
        for ex, recs in mapa2.items():
            mapa.setdefault(ex, []).extend(recs)

    # Solo el encabezado explícitamente MIXTO cede acciones a recomendaciones generales.
    obs_extra = []
    modo_mixto = False
    for linea in _lineas_clinicas(texto):
        n = normalizar_etiqueta(linea)
        if "OTRAS OBSERVACIONES Y RECOMENDACIONES" in n:
            modo_mixto = True
            resto = re.split(r"(?i)OTRAS\s+OBSERVACIONES\s+Y\s+RECOMENDACIONES\s*[:|-]?", linea, maxsplit=1)
            if len(resto) > 1 and resto[1].strip():
                (agregar_general if _es_recomendacion_probable(resto[1]) else obs_extra.append)(resto[1].strip())
            continue
        if modo_mixto:
            if any(x in n for x in _CORTES_OBSERVACIONES_V6):
                modo_mixto = False
                continue
            for col in _columnas_v6(linea) or [linea]:
                limpio = recortar_contenido_legal(col).strip(" •-_:;,./")
                if not limpio or es_vacio_o_estado(limpio):
                    continue
                if _es_recomendacion_probable(limpio):
                    agregar_general(limpio)
                else:
                    obs_extra.append(limpio)

    if generales:
        mapa.setdefault("Recomendaciones generales", []).extend(generales)
    mapa = agrupar_recomendaciones_por_examen(examenes, [], mapa)
    return normalizar_lista_clinica(examenes), mapa, deduplicar_textos(obs_extra)


def extraer_recomendaciones_genericas(texto):
    resultados = []
    for linea in _lineas_recomendaciones_con_reinicio(texto):
        if linea == "__RESET_GENERAL__":
            continue
        for col in _columnas_v6(linea) or [linea]:
            limpio = _limpiar_recomendacion_tabla(col)
            if _es_recomendacion_probable(limpio):
                atomicas, _ = separar_recomendaciones_atomicas([limpio.replace("//", "; ")])
                resultados.extend(atomicas or [limpio])
    return normalizar_lista_clinica(resultados, cerrar_con_punto=True)


def extraer_observaciones_robustas(texto, observaciones_extra=None):
    # Regla crítica V6: si el proveedor etiqueta el campo exactamente como OBSERVACIONES,
    # se respeta TODO su contenido aunque empiece por "Control", "Uso", "Valoración", etc.
    lineas = _lineas_clinicas(texto)
    capturando = False
    candidatos = []
    encontro_campo_puro = False
    for linea in lineas:
        n = normalizar_etiqueta(linea)
        if re.match(r"^OBSERVACIONES?\s*[:|]", linea, flags=re.IGNORECASE):
            encontro_campo_puro = True
            capturando = True
            resto = re.split(r"[:|]", linea, maxsplit=1)[1].strip() if re.search(r"[:|]", linea) else ""
            if resto:
                candidatos.append(resto)
            continue
        if n in {"OBSERVACIONES", "OBSERVACION", "OBSERVACIONES GENERALES", "OBSERVACIONES MEDICAS"}:
            encontro_campo_puro = True
            capturando = True
            continue
        if capturando:
            if any(x in n for x in _CORTES_OBSERVACIONES_V6):
                break
            seccion, _ = _detectar_seccion(linea)
            if seccion and seccion != "observaciones":
                break
            candidatos.extend(_columnas_v6(linea) or [linea])

    if encontro_campo_puro:
        limpios = []
        for item in candidatos:
            limpio = recortar_contenido_legal(item).strip(" •-_:;,./")
            if limpio:
                limpios.append(limpio)
        norm_total = normalizar_etiqueta(" ".join(limpios))
        if not limpios or norm_total in _NEGACIONES_CLINICAS or any(x == norm_total for x in ["NO APLICA", "SIN OBSERVACIONES"]):
            return "Ninguna."
        return a_caso_oracion(" ".join(deduplicar_textos(limpios)))

    # Para «OTRAS OBSERVACIONES Y RECOMENDACIONES» usa solo la parte descriptiva
    # que ya separó el parser de recomendaciones.
    candidatos = list(observaciones_extra or [])
    return a_caso_oracion(" ".join(deduplicar_textos(candidatos))) if candidatos else ""


def extraer_remisiones_robustas(texto):
    lineas = _lineas_clinicas(texto)
    capturando = False
    encontro_seccion = False
    partes = []
    for linea in lineas:
        n = normalizar_etiqueta(linea)
        seccion, resto = _detectar_seccion(linea)
        if seccion == "remisiones":
            capturando = True
            encontro_seccion = True
            if resto:
                partes.extend(_columnas_v6(resto) or [resto])
            continue
        if capturando:
            if any(x in n for x in _CORTES_REMISIONES_V6):
                break
            if seccion and seccion != "remisiones":
                break
            partes.extend(_columnas_v6(linea) or [linea])

    if encontro_seccion:
        limpios = []
        for item in partes:
            limpio = recortar_contenido_legal(item).strip(" •-_:;,./")
            nl = normalizar_etiqueta(limpio)
            if not limpio or nl in _NEGACIONES_CLINICAS:
                continue
            tokens = set(re.findall(r"[A-Z]+", nl))
            if tokens and tokens.issubset({"SI","NO","X","NA","APLICA","REQUIERE","REMISION","REMISIONES"}):
                continue
            limpios.append(limpio)
        if limpios:
            return a_caso_oracion("; ".join(deduplicar_textos(limpios)))
        return "No"

    # Respaldo global solo con verbos inequívocos.
    patrones = [
        r"(?i)\b(?:SE\s+)?REMITE\s+(?:A|POR)\s+([^\n.;]{3,120})",
        r"(?i)\bREMISI[ÓO]N\s+(?:A|POR)\s+([^\n.;]{3,120})",
        r"(?i)\bINTERCONSULTA\s+(?:A|POR|CON)\s+([^\n.;]{3,120})",
        r"(?i)\bREMITIR\s+(?:A|POR)\s+([^\n.;]{3,120})",
    ]
    hallados = []
    for patron in patrones:
        for m in re.finditer(patron, str(texto or "")):
            candidato = recortar_en_siguiente_etiqueta(m.group(1)).strip(" •-_:;,./")
            if candidato and not es_vacio_o_estado(candidato):
                hallados.append(candidato)
    return a_caso_oracion("; ".join(deduplicar_textos(hallados))) if hallados else "No"


def extraer_programas_vigilancia_robusto(texto):
    lineas = _lineas_clinicas(texto)
    candidatos = []
    capturando = False
    for linea in lineas:
        n = normalizar_etiqueta(linea)
        seccion, resto = _detectar_seccion(linea)
        if seccion == "vigilancia":
            capturando = True
            if resto:
                candidatos.append((resto, True))
            continue
        if capturando:
            if seccion and seccion != "vigilancia":
                capturando = False
            elif any(x in n for x in ["INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "REMISIONES", "FIRMA DEL", "CONSENTIMIENTO"]):
                capturando = False
            else:
                candidatos.append((linea, True))
        # Mención explícita PVE/SVE fuera de la sección, por ejemplo «SVE VISUAL: ...».
        if not capturando and re.search(r"\b(?:PVE|SVE)\b", n):
            candidatos.append((linea, False))

    encontrados = []
    for candidato, en_seccion in candidatos:
        n = normalizar_etiqueta(candidato)
        if not n:
            continue
        negacion_global = any(frase in n for frase in ["NO INGRESA", "NO INGRESAR", "NO REQUIERE INGRESO", "NO APLICA", "NINGUNO"])
        for kw, nombre in SVE_CLINICAL_KEYWORDS.items():
            nkw = normalizar_etiqueta(kw)
            pos = n.find(nkw)
            if pos < 0:
                continue
            despues = n[pos + len(nkw): pos + len(nkw) + 28]
            antes = n[max(0, pos - 20):pos]
            negada_fila = bool(re.search(r"^\s*[:=-]?\s*(?:NO|NO APLICA|N A)\b", despues)) or bool(re.search(r"\b(?:NO|NO APLICA)\s*[:=-]?\s*$", antes))
            marcador = bool(re.search(r"\b(?:PVE|SVE)\b", n))
            # Dentro del bloque «Ingresar al Programa...» el nombre de programa en una fila ya es evidencia;
            # fuera del bloque se exige PVE/SVE o verbo explícito.
            verbo = any(v in n for v in ["INGRESAR", "INGRESA", "INGRESO", "INCLUIR", "CONTINUAR", "PERTENECE"])
            positivo = (en_seccion or marcador or verbo) and not negada_fila and not negacion_global
            if positivo and nombre not in encontrados:
                encontrados.append(nombre)
        # Conserva nombres de programa no catalogados si están inequívocamente dentro de la sección.
        if en_seccion and not negacion_global:
            cols = _columnas_v6(candidato) or [candidato]
            for col in cols:
                nc = normalizar_etiqueta(col)
                if nc in {"PVE", "SVE", "SI", "SÍ", "X", "INGRESA"} or _es_estado_examen_v6(col):
                    continue
                if any(normalizar_etiqueta(k) in nc for k in SVE_CLINICAL_KEYWORDS):
                    continue
                if 1 <= len(nc.split()) <= 6 and not any(x in nc for x in ["PROGRAMA", "VIGILANCIA", "PREVENCION Y PROMOCION", "INGRESAR AL"]):
                    # Solo se conserva si la fila también trae un marcador PVE/SVE/SI.
                    if re.search(r"\b(?:PVE|SVE|SI|SÍ)\b", n):
                        encontrados.append(a_caso_oracion(col))
    return ", ".join(deduplicar_textos(encontrados)) if encontrados else "Ninguno"


def detectar_perfil_documental_v6(texto):
    n = normalizar_etiqueta(texto)
    if "EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS" in n and "RECOMENDACIONES" in n:
        return "Tabla examen → recomendación"
    if all(x in n for x in ["RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES"]) and any(x in n for x in ["HABITOS Y ESTILO DE VIDA", "HABITOS SALUDABLES"]):
        return "Matriz de exámenes + columnas de recomendaciones"
    if "EXAMENES" in n and "RECOMENDACIONES" in n:
        return "Secciones clínicas combinadas"
    return "Secciones clínicas genéricas"


def evaluar_calidad_extraccion(datos, texto):
    campos = []
    n = normalizar_etiqueta(texto)
    if not datos.get("nombre"):
        campos.append("nombre")
    if not datos.get("cargo"):
        campos.append("cargo")
    if not datos.get("examenes_lista"):
        campos.append("exámenes realizados")
    hay_seccion_rec = "RECOMEND" in n or "EXAMENES DE DIAGNOSTICO LABORAL REALIZADOS" in n
    if hay_seccion_rec and not any((datos.get("recomendaciones_por_examen") or {}).values()):
        campos.append("recomendaciones")
    if "OBSERVACION" in n and not str(datos.get("observaciones", "")).strip():
        campos.append("observaciones")
    if "REMISION" in n and str(datos.get("remisiones", "No")).strip().lower() in {"", "no", "ninguna", "ninguno"}:
        # Si hay una sección de remisiones con contenido textual positivo, exige revisión.
        rem = normalizar_etiqueta(_contenido_seccion(texto, "remisiones"))
        if rem and rem not in _NEGACIONES_CLINICAS and not any(x in rem for x in ["NO REQUIERE", "SIN REMISION", "NO APLICA", "NINGUNA", "NINGUNO"]):
            campos.append("remisiones")
    if ("VIGILANCIA" in n or " PVE " in f" {n} " or " SVE " in f" {n} ") and normalizar_etiqueta(datos.get("vigilancia_programa", "")) in {"", "NINGUNO", "NINGUNA"}:
        vig = normalizar_etiqueta(_contenido_seccion(texto, "vigilancia"))
        if vig and not any(x in vig for x in ["NO INGRESA", "NO REQUIERE", "NO APLICA", "NINGUNO"]):
            campos.append("vigilancia epidemiológica")
    campos = list(dict.fromkeys(campos))
    calidad = "Alta" if not campos else ("Media" if len(campos) <= 2 else "Revisar")
    return calidad, campos

def analizar_pdf_inteligente(texto, metadatos_pdf=None):
    datos = {
        "nombre": "", "cargo": "", "tipo_examen": "PERIODICO",
        "identificacion": "", "correo": "", "examenes_lista": [],
        "recomendaciones_lista": [], "recomendaciones_por_examen": {},
        "recomendaciones_pendientes_revision": [], "vigilancia_lista": [],
        "observaciones": "", "remisiones": "No", "consecutivo": "",
        "vigilancia_programa": "Ninguno", "lugar": "Tunja",
        "fecha": datetime.date.today(), "calidad_extraccion": "Revisar", "campos_revision": []
    }
    texto = str(texto or "")
    if not texto.strip():
        return datos

    contacto = extraer_identificacion_correo(texto)
    datos.update({k: v for k, v in contacto.items() if v})

    meta_conocida = extraer_metadatos_formatos_conocidos(texto)
    for k, v in meta_conocida.items():
        if v: datos[k] = v

    identidad = extraer_identidad_cargo_lugar(texto)
    for k in ["nombre", "cargo", "lugar", "fecha"]:
        actual = datos.get(k)
        es_default = ((k == "lugar" and actual == "Tunja") or (k == "fecha" and actual == datetime.date.today())) and k not in meta_conocida
        if (not actual or es_default) and identidad.get(k):
            datos[k] = identidad[k]

    metadatos_pdf = metadatos_pdf or {}
    for k in ["nombre", "cargo", "lugar", "fecha"]:
        if not datos.get(k) and metadatos_pdf.get(k):
            datos[k] = metadatos_pdf[k]

    tipo_patrones = [
        (r"\bPOST[ -]?INCAPACIDAD\b", "POST INCAPACIDAD"),
        (r"\bCAMBIO\s+DE\s+CARGO\b", "CAMBIO DE CARGO"),
        (r"\b(?:EGRESO|RETIRO)\b", "EGRESO"),
        (r"\bINGRESO\b", "INGRESO"),
        (r"\b(?:PERIODICO|PERIÓDICO|CONTROL PERIODICO|CONTROL PERIÓDICO)\b", "PERIODICO"),
    ]
    norm_texto = normalizar_etiqueta(texto)
    for patron, valor in tipo_patrones:
        if re.search(patron, norm_texto, re.IGNORECASE):
            datos["tipo_examen"] = valor
            break

    bloques = extraer_bloques_clinicos(texto)
    examenes = extraer_examenes_globales(texto)
    for linea in bloques.get("examenes") or []:
        examen, _, _, _ = _detectar_examen(linea)
        if examen and examen not in examenes:
            examenes.append(examen)
        # Una misma línea puede tener varios exámenes en columnas.
        linea_norm = normalizar_etiqueta(linea)
        for clave, canonico in EXAMS_MAP.items():
            if normalizar_etiqueta(clave) in linea_norm and canonico not in examenes:
                examenes.append(canonico)

    examenes, mapa, obs_extra = extraer_recomendaciones_por_examen_robusto(texto, examenes)
    if not any(mapa.values()):
        respaldo = extraer_recomendaciones_genericas(texto)
        mapa = agrupar_recomendaciones_por_examen(examenes, respaldo, mapa)

    datos["examenes_lista"] = normalizar_lista_clinica(examenes)
    datos["recomendaciones_por_examen"] = mapa
    datos["recomendaciones_lista"] = aplanar_recomendaciones_por_examen(mapa)

    # Detecta únicamente fragmentos realmente truncados; no penaliza exámenes sin recomendación.
    _, pendientes = separar_recomendaciones_atomicas(datos["recomendaciones_lista"])
    datos["recomendaciones_pendientes_revision"] = pendientes

    datos["observaciones"] = extraer_observaciones_robustas(texto, obs_extra)
    datos["remisiones"] = extraer_remisiones_robustas(texto)
    datos["vigilancia_programa"] = extraer_programas_vigilancia_robusto(texto)
    datos["vigilancia_lista"] = [x.strip() for x in datos["vigilancia_programa"].split(",") if x.strip() and normalizar_etiqueta(x) != "NINGUNO"]
    datos["perfil_documental"] = detectar_perfil_documental_v6(texto)
    datos["modo_validacion"] = "Motor clínico V6 · estructura y columnas"

    datos = normalizar_datos_documento(datos)
    calidad, campos = evaluar_calidad_extraccion(datos, texto)
    datos["calidad_extraccion"] = calidad
    datos["campos_revision"] = campos
    return datos



def analizar_json(texto):
    datos = analizar_pdf_inteligente(str(texto or ""), None)
    if isinstance(datos.get("fecha"), (datetime.date, datetime.datetime)):
        datos["fecha"] = datos["fecha"].isoformat()
    return json.dumps(datos, ensure_ascii=False)

def fusionar_json(datos_locales_json, datos_ia_json, texto_fuente):
    locales = json.loads(datos_locales_json) if isinstance(datos_locales_json, str) else datos_locales_json
    ia = json.loads(datos_ia_json) if isinstance(datos_ia_json, str) else datos_ia_json
    if isinstance(locales.get("fecha"), str):
        try: locales["fecha"] = datetime.datetime.strptime(locales["fecha"], "%Y-%m-%d").date()
        except Exception: pass
    datos = fusionar_validacion_ia(locales, ia, str(texto_fuente or ""))
    if isinstance(datos.get("fecha"), (datetime.date, datetime.datetime)):
        datos["fecha"] = datos["fecha"].isoformat()
    return json.dumps(datos, ensure_ascii=False)

# -----------------------------------------------------------------------------
# Motor clínico V7: doble formato + enriquecimiento conservador por examen.
# Objetivos:
# - conservar íntegro el detalle de recomendaciones;
# - mapear recomendaciones generales al examen solo cuando hay evidencia semántica fuerte;
# - mantener generales las recomendaciones transversales;
# - garantizar una entrada para cada examen realizado.
# -----------------------------------------------------------------------------

_ANALIZAR_PDF_V6 = analizar_pdf_inteligente
_FUSIONAR_IA_V6 = fusionar_validacion_ia

_SEMANTICA_EXAMEN_V7 = {
    "OPTOMETRIA": {
        "strong": ["OPTOMETR", "EXAMEN VISUAL", "CONTROL VISUAL", "AGUDEZA VISUAL", "RX OPTICA", "CORRECCION OPTICA", "CORRECCIÓN ÓPTICA", "GAFAS", "ASTIGMAT", "PRESBIC", "VISION", "VISIÓN"],
        "weak": ["VISUAL", "OCULAR", "OPTICA", "ÓPTICA"]
    },
    "AUDIOMETRIA": {
        "strong": ["AUDIOMETR", "PROTECCION AUDITIVA", "PROTECCIÓN AUDITIVA", "CONTROL AUDITIVO", "HIPOACUS", "AUDITIV"],
        "weak": ["RUIDO", "OIDO", "OÍDO"]
    },
    "ESPIROMETRIA": {
        "strong": ["ESPIROMETR", "CONTROL RESPIRATORIO", "VALORACION RESPIRATORIA", "VALORACIÓN RESPIRATORIA"],
        "weak": ["RESPIRATOR", "PULMON", "PULMÓN"]
    },
    "OSTEOMUSCULAR": {
        "strong": ["OSTEOMUSC", "MUSCULOESQUELET", "ORTOPEDIA", "HIGIENE POSTURAL", "ERGONOMIC", "ERGONÓMIC", "FORTALECIMIENTO DE ESPALDA", "PAUSAS ACTIVAS"],
        "weak": ["ESPALDA", "POSTURAL", "COLUMNA", "ARTICULAR", "MUSCULAR"]
    },
    "ELECTROCARDIOGRAMA": {
        "strong": ["ELECTROCARDIO", "CONTROL CARDIOLOG", "VALORACION CARDIOLOG", "VALORACIÓN CARDIOLOG"],
        "weak": ["CARDIOVASCULAR", "CARDIACO", "CARDÍACO", "RITMO CARDIACO", "RITMO CARDÍACO"]
    },
    "GLICEMIA": {
        "strong": ["GLICEM", "GLUCOSA"],
        "weak": []
    },
    "PERFIL LIPIDICO": {
        "strong": ["PERFIL LIPID", "COLESTEROL", "TRIGLICER"],
        "weak": []
    },
}

_RECOMENDACIONES_TRANSVERSALES_V7 = [
    "USO DE EPP", "EPP", "HABITOS SALUDABLES", "HÁBITOS SALUDABLES",
    "CONTROL DE PESO", "HACER DEPORTE", "DIETA BALANCEADA", "ACTIVIDAD FISICA",
    "ACTIVIDAD FÍSICA", "ALIMENTACION SALUDABLE", "ALIMENTACIÓN SALUDABLE"
]


def _familia_examen_v7(examen):
    n = normalizar_etiqueta(examen)
    if "OPTOMETR" in n or "VISUAL" in n: return "OPTOMETRIA"
    if "AUDIOMETR" in n or "AUDITIV" in n: return "AUDIOMETRIA"
    if "ESPIROMETR" in n or "RESPIRATOR" in n: return "ESPIROMETRIA"
    if any(x in n for x in ["OSTEOMUSC", "MUSCULOESQUELET", "ENFASIS OSTEOMUSCULAR", "ÉNFASIS OSTEOMUSCULAR"]): return "OSTEOMUSCULAR"
    if "ELECTROCARD" in n or "CARDIO" in n: return "ELECTROCARDIOGRAMA"
    if "GLICEM" in n: return "GLICEMIA"
    if "LIPID" in n: return "PERFIL LIPIDICO"
    return ""


def _recomendacion_transversal_v7(recomendacion):
    n = normalizar_etiqueta(recomendacion)
    if not n: return True
    return any(n == normalizar_etiqueta(x) or n.startswith(normalizar_etiqueta(x) + " ") for x in _RECOMENDACIONES_TRANSVERSALES_V7)


def _puntaje_semantico_examen_v7(recomendacion, examen):
    n = normalizar_etiqueta(recomendacion)
    familia = _familia_examen_v7(examen)
    if not n or not familia or _recomendacion_transversal_v7(recomendacion):
        return 0
    cfg = _SEMANTICA_EXAMEN_V7.get(familia, {})
    score = 0
    strong_hits = sum(1 for k in cfg.get("strong", []) if normalizar_etiqueta(k) in n)
    weak_hits = sum(1 for k in cfg.get("weak", []) if normalizar_etiqueta(k) in n)
    score += strong_hits * 4 + weak_hits
    # Una mención literal del nombre/familia del examen es evidencia fuerte.
    ex_norm = normalizar_etiqueta(examen)
    if ex_norm and ex_norm in n:
        score += 5
    # Evita que una simple recomendación transversal se enrute por una palabra secundaria.
    if len(n.split()) <= 3 and not strong_hits:
        score = 0
    return score


def enriquecer_recomendaciones_por_examen_v7(datos, texto_fuente=""):
    datos = dict(datos or {})
    examenes = normalizar_lista_clinica(datos.get("examenes_lista", []) or [])
    mapa = agrupar_recomendaciones_por_examen(
        examenes,
        datos.get("recomendaciones_lista", []) or [],
        datos.get("recomendaciones_por_examen", {}) or {}
    )
    generales = list(mapa.get("Recomendaciones generales", []) or [])
    mapa.pop("Recomendaciones generales", None)
    for examen in examenes:
        mapa.setdefault(examen, [])

    generales_restantes = []
    asociaciones = []
    for rec in generales:
        puntuados = sorted(
            [(_puntaje_semantico_examen_v7(rec, examen), examen) for examen in examenes],
            key=lambda x: x[0], reverse=True
        )
        mejor_score, mejor_examen = puntuados[0] if puntuados else (0, "")
        segundo_score = puntuados[1][0] if len(puntuados) > 1 else 0
        # Umbral alto y margen frente al segundo candidato: evita asociaciones ambiguas.
        if mejor_score >= 4 and mejor_score >= segundo_score + 2:
            mapa.setdefault(mejor_examen, []).append(rec)
            asociaciones.append({"examen": mejor_examen, "recomendacion": rec, "fuente": "semantica_documental", "puntaje": mejor_score})
        else:
            generales_restantes.append(rec)

    # Deduplicación final sin resumir ni reescribir el contenido.
    for examen in list(mapa):
        mapa[examen] = normalizar_lista_clinica(deduplicar_textos(mapa[examen]), cerrar_con_punto=True)
    if generales_restantes:
        mapa["Recomendaciones generales"] = normalizar_lista_clinica(deduplicar_textos(generales_restantes), cerrar_con_punto=True)

    datos["recomendaciones_por_examen"] = mapa
    datos["recomendaciones_lista"] = aplanar_recomendaciones_por_examen(mapa)
    datos["asociaciones_recomendaciones_v7"] = asociaciones
    datos["cobertura_recomendaciones"] = {
        "examenes": len(examenes),
        "con_recomendacion": sum(1 for examen in examenes if mapa.get(examen)),
        "generales": len(mapa.get("Recomendaciones generales", []) or [])
    }
    return datos


def analizar_pdf_inteligente(texto, metadatos_pdf=None):
    datos = _ANALIZAR_PDF_V6(texto, metadatos_pdf)
    datos = enriquecer_recomendaciones_por_examen_v7(datos, texto)
    datos["modo_validacion"] = "Motor clínico V7 · doble formato + relaciones por examen"
    # V7 no considera un examen sin recomendación como error por sí solo, pero sí conserva
    # cualquier alerta estructural real detectada por el motor anterior.
    calidad, campos = evaluar_calidad_extraccion(datos, texto)
    datos["calidad_extraccion"] = calidad
    datos["campos_revision"] = campos
    return datos


def deduplicar_mapa_recomendaciones_global(mapa):
    """Evita que la misma recomendación aparezca bajo varios exámenes.
    Prioriza asociaciones específicas y deja las generales al final.
    """
    if not isinstance(mapa, dict):
        return mapa or {}
    salida = {}
    vistos = set()
    items = list(mapa.items())
    items.sort(key=lambda kv: 1 if normalizar_etiqueta(kv[0]) == "RECOMENDACIONES GENERALES" else 0)
    for examen, recs in items:
        limpias = []
        for rec in recs or []:
            firma = normalizar_etiqueta(rec)
            if not firma or firma in vistos or firma in {"REALIZADO", "REALIZADA", "NORMAL", "NO APLICA", "N A"}:
                continue
            vistos.add(firma)
            limpias.append(rec)
        if limpias:
            salida[examen] = limpias
        elif normalizar_etiqueta(examen) != "RECOMENDACIONES GENERALES":
            salida.setdefault(examen, [])
    return salida


def _evidencia_vincula_examen(examen, recomendacion, evidencias):
    exn = normalizar_etiqueta(examen)
    tokens = [t for t in exn.split() if len(t) >= 5 and t not in {"EXAMEN", "MEDICO", "CLINICO", "ENFASIS"}]
    if not tokens:
        tokens = [t for t in exn.split() if len(t) >= 4]
    for evidencia in evidencias or []:
        evn = normalizar_etiqueta(evidencia)
        if not any(t in evn for t in tokens):
            continue
        if texto_soportado_por_fuente(recomendacion, evidencia, 0.30) or texto_soportado_por_fuente(evidencia, recomendacion, 0.30):
            return True
    return False


def fusionar_validacion_ia(datos_locales, datos_ia, texto_fuente):
    # La fusión V6 sigue siendo la barrera contra alucinaciones. V7 añade luego un
    # enrutamiento semántico conservador sobre recomendaciones generales verificadas.
    resultado = _FUSIONAR_IA_V6(datos_locales, datos_ia, texto_fuente)
    resultado = enriquecer_recomendaciones_por_examen_v7(resultado, texto_fuente)
    resultado["validado_ia"] = True
    resultado["modo_validacion"] = "IA visual V7 auditada + motor clínico de doble formato"
    calidad, campos = evaluar_calidad_extraccion(resultado, texto_fuente)
    resultado["calidad_extraccion"] = calidad
    resultado["campos_revision"] = campos
    return resultado

# -----------------------------------------------------------------------------
# Motor clínico V8: reparación de filas colapsadas y secciones críticas.
# Motivo: algunos proveedores entregan PDFs donde PDF.js/OCR conserva la fila
# pero no la frontera de columna. En esos casos se ve, por ejemplo:
#   OPTOMETRIA CONTROL ANUAL // USO DE RX OPTICA // PAUSAS ACTIVAS VISUALES
# V7 detectaba el examen pero perdía el texto de la celda derecha.
# -----------------------------------------------------------------------------
import unicodedata as _unicodedata_v8

_ANALIZAR_PDF_V7 = analizar_pdf_inteligente
_FUSIONAR_IA_V7 = fusionar_validacion_ia


def _fold_keep_positions_v8(value):
    """Mayúsculas sin tildes conservando, en la práctica, los índices del texto latino."""
    raw = str(value or "")
    return "".join(
        ch for ch in _unicodedata_v8.normalize("NFD", raw)
        if _unicodedata_v8.category(ch) != "Mn"
    ).upper()


def _exam_prefix_match_v8(linea):
    """Devuelve (examen canónico, resto original) solo si el examen inicia la fila."""
    raw = str(linea or "")
    folded = _fold_keep_positions_v8(raw)
    for alias, canonico in sorted(EXAMS_MAP.items(), key=lambda kv: len(_fold_keep_positions_v8(kv[0])), reverse=True):
        a = _fold_keep_positions_v8(alias)
        patron = r"^\s*" + re.escape(a).replace(r"\ ", r"\s+") + r"(?=\s|[:|/\-]|$)"
        m = re.search(patron, folded)
        if not m:
            continue
        resto = raw[m.end():].strip(" \t:|/–—-_,.;")
        return canonico, resto
    return "", ""


def _normalizar_estado_examen_v8(value):
    n = normalizar_etiqueta(value)
    if re.match(r"^REALIZAD", n): return "Realizado"
    if n == "NORMAL": return "Normal"
    if n in {"APTO", "CUMPLE", "SI", "SÍ", "OK"}: return a_caso_oracion(value)
    if n in {"NO", "NO APLICA", "N A", "NA"}: return a_caso_oracion(value)
    return a_caso_oracion(value)


def _append_full_recommendation_v8(mapa, examen, texto, join_previous=False):
    texto = recortar_contenido_legal(str(texto or "")).strip(" •\t:|/–—-_,.;")
    if not texto or _es_estado_examen_v6(texto):
        return
    # Mantiene TODO el texto; solo normaliza los separadores // a puntuación legible.
    texto = re.sub(r"\s*//+\s*", "; ", texto)
    texto = re.sub(r"\s{2,}", " ", texto).strip()
    if not texto:
        return
    mapa.setdefault(examen, [])
    if join_previous and mapa[examen]:
        previo = mapa[examen][-1].rstrip()
        if previo and not re.search(r"[.!?;:]$", previo):
            previo += " "
        else:
            previo += " "
        mapa[examen][-1] = (previo + texto).strip()
    else:
        mapa[examen].append(texto)


def _repair_exam_rows_v8(texto, datos):
    """Repara tablas examen→recomendación cuando las columnas llegaron fusionadas."""
    lineas = _lineas_clinicas(texto)
    examenes = normalizar_lista_clinica(datos.get("examenes_lista", []) or [])
    mapa_actual = datos.get("recomendaciones_por_examen", {}) or {}
    if isinstance(mapa_actual, list):
        mapa_actual = {
            str(x.get("examen") or ""): list(x.get("recomendaciones") or [])
            for x in mapa_actual if isinstance(x, dict) and x.get("examen")
        }
    mapa = {str(k): list(v or []) for k, v in mapa_actual.items()}
    estados = dict(datos.get("estado_por_examen", {}) or {})
    for ex in examenes:
        mapa.setdefault(ex, [])

    activa = False
    ultimo_examen = ""
    explicit_rows = 0
    perfil = str(datos.get("perfil_documental", "") or "")
    # Señal de formato B aun si el encabezado llegó dañado: al menos dos filas
    # comienzan por examen y continúan con recomendación/estado, sin otro examen
    # pegado inmediatamente a la derecha (caso de la matriz del formato A).
    candidatas_b = 0
    for _linea in lineas:
        _ex, _resto = _exam_prefix_match_v8(_linea)
        if not _ex or not _resto:
            continue
        _ex2, _pos2, _, _ = _detectar_examen(_resto)
        if _ex2 and 0 <= _pos2 <= 15:
            continue
        if _es_estado_examen_v6(_resto) or _es_recomendacion_probable(_resto):
            candidatas_b += 1
    formato_b_probable = "TABLA EXAMEN" in normalizar_etiqueta(perfil) or candidatas_b >= 2
    stop_terms = [
        "CONCEPTO LABORAL", "CONCEPTO DE APTITUD", "OBSERVACIONES", "TIPO DE RESTRICCION",
        "TIPO DE RESTRICCIÓN", "INGRESAR AL PROGRAMA", "INFORMACION DE REMISIONES",
        "INFORMACIÓN DE REMISIONES", "RECOMENDACIONES MEDICAS", "RECOMENDACIONES MÉDICAS",
        "RECOMENDACIONES OCUPACIONALES", "HABITOS Y ESTILO", "HÁBITOS Y ESTILO"
    ]

    for linea in lineas:
        n = normalizar_etiqueta(linea)
        if ("EXAMENES" in n and "REALIZAD" in n and "RECOMEND" in n) or (
            "DIAGNOSTICO LABORAL" in n and "RECOMEND" in n
        ):
            activa = True
            ultimo_examen = ""
            continue
        if activa and any(x in n for x in stop_terms):
            activa = False
            ultimo_examen = ""

        ex, resto = _exam_prefix_match_v8(linea)
        if ex:
            # Fuera del bloque combinado solo repara si el documento realmente se comporta
            # como tabla examen→recomendación. Esto evita convertir la matriz de exámenes
            # del formato A en recomendaciones falsas.
            if not activa and not formato_b_probable:
                continue
            # Una fila del formato A puede contener dos exámenes lado a lado y ninguna recomendación.
            segundo_ex, segundo_resto = _exam_prefix_match_v8(resto) if resto else ("", "")
            if segundo_ex and (not segundo_resto or _es_estado_examen_v6(segundo_resto)):
                for candidato in [ex, segundo_ex]:
                    canon = canonizar_nombre_examen(candidato, examenes)
                    if canon not in examenes: examenes.append(canon)
                    mapa.setdefault(canon, [])
                if segundo_resto and _es_estado_examen_v6(segundo_resto):
                    estados[canonizar_nombre_examen(segundo_ex, examenes)] = _normalizar_estado_examen_v8(segundo_resto)
                ultimo_examen = ""
                continue

            canon = canonizar_nombre_examen(ex, examenes)
            if canon not in examenes: examenes.append(canon)
            mapa.setdefault(canon, [])
            # Acepta una fila explícita incluso si el encabezado de tabla se perdió por OCR.
            if activa or resto or "\t" in linea:
                explicit_rows += 1
                ultimo_examen = canon
                if resto:
                    if _es_estado_examen_v6(resto):
                        estados[canon] = _normalizar_estado_examen_v8(resto)
                    else:
                        _append_full_recommendation_v8(mapa, canon, resto)
                continue

        # Continuación visual de una recomendación larga en la línea siguiente.
        if activa and ultimo_examen and linea and not _detectar_seccion(linea)[0]:
            if not _exam_prefix_match_v8(linea)[0] and not _es_estado_examen_v6(linea):
                nn = normalizar_etiqueta(linea)
                if not any(x in nn for x in stop_terms) and len(nn.split()) >= 2:
                    _append_full_recommendation_v8(mapa, ultimo_examen, linea, join_previous=True)

    # Las filas explícitas del certificado prevalecen sobre una asociación semántica vacía/ambigua.
    for ex in list(mapa):
        mapa[ex] = normalizar_lista_clinica(deduplicar_textos(mapa[ex]), cerrar_con_punto=True)
    datos["examenes_lista"] = normalizar_lista_clinica(examenes)
    datos["recomendaciones_por_examen"] = agrupar_recomendaciones_por_examen(datos["examenes_lista"], [], mapa)
    datos["recomendaciones_lista"] = aplanar_recomendaciones_por_examen(datos["recomendaciones_por_examen"])
    datos["estado_por_examen"] = estados
    datos["filas_examen_recomendacion_v8"] = explicit_rows
    return datos


def _strip_section_prefix_v8(linea, prefixes):
    raw = str(linea or "").strip()
    folded = _fold_keep_positions_v8(raw)
    for prefix in sorted(prefixes, key=len, reverse=True):
        p = _fold_keep_positions_v8(prefix)
        m = re.match(r"^\s*" + re.escape(p).replace(r"\ ", r"\s+"), folded)
        if m:
            return raw[m.end():].lstrip(" \t:|/–—-_,.;")
    return ""


def _repair_observations_v8(texto, datos):
    lineas = _lineas_clinicas(texto)
    out = []
    capt = False
    for linea in lineas:
        n = normalizar_etiqueta(linea)
        # Excluye el encabezado mixto, que requiere separación distinta.
        if n.startswith("OBSERVACIONES") and not n.startswith("OBSERVACIONES Y RECOMENDACIONES"):
            capt = True
            tail = _strip_section_prefix_v8(linea, ["OBSERVACIONES GENERALES", "OBSERVACIONES MEDICAS", "OBSERVACIONES"])
            if tail: out.append(tail)
            continue
        if capt:
            if any(x in n for x in [
                "TIPO DE RESTRICCION", "TIPO DE RESTRICCIÓN", "INGRESAR AL PROGRAMA",
                "VIGILANCIA EPIDEMIOLOGICA", "INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES",
                "REMISIONES", "FIRMA", "CONSENTIMIENTO"
            ]):
                break
            sec, _ = _detectar_seccion(linea)
            if sec and sec != "observaciones":
                break
            if linea.strip(): out.append(linea.strip())
    if out:
        limpio = " ".join(deduplicar_textos([recortar_contenido_legal(x).strip(" •-_:;,./") for x in out if x.strip()])).strip()
        n = normalizar_etiqueta(limpio)
        if not limpio or n in _NEGACIONES_CLINICAS or n in {"NO APLICA", "SIN OBSERVACIONES"}:
            datos["observaciones"] = "Ninguna."
        else:
            # Conserva acrónimos/capitalización de la fuente en vez de convertir todo a título.
            datos["observaciones"] = limpio
    return datos


def _repair_referrals_v8(texto, datos):
    lineas = _lineas_clinicas(texto)
    capt = False
    found_header = False
    out = []
    prefixes = ["INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "INFORMACION DE REMISION", "REMISIONES", "REMISION"]
    for linea in lineas:
        n = normalizar_etiqueta(linea)
        if any(n.startswith(normalizar_etiqueta(p)) for p in prefixes):
            capt = True; found_header = True
            tail = _strip_section_prefix_v8(linea, prefixes)
            if tail: out.append(tail)
            continue
        if capt:
            if any(x in n for x in ["FIRMA", "CONSENTIMIENTO", "AUTORIZACION", "AUTORIZACIÓN", "RECOMENDACIONES"]):
                break
            sec, _ = _detectar_seccion(linea)
            if sec and sec != "remisiones": break
            if linea.strip(): out.append(linea.strip())
    if found_header:
        clean = []
        for item in out:
            item = recortar_contenido_legal(item).strip(" •-_:;,./")
            ni = normalizar_etiqueta(item)
            if not item or ni in _NEGACIONES_CLINICAS: continue
            if set(re.findall(r"[A-Z]+", ni)).issubset({"SI","NO","X","NA","APLICA","REQUIERE"}): continue
            clean.append(item)
        datos["remisiones"] = "; ".join(deduplicar_textos(clean)) if clean else "No"
    return datos


def _repair_surveillance_v8(texto, datos):
    lineas = _lineas_clinicas(texto)
    encontrados = []
    in_block = False
    for i, linea in enumerate(lineas):
        n = normalizar_etiqueta(linea)
        if any(x in n for x in [
            "INGRESAR AL PROGRAMA DE VIGILANCIA", "PROGRAMA DE VIGILANCIA EPIDEMIOLOGICA",
            "PROGRAMA DE PREVENCION Y PROMOCION", "PROGRAMAS DE VIGILANCIA", "SISTEMA DE VIGILANCIA"
        ]):
            in_block = True
            continue
        if in_block and any(x in n for x in ["INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "REMISIONES", "FIRMA", "CONSENTIMIENTO"]):
            in_block = False
        marker = bool(re.search(r"\b(?:PVE|SVE)\b", n))
        if not (in_block or marker):
            continue
        if any(x in n for x in ["NO INGRESA", "NO INGRESAR", "NO APLICA", "NO REQUIERE", "NINGUNO"]):
            continue
        for kw, nombre in SVE_CLINICAL_KEYWORDS.items():
            if normalizar_etiqueta(kw) in n and nombre not in encontrados:
                encontrados.append(nombre)
    if encontrados:
        datos["vigilancia_programa"] = ", ".join(deduplicar_textos(encontrados))
        datos["vigilancia_lista"] = deduplicar_textos(encontrados)
    return datos


def _postprocess_critical_fields_v8(datos, texto):
    datos = dict(datos or {})
    datos = _repair_exam_rows_v8(texto, datos)
    datos = _repair_observations_v8(texto, datos)
    datos = _repair_referrals_v8(texto, datos)
    datos = _repair_surveillance_v8(texto, datos)
    # Recalcula cobertura y calidad tras las reparaciones de alta confianza.
    examenes = datos.get("examenes_lista", []) or []
    recmap = datos.get("recomendaciones_por_examen", {}) or {}
    datos["cobertura_recomendaciones"] = {
        "examenes": len(examenes),
        "con_recomendacion": sum(1 for ex in examenes if (recmap.get(ex) or [])),
        "solo_estado": sum(1 for ex in examenes if not (recmap.get(ex) or []) and (datos.get("estado_por_examen", {}) or {}).get(ex)),
        "generales": len(recmap.get("Recomendaciones generales", []) or [])
    }
    calidad, campos = evaluar_calidad_extraccion(datos, texto)
    # Si hay una fila explícita examen→recomendación ya reparada, no mantengas una alerta obsoleta de recomendaciones.
    if datos.get("filas_examen_recomendacion_v8", 0) and any((recmap.get(ex) or []) for ex in examenes):
        campos = [c for c in campos if normalizar_etiqueta(c) != "RECOMENDACIONES"]
        if calidad == "Revisar" and len(campos) <= 1:
            calidad = "Media"
    datos["calidad_extraccion"] = calidad
    datos["campos_revision"] = campos
    datos["modo_validacion"] = "Motor clínico V8 · filas reparadas + secciones críticas"
    return datos


def analizar_pdf_inteligente(texto, metadatos_pdf=None):
    datos = _ANALIZAR_PDF_V7(texto, metadatos_pdf)
    return _postprocess_critical_fields_v8(datos, texto)


def deduplicar_mapa_recomendaciones_global(mapa):
    """Evita que la misma recomendación aparezca bajo varios exámenes.
    Prioriza asociaciones específicas y deja las generales al final.
    """
    if not isinstance(mapa, dict):
        return mapa or {}
    salida = {}
    vistos = set()
    items = list(mapa.items())
    items.sort(key=lambda kv: 1 if normalizar_etiqueta(kv[0]) == "RECOMENDACIONES GENERALES" else 0)
    for examen, recs in items:
        limpias = []
        for rec in recs or []:
            firma = normalizar_etiqueta(rec)
            if not firma or firma in vistos or firma in {"REALIZADO", "REALIZADA", "NORMAL", "NO APLICA", "N A"}:
                continue
            vistos.add(firma)
            limpias.append(rec)
        if limpias:
            salida[examen] = limpias
        elif normalizar_etiqueta(examen) != "RECOMENDACIONES GENERALES":
            salida.setdefault(examen, [])
    return salida


def _evidencia_vincula_examen(examen, recomendacion, evidencias):
    exn = normalizar_etiqueta(examen)
    tokens = [t for t in exn.split() if len(t) >= 5 and t not in {"EXAMEN", "MEDICO", "CLINICO", "ENFASIS"}]
    if not tokens:
        tokens = [t for t in exn.split() if len(t) >= 4]
    for evidencia in evidencias or []:
        evn = normalizar_etiqueta(evidencia)
        if not any(t in evn for t in tokens):
            continue
        if texto_soportado_por_fuente(recomendacion, evidencia, 0.30) or texto_soportado_por_fuente(evidencia, recomendacion, 0.30):
            return True
    return False


def fusionar_validacion_ia(datos_locales, datos_ia, texto_fuente):
    resultado = _FUSIONAR_IA_V7(datos_locales, datos_ia, texto_fuente)
    resultado = _postprocess_critical_fields_v8(resultado, texto_fuente)
    resultado["validado_ia"] = True
    resultado["modo_validacion"] = "IA visual V8 + motor clínico con reparación estructural"
    return resultado
