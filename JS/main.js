/* --- LÓGICA DE LA APLICACIÓN (V5 - Dynamic Intervals) --- */

// 1. Estado y Constantes
let listaViajes = [];
let listaGastos = [];

// Estado de Fechas
let currentPreset = 'month'; // 'today', 'week', 'month', 'custom'
let currentRange = { start: '', end: '' }; // En formato YYYY-MM-DD
let diaActual = 'todos'; // Filtro secundario dentro del rango

const STORAGE_KEY = 'datosConductor_v4';
const STORAGE_KEY_GASTOS = 'datosConductor_v4_gastos';
const PRESET_KEY = 'delivery_date_preset';

// AUTH STATE
let isGuest = false;
let isLoggedIn = false;
let isDataLoaded = false; // Flag to prevent saving before loading
let isSyncing = false;   // Flag to prevent concurrent syncs
const AUTH_TOKEN_KEY = 'delivery_auth_token';

// --- HELPERS DE FECHA ---

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Devuelve el lunes de la semana actual
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para que Lunes sea el primer día
    return new Date(date.setDate(diff));
}

function calculateRange(preset) {
    const hoy = new Date();
    let start, end;

    switch (preset) {
        case 'today':
            start = getLocalDateString(hoy);
            end = getLocalDateString(hoy);
            break;
        case 'week':
            const lunes = getMonday(hoy);
            const domingo = new Date(lunes);
            domingo.setDate(domingo.getDate() + 6);
            start = getLocalDateString(lunes);
            end = getLocalDateString(domingo);
            break;
        case 'month':
            start = getLocalDateString(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
            end = getLocalDateString(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
            break;
        case 'custom':
            // Se mantiene el rango actual o se lee de los inputs si existen
            const inputStart = document.getElementById('startDate').value;
            const inputEnd = document.getElementById('endDate').value;
            if (inputStart && inputEnd) {
                start = inputStart;
                end = inputEnd;
            } else {
                // Fallback default a hoy
                start = getLocalDateString(hoy);
                end = getLocalDateString(hoy);
            }
            break;
    }
    return { start, end };
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    // dateStr YYYY-MM-DD
    const partes = dateStr.split('-');
    // Importante: Crear fecha con partes para evitar líos de zona horaria
    const date = new Date(partes[0], partes[1] - 1, partes[2]);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// --- INITIALIZATION ---

window.onload = function () {
    checkAuth();
    initTheme();
    // Dynamic Year
    const yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.innerText = new Date().getFullYear();

    // Listeners tema
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', switchTheme, false);
    }
};

async function initData() {
    if (isGuest) {
        listaViajes = [];
        listaGastos = [];
        isDataLoaded = true;
        finishInit();
        return;
    }

    // Modo Administrador: Sincronizar
    Swal.fire({
        title: 'Sincronizando...',
        text: 'Conectando con la nube...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const datosNube = await cargarDesdeNube();

        if (datosNube) {
            // Sincronización Exitosa
            listaViajes = datosNube.viajes || [];
            listaGastos = datosNube.gastos || [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
            localStorage.setItem(STORAGE_KEY_GASTOS, JSON.stringify(listaGastos));
            isDataLoaded = true;

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Datos sincronizados',
                showConfirmButton: false,
                timer: 2000
            });
        } else {
            // Falló la red o el servidor (pero no fue 401)
            throw new Error("No se pudo obtener respuesta de la nube");
        }
    } catch (error) {
        console.warn("Fallo en sincronización inicial:", error);

        // Cargar lo que haya en LocalStorage como fallback
        const datosGuardados = localStorage.getItem(STORAGE_KEY);
        const gastosGuardados = localStorage.getItem(STORAGE_KEY_GASTOS);

        if (datosGuardados) {
            listaViajes = JSON.parse(datosGuardados);
            listaGastos = gastosGuardados ? JSON.parse(gastosGuardados) : [];

            Swal.fire({
                icon: 'warning',
                title: 'Modo Offline',
                text: 'No pudimos conectar con la nube. Se están usando los datos guardados en este dispositivo.',
                confirmButtonText: 'Entendido'
            });
        } else {
            listaViajes = [];
            listaGastos = [];
            Swal.fire({
                icon: 'info',
                title: 'Sin datos',
                text: 'No hay datos en la nube ni en este dispositivo.',
                timer: 3000
            });
        }
        isDataLoaded = true; // Permitimos usar la app en modo local
    } finally {
        Swal.close();
        finishInit();
    }
}

function finishInit() {
    // Restaurar Preset o Default
    const savedPreset = localStorage.getItem(PRESET_KEY) || 'month';
    const presetSelect = document.getElementById('datePreset');
    if (presetSelect) presetSelect.value = savedPreset;

    handlePresetChange(savedPreset);
    sanitizarFechasUI();
}


// --- CORE LOGIC: MANEJO DE RANGOS ---

function handlePresetChange(preset) {
    currentPreset = preset;
    localStorage.setItem(PRESET_KEY, preset);

    const customGroup = document.getElementById('customDateRange');
    const inputStart = document.getElementById('startDate');
    const inputEnd = document.getElementById('endDate');

    if (preset === 'custom') {
        customGroup.style.display = 'flex';
        // Si no hay fechas definidas, poner hoy
        if (!inputStart.value) inputStart.value = getLocalDateString();
        if (!inputEnd.value) inputEnd.value = getLocalDateString();
        // Recalcular currentRange basado en inputs
        handleCustomDateChange();
    } else {
        customGroup.style.display = 'none';
        currentRange = calculateRange(preset);
        updateRangeDisplay();
        actualizarSelectorDias();
        actualizarVista();
    }
}

function handleCustomDateChange() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (start && end) {
        // Asegurar orden
        if (start > end) {
            // Si fecha inicio es mayor, igualar o intercambiar?
            // Mejor no hacer nada mágico, solo filtrar. 
            // Opcional: Validar visualmente
        }
        currentRange = { start, end };
        updateRangeDisplay();
        actualizarSelectorDias();
        actualizarVista();
    }
}

function updateRangeDisplay() {
    const display = document.getElementById('rangeDisplay');
    if (!display) return;

    const startFmt = formatDateDisplay(currentRange.start);
    const endFmt = formatDateDisplay(currentRange.end);

    if (startFmt === endFmt) {
        display.innerText = startFmt;
    } else {
        display.innerText = `${startFmt} - ${endFmt}`;
    }
}

function isDateInRange(dateStr) {
    if (!currentRange.start || !currentRange.end) return true;
    return dateStr >= currentRange.start && dateStr <= currentRange.end;
}


// --- RENDERIZADO Y FILTROS ---

function actualizarSelectorDias() {
    const selector = document.getElementById('selectorDia');
    if (!selector) return;

    // Obtener todo lo que esté en el rango actual
    const viajesEnRango = listaViajes.filter(v => isDateInRange(v.fecha));
    const gastosEnRango = listaGastos.filter(g => isDateInRange(g.fecha));

    const fechas = [...new Set([...viajesEnRango.map(v => v.fecha), ...gastosEnRango.map(g => g.fecha)])].sort();

    selector.innerHTML = '<option value="todos">Todos los días</option>';

    fechas.forEach(fecha => {
        // Formato: Lunes 4
        // Truco: Crear fecha 'fecha + T00:00:00'
        const d = new Date(fecha + 'T00:00:00');
        const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'long' });
        const nombreDiaCap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);
        const numero = d.getDate();

        const opt = document.createElement('option');
        opt.value = fecha;
        opt.textContent = `${nombreDiaCap} ${numero}`;
        selector.appendChild(opt);
    });

    if (diaActual !== 'todos' && fechas.includes(diaActual)) {
        selector.value = diaActual;
    } else {
        diaActual = 'todos';
        selector.value = 'todos';
    }
}

