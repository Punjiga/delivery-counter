/* --- LÓGICA DE LA APLICACIÓN (V4 - Date Refactor) --- */

// 1. Estado y Constantes
let listaViajes = [];
let fechaVisualizacion = new Date(); // Fecha de referencia para el mes que se está VIENDO
let semanaActual = 'todas'; // 'todas', 1, 2, 3, 4, 5
const STORAGE_KEY = 'datosConductor_v4';

// 2. Inicialización
window.onload = function () {
    const datosGuardados = localStorage.getItem(STORAGE_KEY);
    if (datosGuardados) {
        listaViajes = JSON.parse(datosGuardados);
    }

    // Asegurar que fechaVisualizacion empiece en el mes actual real
    fechaVisualizacion = new Date();

    // Auto-Select Semana Actual
    // Si la fecha actual coincide con el mes visualizado (que es true al inicio), seleccionar la semana correspondiente
    const hoy = new Date();
    const semanaHoy = getSemanaDelMes(hoy.toISOString().split('T')[0]);
    semanaActual = semanaHoy;

    actualizarEncabezadoMes();
    // Nota: actualizarEncabezadoMes ahora llamará a actualizarBotonesSemana()
    actualizarVista();
};

function guardar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listaViajes));
    calcularTotales();
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
    // Auto-select semana actual al volver a "Hoy"
    const hoy = new Date();
    semanaActual = getSemanaDelMes(hoy.toISOString().split('T')[0]);
    actualizarVista();
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

function actualizarBotonesSemana(nombreMes) {
    const year = fechaVisualizacion.getFullYear();
    const mesIndex = fechaVisualizacion.getMonth();
    // Obtener último día del mes (28, 29, 30, 31)
    const ultimoDia = new Date(year, mesIndex + 1, 0).getDate();

    const botones = document.querySelectorAll('.boton-semana');
    const dropdown = document.getElementById('selectorSemanaMobile');
    const shortMonth = nombreMes.substring(0, 3) + '.'; // Ene. Feb.

    // Textos
    const txtSem1 = `Semana 1 (1-7 ${shortMonth})`;
    const txtSem2 = `Semana 2 (8-14 ${shortMonth})`;
    const txtSem3 = `Semana 3 (15-21 ${shortMonth})`;
    const txtSem4 = `Semana 4 (22-${ultimoDia} ${shortMonth})`;

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
    // Heurística simple: Semana 1 (1-7), Semana 2 (8-14), etc.
    // Esto coincide con la estructura visual de "4 semanas" mejor que las semanas de calendario reales que varían
    const dia = new Date(fechaStr + 'T00:00:00').getDate(); // T00:00:00 para evitar problemas de timezone
    const semana = Math.ceil(dia / 7);
    return semana > 4 ? 4 : semana; // Agrupar días 29-31 en semana 4 o dejar que sean 5? 
    // El usuario tenía botones hasta Semana 4. Vamos a asumir que semana 5 se muestra en la 4 o creamos botón semana 5?
    // Mejor: Si es día > 28, es semana 5. Pero si la UI solo tiene 4 botones, mostramos en la 4 o agregamos botón?
    // Revisando index.html original, tenía 4 botones. Voy a permitir que retorne 5 y si no hay botón, se ve en "Todas".
    // O mejor, agrupar 5ta semana con la 4ta para simplificar si no queremos cambiar HTML de botones
    return Math.ceil(dia / 7);
}

// 5. Gestión de Viajes
function agregarViaje() {
    // Por defecto hoy
    const hoy = new Date();
    const fechaStr = hoy.toISOString().split('T')[0];

    // Asegurar que estamos viendo el mes donde agregamos el viaje?
    // O simplemente agregarlo. Si agrego un viaje HOY pero estoy viendo hace 3 meses, no se verá.
    // Lo lógico es mover la vista a HOY al agregar.
    irAlMesActual();

    const nuevoViaje = {
        id: Date.now(),
        fecha: fechaStr,
        cliente: '',
        precio: 0,
        km: 0,
        tipoFechaUI: 'hoy' // 'hoy', 'ayer', 'custom' - para persistir el estado del dropdown
    };

    listaViajes.push(nuevoViaje);
    actualizarVista();
    guardar();
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
}

