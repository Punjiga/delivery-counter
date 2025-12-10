/* --- LÓGICA DE LA APLICACIÓN (V4 - Date Refactor) --- */

// 1. Estado y Constantes
let listaViajes = [];
let fechaVisualizacion = new Date(); // Fecha de referencia para el mes que se está VIENDO
let semanaActual = 'todas'; // 'todas', 1, 2, 3, 4, 5
const STORAGE_KEY = 'datosConductor_v4';
let listaGastos = [];
const STORAGE_KEY_GASTOS = 'datosConductor_v4_gastos';
// AUTH STATE
let isGuest = false;
const AUTH_TOKEN_KEY = 'delivery_auth_token';

// Función para obtener fecha local en formato YYYY-MM-DD (evita problemas de timezone con toISOString)
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 2. Inicialización
window.onload = function () {
    checkAuth();
    // Note: Initialization moved to initData() called after auth
};

function guardar() {
    // Solo guardar en localStorage si es admin (no invitado)
    if (!isGuest) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
        localStorage.setItem(STORAGE_KEY_GASTOS, JSON.stringify(listaGastos));
        // Sincronizar con la nube
        guardarEnNube();
    }
    calcularTotales();
}

// --- SINCRONIZACIÓN CON LA NUBE (JSONBin.io) ---

async function guardarEnNube() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    try {
        const datos = {
            viajes: listaViajes,
            gastos: listaGastos,
            ultimaActualizacion: new Date().toISOString()
        };

        await fetch('/api/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datos)
        });
    } catch (error) {
        console.error('Error al sincronizar con la nube:', error);
    }
}

async function cargarDesdeNube() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;

    try {
        const res = await fetch('/api/sync', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const datos = await res.json();
            return datos;
        }
    } catch (error) {
        console.error('Error al cargar desde la nube:', error);
    }
    return null;
}

// 3. Manejo de Fechas y Navegación
function cambiarMes(delta) {
    // Delta puede ser -1 (mes anterior) o 1 (mes siguiente)
    fechaVisualizacion.setMonth(fechaVisualizacion.getMonth() + delta);
    actualizarEncabezadoMes();
    cambiarSemana('todas'); // Resetear filtro de semana al cambiar mes
}

function irAlMesActual() {
    fechaVisualizacion = new Date();
    actualizarEncabezadoMes();
    // Auto-select semana actual usando fecha local (sin conversión UTC)
    const semanaHoy = getSemanaDelMesLocal(new Date());
    cambiarSemana(semanaHoy);
}

function actualizarEncabezadoMes() {
    const opciones = { month: 'long', year: 'numeric' };
    const textoMes = fechaVisualizacion.toLocaleDateString('es-ES', opciones);
    // Capitalizar primera letra
    const textoFinal = textoMes.charAt(0).toUpperCase() + textoMes.slice(1);
    document.getElementById('tituloMes').innerText = textoFinal;

    // Actualizar etiqueta del total mensual
    const nombreMes = fechaVisualizacion.toLocaleDateString('es-ES', { month: 'long' });
    const etiquetaMes = document.getElementById('etiquetaMes');
    if (etiquetaMes) etiquetaMes.innerText = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

    // Actualizar Textos de los Botones de Semana con Fechas
    actualizarBotonesSemana(nombreMes);
}

function getTextoRangoSemana(semana, nombreMes = '') {
    // Si no tenemos nombreMes, lo sacamos de la fecha actual
    if (!nombreMes) {
        nombreMes = fechaVisualizacion.toLocaleDateString('es-ES', { month: 'long' });
    }

    // Capitalizar
    const nombreMesCap = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    const shortMonth = nombreMesCap.substring(0, 3) + '.'; // Ene. Feb.

    const year = fechaVisualizacion.getFullYear();
    const mesIndex = fechaVisualizacion.getMonth();
    const ultimoDia = new Date(year, mesIndex + 1, 0).getDate();

    if (semana === 'todas') return `(Mes Completo: ${nombreMesCap})`;

    const sem = parseInt(semana);
    if (sem === 1) return `(1-7 ${shortMonth})`;
    if (sem === 2) return `(8-14 ${shortMonth})`;
    if (sem === 3) return `(15-21 ${shortMonth})`;
    if (sem === 4) return `(22-${ultimoDia} ${shortMonth})`;
    return '';
}