function cambiarDia(dia) {
    diaActual = dia;
    actualizarVista();
}


function actualizarVista() {
    const cuerpo = document.getElementById('cuerpoTabla');
    const msg = document.getElementById('mensajeVacio');

    // 1. Filtrar por Rango
    let viajes = listaViajes.filter(v => isDateInRange(v.fecha));

    // 2. Filtrar por Día (si aplica)
    if (diaActual !== 'todos') {
        viajes = viajes.filter(v => v.fecha === diaActual);
    }

    // 3. Ordenar (Más reciente primero para mejor UX? O cronológico?)
    // El usuario suele querer ver lo último arriba si es un rango largo? 
    // Mantenemos CRONOLÓGICO (Ascendente) por ahora, consistente con calendario.
    viajes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    cuerpo.innerHTML = '';

    if (viajes.length === 0) {
        msg.style.display = 'block';
    } else {
        msg.style.display = 'none';

        viajes.forEach(v => {
            const tr = document.createElement('tr');

            // Nombre del día
            const d = new Date(v.fecha + 'T00:00:00');
            const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'long' });
            const nombreDiaCap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);

            // UI Fecha (Dropdown vs Custom)
            const hideSelect = v.tipoFechaUI === 'custom' ? 'style="display:none"' : '';
            const showInput = v.tipoFechaUI === 'custom' ? '' : 'style="display:none"';

            const htmlFecha = `
                <div class="fecha-control-wrapper" style="display: flex; align-items: center; gap: 5px;">
                    <select class="input-tabla selector-fecha-tipo" ${hideSelect} onchange="actualizarDato(${v.id}, 'tipoFechaUI', this.value)">
                        <option value="hoy" ${v.tipoFechaUI === 'hoy' ? 'selected' : ''}>Hoy</option>
                        <option value="ayer" ${v.tipoFechaUI === 'ayer' ? 'selected' : ''}>Ayer</option>
                        <option value="custom" ${v.tipoFechaUI === 'custom' ? 'selected' : ''}>Elegir fecha...</option>
                    </select>
                    
                    <input type="date" class="input-tabla input-fecha-real" 
                        value="${v.fecha}" 
                        ${showInput}
                        onchange="actualizarDato(${v.id}, 'fecha', this.value)"
                    >
                    ${v.tipoFechaUI === 'custom' ?
                    `<button class="btn-reset-date" onclick="actualizarDato(${v.id}, 'tipoFechaUI', 'hoy')" title="Volver a Hoy" style="background:none; border:none; cursor:pointer;">↺</button>`
                    : ''}
                </div>
            `;

            tr.innerHTML = `
                <td data-label="Fecha">${htmlFecha}</td>
                <td data-label="Cliente">
                    <input type="text" class="input-tabla" value="${v.cliente}" placeholder="Destino..." oninput="actualizarDato(${v.id}, 'cliente', this.value)">
                </td>
                <td data-label="Día">
                    <span class="dato-readonly" style="color: var(--color-texto-suave); font-weight: 500;">${nombreDiaCap}</span>
                </td>
                <td data-label="Precio">
                    <input type="number" class="input-tabla" value="${v.precio || ''}" placeholder="₡ 0" oninput="actualizarDato(${v.id}, 'precio', this.value)">
                </td>
                <td data-label="Distancia">
                    <input type="number" step="0.1" class="input-tabla" value="${v.km || ''}" placeholder="0 km" oninput="actualizarDato(${v.id}, 'km', this.value)">
                </td>
                <td data-label="Acción" style="text-align: center;">
                    <button class="boton-borrar" onclick="borrarViaje(${v.id})">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;
            cuerpo.appendChild(tr);
        });
    }

    calcularTotales(viajes);
    renderizarGastos();
}

function renderizarGastos() {
    const cuerpo = document.getElementById('cuerpoTablaGastos');
    const msg = document.getElementById('mensajeGastosVacio');
    if (!cuerpo) return;

    let gastos = listaGastos.filter(g => isDateInRange(g.fecha));

    if (diaActual !== 'todos') {
        gastos = gastos.filter(g => g.fecha === diaActual);
    }

    gastos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    cuerpo.innerHTML = '';

    if (gastos.length === 0) {
        msg.style.display = 'block';
    } else {
        msg.style.display = 'none';

        gastos.forEach(g => {
            const tr = document.createElement('tr');
            const concepto = g.concepto || g.descripcion || g.tipo || '';

            tr.innerHTML = `
                <td data-label="Fecha">
                    <input type="date" class="input-tabla" value="${g.fecha}" 
                        onchange="actualizarGasto(${g.id}, 'fecha', this.value)">
                </td>
                <td data-label="Concepto">
                    <input type="text" class="input-tabla" value="${concepto}" 
                        placeholder="Concepto..." 
                        oninput="actualizarGasto(${g.id}, 'concepto', this.value)">
                </td>
                <td data-label="Monto">
                    <input type="number" class="input-tabla" value="${g.monto || ''}" 
                        placeholder="₡ 0" 
                        oninput="actualizarGasto(${g.id}, 'monto', this.value)">
                </td>
                <td data-label="Acción" style="text-align: center;">
                    <button class="boton-borrar" onclick="borrarGasto(${g.id})">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;
            cuerpo.appendChild(tr);
        });
    }
}