// 7. Cálculos
function calcularTotales(viajesYaFiltrados) {
    // Si no pasamos argumentos, recalculamos filtrando de nuevo (útil para cuando carga la página)
    let viajes = viajesYaFiltrados;
    if (!viajes) {
        const mesVisto = fechaVisualizacion.getMonth();
        const anioVisto = fechaVisualizacion.getFullYear();
        viajes = listaViajes.filter(v => {
            const d = new Date(v.fecha + 'T00:00:00');
            return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
        });
        if (semanaActual !== 'todas') {
            viajes = viajes.filter(v => getSemanaDelMes(v.fecha) === semanaActual);
        }
    }

    // Totales de la VISTA ACTUAL
    const totalDinero = viajes.reduce((sum, v) => sum + (v.precio || 0), 0);
    const totalKm = viajes.reduce((sum, v) => sum + (v.km || 0), 0);

    document.getElementById('totalVistaDinero').innerText = '₡ ' + totalDinero.toLocaleString('es-CR');
    document.getElementById('totalVistaKm').innerText = totalKm.toFixed(1) + ' km';

    // Actualizar Título de Totales
    const tituloTotalVista = document.querySelector('.tarjeta-total.semana .titulo-tarjeta');
    if (tituloTotalVista) {
        if (semanaActual === 'todas') tituloTotalVista.innerText = "TOTAL VISTA ACTUAL";
        else tituloTotalVista.innerText = `TOTAL SEMANA ${semanaActual}`;
    }

    // Totales del MES COMPLETO (independiente de la semana vista)
    const mesVisto = fechaVisualizacion.getMonth();
    const anioVisto = fechaVisualizacion.getFullYear();
    const viajesMes = listaViajes.filter(v => {
        const d = new Date(v.fecha + 'T00:00:00');
        return d.getMonth() === mesVisto && d.getFullYear() === anioVisto;
    });

    const totalMesDinero = viajesMes.reduce((sum, v) => sum + (v.precio || 0), 0);
    const totalMesKm = viajesMes.reduce((sum, v) => sum + (v.km || 0), 0);

    document.getElementById('totalMesDinero').innerText = '₡ ' + totalMesDinero.toLocaleString('es-CR');
    document.getElementById('totalMesKm').innerText = totalMesKm.toFixed(1) + ' km';

    renderizarTotalesDiarios(viajes);

    // Botón PDF
    const botonPDF = document.querySelector('.boton-pdf');
    if (botonPDF) {
        const hayDatos = viajes.some(v => v.precio > 0 && v.cliente);
        botonPDF.disabled = !hayDatos;
    }
}

function renderizarTotalesDiarios(viajes) {
    const contenedorDias = document.getElementById('contenedorDias');
    if (!contenedorDias) return;
    contenedorDias.innerHTML = '';

    // Agrupar por día de la semana
    // Queremos mostrar: Lunes: X, Martes: Y...
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Inicializar acumuladores
    const totalesDias = {};
    diasSemana.forEach(d => totalesDias[d] = { dinero: 0, km: 0, count: 0 });

    viajes.forEach(v => {
        const d = new Date(v.fecha + 'T00:00:00');
        const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'long' });
        const nombreCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);

        // Mapear nombres si varian (tildes etc)
        // toLocaleDateString devuelve 'miércoles', 'sábado' con tilde.
        if (totalesDias[nombreCapitalizado]) {
            totalesDias[nombreCapitalizado].dinero += (v.precio || 0);
            totalesDias[nombreCapitalizado].km += (v.km || 0);
            totalesDias[nombreCapitalizado].count++;
        }
    });

    // Renderizar tarjetas solo para días con datos
    diasSemana.forEach(dia => {
        if (totalesDias[dia].count > 0) {
            // Clases de colores
            const mapaClases = {
                'Lunes': 'dia-Lunes', 'Martes': 'dia-Martes', 'Miércoles': 'dia-Miercoles',
                'Jueves': 'dia-Jueves', 'Viernes': 'dia-Viernes', 'Sábado': 'dia-Sabado', 'Domingo': 'dia-Domingo'
            };

            const tarjeta = document.createElement('div');
            tarjeta.className = `tarjeta-total dia ${mapaClases[dia] || ''} fade-in`;
            tarjeta.innerHTML = `
                <div class="titulo-tarjeta">Total ${dia}</div>
                <div class="valor-dinero">₡ ${totalesDias[dia].dinero.toLocaleString('es-CR')}</div>
                <div class="valor-km">${totalesDias[dia].km.toFixed(1)} km</div>
            `;
            contenedorDias.appendChild(tarjeta);
        }
    });
}

function generarPDF() {
    // Para el PDF, idealmemnte mostrar TODO el mes o lo que se ve?
    // User logic: "Descargar Reporte PDF". Usualmente es lo que se ve.
    // Pero si quieren reporte mensual, mejor cambiar a 'todas' temporalmente como antes.
    const vistaOriginal = semanaActual;
    cambiarSemana('todas');

    setTimeout(() => {
        window.print();
        // Restaurar si se desea:
        // cambiarSemana(vistaOriginal); 
    }, 500);
}