function actualizarBotonesSemana(nombreMes) {
    const botones = document.querySelectorAll('.boton-semana');
    const dropdown = document.getElementById('selectorSemanaMobile');

    // Textos
    const txtSem1 = `Semana 1 ${getTextoRangoSemana(1, nombreMes)}`;
    const txtSem2 = `Semana 2 ${getTextoRangoSemana(2, nombreMes)}`;
    const txtSem3 = `Semana 3 ${getTextoRangoSemana(3, nombreMes)}`;
    const txtSem4 = `Semana 4 ${getTextoRangoSemana(4, nombreMes)}`;

    // Actualizar Botones Desktop
    if (botones[0]) botones[0].innerText = txtSem1;
    if (botones[1]) botones[1].innerText = txtSem2;
    if (botones[2]) botones[2].innerText = txtSem3;
    if (botones[3]) botones[3].innerText = txtSem4;

    // Actualizar Dropdown Mobile
    if (dropdown) {
        if (dropdown.options[0]) dropdown.options[0].text = txtSem1;
        if (dropdown.options[1]) dropdown.options[1].text = txtSem2;
        if (dropdown.options[2]) dropdown.options[2].text = txtSem3;
        if (dropdown.options[3]) dropdown.options[3].text = txtSem4;
    }
}

// 4. Filtros de Semana
function cambiarSemana(semana) {
    semanaActual = semana;

    // Actualizar UI botones
    document.querySelectorAll('.boton-semana').forEach(btn => btn.classList.remove('activo'));

    // Sincronizar Dropdown Mobile
    const dropdownMobile = document.getElementById('selectorSemanaMobile');
    if (dropdownMobile) {
        dropdownMobile.value = semana;
    }

    // Mapear índice de botón
    // Botones orden: 1, 2, 3, 4, Todas
    let index = -1;
    if (semana === 'todas') index = 4;
    else index = parseInt(semana) - 1;

    const botones = document.querySelectorAll('.boton-semana');
    if (botones[index]) botones[index].classList.add('activo');

    actualizarVista();
}

function getSemanaDelMes(fechaStr) {
    // Para strings de fecha (usado en filtros de viajes/gastos)
    const dia = new Date(fechaStr + 'T00:00:00').getDate();
    const semana = Math.ceil(dia / 7);
    return semana > 4 ? 4 : semana;
}

function getSemanaDelMesLocal(dateObj) {
    // Para objetos Date locales (usado en inicialización y botón Hoy)
    // Usa getDate() directamente para evitar problemas de timezone con toISOString()
    const dia = dateObj.getDate();
    const semana = Math.ceil(dia / 7);
    return semana > 4 ? 4 : semana;
}

// 5. Gestión de Viajes
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
            return {
                fecha: document.getElementById('swal-fecha-viaje').value,
                cliente: document.getElementById('swal-cliente').value,
                precio: document.getElementById('swal-precio').value,
                km: document.getElementById('swal-km').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;
            if (!data.fecha) return;

            // Determinar tipoFechaUI
            const d = new Date(data.fecha + 'T00:00:00');
            const hoy = new Date();
            const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

            let tipoFechaUI = 'custom';
            if (d.toDateString() === hoy.toDateString()) tipoFechaUI = 'hoy';
            else if (d.toDateString() === ayer.toDateString()) tipoFechaUI = 'ayer';

            const nuevoViaje = {
                id: Date.now(),
                fecha: data.fecha,
                cliente: data.cliente || '',
                precio: parseFloat(data.precio) || 0,
                km: parseFloat(data.km) || 0,
                tipoFechaUI: tipoFechaUI
            };

            listaViajes.push(nuevoViaje);

            // Si la fecha seleccionada es del mes actual o diferente, 
            // actualizamos la vista actual. Si el usuario agregó una fecha 
            // de otro mes, no se verá hasta que cambie de mes.
            actualizarVista();
            guardar();
        }
    });
}