// --- CRUD OPERATIONS ---

function agregarViaje() {
    Swal.fire({
        title: 'Nuevo Viaje',
        html: `
            <input type="date" id="swal-fecha-viaje" class="swal2-input" value="${getLocalDateString()}">
            <input type="text" id="swal-cliente" class="swal2-input" placeholder="Cliente / Destino">
            <input type="number" id="swal-precio" class="swal2-input" placeholder="Precio (₡)">
            <input type="number" step="0.1" id="swal-km" class="swal2-input" placeholder="Distancia (km)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const fecha = document.getElementById('swal-fecha-viaje').value;
            const cliente = document.getElementById('swal-cliente').value;
            const precio = document.getElementById('swal-precio').value;
            const km = document.getElementById('swal-km').value;

            if (!fecha || !cliente || !precio || !km) {
                Swal.showValidationMessage('Todos los campos son obligatorios');
                return false;
            }
            return { fecha, cliente, precio, km };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;

            // Calcular fechaUI (hoy/ayer/custom)
            const d = new Date(data.fecha + 'T00:00:00');
            const hoy = new Date();
            const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

            let tipoFechaUI = 'custom';
            if (d.toDateString() === hoy.toDateString()) tipoFechaUI = 'hoy';
            else if (d.toDateString() === ayer.toDateString()) tipoFechaUI = 'ayer';

            const nuevo = {
                id: Date.now(),
                fecha: data.fecha,
                cliente: data.cliente,
                precio: parseFloat(data.precio),
                km: parseFloat(data.km),
                tipoFechaUI: tipoFechaUI
            };

            listaViajes.push(nuevo);

            actualizarSelectorDias();
            actualizarVista();
            guardar();
        }
    });
}

function agregarGasto() {
    Swal.fire({
        title: 'Registrar Gasto',
        html: `
            <input type="date" id="swal-fecha" class="swal2-input" value="${getLocalDateString()}">
            <input type="text" id="swal-concepto" class="swal2-input" placeholder="Concepto">
            <input type="number" id="swal-monto" class="swal2-input" placeholder="Monto (₡)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        preConfirm: () => {
            const fecha = document.getElementById('swal-fecha').value;
            const concepto = document.getElementById('swal-concepto').value;
            const monto = document.getElementById('swal-monto').value;
            if (!fecha || !concepto || !monto) {
                Swal.showValidationMessage('Datos incompletos');
                return false;
            }
            return { fecha, concepto, monto };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const d = res.value;
            listaGastos.push({
                id: Date.now(),
                fecha: d.fecha,
                concepto: d.concepto,
                monto: parseFloat(d.monto)
            });
            actualizarSelectorDias();
            actualizarVista();
            guardar();
        }
    });
}

