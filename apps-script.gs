// OPCIONAL: guarda cada ensayo en una Google Sheet además del CSV local.
// 1) Crear una Google Sheet → Extensiones → Apps Script → pegar este código.
// 2) Implementar → Nueva implementación → Aplicación web → Ejecutar como: yo; Acceso: cualquier persona.
// 3) Copiar la URL /exec en config.js → endpoint.
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(Object.keys(d));
  const cols = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(cols.map((c) => d[c] ?? ""));
  return ContentService.createTextOutput("ok");
}