window.borrarViaje = function (id) {
    Swal.fire({
        text: '¿Estás seguro de eliminar este viaje?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            listaViajes = listaViajes.filter(v => v.id !== id);
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

    guardar(); // Auto-guardado y recalculo de totales
    // Si cambiamos la fecha, podría cambiar el día de la semana, forzar re-render de esa fila o todo?
    // Mejor todo para asegurar orden y filtros.
    if (campo === 'fecha') {
        const d = new Date(valor + 'T00:00:00');
        // Chequear si coincide con hoy o ayer para actualizar UI
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

        const esHoy = d.toDateString() === hoy.toDateString();
        const esAyer = d.toDateString() === ayer.toDateString();

        if (esHoy) viaje.tipoFechaUI = 'hoy';
        else if (esAyer) viaje.tipoFechaUI = 'ayer';
        else viaje.tipoFechaUI = 'custom';

        actualizarVista();
    } else if (campo === 'tipoFechaUI') {
        // Manejar lógica del dropdown
        const hoy = new Date();
        const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);

        if (valor === 'hoy') {
            viaje.fecha = hoy.toISOString().split('T')[0];
            viaje.tipoFechaUI = 'hoy';
        } else if (valor === 'ayer') {
            viaje.fecha = ayer.toISOString().split('T')[0];
            viaje.tipoFechaUI = 'ayer';
        } else if (valor === 'custom') {
            viaje.tipoFechaUI = 'custom';
            // No cambiamos la fecha aun, dejamos que el input date lo haga
        }
        actualizarVista();
    }
    // Si solo es cliente/precio/km, no hace falta re-renderizar todo, pero totales sí
    else {
        calcularTotales();
    }
};

window.borrarGasto = function (id) {
    Swal.fire({
        text: '¿Eliminar este gasto?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            listaGastos = listaGastos.filter(g => g.id !== id);
            actualizarVista();
            guardar();
        }
    });
};

// Función para actualizar gastos inline (como viajes)
window.actualizarGasto = function (id, campo, valor) {
    const gasto = listaGastos.find(g => g.id === id);
    if (!gasto) return;

    if (campo === 'monto') {
        gasto[campo] = parseFloat(valor) || 0;
    } else {
        gasto[campo] = valor;
    }

    guardar();

    // Si cambiamos la fecha, podría afectar filtros
    if (campo === 'fecha') {
        actualizarVista();
    } else {
        calcularTotales();
    }
};