window.borrarViaje = function (id) {
    Swal.fire({
        text: '¿Eliminar viaje?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Eliminar'
    }).then((r) => {
        if (r.isConfirmed) {
            listaViajes = listaViajes.filter(v => v.id !== id);
            actualizarSelectorDias();
            actualizarVista();
            guardar();
        }
    });
};

window.borrarGasto = function (id) {
    Swal.fire({
        text: '¿Eliminar gasto?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Eliminar'
    }).then((r) => {
        if (r.isConfirmed) {
            listaGastos = listaGastos.filter(g => g.id !== id);
            actualizarSelectorDias();
            actualizarVista();
            guardar();
        }
    });
};

window.actualizarDato = function (id, campo, valor) {
    const viaje = listaViajes.find(v => v.id === id);
    if (!viaje) return;

    if (campo === 'precio' || campo === 'km') {
        viaje[campo] = parseFloat(valor) || 0;
    } else {
        viaje[campo] = valor;
    }

    if (campo === 'tipoFechaUI') {
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
        if (valor === 'hoy') {
            viaje.fecha = getLocalDateString(hoy);
            viaje.tipoFechaUI = 'hoy';
        } else if (valor === 'ayer') {
            viaje.fecha = getLocalDateString(ayer);
            viaje.tipoFechaUI = 'ayer';
        } else if (valor === 'custom') {
            viaje.tipoFechaUI = 'custom';
        }
        actualizarSelectorDias();
        actualizarVista();
    } else if (campo === 'fecha') {
        // Recalcular tipoFechaUI basado en nueva fecha
        const d = new Date(valor + 'T00:00:00');
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

        if (d.toDateString() === hoy.toDateString()) viaje.tipoFechaUI = 'hoy';
        else if (d.toDateString() === ayer.toDateString()) viaje.tipoFechaUI = 'ayer';
        else viaje.tipoFechaUI = 'custom';

        actualizarSelectorDias();
        actualizarVista();
    } else {
        // Solo datos, no fecha
        calcularTotales(listaViajes.filter(v => isDateInRange(v.fecha))); // Recalcular con filtro actual
    }
    guardar();
};

