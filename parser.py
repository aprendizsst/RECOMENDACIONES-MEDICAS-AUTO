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
        "PAUTAS DE CUIDADO AUDITIVO", "SIN RESTRICCIONES", "SIN ALTERACIONES"
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
        contenido = re.sub(
            r"\b(así mismo|asimismo|de igual forma|adicionalmente),\s*",
            lambda m: m.group(1) + "§ ", contenido, flags=re.IGNORECASE
        )
        contenido = re.sub(r"(^|[,;]\s*)\d+\s*[.)-]\s*", lambda m: ("|||" if m.start() == 0 else m.group(1) + "|||"), contenido)
        contenido = re.sub(r"\s*//+\s*|,\s*-\s*|\s+[–—-]\s+|\s*[•▪◦]\s*", "|||", contenido)
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
        if m_inline: candidatos.append((115, m_inline.group(1), "etiqueta en línea"))

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
        r'(?i)\bCargo\b\s*[:=\t|-]*\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s/.-]{2,60})',
        r'(?i)\bOcupaci[oó]n\b\s*[:=\t|-]*\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s/.-]{2,60})',
        r'(?i)\bPuesto\b\s*[:=\t|-]*\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s/.-]{2,60})'
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


def fusionar_validacion_ia(datos_locales, datos_ia, texto_fuente):
    """Prioriza la lectura visual completa del PDF; conserva el extractor local como respaldo."""
    resultado = dict(datos_locales)
    mapeo = {
        "nombre": "nombre", "cargo": "cargo", "tipo_examen": "tipo_examen",
        "lugar": "lugar", "identificacion": "identificacion", "correo": "correo",
        "observaciones": "observaciones", "remisiones": "remisiones"
    }
    for destino, origen in mapeo.items():
        candidato = str(datos_ia.get(origen, "") or "").strip()
        if candidato:
            resultado[destino] = a_caso_oracion(candidato) if destino in {"observaciones", "remisiones"} else candidato

    examenes_ia = deduplicar_textos(datos_ia.get("examenes_realizados", []))
    recomendaciones_ia = filtrar_recomendaciones_clinicas(
        deduplicar_textos(datos_ia.get("recomendaciones_medicas", []))
    )
    if examenes_ia:
        resultado["examenes_lista"] = examenes_ia
    if recomendaciones_ia:
        resultado["recomendaciones_lista"] = recomendaciones_ia
    mapa_ia = agrupar_recomendaciones_por_examen(
        examenes_ia or resultado.get("examenes_lista", []),
        recomendaciones_ia,
        datos_ia.get("recomendaciones_por_examen", [])
    )
    if any(mapa_ia.values()):
        resultado["recomendaciones_por_examen"] = mapa_ia
    resultado["recomendaciones_pendientes_revision"] = deduplicar_textos(
        datos_ia.get("_fragmentos_pendientes", [])
    )
    programas = deduplicar_textos(datos_ia.get("vigilancia_programa", []))
    if programas:
        resultado["vigilancia_programa"] = ", ".join(programas)

    fecha_ia = str(datos_ia.get("fecha", "") or "").strip()
    if fecha_ia and re.fullmatch(r"20\d{2}-\d{2}-\d{2}", fecha_ia):
        try:
            resultado["fecha"] = datetime.datetime.strptime(fecha_ia, "%Y-%m-%d").date()
        except ValueError:
            pass
    resultado["validado_ia"] = True
    resultado["modelo_ia"] = datos_ia.get("_modelo_usado", "")
    resultado["segunda_revision_ia"] = bool(datos_ia.get("_segunda_revision_ia"))
    resultado["modo_validacion"] = (
        "IA automática + segunda revisión de calidad"
        if resultado["segunda_revision_ia"] else "IA automática + respaldo local"
    )
    return normalizar_datos_documento(resultado)


