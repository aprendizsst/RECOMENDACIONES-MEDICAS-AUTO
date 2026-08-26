window.APP_CONFIG = Object.freeze({
  appName: "Portal SST · Recomendaciones Médicas",
  companyName: "JER S.A.",
  version: "2026.08.26-github-pages-v8",
  pipelineVersion: "2026-08-26.8-row-repair-critical-sections",
  aiValidationVersion: "2026-08-26.8-ai-row-audit",
  documentEngineVersion: "2026-08-26.8-template-first-structured",
  defaultBackendUrl: "https://script.google.com/macros/s/AKfycbxNrv9iLsaY3lIQ6evDnf3zWVanKJNhBzDDiGWkP3W1hX6JYR0vSjMz9lINUYCg_UqVsw/exec",
  defaultGeminiModel: "gemini-3.7-flash",
  maxGeminiPdfMb: 18,
  ocrMinCharsPerPage: 80,
  aiRequiredForGeneration: true,
  clearWorkspaceOnExplicitLogin: true,
  emailSubject: "Recomendación médica ocupacional - {nombre}",
  emailBody: `Cordial saludo,\n\nA continuación hago envío de la recomendación médica de {nombre}, identificado(a) con el número de cédula {identificacion}.\n\nSe requiere confirmar la recepción de este correo. Asimismo, el documento debe firmarse y enviarse nuevamente de forma física, diligenciado con nombre, cédula y fecha.\n\nCordialmente,\nSeguridad y Salud en el Trabajo\nJER S.A.`
});