window.actualizarGasto = function (id, campo, valor) {
    const gasto = listaGastos.find(g => g.id === id);
    if (!gasto) return;

    if (campo === 'monto') gasto[campo] = parseFloat(valor) || 0;
    else gasto[campo] = valor;

    if (campo === 'fecha') {
        actualizarSelectorDias();
        actualizarVista();
    } else {
        calcularTotales(listaViajes.filter(v => isDateInRange(v.fecha)));
    }
    guardar();
};

function guardar() {
    if (!isGuest) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
        localStorage.setItem(STORAGE_KEY_GASTOS, JSON.stringify(listaGastos));

        // SOLO guardar en nube si ya terminamos de cargar (para evitar borrar lo que hay con una lista vacía)
        if (isDataLoaded) {
            guardarEnNube();
        } else {
            console.warn("Guardado en nube omitido: la carga inicial aún no ha terminado.");
        }
    }
}

// --- TOTALES ---

function calcularTotales(viajesActivos) {
    // Viajes Activos ya viene filtrado por actualizarVista
    // Pero si se llama desde otra parte, asegurar
    if (!viajesActivos) {
        viajesActivos = listaViajes.filter(v => isDateInRange(v.fecha));
        if (diaActual !== 'todos') viajesActivos = viajesActivos.filter(v => v.fecha === diaActual);
    }

    // Filtrar gastos con las mismas condiciones
    let gastosActivos = listaGastos.filter(g => isDateInRange(g.fecha));
    if (diaActual !== 'todos') gastosActivos = gastosActivos.filter(g => g.fecha === diaActual);

    const ingresos = viajesActivos.reduce((sum, v) => sum + (v.precio || 0), 0);
    const kms = viajesActivos.reduce((sum, v) => sum + (v.km || 0), 0);
    const egresos = gastosActivos.reduce((sum, g) => sum + (g.monto || 0), 0);
    const ganancia = ingresos - egresos;

    // Render
    document.getElementById('totalVistaDinero').innerText = '₡ ' + ingresos.toLocaleString('es-CR');
    document.getElementById('totalVistaKm').innerText = kms.toFixed(1) + ' km';

    const elGastos = document.getElementById('totalVistaGastos');
    if (elGastos) elGastos.innerText = '₡ ' + egresos.toLocaleString('es-CR');

    const elGanancia = document.getElementById('totalVistaGanancia');
    if (elGanancia) {
        elGanancia.innerText = '₡ ' + ganancia.toLocaleString('es-CR');
        elGanancia.style.color = ganancia >= 0 ? 'var(--color-exito)' : 'var(--color-peligro)';
        elGanancia.closest('.tarjeta-total').style.borderLeftColor = ganancia >= 0 ? 'var(--color-exito)' : 'var(--color-peligro)';
    }

    // Actualizar Títulos de Tarjetas
    const rangoLbl = document.getElementById('rangeDisplay') ? document.getElementById('rangeDisplay').innerText : '';
    // Podríamos poner un texto extra corto si rangoLbl es muy largo, pero probemos así

    renderizarTotalesDiarios(viajesActivos);

    // Btn PDF
    const btnPdf = document.querySelector('.boton-pdf');
    if (btnPdf) btnPdf.disabled = (viajesActivos.length === 0 && gastosActivos.length === 0);
}

