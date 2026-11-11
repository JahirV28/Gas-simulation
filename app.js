/**
 * Simulador de la Ecuación del Gas Ideal y Trabajo (Temas 4.2.1, 4.2.2 y 4.2.3)
 * Física Aplicada I - Grupo 4
 * Arquitectura en HTML5 + CSS3 + Vanilla JS sin dependencias externas
 */

(() => {
  'use strict';

  // Constantes Físicas Fundamentales (SI)
  const R = 8.314; // J/(mol·K)
  const NA = 6.02214076e23; // 1/mol (Número de Avogadro)

  // Estado Global para la Simulación Cinética del Módulo 1
  const simStateMod1 = {
    P_Pa: 99817.88,
    V_m3: 0.025,
    n_mol: 1.0,
    T_K: 300.15,
    solvedVar: 'P',
    particles: [],
    lastTimestamp: 0
  };

  // Estado Global para el Diagrama P-V del Módulo 2
  const simStateMod2 = {
    process: 'isobaric', // 'isobaric' | 'isothermal' | 'isochoric' | 'adiabatic'
    gasType: 'mono',     // 'mono' (Cv=1.5R, Cp=2.5R, gamma=5/3) | 'di' (Cv=2.5R, Cp=3.5R, gamma=1.4)
    n: 2.0,
    P1: 150000,
    V1: 0.02,
    T1: 180.42,
    P2: 150000,
    V2: 0.06,
    T2: 541.26,
    W: 6000,
    dU: 9000,
    Q: 15000
  };

  // =========================================================================
  // UTILIDADES DE FORMATO Y VALIDACIÓN ESTRICTA
  // =========================================================================

  /**
   * Verifica que una cadena sea estrictamente un número real válido (sin letras ni símbolos extraños)
   */
  function isValidNumericString(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (trimmed === '') return false;
    return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
  }

  /**
   * Formatea números de manera científica o decimal limpia evitando NaN/Infinity
   */
  function formatNumber(val, decimals = 3) {
    if (!Number.isFinite(val)) return '—';
    const abs = Math.abs(val);
    if (abs === 0) return '0';
    if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) {
      return val.toExponential(3);
    }
    return Number(val.toFixed(decimals)).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Formatea un valor numérico para rellenar un input sin comas de miles
   */
  function formatForInput(val) {
    if (!Number.isFinite(val)) return '';
    const abs = Math.abs(val);
    if (abs === 0) return '0';
    if (abs >= 1e6 || (abs > 0 && abs < 1e-4)) {
      return val.toExponential(4);
    }
    return Number(val.toPrecision(6)).toString();
  }

  /**
   * Conversiones hacia y desde el Sistema Internacional (SI)
   */
  function pressureToPa(val, unit) {
    if (unit === 'kPa') return val * 1000;
    if (unit === 'atm') return val * 101325;
    return val; // Pa
  }

  function paToPressureUnit(valPa, unit) {
    if (unit === 'kPa') return valPa / 1000;
    if (unit === 'atm') return valPa / 101325;
    return valPa;
  }

  function volumeToM3(val, unit) {
    if (unit === 'L') return val * 0.001;
    return val; // m3
  }

  function m3ToVolumeUnit(valM3, unit) {
    if (unit === 'L') return valM3 * 1000;
    return valM3;
  }

  function tempToKelvin(val, unit) {
    if (unit === 'C') return val + 273.15;
    return val; // K
  }

  function kelvinToTempUnit(valK, unit) {
    if (unit === 'C') return valK - 273.15;
    return valK;
  }

  /**
   * Sanitiza en tiempo real la entrada de teclado para impedir letras (excepto notación científica 'e')
   */
  function attachNumericInputGuard(inputEl) {
    inputEl.addEventListener('input', () => {
      const raw = inputEl.value;
      // Permite dígitos, punto decimal, signo menos/más y 'e'/'E'
      const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.+\-eE]/g, '');
      if (raw !== cleaned) {
        inputEl.value = cleaned;
      }
    });
  }

  // =========================================================================
  // NAVEGACIÓN POR PESTAÑAS (MÓDULO 1 / MÓDULO 2)
  // =========================================================================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const moduleViews = document.querySelectorAll('.module-view');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach((b) => b.classList.remove('active'));
      moduleViews.forEach((m) => m.classList.remove('active'));

      btn.classList.add('active');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');

      if (targetId === 'module-2') {
        requestAnimationFrame(() => drawPVDiagram());
      } else {
        requestAnimationFrame(() => drawCylinderFrame());
      }
    });
  });

  // =========================================================================
  // MÓDULO 1: ECUACIÓN DE ESTADO DEL GAS IDEAL (PV = nRT)
  // =========================================================================
  const mod1Inputs = {
    P: document.getElementById('input-p'),
    V: document.getElementById('input-v'),
    n: document.getElementById('input-n'),
    T: document.getElementById('input-t')
  };

  const mod1Units = {
    P: document.getElementById('unit-p'),
    V: document.getElementById('unit-v'),
    T: document.getElementById('unit-t')
  };

  const mod1Groups = {
    P: document.getElementById('fg-p'),
    V: document.getElementById('fg-v'),
    n: document.getElementById('fg-n'),
    T: document.getElementById('fg-t')
  };

  const mod1Hints = {
    P: document.getElementById('hint-p'),
    V: document.getElementById('hint-v'),
    n: document.getElementById('hint-n'),
    T: document.getElementById('hint-t')
  };

  const mod1AlertBox = document.getElementById('mod1-alert');
  const mod1AlertText = document.getElementById('mod1-alert-text');

  function showMod1Alert(msg, type = 'error') {
    mod1AlertBox.className = `alert-box show ${type}`;
    mod1AlertText.innerHTML = msg;
  }

  function hideMod1Alert() {
    mod1AlertBox.className = 'alert-box';
    mod1AlertText.innerHTML = '';
  }

  function clearSolvedHighlights() {
    Object.values(mod1Groups).forEach((fg) => fg.classList.remove('solved-highlight'));
  }

  /**
   * Actualiza las etiquetas inferiores de conversión al SI en tiempo real
   */
  function updateMod1LiveHints() {
    // Presión
    const pRaw = mod1Inputs.P.value.trim();
    if (isValidNumericString(pRaw)) {
      const pVal = parseFloat(pRaw);
      const pPa = pressureToPa(pVal, mod1Units.P.value);
      mod1Hints.P.textContent = `Conversión SI: P = ${formatNumber(pPa, 2)} Pa`;
    } else {
      mod1Hints.P.textContent = 'Incógnita a despejar (se calculará en Pa y ' + mod1Units.P.value + ')';
    }

    // Volumen
    const vRaw = mod1Inputs.V.value.trim();
    if (isValidNumericString(vRaw)) {
      const vVal = parseFloat(vRaw);
      const vM3 = volumeToM3(vVal, mod1Units.V.value);
      mod1Hints.V.textContent = `Conversión SI: V = ${formatNumber(vM3, 5)} m³`;
    } else {
      mod1Hints.V.textContent = 'Incógnita a despejar (se calculará en m³ y ' + mod1Units.V.value + ')';
    }

    // Moles
    const nRaw = mod1Inputs.n.value.trim();
    if (isValidNumericString(nRaw)) {
      const nVal = parseFloat(nRaw);
      const molecules = nVal * NA;
      mod1Hints.n.textContent = `SI: ${formatNumber(nVal, 4)} mol (N = ${molecules.toExponential(3)} moléculas)`;
    } else {
      mod1Hints.n.textContent = 'Incógnita a despejar (se calculará en mol)';
    }

    // Temperatura
    const tRaw = mod1Inputs.T.value.trim();
    if (isValidNumericString(tRaw)) {
      const tVal = parseFloat(tRaw);
      if (mod1Units.T.value === 'C') {
        const tK = tVal + 273.15;
        mod1Hints.T.textContent = `Conversión SI: T(K) = ${tVal} + 273.15 = ${formatNumber(tK, 2)} K`;
      } else {
        const tC = tVal - 273.15;
        mod1Hints.T.textContent = `SI: ${formatNumber(tVal, 2)} K (${formatNumber(tC, 2)} °C)`;
      }
    } else {
      mod1Hints.T.textContent = 'Incógnita a despejar (se calculará en K y ' + (mod1Units.T.value === 'C' ? '°C' : 'K') + ')';
    }
  }

  // Conectar guardas numéricas y eventos en Módulo 1
  Object.keys(mod1Inputs).forEach((key) => {
    attachNumericInputGuard(mod1Inputs[key]);
    mod1Inputs[key].addEventListener('input', () => {
      clearSolvedHighlights();
      hideMod1Alert();
      updateMod1LiveHints();
    });
  });

  Object.keys(mod1Units).forEach((key) => {
    mod1Units[key].addEventListener('change', () => {
      updateMod1LiveHints();
    });
  });

  // Botones individuales para vaciar 1 campo específico (×)
  document.querySelectorAll('.clear-single-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-clear');
      const inputEl = document.getElementById(targetId);
      if (inputEl) {
        inputEl.value = '';
        clearSolvedHighlights();
        hideMod1Alert();
        updateMod1LiveHints();
        inputEl.focus();
      }
    });
  });

  /**
   * Lógica Principal del Módulo 1: Validación + Despeje Automático de la Ecuación de Estado
   * @param {boolean} fillInput - Si es true, rellena la caja de texto vacía con el valor despejado
   */
  function calculateMod1(fillInput = true) {
    hideMod1Alert();
    clearSolvedHighlights();

    const keys = ['P', 'V', 'n', 'T'];
    const varNames = {
      P: 'Presión absoluta (P)',
      V: 'Volumen (V)',
      n: 'Cantidad de sustancia (n)',
      T: 'Temperatura (T)'
    };

    const emptyKeys = [];
    const parsedValues = {};

    // 1. Revisar campos vacíos y bloquear caracteres inválidos
    for (const k of keys) {
      const raw = mod1Inputs[k].value.trim();
      if (raw === '') {
        emptyKeys.push(k);
      } else {
        if (!isValidNumericString(raw)) {
          showMod1Alert(
            `<strong>Formato numérico inválido en ${varNames[k]}:</strong> Ingresa únicamente valores numéricos reales (sin letras ni símbolos especiales).`,
            'error'
          );
          return;
        }
        const num = parseFloat(raw);
        if (!Number.isFinite(num)) {
          showMod1Alert(
            `<strong>Valor fuera de rango en ${varNames[k]}:</strong> El número ingresado no es finito.`,
            'error'
          );
          return;
        }
        parsedValues[k] = num;
      }
    }

    // 2. Validación obligatoria: Exactamente 3 llenos y 1 vacío
    if (emptyKeys.length === 0) {
      showMod1Alert(
        `<strong>Validación de Despeje:</strong> Los 4 campos están llenos (0 campos vacíos). Debes ingresar exactamente <strong>3 variables</strong> y dejar <strong>1 campo vacío</strong> para despejarlo (haz clic en el botón <strong>&times;</strong> junto a la variable que desees calcular).`,
        'warning'
      );
      return;
    }

    if (emptyKeys.length >= 2) {
      showMod1Alert(
        `<strong>Datos insuficientes (${emptyKeys.length} campos vacíos):</strong> Para resolver la ecuación <em>PV = nRT</em> debes llenar exactamente <strong>3 variables conocidas</strong> y dejar solo <strong>1 campo vacío</strong> como incógnita.`,
        'warning'
      );
      return;
    }

    const missingKey = emptyKeys[0];

    // 3. Convertir variables conocidas al Sistema Internacional y validar límites físicos
    let P_Pa = missingKey !== 'P' ? pressureToPa(parsedValues.P, mod1Units.P.value) : null;
    let V_m3 = missingKey !== 'V' ? volumeToM3(parsedValues.V, mod1Units.V.value) : null;
    let n_mol = missingKey !== 'n' ? parsedValues.n : null;
    let T_K = missingKey !== 'T' ? tempToKelvin(parsedValues.T, mod1Units.T.value) : null;

    // Validación del Cero Absoluto (T <= 0 K o <= -273.15 °C)
    if (T_K !== null && T_K <= 0) {
      showMod1Alert(
        `<strong>Violación del Cero Absoluto:</strong> La temperatura ingresada equivale a <strong>${formatNumber(T_K, 2)} K</strong> (${formatNumber(T_K - 273.15, 2)} °C). Físicamente es imposible alcanzar o bajar del cero absoluto (<strong>0 K = -273.15 °C</strong>). Ingresa una temperatura mayor a 0 K.`,
        'error'
      );
      return;
    }

    // Validación de valores físicamente imposibles (P > 0, V > 0, n > 0)
    if (P_Pa !== null && P_Pa <= 0) {
      showMod1Alert(
        `<strong>Valor físicamente imposible en Presión (P):</strong> La presión absoluta de un gas ideal debe ser estrictamente mayor que cero (<strong>P &gt; 0</strong>).`,
        'error'
      );
      return;
    }

    if (V_m3 !== null && V_m3 <= 0) {
      showMod1Alert(
        `<strong>Valor físicamente imposible en Volumen (V):</strong> El volumen del contenedor debe ser estrictamente mayor que cero (<strong>V &gt; 0</strong>).`,
        'error'
      );
      return;
    }

    if (n_mol !== null && n_mol <= 0) {
      showMod1Alert(
        `<strong>Valor físicamente imposible en Moles (n):</strong> La cantidad de sustancia debe ser estrictamente mayor que cero (<strong>n &gt; 0 mol</strong>).`,
        'error'
      );
      return;
    }

    // 4. Aplicar el Despeje Algebraico Exacto según la incógnita
    let algebraHTML = '';
    let subHTML = '';
    let resHTML = '';
    let resSubNote = '';
    let convNote = 'Variables convertidas al SI (Pa, m³, mol, K)';

    if (mod1Units.T.value === 'C' && missingKey !== 'T') {
      convNote = `Conversión previa: T(K) = ${parsedValues.T} °C + 273.15 = ${formatNumber(T_K, 2)} K`;
    }

    if (missingKey === 'P') {
      P_Pa = (n_mol * R * T_K) / V_m3;
      const pSelectedUnit = paToPressureUnit(P_Pa, mod1Units.P.value);
      if (fillInput) {
        mod1Inputs.P.value = formatForInput(pSelectedUnit);
      }

      algebraHTML = `P = <span class="frac"><span class="num">n &middot; R &middot; T</span><span class="den">V</span></span>`;
      subHTML = `P = <span class="frac"><span class="num">(${formatNumber(n_mol, 3)} mol)(8.314 J/mol&middot;K)(${formatNumber(T_K, 2)} K)</span><span class="den">${formatNumber(V_m3, 5)} m³</span></span>`;
      resHTML = `P = ${formatNumber(P_Pa, 2)} Pa`;
      resSubNote = `En la unidad seleccionada: ${formatNumber(pSelectedUnit, 4)} ${mod1Units.P.value}`;
    } else if (missingKey === 'V') {
      V_m3 = (n_mol * R * T_K) / P_Pa;
      const vSelectedUnit = m3ToVolumeUnit(V_m3, mod1Units.V.value);
      if (fillInput) {
        mod1Inputs.V.value = formatForInput(vSelectedUnit);
      }

      algebraHTML = `V = <span class="frac"><span class="num">n &middot; R &middot; T</span><span class="den">P</span></span>`;
      subHTML = `V = <span class="frac"><span class="num">(${formatNumber(n_mol, 3)} mol)(8.314 J/mol&middot;K)(${formatNumber(T_K, 2)} K)</span><span class="den">${formatNumber(P_Pa, 2)} Pa</span></span>`;
      resHTML = `V = ${formatNumber(V_m3, 5)} m³`;
      resSubNote = `En la unidad seleccionada: ${formatNumber(vSelectedUnit, 4)} ${mod1Units.V.value}`;
    } else if (missingKey === 'n') {
      n_mol = (P_Pa * V_m3) / (R * T_K);
      if (fillInput) {
        mod1Inputs.n.value = formatForInput(n_mol);
      }

      algebraHTML = `n = <span class="frac"><span class="num">P &middot; V</span><span class="den">R &middot; T</span></span>`;
      subHTML = `n = <span class="frac"><span class="num">(${formatNumber(P_Pa, 2)} Pa)(${formatNumber(V_m3, 5)} m³)</span><span class="den">(8.314 J/mol&middot;K)(${formatNumber(T_K, 2)} K)</span></span>`;
      resHTML = `n = ${formatNumber(n_mol, 4)} mol`;
      resSubNote = `Equivale a N = ${(n_mol * NA).toExponential(3)} moléculas`;
    } else if (missingKey === 'T') {
      T_K = (P_Pa * V_m3) / (n_mol * R);
      const tSelectedUnit = kelvinToTempUnit(T_K, mod1Units.T.value);
      if (fillInput) {
        mod1Inputs.T.value = formatForInput(tSelectedUnit);
      }

      algebraHTML = `T = <span class="frac"><span class="num">P &middot; V</span><span class="den">n &middot; R</span></span>`;
      subHTML = `T = <span class="frac"><span class="num">(${formatNumber(P_Pa, 2)} Pa)(${formatNumber(V_m3, 5)} m³)</span><span class="den">(${formatNumber(n_mol, 3)} mol)(8.314 J/mol&middot;K)</span></span>`;
      resHTML = `T = ${formatNumber(T_K, 2)} K`;
      const tCelsius = T_K - 273.15;
      resSubNote = `Conversión a Celsius: T(°C) = ${formatNumber(T_K, 2)} - 273.15 = ${formatNumber(tCelsius, 2)} °C`;
    }

    // Resaltar visualmente el campo recién despejado cuando el usuario calcula
    if (fillInput) {
      mod1Groups[missingKey].classList.add('solved-highlight');
    }
    updateMod1LiveHints();

    // Actualizar Tarjetas de Explicación Matemática
    document.getElementById('mod1-solved-tag').textContent = `Despejada: ${missingKey}`;
    document.getElementById('mod1-step-algebra').innerHTML = algebraHTML;
    document.getElementById('mod1-step-conv-note').textContent = convNote;
    document.getElementById('mod1-step-sub').innerHTML = subHTML;
    document.getElementById('mod1-step-res').innerHTML = resHTML;
    document.getElementById('mod1-step-res-sub').textContent = resSubNote;

    // Actualizar KPIs inferiores del Módulo 1
    document.getElementById('kpi-p-si').textContent = `${formatNumber(P_Pa, 2)} Pa`;
    document.getElementById('kpi-p-alt').textContent = `${formatNumber(P_Pa / 1000, 3)} kPa | ${formatNumber(P_Pa / 101325, 3)} atm`;

    document.getElementById('kpi-v-si').textContent = `${formatNumber(V_m3, 5)} m³`;
    document.getElementById('kpi-v-alt').textContent = `${formatNumber(V_m3 * 1000, 3)} L`;

    document.getElementById('kpi-t-si').textContent = `${formatNumber(T_K, 2)} K`;
    document.getElementById('kpi-t-alt').textContent = `${formatNumber(T_K - 273.15, 2)} °C`;

    document.getElementById('kpi-n-si').textContent = `${formatNumber(n_mol, 4)} mol`;
    document.getElementById('kpi-n-alt').textContent = `N = ${(n_mol * NA).toExponential(3)} moléculas`;

    // Actualizar Estado del Simulador Cinético
    simStateMod1.P_Pa = P_Pa;
    simStateMod1.V_m3 = V_m3;
    simStateMod1.n_mol = n_mol;
    simStateMod1.T_K = T_K;
    simStateMod1.solvedVar = missingKey;
    syncParticleCount();
  }

  // Botón Calcular Módulo 1
  document.getElementById('btn-calc-mod1').addEventListener('click', () => calculateMod1(true));

  // Botón Limpiar Campos Módulo 1
  document.getElementById('btn-clear-mod1').addEventListener('click', () => {
    Object.values(mod1Inputs).forEach((inp) => {
      inp.value = '';
    });
    clearSolvedHighlights();
    hideMod1Alert();
    updateMod1LiveHints();
    document.getElementById('mod1-solved-tag').textContent = 'Esperando datos';
    document.getElementById('mod1-step-sub').textContent = 'Ingresa 3 variables y presiona Calcular';
    document.getElementById('mod1-step-res').textContent = '—';
    document.getElementById('mod1-step-res-sub').textContent = 'Campos reiniciados';
    mod1Inputs.P.focus();
  });

  // Casos de prueba rápidos (Presets Módulo 1)
  const presetsMod1 = {
    solveP: { P: '', unitP: 'kPa', V: '25', unitV: 'L', n: '1.0', T: '27', unitT: 'C' },
    solveV: { P: '1', unitP: 'atm', V: '', unitV: 'L', n: '1.0', T: '0', unitT: 'C' },
    solveN: { P: '800', unitP: 'kPa', V: '1.5', unitV: 'm3', n: '', T: '27', unitT: 'C' },
    solveT: { P: '250', unitP: 'kPa', V: '30', unitV: 'L', n: '2.5', T: '', unitT: 'C' }
  };

  document.querySelectorAll('[data-preset-mod1]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset-mod1');
      const p = presetsMod1[key];
      if (!p) return;
      mod1Units.P.value = p.unitP;
      mod1Units.V.value = p.unitV;
      mod1Units.T.value = p.unitT;
      mod1Inputs.P.value = p.P;
      mod1Inputs.V.value = p.V;
      mod1Inputs.n.value = p.n;
      mod1Inputs.T.value = p.T;
      calculateMod1();
    });
  });

  // =========================================================================
  // ANIMACIÓN DEL CILINDRO-ÉMBOLO Y PARTÍCULAS (CANVAS MÓDULO 1)
  // =========================================================================
  const cylCanvas = document.getElementById('cylinder-canvas');
  const cylCtx = cylCanvas.getContext('2d');

  function syncParticleCount() {
    // Escalar número de partículas visibles entre 14 y 75 según n (mol)
    const targetCount = Math.min(75, Math.max(14, Math.round(28 * Math.log10(simStateMod1.n_mol * 8 + 1.5))));
    while (simStateMod1.particles.length < targetCount) {
      const angle = Math.random() * Math.PI * 2;
      simStateMod1.particles.push({
        rx: 0.08 + Math.random() * 0.84,
        ry: 0.08 + Math.random() * 0.84,
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        radius: 4.2
      });
    }
    if (simStateMod1.particles.length > targetCount) {
      simStateMod1.particles.length = targetCount;
    }
  }

  function getTemperatureColor(T_K) {
    // De azul frío (<200K) a cian (300K) a ámbar (500K) a rojo brillante (>800K)
    const ratio = Math.min(1, Math.max(0, (T_K - 120) / 750));
    if (ratio < 0.35) {
      return '#38bdf8';
    } else if (ratio < 0.65) {
      return '#fbbf24';
    }
    return '#f43f5e';
  }

  function drawCylinderFrame(timestamp = 0) {
    if (!cylCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cylCanvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const width = rect.width;
    const height = Math.max(290, Math.min(340, rect.width * 0.42));
    if (cylCanvas.width !== Math.round(width * dpr) || cylCanvas.height !== Math.round(height * dpr)) {
      cylCanvas.width = Math.round(width * dpr);
      cylCanvas.height = Math.round(height * dpr);
    }

    cylCtx.save();
    cylCtx.scale(dpr, dpr);

    // Fondo del laboratorio
    cylCtx.fillStyle = '#090d16';
    cylCtx.fillRect(0, 0, width, height);

    // Cuadrícula sutil de fondo
    cylCtx.strokeStyle = 'rgba(45, 61, 89, 0.25)';
    cylCtx.lineWidth = 1;
    const gridStep = 28;
    for (let x = 0; x < width; x += gridStep) {
      cylCtx.beginPath();
      cylCtx.moveTo(x, 0);
      cylCtx.lineTo(x, height);
      cylCtx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      cylCtx.beginPath();
      cylCtx.moveTo(0, y);
      cylCtx.lineTo(width, y);
      cylCtx.stroke();
    }

    // Dimensiones del cilindro
    const cylWidth = Math.min(250, width * 0.36);
    const cylX = Math.max(35, width * 0.1);
    const cylBottomY = height - 34;
    const cylTopLimitY = 36;
    const maxChamberHeight = cylBottomY - cylTopLimitY - 30;

    // Escalar altura de la cámara de gas según Volumen (escala logarítmica suave para cubrir desde mL hasta m³)
    const volLiters = simStateMod1.V_m3 * 1000;
    const normV = Math.min(1, Math.max(0.22, (Math.log10(Math.max(0.1, volLiters)) + 1) / 3.3));
    const chamberHeight = maxChamberHeight * normV;
    const pistonBottomY = cylBottomY - chamberHeight;
    const pistonHeight = 20;

    // Color térmico del gas según T
    const particleColor = getTemperatureColor(simStateMod1.T_K);

    // Brillo interior del gas
    const gasGrad = cylCtx.createLinearGradient(cylX, pistonBottomY, cylX, cylBottomY);
    gasGrad.addColorStop(0, 'rgba(56, 189, 248, 0.07)');
    gasGrad.addColorStop(1, simStateMod1.T_K > 450 ? 'rgba(244, 63, 94, 0.14)' : 'rgba(56, 189, 248, 0.14)');
    cylCtx.fillStyle = gasGrad;
    cylCtx.fillRect(cylX, pistonBottomY, cylWidth, chamberHeight);

    // Actualizar y dibujar partículas en movimiento (velocidad proporcional a sqrt(T))
    const speedFactor = Math.min(6.5, Math.max(0.6, Math.sqrt(simStateMod1.T_K / 300) * 2.1));
    simStateMod1.particles.forEach((p) => {
      p.rx += (p.vx * speedFactor) / cylWidth;
      p.ry += (p.vy * speedFactor) / chamberHeight;

      if (p.rx <= 0.04) {
        p.rx = 0.04;
        p.vx = Math.abs(p.vx);
      } else if (p.rx >= 0.96) {
        p.rx = 0.96;
        p.vx = -Math.abs(p.vx);
      }

      if (p.ry <= 0.06) {
        p.ry = 0.06;
        p.vy = Math.abs(p.vy);
      } else if (p.ry >= 0.94) {
        p.ry = 0.94;
        p.vy = -Math.abs(p.vy);
      }

      const px = cylX + p.rx * cylWidth;
      const py = pistonBottomY + p.ry * chamberHeight;

      // Estela cinética
      cylCtx.beginPath();
      cylCtx.moveTo(px, py);
      cylCtx.lineTo(px - p.vx * speedFactor * 2.2, py - p.vy * speedFactor * 2.2);
      cylCtx.strokeStyle = particleColor;
      cylCtx.globalAlpha = 0.35;
      cylCtx.lineWidth = 2;
      cylCtx.stroke();

      // Partícula
      cylCtx.beginPath();
      cylCtx.arc(px, py, p.radius, 0, Math.PI * 2);
      cylCtx.fillStyle = particleColor;
      cylCtx.globalAlpha = 0.95;
      cylCtx.fill();
    });
    cylCtx.globalAlpha = 1;

    // Flechas de presión del gas empujando el émbolo hacia arriba
    const numArrows = 4;
    cylCtx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    cylCtx.fillStyle = 'rgba(16, 185, 129, 0.7)';
    for (let i = 1; i <= numArrows; i++) {
      const ax = cylX + (cylWidth * i) / (numArrows + 1);
      const ayTop = pistonBottomY + 4;
      const ayBot = pistonBottomY + 20;
      cylCtx.beginPath();
      cylCtx.moveTo(ax, ayBot);
      cylCtx.lineTo(ax, ayTop);
      cylCtx.lineWidth = 1.8;
      cylCtx.stroke();

      cylCtx.beginPath();
      cylCtx.moveTo(ax, ayTop);
      cylCtx.lineTo(ax - 4, ayTop + 6);
      cylCtx.lineTo(ax + 4, ayTop + 6);
      cylCtx.closePath();
      cylCtx.fill();
    }

    // Dibujar el Émbolo Móvil (Pistón)
    const pistonGrad = cylCtx.createLinearGradient(cylX, pistonBottomY - pistonHeight, cylX + cylWidth, pistonBottomY);
    pistonGrad.addColorStop(0, '#475569');
    pistonGrad.addColorStop(0.5, '#94a3b8');
    pistonGrad.addColorStop(1, '#334155');
    cylCtx.fillStyle = pistonGrad;
    cylCtx.fillRect(cylX + 2, pistonBottomY - pistonHeight, cylWidth - 4, pistonHeight);
    cylCtx.strokeStyle = '#cbd5e1';
    cylCtx.lineWidth = 1.5;
    cylCtx.strokeRect(cylX + 2, pistonBottomY - pistonHeight, cylWidth - 4, pistonHeight);

    // Vástago del émbolo
    const rodWidth = 18;
    const rodX = cylX + cylWidth / 2 - rodWidth / 2;
    cylCtx.fillStyle = '#64748b';
    cylCtx.fillRect(rodX, cylTopLimitY - 12, rodWidth, pistonBottomY - pistonHeight - (cylTopLimitY - 12));

    // Paredes del cilindro (U metálica gruesa)
    cylCtx.strokeStyle = '#94a3b8';
    cylCtx.lineWidth = 4;
    cylCtx.beginPath();
    cylCtx.moveTo(cylX, cylTopLimitY);
    cylCtx.lineTo(cylX, cylBottomY);
    cylCtx.lineTo(cylX + cylWidth, cylBottomY);
    cylCtx.lineTo(cylX + cylWidth, cylTopLimitY);
    cylCtx.stroke();

    // Panel de Telemetría en Tiempo Real a la derecha del cilindro
    const infoX = cylX + cylWidth + 38;
    const infoWidth = width - infoX - 24;

    if (infoWidth > 160) {
      cylCtx.fillStyle = 'rgba(23, 32, 51, 0.88)';
      cylCtx.strokeStyle = '#2d3d59';
      cylCtx.lineWidth = 1.2;
      cylCtx.beginPath();
      cylCtx.roundRect(infoX, 34, infoWidth, height - 68, 10);
      cylCtx.fill();
      cylCtx.stroke();

      cylCtx.fillStyle = '#38bdf8';
      cylCtx.font = 'bold 13px Inter, sans-serif';
      cylCtx.fillText('ESTADO TERMODINÁMICO EN SISTEMA INTERNACIONAL', infoX + 16, 60);

      const rows = [
        { label: 'Presión Absoluta (P):', val: `${formatNumber(simStateMod1.P_Pa, 2)} Pa (${formatNumber(simStateMod1.P_Pa / 1000, 2)} kPa)`, key: 'P' },
        { label: 'Volumen del Gas (V):', val: `${formatNumber(simStateMod1.V_m3, 5)} m³ (${formatNumber(simStateMod1.V_m3 * 1000, 2)} L)`, key: 'V' },
        { label: 'Cantidad de Sustancia (n):', val: `${formatNumber(simStateMod1.n_mol, 4)} mol`, key: 'n' },
        { label: 'Temperatura Absoluta (T):', val: `${formatNumber(simStateMod1.T_K, 2)} K (${formatNumber(simStateMod1.T_K - 273.15, 2)} °C)`, key: 'T' }
      ];

      rows.forEach((r, idx) => {
        const y = 92 + idx * 42;
        const isSolved = simStateMod1.solvedVar === r.key;

        if (isSolved) {
          cylCtx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          cylCtx.fillRect(infoX + 12, y - 17, infoWidth - 24, 30);
        }

        cylCtx.fillStyle = isSolved ? '#10b981' : '#94a3b8';
        cylCtx.font = isSolved ? 'bold 12px Inter, sans-serif' : '12px Inter, sans-serif';
        cylCtx.fillText(r.label, infoX + 18, y);

        cylCtx.fillStyle = isSolved ? '#6ee7b7' : '#f8fafc';
        cylCtx.font = 'bold 13px "JetBrains Mono", monospace';
        cylCtx.fillText(r.val, infoX + 195, y);
      });

      // Indicador inferior de agitación térmica
      cylCtx.fillStyle = '#cbd5e1';
      cylCtx.font = '12px Inter, sans-serif';
      cylCtx.fillText(
        `Partículas simuladas: ${simStateMod1.particles.length}  |  Energía cinética media: (3/2)k_B·T = ${(1.5 * 1.38e-23 * simStateMod1.T_K).toExponential(2)} J`,
        infoX + 16,
        height - 48
      );
    }

    cylCtx.restore();

    // Continuar bucle de animación solo si el Módulo 1 está activo
    if (document.getElementById('module-1').classList.contains('active')) {
      requestAnimationFrame(drawCylinderFrame);
    }
  }

  // =========================================================================
  // MÓDULO 2: PROCESOS TERMODINÁMICOS, TRABAJO (W) Y PRIMERA LEY
  // =========================================================================
  const processSelect = document.getElementById('process-select');
  const processLawHint = document.getElementById('process-law-hint');
  const mod2AlertBox = document.getElementById('mod2-alert');
  const mod2AlertText = document.getElementById('mod2-alert-text');

  const m2Groups = {
    n: document.getElementById('m2-fg-n'),
    p: document.getElementById('m2-fg-p'),
    t: document.getElementById('m2-fg-t'),
    v: document.getElementById('m2-fg-v'),
    t1: document.getElementById('m2-fg-t1'),
    t2: document.getElementById('m2-fg-t2'),
    v1: document.getElementById('m2-fg-v1'),
    v2: document.getElementById('m2-fg-v2')
  };

  const m2Inputs = {
    n: document.getElementById('m2-n'),
    p: document.getElementById('m2-p'),
    t: document.getElementById('m2-t'),
    v: document.getElementById('m2-v'),
    t1: document.getElementById('m2-t1'),
    t2: document.getElementById('m2-t2'),
    v1: document.getElementById('m2-v1'),
    v2: document.getElementById('m2-v2')
  };

  const m2Units = {
    p: document.getElementById('m2-unit-p'),
    t: document.getElementById('m2-unit-t'),
    v: document.getElementById('m2-unit-v'),
    t1: document.getElementById('m2-unit-t1'),
    t2: document.getElementById('m2-unit-t2'),
    v1: document.getElementById('m2-unit-v1'),
    v2: document.getElementById('m2-unit-v2')
  };

  Object.values(m2Inputs).forEach((inp) => {
    attachNumericInputGuard(inp);
  });

  function showMod2Alert(msg, type = 'error') {
    mod2AlertBox.className = `alert-box show ${type}`;
    mod2AlertText.innerHTML = msg;
  }

  function hideMod2Alert() {
    mod2AlertBox.className = 'alert-box';
    mod2AlertText.innerHTML = '';
  }

  /**
   * Muestra únicamente los campos de entrada correspondientes al proceso seleccionado
   */
  function updateMod2VisibleFields() {
    const proc = processSelect.value;
    simStateMod2.process = proc;
    hideMod2Alert();

    // Ocultar todos excepto 'n'
    m2Groups.p.style.display = 'none';
    m2Groups.t.style.display = 'none';
    m2Groups.v.style.display = 'none';
    m2Groups.t1.style.display = 'none';
    m2Groups.t2.style.display = 'none';
    m2Groups.v1.style.display = 'none';
    m2Groups.v2.style.display = 'none';

    if (proc === 'isobaric') {
      m2Groups.p.style.display = 'block';
      m2Groups.v1.style.display = 'block';
      m2Groups.v2.style.display = 'block';
      processLawHint.innerHTML = 'Ecuación: V₁ / T₁ = V₂ / T₂ &bull; W = P(V₂ &minus; V₁) &bull; Q = nCₚ&Delta;T';
    } else if (proc === 'isothermal') {
      m2Groups.t.style.display = 'block';
      m2Groups.v1.style.display = 'block';
      m2Groups.v2.style.display = 'block';
      processLawHint.innerHTML = 'Ecuación: P₁V₁ = P₂V₂ &bull; W = nRT ln(V₂/V₁) &bull; &Delta;U = 0, Q = W';
    } else if (proc === 'isochoric') {
      m2Groups.v.style.display = 'block';
      m2Groups.t1.style.display = 'block';
      m2Groups.t2.style.display = 'block';
      processLawHint.innerHTML = 'Ecuación: P₁ / T₁ = P₂ / T₂ &bull; W = 0 &bull; Q = &Delta;U = nCᵥ&Delta;T';
    } else if (proc === 'adiabatic') {
      m2Groups.t1.style.display = 'block';
      m2Groups.v1.style.display = 'block';
      m2Groups.v2.style.display = 'block';
      processLawHint.innerHTML = 'Ecuación: P₁V₁^&gamma; = P₂V₂^&gamma; &bull; Q = 0 &bull; W = &minus;&Delta;U';
    }
  }

  processSelect.addEventListener('change', () => {
    updateMod2VisibleFields();
    calculateMod2();
  });

  // Selector de tipo de gas (Monoatómico / Diatómico)
  const gasBtns = document.querySelectorAll('[data-gastype]');
  gasBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      gasBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      simStateMod2.gasType = btn.getAttribute('data-gastype');
      calculateMod2();
    });
  });

  /**
   * Valida y ejecuta los cálculos del proceso termodinámico seleccionado en el Módulo 2
   */
  function calculateMod2() {
    hideMod2Alert();

    const proc = processSelect.value;
    const isMono = simStateMod2.gasType === 'mono';
    const Cv = isMono ? 1.5 * R : 2.5 * R;
    const Cp = isMono ? 2.5 * R : 3.5 * R;
    const gamma = isMono ? 5 / 3 : 1.4;
    const cvFracLabel = isMono ? '3/2 R' : '5/2 R';
    const cpFracLabel = isMono ? '5/2 R' : '7/2 R';

    // Helper para leer y validar un campo requerido del Módulo 2
    function readValidField(key, label) {
      const raw = m2Inputs[key].value.trim();
      if (!isValidNumericString(raw)) {
        showMod2Alert(
          `<strong>Entrada inválida en ${label}:</strong> Ingresa un valor numérico válido (sin letras ni campos vacíos).`,
          'error'
        );
        return null;
      }
      const val = parseFloat(raw);
      if (!Number.isFinite(val)) {
        showMod2Alert(`<strong>Valor no finito en ${label}.</strong>`, 'error');
        return null;
      }
      return val;
    }

    const n = readValidField('n', 'Cantidad de sustancia (n)');
    if (n === null) return;
    if (n <= 0) {
      showMod2Alert(
        `<strong>Valor físicamente imposible:</strong> El número de moles (<strong>n</strong>) debe ser estrictamente mayor que cero (n &gt; 0).`,
        'error'
      );
      return;
    }

    let P1, V1, T1, P2, V2, T2, W, dU, Q;
    let mathState = '', noteState = '';
    let mathW = '', mathDU = '', mathQ = '';
    let procTitle = '';

    if (proc === 'isobaric') {
      procTitle = 'Proceso Isobárico (P = constante)';
      const pVal = readValidField('p', 'Presión constante (P)');
      const v1Val = readValidField('v1', 'Volumen inicial (V₁)');
      const v2Val = readValidField('v2', 'Volumen final (V₂)');
      if (pVal === null || v1Val === null || v2Val === null) return;

      const P = pressureToPa(pVal, m2Units.p.value);
      V1 = volumeToM3(v1Val, m2Units.v1.value);
      V2 = volumeToM3(v2Val, m2Units.v2.value);

      if (P <= 0 || V1 <= 0 || V2 <= 0) {
        showMod2Alert(
          `<strong>Valores físicamente imposibles:</strong> La presión absoluta (P) y los volúmenes (V₁, V₂) deben ser estrictamente mayores que cero (&gt; 0).`,
          'error'
        );
        return;
      }

      P1 = P;
      P2 = P;
      T1 = (P * V1) / (n * R);
      T2 = (P * V2) / (n * R);

      W = P * (V2 - V1);
      dU = n * Cv * (T2 - T1);
      Q = n * Cp * (T2 - T1);

      mathState = `T = <span class="frac"><span class="num">P &middot; V</span><span class="den">n &middot; R</span></span> &rArr; T₁ = <strong>${formatNumber(T1, 2)} K</strong>, T₂ = <strong>${formatNumber(T2, 2)} K</strong>`;
      noteState = `Ley de Charles: V₁/T₁ = V₂/T₂ = ${formatNumber(V1 / T1, 6)} m³/K`;
      mathW = `W = P(V₂ &minus; V₁) = (${formatNumber(P, 1)} Pa)(${formatNumber(V2 - V1, 4)} m³) = <strong>${formatNumber(W, 2)} J</strong>`;
      mathDU = `&Delta;U = nCᵥ(T₂ &minus; T₁) = (${formatNumber(n, 2)})(${formatNumber(Cv, 2)})(${formatNumber(T2 - T1, 2)} K) = <strong>${formatNumber(dU, 2)} J</strong>`;
      mathQ = `Q = nCₚ&Delta;T = &Delta;U + W = ${formatNumber(dU, 2)} + (${formatNumber(W, 2)}) = <strong>${formatNumber(Q, 2)} J</strong>`;
    } else if (proc === 'isothermal') {
      procTitle = 'Proceso Isotérmico (T = constante)';
      const tVal = readValidField('t', 'Temperatura constante (T)');
      const v1Val = readValidField('v1', 'Volumen inicial (V₁)');
      const v2Val = readValidField('v2', 'Volumen final (V₂)');
      if (tVal === null || v1Val === null || v2Val === null) return;

      const T = tempToKelvin(tVal, m2Units.t.value);
      if (T <= 0) {
        showMod2Alert(
          `<strong>Violación del Cero Absoluto:</strong> La temperatura ingresada equivale a <strong>${formatNumber(T, 2)} K</strong> (≤ 0 K o ≤ -273.15 °C). Es físicamente imposible alcanzar o bajar del cero absoluto.`,
          'error'
        );
        return;
      }

      V1 = volumeToM3(v1Val, m2Units.v1.value);
      V2 = volumeToM3(v2Val, m2Units.v2.value);
      if (V1 <= 0 || V2 <= 0) {
        showMod2Alert(
          `<strong>Valores físicamente imposibles:</strong> Los volúmenes inicial (V₁) y final (V₂) deben ser estrictamente mayores que cero (&gt; 0).`,
          'error'
        );
        return;
      }

      T1 = T;
      T2 = T;
      P1 = (n * R * T) / V1;
      P2 = (n * R * T) / V2;

      W = n * R * T * Math.log(V2 / V1);
      dU = 0;
      Q = W;

      mathState = `P = <span class="frac"><span class="num">n &middot; R &middot; T</span><span class="den">V</span></span> &rArr; P₁ = <strong>${formatNumber(P1 / 1000, 2)} kPa</strong>, P₂ = <strong>${formatNumber(P2 / 1000, 2)} kPa</strong>`;
      noteState = m2Units.t.value === 'C'
        ? `Conversión SI: T(K) = ${tVal} °C + 273.15 = ${formatNumber(T, 2)} K | P₁V₁ = P₂V₂`
        : `Ley de Boyle: P₁V₁ = P₂V₂ = ${formatNumber(P1 * V1, 2)} J`;
      mathW = `W = nRT ln(V₂/V₁) = (${formatNumber(n, 2)})(8.314)(${formatNumber(T, 2)}) ln(${formatNumber(V2 / V1, 3)}) = <strong>${formatNumber(W, 2)} J</strong>`;
      mathDU = `&Delta;U = nCᵥ&Delta;T = 0 J &nbsp;(porque &Delta;T = 0 K)`;
      mathQ = `Q = &Delta;U + W = 0 + (${formatNumber(W, 2)}) = <strong>${formatNumber(Q, 2)} J</strong>`;
    } else if (proc === 'isochoric') {
      procTitle = 'Proceso Isocórico (V = constante)';
      const vVal = readValidField('v', 'Volumen constante (V)');
      const t1Val = readValidField('t1', 'Temperatura inicial (T₁)');
      const t2Val = readValidField('t2', 'Temperatura final (T₂)');
      if (vVal === null || t1Val === null || t2Val === null) return;

      const V = volumeToM3(vVal, m2Units.v.value);
      if (V <= 0) {
        showMod2Alert(
          `<strong>Valor físicamente imposible:</strong> El volumen (V) debe ser estrictamente mayor que cero (&gt; 0).`,
          'error'
        );
        return;
      }

      T1 = tempToKelvin(t1Val, m2Units.t1.value);
      T2 = tempToKelvin(t2Val, m2Units.t2.value);
      if (T1 <= 0 || T2 <= 0) {
        showMod2Alert(
          `<strong>Violación del Cero Absoluto:</strong> Las temperaturas absolutas T₁ (${formatNumber(T1, 2)} K) y T₂ (${formatNumber(T2, 2)} K) deben ser estrictamente mayores a 0 K (-273.15 °C).`,
          'error'
        );
        return;
      }

      V1 = V;
      V2 = V;
      P1 = (n * R * T1) / V;
      P2 = (n * R * T2) / V;

      W = 0;
      dU = n * Cv * (T2 - T1);
      Q = dU;

      mathState = `P = <span class="frac"><span class="num">n &middot; R &middot; T</span><span class="den">V</span></span> &rArr; P₁ = <strong>${formatNumber(P1 / 1000, 2)} kPa</strong>, P₂ = <strong>${formatNumber(P2 / 1000, 2)} kPa</strong>`;
      noteState = `Ley de Gay-Lussac: P₁/T₁ = P₂/T₂ = ${formatNumber(P1 / T1, 2)} Pa/K`;
      mathW = `W = &int; P dV = <strong>0 J</strong> &nbsp;(porque &Delta;V = 0 m³)`;
      mathDU = `&Delta;U = nCᵥ(T₂ &minus; T₁) = (${formatNumber(n, 2)})(${formatNumber(Cv, 2)})(${formatNumber(T2 - T1, 2)} K) = <strong>${formatNumber(dU, 2)} J</strong>`;
      mathQ = `Q = &Delta;U = <strong>${formatNumber(Q, 2)} J</strong>`;
    } else if (proc === 'adiabatic') {
      procTitle = `Proceso Adiabático (Q = 0, \u03b3 = ${gamma.toFixed(3)})`;
      const t1Val = readValidField('t1', 'Temperatura inicial (T₁)');
      const v1Val = readValidField('v1', 'Volumen inicial (V₁)');
      const v2Val = readValidField('v2', 'Volumen final (V₂)');
      if (t1Val === null || v1Val === null || v2Val === null) return;

      T1 = tempToKelvin(t1Val, m2Units.t1.value);
      if (T1 <= 0) {
        showMod2Alert(
          `<strong>Violación del Cero Absoluto:</strong> La temperatura inicial equivale a <strong>${formatNumber(T1, 2)} K</strong> (≤ 0 K). Debe ser mayor a 0 K (-273.15 °C).`,
          'error'
        );
        return;
      }

      V1 = volumeToM3(v1Val, m2Units.v1.value);
      V2 = volumeToM3(v2Val, m2Units.v2.value);
      if (V1 <= 0 || V2 <= 0) {
        showMod2Alert(
          `<strong>Valores físicamente imposibles:</strong> Los volúmenes V₁ y V₂ deben ser estrictamente mayores que cero (&gt; 0).`,
          'error'
        );
        return;
      }

      P1 = (n * R * T1) / V1;
      P2 = P1 * Math.pow(V1 / V2, gamma);
      T2 = (P2 * V2) / (n * R);

      Q = 0;
      dU = n * Cv * (T2 - T1);
      W = -dU; // también igual a -nR/(gamma-1)*(T2 - T1)

      mathState = `P₂ = P₁(V₁/V₂)^&gamma; = <strong>${formatNumber(P2 / 1000, 2)} kPa</strong> &bull; T₂ = <strong>${formatNumber(T2, 2)} K</strong>`;
      noteState = `Relación Adiabática: P₁V₁^&gamma; = P₂V₂^&gamma; (&gamma; = ${gamma.toFixed(3)})`;
      mathW = `W = &minus;&Delta;U = &minus;[nR/(&gamma;&minus;1)](T₂ &minus; T₁) = <strong>${formatNumber(W, 2)} J</strong>`;
      mathDU = `&Delta;U = nCᵥ(T₂ &minus; T₁) = (${formatNumber(n, 2)})(${formatNumber(Cv, 2)})(${formatNumber(T2 - T1, 2)} K) = <strong>${formatNumber(dU, 2)} J</strong>`;
      mathQ = `Q = <strong>0 J</strong> &nbsp;(Proceso aislado térmicamente)`;
    }

    // Guardar estado en simStateMod2
    Object.assign(simStateMod2, { n, P1, V1, T1, P2, V2, T2, W, dU, Q, gamma });

    // Actualizar Etiqueta de Interpretación Física del Signo del Trabajo (W)
    const interpBanner = document.getElementById('work-interpretation');
    const interpText = document.getElementById('work-interp-text');
    const interpVal = document.getElementById('work-interp-val');

    const eps = 1e-9;
    if (W > eps) {
      interpBanner.className = 'interpretation-banner expansion';
      interpText.textContent = 'Expansión: El gas realiza trabajo sobre el entorno (W > 0)';
      interpVal.textContent = `W = +${formatNumber(W, 2)} J`;
    } else if (W < -eps) {
      interpBanner.className = 'interpretation-banner compression';
      interpText.textContent = 'Compresión: El entorno realiza trabajo sobre el gas (W < 0)';
      interpVal.textContent = `W = ${formatNumber(W, 2)} J`;
    } else {
      interpBanner.className = 'interpretation-banner isochoric';
      interpText.textContent = 'Volumen constante: No hay trabajo mecánico (W = 0)';
      interpVal.textContent = 'W = 0.00 J';
    }

    // Actualizar KPIs Primera Ley
    document.getElementById('mod2-proc-badge').textContent = procTitle;
    document.getElementById('m2-kpi-w').textContent = `${formatNumber(W, 2)} J`;
    document.getElementById('m2-kpi-w-sub').textContent = `${formatNumber(W / 1000, 3)} kJ`;

    document.getElementById('m2-kpi-du').textContent = `${formatNumber(dU, 2)} J`;
    document.getElementById('m2-kpi-du-sub').textContent = `${formatNumber(dU / 1000, 3)} kJ (${cvFracLabel})`;

    document.getElementById('m2-kpi-q').textContent = `${formatNumber(Q, 2)} J`;
    document.getElementById('m2-kpi-q-sub').textContent =
      Math.abs(Q) < eps ? 'Sin flujo de calor (Q = 0)' : Q > 0 ? `${formatNumber(Q / 1000, 3)} kJ (Calor entra)` : `${formatNumber(Q / 1000, 3)} kJ (Calor sale)`;

    document.getElementById('m2-kpi-law').textContent = `${formatNumber(dU, 1)} = ${formatNumber(Q, 1)} - (${formatNumber(W, 1)})`;
    document.getElementById('m2-kpi-law-sub').textContent = `\u0394U = Q \u2212 W cumplido en J`;

    // Actualizar tarjetas matemáticas
    document.getElementById('m2-math-state').innerHTML = mathState;
    document.getElementById('m2-note-state').textContent = noteState;
    document.getElementById('m2-math-w').innerHTML = mathW;
    document.getElementById('m2-math-du').innerHTML = mathDU;
    document.getElementById('m2-math-q').innerHTML = mathQ;
    document.getElementById('m2-note-du').textContent = `Cᵥ = ${cvFracLabel} = ${formatNumber(Cv, 3)} J/(mol·K) | Cₚ = ${cpFracLabel}`;

    // Actualizar Tabla Comparativa de Estados
    document.getElementById('tbl-p1').textContent = `${formatNumber(P1, 2)} Pa (${formatNumber(P1 / 1000, 2)} kPa)`;
    document.getElementById('tbl-v1').textContent = `${formatNumber(V1, 5)} m³ (${formatNumber(V1 * 1000, 2)} L)`;
    document.getElementById('tbl-t1').textContent = `${formatNumber(T1, 2)} K`;
    document.getElementById('tbl-tc1').textContent = `${formatNumber(T1 - 273.15, 2)} °C`;

    document.getElementById('tbl-p2').textContent = `${formatNumber(P2, 2)} Pa (${formatNumber(P2 / 1000, 2)} kPa)`;
    document.getElementById('tbl-v2').textContent = `${formatNumber(V2, 5)} m³ (${formatNumber(V2 * 1000, 2)} L)`;
    document.getElementById('tbl-t2').textContent = `${formatNumber(T2, 2)} K`;
    document.getElementById('tbl-tc2').textContent = `${formatNumber(T2 - 273.15, 2)} °C`;

    drawPVDiagram();
  }

  document.getElementById('btn-calc-mod2').addEventListener('click', calculateMod2);

  // Botón para invertir Estado 1 <-> Estado 2 (para comparar Expansión vs Compresión al instante)
  document.getElementById('btn-invert-mod2').addEventListener('click', () => {
    const proc = processSelect.value;
    if (proc === 'isochoric') {
      const tmpVal = m2Inputs.t1.value;
      const tmpUnit = m2Units.t1.value;
      m2Inputs.t1.value = m2Inputs.t2.value;
      m2Units.t1.value = m2Units.t2.value;
      m2Inputs.t2.value = tmpVal;
      m2Units.t2.value = tmpUnit;
    } else if (proc === 'adiabatic') {
      // Usar T2 calculada previamente como nueva T1 e invertir V1 <-> V2
      m2Units.t1.value = 'K';
      m2Inputs.t1.value = formatForInput(simStateMod2.T2);
      const tmpV = m2Inputs.v1.value;
      const tmpUnitV = m2Units.v1.value;
      m2Inputs.v1.value = m2Inputs.v2.value;
      m2Units.v1.value = m2Units.v2.value;
      m2Inputs.v2.value = tmpV;
      m2Units.v2.value = tmpUnitV;
    } else {
      const tmpV = m2Inputs.v1.value;
      const tmpUnitV = m2Units.v1.value;
      m2Inputs.v1.value = m2Inputs.v2.value;
      m2Units.v1.value = m2Units.v2.value;
      m2Inputs.v2.value = tmpV;
      m2Units.v2.value = tmpUnitV;
    }
    calculateMod2();
  });

  // Presets de Demostración para el Módulo 2
  document.querySelectorAll('[data-preset-mod2]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset-mod2');
      if (key === 'exp_isobaric') {
        processSelect.value = 'isobaric';
        m2Inputs.n.value = '2.0';
        m2Inputs.p.value = '150';
        m2Units.p.value = 'kPa';
        m2Inputs.v1.value = '20';
        m2Units.v1.value = 'L';
        m2Inputs.v2.value = '60';
        m2Units.v2.value = 'L';
      } else if (key === 'comp_isothermal') {
        processSelect.value = 'isothermal';
        m2Inputs.n.value = '2.0';
        m2Inputs.t.value = '300';
        m2Units.t.value = 'K';
        m2Inputs.v1.value = '60';
        m2Units.v1.value = 'L';
        m2Inputs.v2.value = '20';
        m2Units.v2.value = 'L';
      } else if (key === 'heat_isochoric') {
        processSelect.value = 'isochoric';
        m2Inputs.n.value = '2.0';
        m2Inputs.v.value = '40';
        m2Units.v.value = 'L';
        m2Inputs.t1.value = '300';
        m2Units.t1.value = 'K';
        m2Inputs.t2.value = '650';
        m2Units.t2.value = 'K';
      } else if (key === 'exp_adiabatic') {
        processSelect.value = 'adiabatic';
        m2Inputs.n.value = '2.0';
        m2Inputs.t1.value = '500';
        m2Units.t1.value = 'K';
        m2Inputs.v1.value = '20';
        m2Units.v1.value = 'L';
        m2Inputs.v2.value = '60';
        m2Units.v2.value = 'L';
      }
      updateMod2VisibleFields();
      calculateMod2();
    });
  });

  // =========================================================================
  // RENDERIZADO DEL DIAGRAMA P-V DINÁMICO EN HTML5 CANVAS
  // =========================================================================
  const pvCanvas = document.getElementById('pv-canvas');
  const pvCtx = pvCanvas.getContext('2d');

  function drawPVDiagram() {
    if (!pvCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = pvCanvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const width = rect.width;
    const height = Math.max(330, Math.min(410, rect.width * 0.48));
    if (pvCanvas.width !== Math.round(width * dpr) || pvCanvas.height !== Math.round(height * dpr)) {
      pvCanvas.width = Math.round(width * dpr);
      pvCanvas.height = Math.round(height * dpr);
    }

    pvCtx.save();
    pvCtx.scale(dpr, dpr);

    // Fondo oscuro científico
    pvCtx.fillStyle = '#090d16';
    pvCtx.fillRect(0, 0, width, height);

    const padLeft = 78;
    const padRight = 38;
    const padTop = 36;
    const padBottom = 56;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const { process: proc, P1, V1, P2, V2, n, T1, gamma, W } = simStateMod2;

    // Determinar escalas de los ejes (V desde 0 hasta 1.25 * Vmax; P desde 0 hasta 1.25 * Pmax)
    const vMaxVal = Math.max(V1, V2);
    const vMinVal = Math.min(V1, V2);
    const axisVMax = vMaxVal * 1.25;
    const axisVMin = 0;

    const pMaxVal = Math.max(P1, P2);
    const axisPMax = pMaxVal * 1.25;
    const axisPMin = 0;

    function toCanvasX(v) {
      return padLeft + ((v - axisVMin) / (axisVMax - axisVMin)) * plotW;
    }

    function toCanvasY(p) {
      return padTop + plotH - ((p - axisPMin) / (axisPMax - axisPMin)) * plotH;
    }

    // 1. Dibujar cuadrícula y etiquetas de ejes
    const gridSteps = 5;
    pvCtx.strokeStyle = 'rgba(45, 61, 89, 0.38)';
    pvCtx.lineWidth = 1;
    pvCtx.font = '11px "JetBrains Mono", monospace';
    pvCtx.fillStyle = '#94a3b8';

    for (let i = 0; i <= gridSteps; i++) {
      // Líneas horizontales (Presión en kPa)
      const pVal = (axisPMax * i) / gridSteps;
      const y = toCanvasY(pVal);
      pvCtx.beginPath();
      pvCtx.moveTo(padLeft, y);
      pvCtx.lineTo(padLeft + plotW, y);
      pvCtx.stroke();

      const pLabel = formatNumber(pVal / 1000, 1);
      pvCtx.textAlign = 'right';
      pvCtx.fillText(`${pLabel}`, padLeft - 8, y + 4);

      // Líneas verticales (Volumen en m³)
      const vVal = (axisVMax * i) / gridSteps;
      const x = toCanvasX(vVal);
      pvCtx.beginPath();
      pvCtx.moveTo(x, padTop);
      pvCtx.lineTo(x, padTop + plotH);
      pvCtx.stroke();

      pvCtx.textAlign = 'center';
      pvCtx.fillText(`${formatNumber(vVal, 3)}`, x, padTop + plotH + 18);
    }

    // Títulos de los Ejes
    pvCtx.save();
    pvCtx.fillStyle = '#cbd5e1';
    pvCtx.font = 'bold 12px Inter, sans-serif';
    pvCtx.textAlign = 'center';
    pvCtx.fillText('Volumen V (m³)', padLeft + plotW / 2, height - 12);

    pvCtx.translate(18, padTop + plotH / 2);
    pvCtx.rotate(-Math.PI / 2);
    pvCtx.fillText('Presión Absoluta P (kPa)', 0, 0);
    pvCtx.restore();

    // 2. Generar los puntos exactos de la trayectoria termodinámica (1 -> 2)
    const numSamples = 90;
    const curvePoints = [];
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const v = V1 + t * (V2 - V1);
      let p;
      if (proc === 'isobaric') {
        p = P1;
      } else if (proc === 'isothermal') {
        p = (n * R * T1) / v;
      } else if (proc === 'isochoric') {
        p = P1 + t * (P2 - P1);
      } else if (proc === 'adiabatic') {
        p = P1 * Math.pow(V1 / v, gamma);
      }
      curvePoints.push({ x: toCanvasX(v), y: toCanvasY(p), v, p });
    }

    // 3. Sombrear el área bajo la curva (Trabajo W = integral P dV) si hay cambio de volumen
    if (Math.abs(V2 - V1) > 1e-12) {
      const baseY = toCanvasY(0);
      pvCtx.beginPath();
      pvCtx.moveTo(curvePoints[0].x, baseY);
      curvePoints.forEach((pt) => pvCtx.lineTo(pt.x, pt.y));
      pvCtx.lineTo(curvePoints[curvePoints.length - 1].x, baseY);
      pvCtx.closePath();

      const areaGrad = pvCtx.createLinearGradient(0, padTop, 0, baseY);
      if (W >= 0) {
        areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.36)');
        areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
      } else {
        areaGrad.addColorStop(0, 'rgba(245, 158, 11, 0.36)');
        areaGrad.addColorStop(1, 'rgba(245, 158, 11, 0.05)');
      }
      pvCtx.fillStyle = areaGrad;
      pvCtx.fill();

      // Líneas punteadas verticales desde 1 y 2 hasta el eje V
      pvCtx.save();
      pvCtx.setLineDash([5, 5]);
      pvCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      pvCtx.beginPath();
      pvCtx.moveTo(curvePoints[0].x, curvePoints[0].y);
      pvCtx.lineTo(curvePoints[0].x, baseY);
      pvCtx.moveTo(curvePoints[curvePoints.length - 1].x, curvePoints[curvePoints.length - 1].y);
      pvCtx.lineTo(curvePoints[curvePoints.length - 1].x, baseY);
      pvCtx.stroke();
      pvCtx.restore();

      // Etiqueta W dentro del área sombreada
      const midPt = curvePoints[Math.floor(numSamples / 2)];
      const labelY = Math.min(baseY - 16, (midPt.y + baseY) / 2 + 6);
      pvCtx.fillStyle = W >= 0 ? '#6ee7b7' : '#fcd34d';
      pvCtx.font = 'bold 12px "JetBrains Mono", monospace';
      pvCtx.textAlign = 'center';
      pvCtx.fillText(`Área = W = ${W >= 0 ? '+' : ''}${formatNumber(W, 1)} J`, midPt.x, labelY);
    }

    // Si es adiabático, dibujar curva isoterma de referencia (T1) punteada para comparación física
    if (proc === 'adiabatic') {
      pvCtx.save();
      pvCtx.setLineDash([4, 4]);
      pvCtx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      pvCtx.lineWidth = 1.5;
      pvCtx.beginPath();
      for (let i = 0; i <= numSamples; i++) {
        const v = V1 + (i / numSamples) * (V2 - V1);
        const pIso = (n * R * T1) / v;
        const cx = toCanvasX(v);
        const cy = toCanvasY(pIso);
        if (cy >= padTop && cy <= padTop + plotH) {
          if (i === 0) pvCtx.moveTo(cx, cy);
          else pvCtx.lineTo(cx, cy);
        }
      }
      pvCtx.stroke();
      pvCtx.restore();
    }

    // 4. Trazar la curva principal del proceso
    const mainStrokeColor = W > 0 ? '#10b981' : W < 0 ? '#f59e0b' : '#38bdf8';
    pvCtx.strokeStyle = mainStrokeColor;
    pvCtx.lineWidth = 3.2;
    pvCtx.beginPath();
    curvePoints.forEach((pt, idx) => {
      if (idx === 0) pvCtx.moveTo(pt.x, pt.y);
      else pvCtx.lineTo(pt.x, pt.y);
    });
    pvCtx.stroke();

    // 5. Dibujar Flecha Direccional en la mitad de la curva (1 -> 2)
    const pt1 = curvePoints[0];
    const pt2 = curvePoints[curvePoints.length - 1];
    if (Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y) > 12) {
      const midIdx = Math.floor(numSamples * 0.52);
      const prevPt = curvePoints[midIdx - 3];
      const nextPt = curvePoints[midIdx + 3];
      const midPt = curvePoints[midIdx];
      const angle = Math.atan2(nextPt.y - prevPt.y, nextPt.x - prevPt.x);

      pvCtx.save();
      pvCtx.translate(midPt.x, midPt.y);
      pvCtx.rotate(angle);
      pvCtx.fillStyle = '#f8fafc';
      pvCtx.beginPath();
      pvCtx.moveTo(8, 0);
      pvCtx.lineTo(-7, -6);
      pvCtx.lineTo(-4, 0);
      pvCtx.lineTo(-7, 6);
      pvCtx.closePath();
      pvCtx.fill();
      pvCtx.restore();
    }

    // 6. Dibujar Ejes Principales X y Y encima
    pvCtx.strokeStyle = '#64748b';
    pvCtx.lineWidth = 1.8;
    pvCtx.beginPath();
    pvCtx.moveTo(padLeft, padTop);
    pvCtx.lineTo(padLeft, padTop + plotH);
    pvCtx.lineTo(padLeft + plotW, padTop + plotH);
    pvCtx.stroke();

    // 7. Marcar Punto 1 (Estado Inicial) y Punto 2 (Estado Final)

    // Punto 1
    pvCtx.beginPath();
    pvCtx.arc(pt1.x, pt1.y, 6.5, 0, Math.PI * 2);
    pvCtx.fillStyle = '#38bdf8';
    pvCtx.fill();
    pvCtx.lineWidth = 2;
    pvCtx.strokeStyle = '#090d16';
    pvCtx.stroke();

    // Punto 2
    pvCtx.beginPath();
    pvCtx.arc(pt2.x, pt2.y, 6.5, 0, Math.PI * 2);
    pvCtx.fillStyle = '#10b981';
    pvCtx.fill();
    pvCtx.lineWidth = 2;
    pvCtx.strokeStyle = '#090d16';
    pvCtx.stroke();

    // Etiquetas de coordenadas para Estado 1 y Estado 2
    pvCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
    pvCtx.fillStyle = '#7dd3fc';
    pvCtx.textAlign = pt1.x > padLeft + plotW * 0.7 ? 'right' : 'left';
    const offset1X = pt1.x > padLeft + plotW * 0.7 ? -10 : 10;
    pvCtx.fillText(`1 (${formatNumber(V1, 3)} m³, ${formatNumber(P1 / 1000, 1)} kPa)`, pt1.x + offset1X, pt1.y - 10);

    pvCtx.fillStyle = '#6ee7b7';
    pvCtx.textAlign = pt2.x > padLeft + plotW * 0.7 ? 'right' : 'left';
    const offset2X = pt2.x > padLeft + plotW * 0.7 ? -10 : 10;
    const offset2Y = Math.abs(pt2.y - pt1.y) < 22 ? 20 : -10;
    pvCtx.fillText(`2 (${formatNumber(V2, 3)} m³, ${formatNumber(P2 / 1000, 1)} kPa)`, pt2.x + offset2X, pt2.y + offset2Y);

    pvCtx.restore();
  }

  // Redibujar ambos canvas al cambiar el tamaño de la ventana
  window.addEventListener('resize', () => {
    if (document.getElementById('module-1').classList.contains('active')) {
      drawCylinderFrame();
    } else {
      drawPVDiagram();
    }
  });

  // =========================================================================
  // INICIALIZACIÓN AL CARGAR LA APLICACIÓN
  // =========================================================================
  updateMod1LiveHints();
  calculateMod1(false);
  requestAnimationFrame(drawCylinderFrame);

  updateMod2VisibleFields();
  calculateMod2();
})();
