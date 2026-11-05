// Configuración del test. Todo lo ajustable está acá.
window.CONFIG = {
  // Condiciones en el orden del cuadrado latino (fila del grupo 1).
  condiciones: ["C00", "C25", "C40", "C50", "C65"],
  sets: ["A", "B", "C", "D", "E"],

  bloques: 8,                 // 8 bloques x 5 ensayos = 40
  ventanaRespuesta_s: 45,     // ventana máxima de respuesta
  pausaCorta_s: 120,          // pausa entre bloques
  pausaLarga_s: 300,          // pausa a mitad de sesión
  pausaLargaTrasBloque: 4,

  // Señal de respuesta (se genera en el navegador, en t_senal_respuesta_s del CSV = fin del archivo).
  senalRespuesta: { frecuencia_Hz: 500, duracion_s: 0.2, amplitud: 0.072 },

  // Práctica: 3 listas en orden creciente de compresión, con palabras que NO estén
  // en las listas experimentales. Dejar vacío para saltear la práctica.
  // Ejemplo: { archivo: "audio/practica/P1_C00.flac", condicion: "C00", palabras: ["...", ...] }
  practica: [],

  // Opcional: URL de un Google Apps Script (ver apps-script.gs) para guardar cada ensayo online.
  // Si queda vacío, los datos se guardan en el navegador y se descargan como CSV al final.
  endpoint: "",
};