function renderizarTotalesDiarios(viajes) {
    const contenedor = document.getElementById('contenedorDias');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Agrupar por fecha EXACTA para que sea más claro en modo Rango
    // O agrupar por Día de Semana como antes?
    // "Totales Diarios" sugiere por Fecha. Antes agrupaba todos los Lunes juntos si era mes?
    // En el código V4: diasSemana.forEach... agrupaba todos los lunes.
    // Para un Rango Personalizado, agrupar todos los lunes puede ser confuso si el rango son 2 meses.
    // Mejor agrupar por FECHA ÚNICA.

    const totalesPorFecha = {};

    viajes.forEach(v => {
        if (!totalesPorFecha[v.fecha]) {
            totalesPorFecha[v.fecha] = { dinero: 0, km: 0, fecha: v.fecha };
        }
        totalesPorFecha[v.fecha].dinero += (v.precio || 0);
        totalesPorFecha[v.fecha].km += (v.km || 0);
    });

    // Ordenar fechas
    const fechasOrdenadas = Object.keys(totalesPorFecha).sort((a, b) => new Date(a) - new Date(b));

    // Generar Cards
    fechasOrdenadas.forEach(fecha => {
        const datos = totalesPorFecha[fecha];
        const d = new Date(fecha + 'T00:00:00');
        const diaSemana = d.toLocaleDateString('es-ES', { weekday: 'long' });
        const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        const fechaFmt = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        // Clase color día
        const mapaClases = {
            'Lunes': 'dia-Lunes', 'Martes': 'dia-Martes', 'Miércoles': 'dia-Miercoles',
            'Jueves': 'dia-Jueves', 'Viernes': 'dia-Viernes', 'Sábado': 'dia-Sabado', 'Domingo': 'dia-Domingo'
        };
        const claseDia = mapaClases[diaSemanaCap.replace('é', 'e')] || ''; // Fix Miércoles tilde

        const card = document.createElement('div');
        card.className = `tarjeta-total dia ${claseDia} fade-in`;
        card.innerHTML = `
            <div class="titulo-tarjeta">${diaSemanaCap} ${fechaFmt}</div>
            <div class="valor-dinero">₡ ${datos.dinero.toLocaleString('es-CR')}</div>
            <div class="valor-km">${datos.km.toFixed(1)} km</div>
        `;
        contenedor.appendChild(card);
    });
}

// --- PDF ---

function generarPDF() {
    Swal.fire({
        title: 'Generar Reporte PDF',
        text: `Reporte: ${document.getElementById('rangeDisplay').innerText}`,
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Sí, incluir gastos',
        denyButtonText: 'Solo viajes',
    }).then((res) => {
        if (res.isDismissed) return;

        const incluirGastos = res.isConfirmed;
        const containerGastos = document.querySelector('.gastos-contenedor');
        const cardGastos = document.getElementById('cardGastos');
        const cardGanancia = document.getElementById('cardGanancia');

        if (!incluirGastos) {
            if (containerGastos) containerGastos.style.display = 'none';
            if (cardGastos) cardGastos.style.display = 'none';
            if (cardGanancia) cardGanancia.style.display = 'none';
        }

        const tituloOriginal = document.title;
        document.title = `Reporte - ${document.getElementById('rangeDisplay').innerText}`;

        setTimeout(() => {
            window.print();
            document.title = tituloOriginal;
            if (!incluirGastos) {
                if (containerGastos) containerGastos.style.display = 'block';
                if (cardGastos) cardGastos.style.display = 'block';
                if (cardGanancia) cardGanancia.style.display = 'block';
            }
        }, 500);
    });
}


