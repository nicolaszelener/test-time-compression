/* Test de inteligibilidad y retención serial con habla comprimida temporalmente.
   Flujo: configuración → instrucciones → práctica → 8 bloques × 5 ensayos (pausas) → descarga. */
(() => {
  "use strict";
  const C = window.CONFIG, E = window.ESTIMULOS;
  const T_SENAL = E.t_senal_respuesta_s;
  const KEY = "tc_sesion_actual";
  const $ = (id) => document.getElementById(id);

  // ---------- utilidades ----------
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const show = (id) => { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id)); };
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn(e); } };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };

  // ---------- cuadrado latino ----------
  const condicionDeSet = (grupo, setIdx) => C.condiciones[(setIdx + grupo - 1) % C.condiciones.length];

  function armarPlan(grupo) {
    const porCond = {};
    C.sets.forEach((set, i) => {
      const cond = condicionDeSet(grupo, i);
      porCond[cond] = shuffle(E.listas.filter((l) => l.set === set));
    });
    const ensayos = [];
    for (let b = 0; b < C.bloques; b++) {
      shuffle(C.condiciones).forEach((cond, k) => {
        const l = porCond[cond][b];
        ensayos.push({ fase: "experimental", bloque: b + 1, pos_bloque: k + 1, condicion: cond, lista: l.lista, set: l.set,
                       palabras: l.palabras, archivo: `audio/${cond}/${l.lista}.flac` });
      });
    }
    const practica = (C.practica || []).map((p, i) => ({ fase: "practica", bloque: 0, pos_bloque: i + 1, condicion: p.condicion,
                       lista: p.lista || `P${i + 1}`, set: "-", palabras: p.palabras, archivo: p.archivo }));
    return practica.concat(ensayos);
  }

  function describirAsignacion() {
    const g = +$("in-grupo").value;
    $("asignacion").textContent = "Asignación: " + C.sets.map((s, i) => `${s}→${condicionDeSet(g, i)}`).join("  ·  ");
  }

  // ---------- audio ----------
  let ctx = null;
  const crudos = {};   // archivo → ArrayBuffer
  const buffers = {};  // archivo → AudioBuffer
  function asegurarContexto() {
    if (!ctx) {
      try { ctx = new AudioContext({ sampleRate: 48000 }); } catch (e) { ctx = new AudioContext(); }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  async function descargar(archivos, onProg) {
    let n = 0;
    await Promise.all(archivos.map(async (a) => {
      if (!crudos[a]) {
        const r = await fetch(a);
        if (!r.ok) throw new Error(`No se pudo cargar ${a} (${r.status})`);
        crudos[a] = await r.arrayBuffer();
      }
      onProg && onProg(++n, archivos.length);
    }));
  }
  async function decodificar(a) {
    if (!buffers[a]) {
      if (!crudos[a]) await descargar([a]);
      buffers[a] = await ctx.decodeAudioData(crudos[a].slice(0));
    }
    return buffers[a];
  }
  function tono(t0, { frecuencia_Hz, duracion_s, amplitud }) {
    const o = ctx.createOscillator(), g = ctx.createGain(), r = 0.005;
    o.frequency.value = frecuencia_Hz;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amplitud, t0 + r);
    g.gain.setValueAtTime(amplitud, t0 + duracion_s - r);
    g.gain.linearRampToValueAtTime(0, t0 + duracion_s);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + duracion_s + 0.01);
  }

  // ---------- estado ----------
  let S = null; // { meta, plan, resultados, idx, terminado }

  function nuevaSesion() {
    const part = $("in-part").value.trim(), grupo = +$("in-grupo").value;
    S = {
      meta: { participante: part, grupo, piloto: $("in-piloto").checked, inicio_sesion: new Date().toISOString(),
              user_agent: navigator.userAgent, version: "1.0" },
      plan: armarPlan(grupo), resultados: [], idx: 0, terminado: false,
    };
    save();
  }

  // ---------- pantalla de configuración ----------
  function initSetup() {
    $("in-grupo").addEventListener("change", describirAsignacion);
    $("in-part").addEventListener("input", () => {
      const n = parseInt($("in-part").value, 10);
      if (n > 0) { $("in-grupo").value = String(((n - 1) % 5) + 1); describirAsignacion(); }
      $("btn-start").disabled = !(n > 0);
    });
    describirAsignacion();
    $("btn-start").textContent = "Iniciar sesión";
    $("btn-start").disabled = true;

    const prev = load();
    if (prev && !prev.terminado && prev.resultados && prev.resultados.length) {
      $("resume-box").hidden = false;
      $("resume-who").textContent = `participante ${prev.meta.participante} (grupo ${prev.meta.grupo})`;
      $("resume-n").textContent = prev.resultados.filter((r) => r.fase === "experimental").length;
      $("btn-resume").onclick = () => { S = prev; S.meta.reanudada = (S.meta.reanudada || 0) + 1; arrancar(false); };
      $("btn-resume-dl").onclick = () => { S = prev; bajarCSV(); };
      $("btn-resume-discard").onclick = () => { if (confirmar2()) { localStorage.removeItem(KEY); $("resume-box").hidden = true; } };
    }

    $("btn-start").onclick = () => {
      if (prev && !prev.terminado && prev.resultados && prev.resultados.length && !$("resume-box").hidden) {
        $("load-status").textContent = "Primero retomá, descargá o descartá la sesión sin terminar.";
        return;
      }
      nuevaSesion(); arrancar(true);
    };

    let calibSrc = null;
    $("btn-calib").onclick = async () => {
      asegurarContexto();
      if (calibSrc) { calibSrc.stop(); calibSrc = null; $("btn-calib").textContent = "Señal de calibración"; return; }
      const buf = await decodificar("audio/C00/L01.flac");
      calibSrc = ctx.createBufferSource(); calibSrc.buffer = buf; calibSrc.loop = true;
      calibSrc.connect(ctx.destination); calibSrc.start();
      $("btn-calib").textContent = "Detener calibración";
    };
  }
  // Doble confirmación sin diálogos del navegador.
  let _armado = 0;
  function confirmar2() {
    if (Date.now() - _armado < 3000) return true;
    _armado = Date.now(); $("btn-resume-discard").textContent = "¿Seguro? Tocá de nuevo"; return false;
  }

  async function arrancar(mostrarInstrucciones) {
    asegurarContexto();
    try { document.documentElement.requestFullscreen && await document.documentElement.requestFullscreen(); } catch (e) {}
    $("btn-start").disabled = true; $("btn-resume").disabled = true;
    const archivos = [...new Set(S.plan.map((t) => t.archivo))];
    try {
      await descargar(archivos, (n, tot) => { $("load-status").textContent = `Cargando audios ${n}/${tot}…`; });
    } catch (e) {
      $("load-status").textContent = "Error: " + e.message; $("btn-start").disabled = false; return;
    }
    S.meta.sample_rate = ctx.sampleRate;
    S.meta.output_latency_s = ctx.outputLatency ?? null;
    S.meta.base_latency_s = ctx.baseLatency ?? null;
    save();
    window.addEventListener("beforeunload", (e) => { if (S && !S.terminado) { e.preventDefault(); e.returnValue = ""; } });
    if (mostrarInstrucciones) {
      document.querySelectorAll(".vr").forEach((el) => (el.textContent = C.ventanaRespuesta_s));
      $("instr-practica").hidden = !(C.practica && C.practica.length);
      $("btn-instr").onclick = () => prepararEnsayo();
      show("s-instr");
    } else prepararEnsayo();
  }

  // ---------- ensayo ----------
  const inputs = [];
  function construirCasilleros() {
    const cont = $("boxes");
    for (let i = 0; i < 6; i++) {
      const d = document.createElement("label"); d.className = "box";
      const s = document.createElement("span"); s.textContent = i + 1;
      const inp = document.createElement("input");
      Object.assign(inp, { type: "text", autocomplete: "off", spellcheck: false, disabled: true });
      inp.setAttribute("autocorrect", "off"); inp.setAttribute("autocapitalize", "off");
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); if (i < 5) inputs[i + 1].focus(); else enviar(false); }
      });
      d.append(s, inp); cont.append(d); inputs.push(inp);
    }
  }

  let ensayo = null; // datos del ensayo en curso
  let timerRAF = 0, finVentana = 0;

  async function prepararEnsayo() {
    if (S.idx >= S.plan.length) return terminar();
    const t = S.plan[S.idx];
    const nExp = S.plan.filter((x) => x.fase === "experimental").length;
    const iExp = S.plan.slice(0, S.idx + 1).filter((x) => x.fase === "experimental").length;
    $("t-label").textContent = t.fase === "practica" ? "Práctica" : `Bloque ${t.bloque} de ${C.bloques}`;
    $("t-progress").textContent = t.fase === "practica" ? `${t.pos_bloque} de ${C.practica.length}` : `Ensayo ${iExp} de ${nExp}`;
    inputs.forEach((i) => { i.value = ""; i.disabled = true; });
    $("t-status").className = "status"; $("t-status").innerHTML = "Presioná <b>Escuchar</b> cuando estés listo/a.";
    $("t-msg").innerHTML = "&nbsp;"; $("t-bar").style.width = "0"; $("t-bar").className = "";
    $("btn-play").hidden = false; $("btn-play").disabled = true; $("btn-send").hidden = true;
    show("s-trial");
    await decodificar(t.archivo);
    const sig = S.plan[S.idx + 1]; if (sig) decodificar(sig.archivo); // precarga
    $("btn-play").disabled = false; $("btn-play").focus();
  }

  function reproducir() {
    const t = S.plan[S.idx], buf = buffers[t.archivo];
    asegurarContexto();
    $("btn-play").hidden = true;
    $("t-status").textContent = "Escuchá…";
    const t0 = ctx.currentTime + 0.15;
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(t0);
    const tSenal = t0 + T_SENAL;
    tono(tSenal, C.senalRespuesta);
    ensayo = { t_inicio_iso: new Date(Date.now() + 150).toISOString(), duracion_archivo_s: buf.duration };
    const esperar = () => {
      if (ctx.currentTime >= tSenal) abrirVentana(); else requestAnimationFrame(esperar);
    };
    requestAnimationFrame(esperar);
  }

  function abrirVentana() {
    ensayo.t_senal_perf = performance.now();
    $("t-status").className = "status go"; $("t-status").textContent = "Escribí las palabras en orden";
    inputs.forEach((i) => (i.disabled = false)); inputs[0].focus();
    $("btn-send").hidden = false;
    finVentana = ensayo.t_senal_perf + C.ventanaRespuesta_s * 1000;
    const tick = () => {
      const rest = finVentana - performance.now();
      const frac = Math.max(0, rest) / (C.ventanaRespuesta_s * 1000);
      $("t-bar").style.width = (frac * 100).toFixed(2) + "%";
      $("t-bar").className = rest < 10000 ? "low" : "";
      if (rest <= 0) return enviar(true);
      timerRAF = requestAnimationFrame(tick);
    };
    timerRAF = requestAnimationFrame(tick);
  }

  function puntuar(obj, resp) {
    const o = obj.map(norm), r = resp.map(norm), usado = new Array(6).fill(false);
    let pi = 0;
    o.forEach((w) => { const j = r.findIndex((x, k) => !usado[k] && x === w); if (j >= 0) { usado[j] = true; pi++; } });
    const prs = o.reduce((n, w, i) => n + (r[i] === w ? 1 : 0), 0);
    return { pi, prs };
  }

  function enviar(porTiempo) {
    if (!ensayo || ensayo.enviado) return;
    const resp = inputs.map((i) => i.value.trim());
    if (!porTiempo && resp.some((r) => r === "")) {
      $("t-msg").textContent = "Completá los casilleros vacíos con una X.";
      inputs[resp.findIndex((r) => r === "")].focus();
      return;
    }
    ensayo.enviado = true;
    cancelAnimationFrame(timerRAF);
    const rt = (performance.now() - ensayo.t_senal_perf) / 1000;
    const t = S.plan[S.idx], sc = puntuar(t.palabras, resp);
    const fila = {
      participante: S.meta.participante, grupo: S.meta.grupo, piloto: S.meta.piloto ? 1 : 0,
      orden: S.idx + 1, fase: t.fase, bloque: t.bloque, pos_bloque: t.pos_bloque,
      condicion: t.condicion, lista: t.lista, set: t.set,
      ...Object.fromEntries(t.palabras.map((w, i) => [`estimulo_${i + 1}`, w])),
      ...Object.fromEntries(resp.map((w, i) => [`respuesta_${i + 1}`, w])),
      t_inicio_iso: ensayo.t_inicio_iso, rt_s: +Math.min(rt, C.ventanaRespuesta_s).toFixed(3),
      timeout: porTiempo ? 1 : 0, aciertos_id_auto: sc.pi, aciertos_pos_auto: sc.prs,
    };
    S.resultados.push(fila); S.idx++; save();
    enviarOnline(fila);
    inputs.forEach((i) => (i.disabled = true)); $("btn-send").hidden = true;
    siguiente(t);
  }

  function siguiente(t) {
    const prox = S.plan[S.idx];
    if (!prox) return terminar();
    if (t.fase === "practica" && prox.fase === "experimental")
      return pausa(0, "Fin de la práctica", "Ahora empieza el test. Avisá si tenés alguna duda.");
    if (t.fase === "experimental" && prox.bloque !== t.bloque) {
      const larga = t.bloque === C.pausaLargaTrasBloque;
      return pausa(larga ? C.pausaLarga_s : C.pausaCorta_s, larga ? "Pausa larga" : "Pausa",
        `Terminaste el bloque ${t.bloque} de ${C.bloques}. Descansá; vas a poder seguir cuando termine el tiempo.`);
    }
    prepararEnsayo();
  }

  // ---------- pausa ----------
  let pausaInt = 0;
  function pausa(seg, titulo, msg) {
    $("p-title").textContent = titulo; $("p-msg").textContent = msg;
    const fin = Date.now() + seg * 1000;
    $("btn-continue").disabled = seg > 0;
    $("btn-skip").hidden = seg === 0;
    const upd = () => {
      const r = Math.max(0, (fin - Date.now()) / 1000);
      $("p-clock").textContent = seg > 0 ? fmtClock(Math.ceil(r)) : "";
      if (r <= 0) { clearInterval(pausaInt); $("btn-continue").disabled = false; $("btn-continue").focus(); }
    };
    clearInterval(pausaInt); upd(); pausaInt = setInterval(upd, 250);
    $("btn-skip").onclick = () => { clearInterval(pausaInt); $("p-clock").textContent = ""; $("btn-continue").disabled = false; $("btn-continue").focus(); };
    $("btn-continue").onclick = () => { clearInterval(pausaInt); prepararEnsayo(); };
    show("s-pause");
  }

  // ---------- fin y exportación ----------
  function terminar() {
    S.terminado = true; S.meta.fin_sesion = new Date().toISOString(); save();
    try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {}
    show("s-end");
    bajarCSV();
    const exp = S.resultados.filter((r) => r.fase === "experimental");
    $("end-msg").textContent = `${exp.length} ensayos guardados. El CSV se descargó automáticamente; si no, usá el botón.`;
    $("btn-dl-csv").onclick = bajarCSV;
    $("btn-dl-json").onclick = bajarJSON;
    $("btn-new").onclick = () => { localStorage.removeItem(KEY); location.reload(); };
  }
  const nombreBase = () => `resultados_P${String(S.meta.participante).padStart(2, "0")}_G${S.meta.grupo}${S.meta.piloto ? "_piloto" : ""}_${S.meta.inicio_sesion.slice(0, 16).replace(/[:T]/g, "-")}`;
  function bajar(nombre, tipo, contenido) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = nombre; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function aCSV(filas) {
    if (!filas.length) return "";
    const cols = Object.keys(filas[0]);
    const esc = (v) => { v = v == null ? "" : String(v); return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    return "﻿" + [cols.join(","), ...filas.map((f) => cols.map((c) => esc(f[c])).join(","))].join("\n") + "\n";
  }
  const bajarCSV = () => bajar(nombreBase() + ".csv", "text/csv;charset=utf-8", aCSV(S.resultados));
  const bajarJSON = () => bajar(nombreBase() + ".json", "application/json", JSON.stringify(S, null, 2));

  function enviarOnline(fila) {
    if (!C.endpoint) return;
    fetch(C.endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...fila, sesion: S.meta.inicio_sesion }) }).catch((e) => console.warn("endpoint:", e));
  }

  // ---------- inicio ----------
  construirCasilleros();
  $("btn-play").onclick = reproducir;
  $("btn-send").onclick = () => enviar(false);
  document.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && $("s-trial").classList.contains("active") && !$("btn-play").hidden && !$("btn-play").disabled && document.activeElement !== $("btn-play")) {
      e.preventDefault(); reproducir();
    }
  });
  initSetup();
  window.__TC = { get S() { return S; } }; // para depuración
})();
