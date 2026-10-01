/* ============================================================
   Viborita LCD — lógica del juego
   Malla de 20 x 14 celdas de 24 px, dibujada como matriz de puntos.
   ============================================================ */
(() => {
  "use strict";

  const COLS = 20;
  const ROWS = 14;
  const CELDA = 24;
  const MARCO = 4;              // aire entre el borde del lienzo y la malla
  const MS_INICIAL = 150;
  const MS_MINIMO = 70;
  const MS_POR_MANZANA = 3;
  const MANZANAS_POR_NIVEL = 5;
  const CADA_CUANTAS_DORADAS = 7;   // la 7, 14, 21, ... de cada partida
  const VALOR_DORADA = 3;           // la dorada vale el triple
  const CLAVE_RECORD = "viborita-lcd.mejor";

  const lienzo = document.getElementById("campo");
  const ctx = lienzo.getContext("2d");
  const pantalla = document.getElementById("pantalla");
  const aviso = document.getElementById("aviso");
  const avisoTitulo = document.getElementById("aviso-titulo");
  const avisoPie = document.getElementById("aviso-pie");
  const led = document.getElementById("led");
  const salida = {
    marcador: document.getElementById("marcador"),
    record: document.getElementById("record"),
    segmentos: document.getElementById("d-segmentos"),
    velocidad: document.getElementById("d-velocidad"),
    nivel: document.getElementById("d-nivel"),
    manzanas: document.getElementById("d-manzanas"),
    mejor: document.getElementById("d-mejor"),
    borrarRecord: document.getElementById("btn-borrar-record"),
  };

  const css = getComputedStyle(document.documentElement);
  const COLOR = {
    lcd: css.getPropertyValue("--lcd").trim() || "#a8b457",
    apagado: css.getPropertyValue("--lcd-apagado").trim() || "#9ba74d",
    tinta: css.getPropertyValue("--tinta-lcd").trim() || "#1b2113",
  };

  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Patrón de puntos apagados: así se ve un LCD de matriz antes de encender nada.
  const malla = document.createElement("canvas");
  malla.width = malla.height = 4;
  const mctx = malla.getContext("2d");
  mctx.fillStyle = COLOR.lcd;
  mctx.fillRect(0, 0, 4, 4);
  mctx.fillStyle = COLOR.apagado;
  mctx.fillRect(0, 0, 1, 1);
  const fondo = ctx.createPattern(malla, "repeat");

  // Sprite de la manzana, 5 x 5 puntos dentro de la celda.
  const MANZANA = [
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
  ];

  // La dorada se dibuja hueca: sólo el contorno, el centro queda apagado.
  const MANZANA_DORADA = [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ];

  const DIRS = {
    arriba: { x: 0, y: -1 },
    abajo: { x: 0, y: 1 },
    izquierda: { x: -1, y: 0 },
    derecha: { x: 1, y: 0 },
  };

  const TECLAS = {
    ArrowUp: "arriba", KeyW: "arriba",
    ArrowDown: "abajo", KeyS: "abajo",
    ArrowLeft: "izquierda", KeyA: "izquierda",
    ArrowRight: "derecha", KeyD: "derecha",
  };

  let cuerpo, rumbo, cola, comida, comidaDorada;
  let puntos, manzanas, nivel, tickMs, mejor;
  let estado;              // "listo" | "jugando" | "pausa" | "fin"
  let acumulado, anterior, finDesde;

  const enMalla = (c) => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS;
  const cifras = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");

  function leerRecord() {
    try {
      return Number.parseInt(localStorage.getItem(CLAVE_RECORD), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function guardarRecord(valor) {
    try {
      localStorage.setItem(CLAVE_RECORD, String(valor));
    } catch (e) {
      /* almacenamiento bloqueado: el récord vive sólo en esta sesión */
    }
  }

  function borrarRecord() {
    if (!mejor) return;
    if (!window.confirm("¿Borrar la mejor marca? Esta acción no se puede deshacer.")) return;
    mejor = 0;
    guardarRecord(0);
    pintarDatos();
  }

  function celdaLibre() {
    const libres = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!cuerpo.some((s) => s.x === x && s.y === y)) libres.push({ x, y });
      }
    }
    return libres[Math.floor(Math.random() * libres.length)] || { x: 0, y: 0 };
  }

  function siguienteComida() {
    comida = celdaLibre();
    // la que toca es la número manzanas + 1: 7, 14, 21, ... son doradas
    comidaDorada = (manzanas + 1) % CADA_CUANTAS_DORADAS === 0;
  }

  function nuevaPartida() {
    const y = Math.floor(ROWS / 2);
    cuerpo = [4, 3, 2, 1, 0].map((x) => ({ x, y }));
    rumbo = DIRS.derecha;
    cola = [];
    puntos = 0;
    manzanas = 0;
    nivel = 1;
    tickMs = MS_INICIAL;
    acumulado = 0;
    finDesde = 0;
    siguienteComida();
  }

  function siguienteRumbo() {
    while (cola.length) {
      const d = DIRS[cola.shift()];
      if (d.x !== -rumbo.x || d.y !== -rumbo.y) return d;
    }
    return rumbo;
  }

  function girar(nombre) {
    if (!DIRS[nombre]) return;
    if (estado === "listo") comenzar();
    if (estado !== "jugando") return;
    if (cola.length < 2) cola.push(nombre);
  }

  function paso() {
    rumbo = siguienteRumbo();
    const cabeza = { x: cuerpo[0].x + rumbo.x, y: cuerpo[0].y + rumbo.y };

    const chocaConsigo = cuerpo.some(
      (s, i) => i < cuerpo.length - 1 && s.x === cabeza.x && s.y === cabeza.y
    );
    if (!enMalla(cabeza) || chocaConsigo) {
      perder();
      return;
    }

    cuerpo.unshift(cabeza);

    if (cabeza.x === comida.x && cabeza.y === comida.y) {
      manzanas += 1;
      nivel = Math.floor(manzanas / MANZANAS_POR_NIVEL) + 1;
      puntos += 10 * nivel * (comidaDorada ? VALOR_DORADA : 1);
      tickMs = Math.max(MS_MINIMO, MS_INICIAL - manzanas * MS_POR_MANZANA);
      siguienteComida();
    } else {
      cuerpo.pop();
    }
  }

  function perder() {
    estado = "fin";
    finDesde = performance.now();
    if (puntos > mejor) {
      mejor = puntos;
      guardarRecord(mejor);
    }
    pintarAviso();
    pintarDatos();
  }

  function comenzar() {
    nuevaPartida();
    estado = "jugando";
    anterior = performance.now();
    pintarAviso();
    pintarDatos();
  }

  function alternarPausa() {
    if (estado === "jugando") estado = "pausa";
    else if (estado === "pausa") { estado = "jugando"; anterior = performance.now(); }
    else return;
    pintarAviso();
  }

  function botonPrincipal() {
    if (estado === "jugando" || estado === "pausa") alternarPausa();
    else comenzar();
  }

  /* ---------------- pintura ---------------- */

  function punto(x, y, w, h) {
    ctx.fillRect(MARCO + x, MARCO + y, w, h);
  }

  function dibujar(ahora) {
    const W = lienzo.width;
    const H = lienzo.height;

    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, W, H);

    // marco del campo
    ctx.fillStyle = COLOR.tinta;
    ctx.fillRect(0, 0, W, 2);
    ctx.fillRect(0, H - 2, W, 2);
    ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(W - 2, 0, 2, H);

    // manzana: parpadea salvo que el visor pida calma
    const visible = quieto.matches || estado !== "jugando" || Math.floor(ahora / 420) % 2 === 0;
    if (visible) {
      const px = 4;
      const ox = comida.x * CELDA + 2;
      const oy = comida.y * CELDA + 2;
      const sprite = comidaDorada ? MANZANA_DORADA : MANZANA;
      for (let f = 0; f < 5; f += 1) {
        for (let c = 0; c < 5; c += 1) {
          if (sprite[f][c]) punto(ox + c * px, oy + f * px, px, px);
        }
      }
    }

    // la viborita parpadea un instante al morir, como un píxel quemado
    const muerta = estado === "fin" && !quieto.matches && ahora - finDesde < 760;
    if (!muerta || Math.floor((ahora - finDesde) / 190) % 2 === 0) {
      cuerpo.forEach((s, i) => {
        const aire = i === cuerpo.length - 1 && cuerpo.length > 1 ? 5 : 2;
        punto(s.x * CELDA + aire, s.y * CELDA + aire, CELDA - aire * 2, CELDA - aire * 2);
      });

      // ojo de la cabeza, mirando hacia donde avanza
      const cab = cuerpo[0];
      ctx.fillStyle = COLOR.lcd;
      punto(
        cab.x * CELDA + 10 + rumbo.x * 5,
        cab.y * CELDA + 10 + rumbo.y * 5,
        4,
        4
      );
      ctx.fillStyle = COLOR.tinta;
    }
  }

  function pintarDatos() {
    salida.marcador.textContent = cifras(puntos);
    salida.record.textContent = cifras(mejor);
    salida.segmentos.textContent = cuerpo.length;
    salida.velocidad.textContent = tickMs;
    salida.nivel.textContent = nivel;
    salida.manzanas.textContent = manzanas;
    salida.mejor.textContent = cifras(mejor);
    salida.borrarRecord.disabled = mejor === 0;
  }

  function pintarAviso() {
    const textos = {
      listo: ["PULSA INICIAR", "FLECHAS O WASD PARA GIRAR"],
      pausa: ["PAUSA", "PULSA OK PARA SEGUIR"],
      fin: ["FIN DEL JUEGO", "PUNTOS " + cifras(puntos)],
    };
    const t = textos[estado];
    aviso.hidden = !t;
    if (t) {
      avisoTitulo.textContent = t[0];
      avisoPie.textContent = t[1];
    }
    led.toggleAttribute("data-encendido", estado === "jugando" || estado === "pausa");
    led.toggleAttribute("data-parpadea", estado === "pausa");
    document.getElementById("btn-pausa").textContent = estado === "pausa" ? "Seguir" : "Pausa";
  }

  /* ---------------- bucle ---------------- */

  function cuadro(ahora) {
    if (estado === "jugando") {
      acumulado += ahora - anterior;
      let vueltas = 0;
      while (acumulado >= tickMs && estado === "jugando" && vueltas < 4) {
        acumulado -= tickMs;
        vueltas += 1;
        paso();
      }
      if (vueltas) pintarDatos();
    } else {
      acumulado = 0;
    }
    anterior = ahora;
    dibujar(ahora);
    requestAnimationFrame(cuadro);
  }

  /* ---------------- mandos ---------------- */

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = TECLAS[e.code];
    if (dir) {
      e.preventDefault();
      girar(dir);
      return;
    }
    if (e.code === "Space" || e.code === "KeyP") {
      e.preventDefault();
      if (estado === "listo" || estado === "fin") comenzar();
      else alternarPausa();
    } else if (e.code === "Enter") {
      e.preventDefault();
      comenzar();
    }
  });

  document.querySelectorAll("[data-dir]").forEach((boton) => {
    boton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      girar(boton.dataset.dir);
    });
    // Con el teclado la tecla enfocada gira; el atajo global no debe verlo.
    boton.addEventListener("keydown", (e) => {
      if (e.code !== "Enter" && e.code !== "Space") return;
      e.preventDefault();
      e.stopPropagation();
      girar(boton.dataset.dir);
    });
  });

  document.getElementById("btn-iniciar").addEventListener("click", comenzar);
  document.getElementById("btn-pausa").addEventListener("click", alternarPausa);
  document.getElementById("btn-ok").addEventListener("click", botonPrincipal);
  salida.borrarRecord.addEventListener("click", borrarRecord);

  // Deslizar sobre la pantalla, para jugar con el pulgar.
  let origen = null;
  pantalla.addEventListener("pointerdown", (e) => { origen = { x: e.clientX, y: e.clientY }; });
  pantalla.addEventListener("pointerup", (e) => {
    if (!origen) return;
    const dx = e.clientX - origen.x;
    const dy = e.clientY - origen.y;
    origen = null;
    if (Math.hypot(dx, dy) < 24) {
      botonPrincipal();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) girar(dx > 0 ? "derecha" : "izquierda");
    else girar(dy > 0 ? "abajo" : "arriba");
  });
  pantalla.addEventListener("pointercancel", () => { origen = null; });

  /* ---------------- arranque ---------------- */

  function arrancar() {
    mejor = leerRecord();
    nuevaPartida();
    estado = "listo";
    anterior = performance.now();
    pintarAviso();
    pintarDatos();
    requestAnimationFrame(cuadro);
  }

  arrancar();
})();