// --- DATA CLEANSING ---
function sanitizarFechasUI() {
    // Mismo método de V4
    const hoyStr = new Date().toDateString();
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toDateString();
    let hubo = false;
    listaViajes.forEach(v => {
        if (v.tipoFechaUI === 'hoy') {
            const d = new Date(v.fecha + 'T00:00:00').toDateString();
            if (d !== hoyStr) { v.tipoFechaUI = (d === ayerStr) ? 'ayer' : 'custom'; hubo = true; }
        } else if (v.tipoFechaUI === 'ayer') {
            const d = new Date(v.fecha + 'T00:00:00').toDateString();
            if (d !== ayerStr) { v.tipoFechaUI = 'custom'; hubo = true; }
        }
    });
    if (hubo) localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
}

// --- AUTH & SYNC (COPIED AS IS, ESSENTIAL) ---
// Note: functions checkAuth, handleLogin, save, etc are already above or integrated.
// Re-adding the sync/auth specific chunks if skipped.

async function guardarEnNube() {
    if (isGuest || !isDataLoaded || isSyncing) return;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    isSyncing = true;
    try {
        const res = await fetch('/api/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                viajes: listaViajes,
                gastos: listaGastos,
                ultimaActualizacion: new Date().toISOString()
            })
        });

        if (!res.ok) {
            if (res.status === 401) {
                console.error("Sesión expirada");
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'Sesión expirada. Por favor, vuelve a ingresar.',
                    showConfirmButton: false,
                    timer: 3000
                });
                logout();
            } else {
                throw new Error("Error en sincronización: " + res.status);
            }
        } else {
            console.log("Sincronizado correctamente");
            // Opcional: Toast de éxito muy sutil
        }
    } catch (e) {
        console.error("Fallo guardarEnNube:", e);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Error de conexión. Se guardó localmente.',
            showConfirmButton: false,
            timer: 2000
        });
    } finally {
        isSyncing = false;
    }
}

async function cargarDesdeNube() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;

    // Controlador de tiempo de espera (15 segundos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const r = await fetch('/api/sync', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (r.ok) {
            return await r.json();
        } else if (r.status === 401) {
            console.error("Token inválido al cargar");
            logout();
            return null;
        } else {
            console.error("Error API Sync status:", r.status);
            return null;
        }
    } catch (e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            console.error("Tiempo de espera agotado al cargar desde nube (15s)");
        } else {
            console.error("Error cargando desde nube:", e);
        }
    }
    return null;
}


async function checkAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) { showLoginOverlay(); return; }

    // Validar token brevemente intentando cargar (o con un endpoint de validación)
    // Para ser rápidos, asumimos que es válido pero si la primera carga falla con 401, el logout ocurre allí.
    isLoggedIn = true;
    unlockApp();
}

// Re-implementing simplified checkAuth/handleLogin fully to ensure no break
async function handleLogin(e) {
    e.preventDefault();
    if (isLoggedIn) return;
    const user = document.getElementById('usernameInput').value.trim();
    const pass = document.getElementById('passwordInput').value;

    if (user.toLowerCase() !== 'punjiga') {
        alert('Usuario incorrecto'); return;
    }

    // Mock login or real? V4 had fetch /api/login. 
    // I will assume real fetch is needed.
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        if (res.ok) {
            const d = await res.json();
            localStorage.setItem(AUTH_TOKEN_KEY, d.token);
            isLoggedIn = true;
            unlockApp();
        } else {
            const err = await res.json();
            alert('Error login: ' + (err.error || 'Credenciales inválidas'));
        }
    } catch (err) { alert('Error network: ' + err.message); }
}

function enableGuestMode() {
    isGuest = true; isLoggedIn = true; unlockApp();
}

function unlockApp() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    const banner = document.getElementById('loggedInBanner');
    if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = isGuest ? 'Modo Invitado' : 'Administrador';
        banner.className = isGuest ? 'loggedin-banner guest-mode' : 'loggedin-banner admin-mode';
    }
    initData();
}

function logout() {
    isLoggedIn = false;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    location.reload();
}

function showLoginOverlay() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function toggleTarifasApp() {
    document.getElementById('tarifasPanelApp').classList.toggle('open');
    document.querySelector('.tarifas-toggle-app').classList.toggle('active');
}

function initTheme() {
    const t = localStorage.getItem('theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
}
function switchTheme(e) {
    const t = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
}