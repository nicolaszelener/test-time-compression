# Test de habla comprimida temporalmente

Test perceptivo de inteligibilidad y retención serial (tesis de Ingeniería de Sonido, UNTREF — Nicolás Zelener).

## Uso

1. Abrir la página (GitHub Pages) en la PC del laboratorio, con auriculares y volumen calibrado.
2. **Señal de calibración**: reproduce en loop la lista C00/L01 para ajustar el nivel (65 dB SPL). Hacerlo sin el participante.
3. Ingresar el número de participante. El grupo del cuadrado latino se asigna solo (`((n−1) mod 5) + 1`) y se puede cambiar.
4. **Iniciar sesión** → instrucciones → (práctica) → 8 bloques × 5 ensayos.
5. Al final se descarga un CSV `resultados_PXX_GY_fecha.csv`. Cada ensayo también queda guardado en el navegador:
   si la página se cierra a mitad de sesión, al volver a abrirla aparece la opción de **retomar** o **descargar lo guardado**.

## Diseño implementado

- Cuadrado latino 5×5 cíclico: grupo g, set i (A=0…E=4) → condición `condiciones[(i + g − 1) mod 5]`.
- Cada bloque tiene un ensayo de cada condición, en orden aleatorio por bloque y participante; las 8 listas de cada condición se reparten al azar entre los bloques.
- Audio por Web Audio API a 48 kHz. Los archivos ya traen el tono de aviso; la señal de respuesta (500 Hz, 200 ms) se genera al final del archivo (t = 13,2 s = 1,5 s después del inicio de la sexta palabra).
- Los casilleros se habilitan con la señal de respuesta. Ventana de 45 s con barra de tiempo; al vencer se guarda lo escrito (`timeout = 1`).
- Para enviar antes de tiempo hay que completar los seis casilleros (palabra o X). `Enter` avanza de casillero.
- Pausas: 2 min entre bloques, 5 min tras el bloque 4 (el experimentador puede saltearlas).

## Columnas del CSV

`participante, grupo, piloto, orden, fase, bloque, pos_bloque, condicion, lista, set, estimulo_1..6, respuesta_1..6, t_inicio_iso, rt_s, timeout, aciertos_id_auto, aciertos_pos_auto`

`aciertos_*_auto` son puntajes **preliminares** por coincidencia exacta (sin mayúsculas ni tildes). El puntaje final (equivalencia fonológica, errores tipográficos) se calcula en el análisis.

## Configuración

Todo en `config.js`: ventana de respuesta, pausas, señal de respuesta, listas de práctica y `endpoint` opcional (Google Sheets, ver `apps-script.gs`).

**Práctica**: falta cargar los audios. Poner los archivos en `audio/practica/` y completar `practica` en `config.js` con 3 entradas en orden creciente de compresión.

## Audios

`audio/CXX/LYY.flac`: FLAC 24 bit / 48 kHz, conversión sin pérdida (bit a bit idéntica) de los WAV de `04_listas`. `ensamblado_listas.csv` es la fuente de `stimuli.js`.

## Publicar en GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save. La página queda en
`https://nicolaszelener.github.io/test-time-compression/`.