function agregarGasto() {
    Swal.fire({
        title: 'Registrar Gasto',
        html: `
            <input type="date" id="swal-fecha" class="swal2-input" value="${getLocalDateString()}">
            <input type="text" id="swal-concepto" class="swal2-input" placeholder="Concepto (ej: Gasolina, Comida...)">
            <input type="number" id="swal-monto" class="swal2-input" placeholder="Monto (₡)">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                fecha: document.getElementById('swal-fecha').value,
                concepto: document.getElementById('swal-concepto').value,
                monto: document.getElementById('swal-monto').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;
            if (!data.monto || !data.fecha) return;

            const nuevoGasto = {
                id: Date.now(),
                fecha: data.fecha,
                concepto: data.concepto || 'Gasto',
                monto: parseFloat(data.monto)
            };

            listaGastos.push(nuevoGasto);
            actualizarVista();
            guardar();
        }
    });
}

// 6. Renderizado
function actualizarVista() {
    const cuerpoTabla = document.getElementById('cuerpoTabla');
    const mensajeVacio = document.getElementById('mensajeVacio');

    // Filtros
    const mesVisto = fechaVisualizacion.getMonth();
    const anioVisto = fechaVisualizacion.getFullYear();

    let viajesFiltrados = listaViajes.filter(v => {
        const d = new Date(v.fecha + 'T00:00:00');
        return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
    });

    if (semanaActual !== 'todas') {
        viajesFiltrados = viajesFiltrados.filter(v => getSemanaDelMes(v.fecha) === semanaActual);
    }

    // Ordenar por fecha descendente (más reciente primero) o ascendente?
    // Generalmente registro de viajes es cronológico.
    // Ordenar por fecha ASCENDENTE (del 1 al 31)
    viajesFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    cuerpoTabla.innerHTML = '';

    if (viajesFiltrados.length === 0) {
        mensajeVacio.style.display = 'block';
    } else {
        mensajeVacio.style.display = 'none';

        viajesFiltrados.forEach(viaje => {
            const fila = document.createElement('tr');

            // Calcular Día de la semana
            const dateObj = new Date(viaje.fecha + 'T00:00:00');
            const nombreDia = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
            const nombreDiaCap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);

            // Lógica UI fecha
            let inputFechaHtml = '';
            const hideSelectClass = viaje.tipoFechaUI === 'custom' ? 'style="display:none"' : '';
            const showInputClass = viaje.tipoFechaUI === 'custom' ? '' : 'style="display:none"';

            // Selector dropdown
            inputFechaHtml += `
                <div class="fecha-control-wrapper" style="display: flex; align-items: center; gap: 5px;">
                    <select class="input-tabla selector-fecha-tipo" ${hideSelectClass} onchange="actualizarDato(${viaje.id}, 'tipoFechaUI', this.value)">
                        <option value="hoy" ${viaje.tipoFechaUI === 'hoy' ? 'selected' : ''}>Hoy</option>
                        <option value="ayer" ${viaje.tipoFechaUI === 'ayer' ? 'selected' : ''}>Ayer</option>
                        <option value="custom" ${viaje.tipoFechaUI === 'custom' ? 'selected' : ''}>Elegir fecha...</option>
                    </select>
                    
                    <input type="date" class="input-tabla input-fecha-real" 
                        value="${viaje.fecha}" 
                        ${showInputClass}
                        onchange="actualizarDato(${viaje.id}, 'fecha', this.value)"
                    >
                    ${viaje.tipoFechaUI === 'custom' ?
                    `<button class="btn-reset-date" onclick="actualizarDato(${viaje.id}, 'tipoFechaUI', 'hoy')" title="Volver a Hoy" style="background:none; border:none; cursor:pointer;">↺</button>`
                    : ''}
                </div>
            `;

            fila.innerHTML = `
                <td data-label="Fecha">
                   ${inputFechaHtml}
                </td>
                <td data-label="Cliente">
                    <input type="text" class="input-tabla" value="${viaje.cliente}" placeholder="Destino..." oninput="actualizarDato(${viaje.id}, 'cliente', this.value)">
                </td>
                <td data-label="Día">
                    <span class="dato-readonly" style="color: var(--color-texto-suave); font-weight: 500;">${nombreDiaCap}</span>
                </td>
                <td data-label="Precio">
                    <input type="number" class="input-tabla" value="${viaje.precio || ''}" placeholder="₡ 0" oninput="actualizarDato(${viaje.id}, 'precio', this.value)">
                </td>
                <td data-label="Distancia">
                    <input type="number" step="0.1" class="input-tabla" value="${viaje.km || ''}" placeholder="0 km" oninput="actualizarDato(${viaje.id}, 'km', this.value)">
                </td>
                <td data-label="Acción" style="text-align: center;">
                    <button class="boton-borrar" onclick="borrarViaje(${viaje.id})">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;
            cuerpoTabla.appendChild(fila);
        });
    }

    calcularTotales(viajesFiltrados);
    renderizarGastos(); // Renderizar gastos también
}