def analizar_pdf_inteligente(texto, metadatos_pdf=None):
    datos = {
        "nombre": "", "cargo": "", "tipo_examen": "PERIODICO",
        "identificacion": "", "correo": "",
        "examenes_lista": [], "recomendaciones_lista": [], "vigilancia_lista": [],
        "observaciones": "", "remisiones": "No", "consecutivo": "",
        "vigilancia_programa": "NINGUNO", "lugar": "Tunja", "fecha": datetime.date.today()
    }
    if not texto: return datos

    contacto = extraer_identificacion_correo(texto)
    datos.update({clave: valor for clave, valor in contacto.items() if valor})

    # 1. Extracción de Alta Prioridad
    meta_conocida = extraer_metadatos_formatos_conocidos(texto)
    for k, v in meta_conocida.items():
        if v: datos[k] = v

    # 2. Respaldo por Extractor Matricial
    identificacion = extraer_identidad_cargo_lugar(texto)
    for k in ["nombre", "cargo", "lugar", "fecha"]:
        if not datos[k] and identificacion.get(k):
            datos[k] = identificacion[k]

    metadatos_pdf = metadatos_pdf or {}
    for k in ["nombre", "cargo", "lugar", "fecha"]:
        if not datos[k] and metadatos_pdf.get(k):
            datos[k] = metadatos_pdf[k]

    for palabra in ["INGRESO", "PERIÓDICO", "PERIODICO", "EGRESO", "RETIRO", "CAMBIO DE CARGO", "POST-INCAPACIDAD", "POST INCAPACIDAD", "CONTROL PERIÓDICO"]:
        if palabra in texto.upper():
            datos["tipo_examen"] = "PERIODICO" if "PERIOD" in palabra or "CONTROL" in palabra else palabra
            break

    lineas_raw = texto.split("\n")
    examenes_detectados = []
    recoms_raw_dict = {}
    current_exam = None
    in_exams_section = True
    formato_grilla_detectado = False
    recoms_grilla_acumuladas = []

    for idx_l, linea in enumerate(lineas_raw):
        linea_limpia = limpiar_linea_ruido_lateral(linea)
        linea_upper = linea_limpia.upper().strip()
        
        if "EL CONCEPTO DE APTITUD SE DEFINIÓ A PARTIR DE LOS SIGUIENTES EXÁMENES PRACTICADOS" in linea_upper:
            for offset in range(1, 4):
                if idx_l + offset < len(lineas_raw):
                    l_sig = lineas_raw[idx_l + offset].upper()
                    for k_ex, v_ex in EXAMS_MAP.items():
                        if k_ex in l_sig and v_ex not in examenes_detectados: examenes_detectados.append(v_ex)
            continue
            
        if any(h in linea_upper for h in ["RECOMENDACIONES MÉDICAS", "RECOMENDACIONES MEDICAS", "RECOMENDACIONES OCUPACIONALES", "HÁBITOS Y ESTILO DE VIDA SALUDABLES", "HABITOS Y ESTILO DE VIDA SALUDABLES"]):
            formato_grilla_detectado = True
            current_exam = None
            continue
            
        if formato_grilla_detectado:
            if any(stop in linea_upper for stop in ["OTRAS OBSERVACIONES", "INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "REMISIONES", "ATENTAMENTE", "CONSENTIMIENTO", "AUTORIZO", "TRATAMIENTO DE DATOS", "HABEAS DATA", "FIRMA DEL TRABAJADOR"]) or es_encabezado_legal(linea_limpia) or es_contenido_legal_recomendacion(linea_limpia):
                formato_grilla_detectado = False
                current_exam = None
                continue
            else:
                columnas = [col.strip(" |/-,_.") for col in re.split(r'\s{2,}|\|', linea_limpia) if col.strip()]
                for col in columnas:
                    col_clinica = recortar_contenido_legal(col)
                    if col_clinica and not es_vacio_o_estado(col_clinica) and not es_contenido_legal_recomendacion(col_clinica):
                        rec_fmt = a_caso_oracion(col_clinica)
                        if rec_fmt and rec_fmt not in recoms_grilla_acumuladas: recoms_grilla_acumuladas.append(rec_fmt)
                continue

        if any(stop in linea_upper for stop in ["OTRAS OBSERVACIONES", "OBSERVACIONES", "OBSERVACION", "INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES", "REMISIONES", "SISTEMA DE VIGILANCIA", "CONSENTIMIENTO", "AUTORIZO", "ATENTAMENTE"]) or es_encabezado_legal(linea_limpia) or es_contenido_legal_recomendacion(linea_limpia):
            in_exams_section = False
            if current_exam:
                contenido_actual = recoms_raw_dict.get(current_exam, "")
                recoms_raw_dict[current_exam] = recortar_contenido_legal(contenido_actual)
                current_exam = None
            continue

        matched_key = None
        for key in sorted(EXAMS_MAP.keys(), key=len, reverse=True):
            if key in linea_upper and linea_upper.find(key) < 15:
                matched_key = key
                break
        
        if matched_key:
            posicion_examen = linea_upper.find(matched_key)
            prefijo_examen = linea_upper[:posicion_examen]
            if not in_exams_section and any(verbo in prefijo_examen for verbo in ["REALIZAR", "SOLICITAR", "REMITIR", "PROGRAMAR", "ORDENAR", "CONTROL POR"]):
                continue
            in_exams_section = True
            current_exam = EXAMS_MAP[matched_key]
            if current_exam not in examenes_detectados: examenes_detectados.append(current_exam)
            idx = posicion_examen + len(matched_key)
            recoms_raw_dict[current_exam] = linea_limpia[idx:].strip(" :-,_/")
        else:
            if in_exams_section and current_exam and linea_limpia.strip():
                if not es_encabezado_legal(linea_limpia) and not es_contenido_legal_recomendacion(linea_limpia):
                    recoms_raw_dict[current_exam] = recoms_raw_dict.get(current_exam, "") + " " + linea_limpia.strip()

    recoms_por_examen = []
    pve_detectados = set()

    if recoms_grilla_acumuladas:
        for rec in recoms_grilla_acumuladas:
            recoms_por_examen.append(rec)
            rec_up = rec.upper()
            if any(re.search(patron, rec_up) for patron in [r'\bAUDITIV', r'\bRUIDO', r'\bOIDO', r'\bOÍDO', r'\bAUDIO']): pve_detectados.add("Conservación Auditiva")
            if any(re.search(patron, rec_up) for patron in [r'\bPOSTURAL', r'\bLUMBAR', r'\bOSTEOMUSCULAR', r'\bERGONOMIC', r'\bESPALDA', r'\bCARGA']): pve_detectados.add("Prevención Osteomuscular (DME)")
            if any(re.search(patron, rec_up) for patron in [r'\bVISUAL', r'\bGAFAS', r'\bVISION', r'\bVISIÓN', r'\bLENTE', r'\bOPTOMETR', r'\bRX\b']): pve_detectados.add("Conservación Visual")
            if any(re.search(patron, rec_up) for patron in [r'\bRESPIRATORI', r'\bESPIROMETR', r'\bPOLVO', r'\bHUMO']): pve_detectados.add("Conservación Respiratoria")
    else:
        for exam in examenes_detectados:
            rec_part = recoms_raw_dict.get(exam, "").strip()
            rec_part = recortar_contenido_legal(rec_part)
            rec_part = re.sub(r'\s+', ' ', rec_part)
            rec_part = limpiar_ruido_columnas_final(rec_part)
            
            if not es_vacio_o_estado(rec_part):
                parts = re.split(r'//|;|\b\d+\.|\b\d+\-', rec_part)
                valid_parts = []
                for p in parts:
                    p_clean = p.strip(" .-_/()[]")
                    p_clean = recortar_contenido_legal(p_clean)
                    if p_clean and not es_vacio_o_estado(p_clean) and not es_contenido_legal_recomendacion(p_clean):
                        valid_parts.append(a_caso_oracion(p_clean))
                        p_upper = p_clean.upper()
                        if any(re.search(patron, p_upper) for patron in [r'\bAUDITIV', r'\bRUIDO', r'\bOIDO', r'\bOÍDO', r'\bAUDIO']): pve_detectados.add("Conservación Auditiva")
                        if any(re.search(patron, p_upper) for patron in [r'\bPOSTURAL', r'\bLUMBAR', r'\bOSTEOMUSCULAR', r'\bERGONOMIC', r'\bESPALDA', r'\bCARGA']): pve_detectados.add("Prevención Osteomuscular (DME)")
                        if any(re.search(patron, p_upper) for patron in [r'\bVISUAL', r'\bGAFAS', r'\bVISION', r'\bVISIÓN', r'\bLENTE', r'\bOPTOMETR', r'\bRX\b']): pve_detectados.add("Conservación Visual")
                        if any(re.search(patron, p_upper) for patron in [r'\bRESPIRATORI', r'\bESPIROMETR', r'\bPOLVO', r'\bHUMO']): pve_detectados.add("Conservación Respiratoria")
                if valid_parts: recoms_por_examen.append(f"{exam}: {' - '.join(valid_parts)}")

    datos["examenes_lista"] = deduplicar_textos(examenes_detectados + extraer_examenes_globales(texto))
    recomendaciones_respaldo = extraer_recomendaciones_genericas(texto)
    datos["recomendaciones_lista"] = filtrar_recomendaciones_clinicas(
        deduplicar_textos(recoms_por_examen + recomendaciones_respaldo)
    )
    datos["vigilancia_lista"] = list(pve_detectados)

    # RECOLECCIÓN VECINAL ESTRICTA DE PVE (MAX 3 LÍNEAS DEBAJO DE LA CABECERA)
    programas_encontrados = []
    for idx, line in enumerate(lineas_raw):
        l_up = line.upper()
        if "INGRESAR AL PROGRAMA DE VIGILANCIA" in l_up or "PROGRAMA DE VIGILANCIA EPIDEMIOL" in l_up:
            for offset in [0, 1, 2, 3]:
                if idx + offset < len(lineas_raw):
                    text_target = lineas_raw[idx + offset].upper()
                    if offset > 0 and any(stop in text_target for stop in ["REMISIONES:", "OBSERVACIONES:", "ATENTAMENTE", "CONSENTIMIENTO", "AUTORIZO"]): break
                    for kw, prog_name in SVE_CLINICAL_KEYWORDS.items():
                        if kw in text_target and prog_name not in programas_encontrados: programas_encontrados.append(prog_name)
            break

    for pve_bandera in datos["vigilancia_lista"]:
        if pve_bandera not in programas_encontrados: programas_encontrados.append(pve_bandera)
        
    datos["vigilancia_programa"] = ", ".join(programas_encontrados) if programas_encontrados else "NINGUNO"

    def extraer_seccion_limpia(texto_completo, palabras_inicio, palabras_fin):
        seccion = []
        dentro = False
        for l in texto_completo.split('\n'):
            l_limpia = limpiar_linea_ruido_lateral(l)
            l_upper = l_limpia.upper().strip()
            if not dentro:
                if any(h in l_upper for h in palabras_inicio):
                    dentro = True
                    for h in palabras_inicio:
                        if h in l_upper:
                            resto = l_limpia[l_upper.find(h) + len(h):].strip(" :-,_")
                            if resto: seccion.append(resto)
                            break
            else:
                if any(h in l_upper for h in palabras_fin): break
                seccion.append(l_limpia)
        return "\n".join([s for s in seccion if s]).strip()

    obs_fmt_nuevo = ""
    m_obs_nuevo = re.search(r'OTRAS OBSERVACIONES Y RECOMENDACIONES\s*\n\s*([^\n]+)', texto, re.IGNORECASE)
    if m_obs_nuevo: obs_fmt_nuevo = m_obs_nuevo.group(1).strip()
        
    if obs_fmt_nuevo and not es_vacio_o_estado(obs_fmt_nuevo): datos["observaciones"] = a_caso_oracion(obs_fmt_nuevo)
    else: datos["observaciones"] = a_caso_oracion(extraer_seccion_limpia(texto, ["OBSERVACIONES:"], ["RECOMENDACIONES", "REMISIONES", "INGRESAR AL PROGRAMA", "PROGRAMA DE VIGILANCIA"]))
    
    rem_raw = extraer_seccion_limpia(texto, ["INFORMACION DE REMISIONES", "INFORMACIÓN DE REMISIONES"], ["CONSENTIMIENTO", "AUTORIZO"])
    datos["remisiones"] = "No" if es_vacio_o_negativo(rem_raw) else a_caso_oracion(rem_raw)
    datos["modo_validacion"] = "Respaldo local"
    return normalizar_datos_documento(datos)



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