function renderizarGastos() {
    const cuerpoTabla = document.getElementById('cuerpoTablaGastos');
    const mensajeVacio = document.getElementById('mensajeGastosVacio');
    if (!cuerpoTabla) return;

    // Filtros (Mismos que viajes)
    const mesVisto = fechaVisualizacion.getMonth();
    const anioVisto = fechaVisualizacion.getFullYear();

    let gastosFiltrados = listaGastos.filter(g => {
        const d = new Date(g.fecha + 'T00:00:00');
        return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
    });

    if (semanaActual !== 'todas') {
        gastosFiltrados = gastosFiltrados.filter(g => getSemanaDelMes(g.fecha) === semanaActual);
    }

    gastosFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    cuerpoTabla.innerHTML = '';

    if (gastosFiltrados.length === 0) {
        mensajeVacio.style.display = 'block';
    } else {
        mensajeVacio.style.display = 'none';
        gastosFiltrados.forEach(gasto => {
            const fila = document.createElement('tr');

            // Compatibilidad: usar 'concepto' o fallback a 'tipo'/'descripcion' de datos antiguos
            const conceptoValor = gasto.concepto || gasto.descripcion || gasto.tipo || '';

            fila.innerHTML = `
                <td data-label="Fecha">
                    <input type="date" class="input-tabla" value="${gasto.fecha}" 
                        onchange="actualizarGasto(${gasto.id}, 'fecha', this.value)">
                </td>
                <td data-label="Concepto">
                    <input type="text" class="input-tabla" value="${conceptoValor}" 
                        placeholder="Concepto..." 
                        oninput="actualizarGasto(${gasto.id}, 'concepto', this.value)">
                </td>
                <td data-label="Monto">
                    <input type="number" class="input-tabla" value="${gasto.monto || ''}" 
                        placeholder="₡ 0" 
                        oninput="actualizarGasto(${gasto.id}, 'monto', this.value)">
                </td>
                <td data-label="Acción" style="text-align: center;">
                    <button class="boton-borrar" onclick="borrarGasto(${gasto.id})">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;
            cuerpoTabla.appendChild(fila);
        });
    }
}

// --- AUTHENTICATION LOGIC ---

function checkAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        showLoginOverlay();
        return;
    }

    // Decode token to check expiry (Simplified client check)
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            logout();
            return;
        }
    } catch (e) {
        logout();
        return;
    }

    // Token valid
    unlockApp();
}

async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('passwordInput').value;
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Verificando...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            unlockApp();
        } else {
            Swal.fire('Error', 'Contraseña incorrecta', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function enableGuestMode() {
    isGuest = true;
    unlockApp();
    // Invitados pueden usar la app normalmente, pero sus datos no se guardan
}

function unlockApp() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';

    // Update Banner with proper styling
    const banner = document.getElementById('loggedInBanner');
    if (banner) {
        banner.style.display = 'block';
        if (isGuest) {
            banner.className = 'loggedin-banner guest-mode';
            banner.innerHTML = 'Accediste como: <strong>INVITADO</strong>';
        } else {
            banner.className = 'loggedin-banner admin-mode';
            banner.innerHTML = 'Accediste como: <strong>ADMINISTRADOR</strong>';
        }
    }

    // Inicializar App
    initData();
}

function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    location.reload();
}

function showLoginOverlay() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

async function initData() {
    // Invitados empiezan con listas vacías (datos temporales)
    // Admin carga datos desde la nube primero, fallback a localStorage
    if (!isGuest) {
        // Intentar cargar desde la nube primero
        const datosNube = await cargarDesdeNube();

        if (datosNube && datosNube.viajes) {
            // Datos de la nube disponibles
            listaViajes = datosNube.viajes || [];
            listaGastos = datosNube.gastos || [];
            // Actualizar localStorage con datos de la nube
            localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
            localStorage.setItem(STORAGE_KEY_GASTOS, JSON.stringify(listaGastos));
        } else {
            // Fallback: cargar desde localStorage
            const datosGuardados = localStorage.getItem(STORAGE_KEY);
            if (datosGuardados) {
                listaViajes = JSON.parse(datosGuardados);
            }
            const gastosGuardados = localStorage.getItem(STORAGE_KEY_GASTOS);
            if (gastosGuardados) {
                listaGastos = JSON.parse(gastosGuardados);
            }
        }
    } else {
        listaViajes = [];
        listaGastos = [];
    }

    // Asegurar que fechaVisualizacion empiece en el mes actual real
    fechaVisualizacion = new Date();

    // Sanitizar Fechas
    sanitizarFechasUI();

    actualizarEncabezadoMes();

    // Auto-Select Semana Actual usando fecha local (sin conversión UTC)
    const semanaHoy = getSemanaDelMesLocal(new Date());
    cambiarSemana(semanaHoy);
}

// 7. Cálculos
function calcularTotales(viajesYaFiltrados) {
    // 1. Filtrar Viajes (Ingresos)
    let viajes = viajesYaFiltrados;
    const mesVisto = fechaVisualizacion.getMonth();
    const anioVisto = fechaVisualizacion.getFullYear();

    if (!viajes) {
        viajes = listaViajes.filter(v => {
            const d = new Date(v.fecha + 'T00:00:00');
            return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
        });
        if (semanaActual !== 'todas') {
            viajes = viajes.filter(v => getSemanaDelMes(v.fecha) === semanaActual);
        }
    }

    // 2. Filtrar Gastos (Egresos) - Misma lógica de filtro
    let gastos = listaGastos.filter(g => {
        const d = new Date(g.fecha + 'T00:00:00');
        return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
    });
    if (semanaActual !== 'todas') {
        gastos = gastos.filter(g => getSemanaDelMes(g.fecha) === semanaActual);
    }

    // 3. Calcular Sumas
    const totalIngresos = viajes.reduce((sum, v) => sum + (v.precio || 0), 0);
    const totalKm = viajes.reduce((sum, v) => sum + (v.km || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
    const gananciaNeta = totalIngresos - totalGastos;

    // 4. Actualizar DOM - Mostrar valores para todos (admin e invitados)
    const dineroText = '₡ ' + totalIngresos.toLocaleString('es-CR');
    const gastosText = '₡ ' + totalGastos.toLocaleString('es-CR');
    const gananciaText = '₡ ' + gananciaNeta.toLocaleString('es-CR');

    document.getElementById('totalVistaDinero').innerHTML = dineroText;
    document.getElementById('totalVistaKm').innerText = totalKm.toFixed(1) + ' km';

    const elGastos = document.getElementById('totalVistaGastos');
    if (elGastos) elGastos.innerHTML = gastosText;

    // Ganancia Neta: Color Exito (Verde) si positivo, Peligro (Rojo) si negativo
    const elGanancia = document.getElementById('totalVistaGanancia');
    if (elGanancia) {
        elGanancia.innerHTML = gananciaText;
        // Usar verde para ganancia (exito), rojo para perdida (peligro)
        elGanancia.style.color = gananciaNeta >= 0 ? 'var(--color-exito)' : 'var(--color-peligro)';

        // También actualizar el borde de la tarjeta de ganancia para que coincida
        const tarjetaGanancia = elGanancia.closest('.tarjeta-total');
        if (tarjetaGanancia) {
            tarjetaGanancia.style.borderLeftColor = gananciaNeta >= 0 ? 'var(--color-exito)' : 'var(--color-peligro)';
        }
    }

    // Actualizar Títulos de Totales con Rangos Dinámicos
    const rangoTexto = getTextoRangoSemana(semanaActual);

    // Título Ingresos
    const tituloIngresos = document.getElementById('tituloIngresos');
    if (tituloIngresos) {
        tituloIngresos.innerText = `Ingresos ${rangoTexto}`;
    } else {
        // Fallback por si no encuentra el ID (versión anterior HTML)
        const tituloTotalVista = document.querySelector('.tarjeta-total.semana .titulo-tarjeta');
        if (tituloTotalVista) tituloTotalVista.innerText = `Ingresos ${rangoTexto}`;
    }

    // Título Gastos
    const tituloGastos = document.getElementById('tituloGastos');
    if (tituloGastos) {
        tituloGastos.innerText = `Gastos ${rangoTexto}`;
    }

    // Título Ganancia Neta
    const tituloGanancia = document.getElementById('tituloGanancia');
    if (tituloGanancia) {
        tituloGanancia.innerText = `Ganancia Neta ${rangoTexto}`;
    }

    renderizarTotalesDiarios(viajes);

    // Botón PDF logic
    const botonPDF = document.querySelector('.boton-pdf');
    if (botonPDF) {
        const hayDatos = (viajes.length > 0) || (gastos.length > 0);
        botonPDF.disabled = !hayDatos;
    }
}

function renderizarTotalesDiarios(viajes) {
    const contenedorDias = document.getElementById('contenedorDias');
    if (!contenedorDias) return;
    contenedorDias.innerHTML = '';

    // Agrupar por día de la semana
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Inicializar acumuladores con lista de fechas
    const totalesDias = {};
    diasSemana.forEach(d => totalesDias[d] = { dinero: 0, km: 0, count: 0, fechas: [] });

    viajes.forEach(v => {
        const d = new Date(v.fecha + 'T00:00:00');
        const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'long' });
        const nombreCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);

        if (totalesDias[nombreCapitalizado]) {
            totalesDias[nombreCapitalizado].dinero += (v.precio || 0);
            totalesDias[nombreCapitalizado].km += (v.km || 0);
            totalesDias[nombreCapitalizado].count++;
            // Guardar fecha única
            if (!totalesDias[nombreCapitalizado].fechas.includes(v.fecha)) {
                totalesDias[nombreCapitalizado].fechas.push(v.fecha);
            }
        }
    });

    // Renderizar tarjetas solo para días con datos
    diasSemana.forEach(dia => {
        if (totalesDias[dia].count > 0) {
            const mapaClases = {
                'Lunes': 'dia-Lunes', 'Martes': 'dia-Martes', 'Miércoles': 'dia-Miercoles',
                'Jueves': 'dia-Jueves', 'Viernes': 'dia-Viernes', 'Sábado': 'dia-Sabado', 'Domingo': 'dia-Domingo'
            };

            // Crear texto de fechas (ej: "4 Dic." o "4, 11 Dic.")
            const fechasTexto = totalesDias[dia].fechas.map(f => {
                const dateObj = new Date(f + 'T00:00:00');
                const texto = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                // Capitalizar mes
                const partes = texto.split(' ');
                if (partes.length > 1) {
                    partes[1] = partes[1].charAt(0).toUpperCase() + partes[1].slice(1);
                }
                return partes.join(' ');
            }).join(', ');

            const dineroDiaText = '₡ ' + totalesDias[dia].dinero.toLocaleString('es-CR');

            const tarjeta = document.createElement('div');
            tarjeta.className = `tarjeta-total dia ${mapaClases[dia] || ''} fade-in`;
            tarjeta.innerHTML = `
                <div class="titulo-tarjeta">Total ${dia} (${fechasTexto})</div>
                <div class="valor-dinero">${dineroDiaText}</div>
                <div class="valor-km">${totalesDias[dia].km.toFixed(1)} km</div>
            `;
            contenedorDias.appendChild(tarjeta);
        }
    });
}

function generarPDF() {
    // Preguntar si incluir gastos
    Swal.fire({
        title: 'Generar Reporte PDF',
        text: "¿Deseas incluir la tabla de gastos en el reporte?",
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Sí, incluir gastos',
        denyButtonText: 'No, solo viajes',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isDismissed) return; // Cancelado

        const incluirGastos = result.isConfirmed;
        // const vistaOriginal = semanaActual; // Ya no necesitamos guardar vista original porque no la cambiamos

        // NO cambiamos a vista completa, respetamos la vista actual del usuario
        // cambiarSemana('todas');

        // Manejar visibilidad de gastos usando IDs
        const containerGastos = document.querySelector('.gastos-contenedor');
        const cardGastos = document.getElementById('cardGastos');
        const cardGanancia = document.getElementById('cardGanancia');

        // Si NO incluye gastos, ocultamos cosas
        if (!incluirGastos) {
            if (containerGastos) containerGastos.style.display = 'none';
            if (cardGastos) cardGastos.style.display = 'none';
            if (cardGanancia) cardGanancia.style.display = 'none';
        }

        setTimeout(() => {
            window.print();

            // Restaurar visibilidad
            if (!incluirGastos) {
                if (containerGastos) containerGastos.style.display = 'block';
                if (cardGastos) cardGastos.style.display = 'block';
                if (cardGanancia) cardGanancia.style.display = 'block';

                // Forzar re-calculo para asegurar estilos correctos
                calcularTotales();
            }
        }, 500);
    });
}

// Nueva función para corregir inconsistencias de "Hoy" y "Ayer" al cargar
function sanitizarFechasUI() {
    const hoyStr = new Date().toDateString();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toDateString();

    let huboCambios = false;

    // Revisar Viajes
    listaViajes.forEach(viaje => {
        if (!viaje.tipoFechaUI || viaje.tipoFechaUI === 'custom') return;

        const fechaViaje = new Date(viaje.fecha + 'T00:00:00').toDateString();

        if (viaje.tipoFechaUI === 'hoy') {
            if (fechaViaje !== hoyStr) {
                // Si dice hoy pero no es hoy:
                if (fechaViaje === ayerStr) viaje.tipoFechaUI = 'ayer';
                else viaje.tipoFechaUI = 'custom';
                huboCambios = true;
            }
        } else if (viaje.tipoFechaUI === 'ayer') {
            if (fechaViaje !== ayerStr) {
                viaje.tipoFechaUI = 'custom';
                huboCambios = true;
            }
        }
    });

    if (huboCambios) {
        // Guardamos silenciosamente para limpiar la BD local
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
    }
}