/* --- LÓGICA DE LA APLICACIÓN --- */

// 1. Estado Inicial de los Datos
let listaViajes = [];
let semanaActual = 1; // 1, 2, 3, 4 o 'todas'
let mesActual = 'Noviembre';

// 2. Al abrir la página (Cargar datos)
window.onload = function () {
    // Recuperar datos guardados
    const datosGuardados = localStorage.getItem('datosConductor_v3');
    const mesGuardado = localStorage.getItem('mesConductor_v3');

    if (datosGuardados) {
        listaViajes = JSON.parse(datosGuardados);
    }

    if (mesGuardado) {
        mesActual = mesGuardado;
        document.getElementById('selectorMes').value = mesActual;
    }

    actualizarVista();
};

// 3. Función para Guardar (Automático)
function guardar() {
    localStorage.setItem('datosConductor_v3', JSON.stringify(listaViajes));
    localStorage.setItem('mesConductor_v3', mesActual);

    // Recalcular totales cada vez que se guarde
    calcularTotales();
}

// 4. Cambiar Mes
function cambiarMes() {
    mesActual = document.getElementById('selectorMes').value;
    // Reiniciar a semana 1 al cambiar de mes
    cambiarSemana(1);
}

// 5. Cambiar Semana (Pestañas)
function cambiarSemana(nuevaSemana) {
    semanaActual = nuevaSemana;

    // Actualizar diseño de botones
    const botones = document.querySelectorAll('.boton-semana');
    botones.forEach(btn => btn.classList.remove('activo'));

    // Índice del botón a activar
    let index = nuevaSemana === 'todas' ? 4 : nuevaSemana - 1;
    if (botones[index]) botones[index].classList.add('activo');

    actualizarVista();
}

// 6. Agregar Nuevo Viaje
function agregarViaje() {
    const nuevoViaje = {
        id: Date.now(), // ID único basado en el tiempo exacto
        mes: mesActual,
        semana: semanaActual === 'todas' ? 1 : semanaActual, // Si estás en "Ver Todo", se va a la Sem 1 por defecto
        cliente: '',
        dia: 'Lunes',
        precio: 0,
        km: 0
    };

    listaViajes.push(nuevoViaje);
    actualizarVista();
    guardar();
}

// 7. Borrar Viaje con SweetAlert2
window.borrarViaje = function (idParaBorrar) {
    Swal.fire({
        text: '¿Estás seguro de que deseas eliminar este viaje?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        backdrop: true,
        allowOutsideClick: true,
        customClass: {
            popup: 'swal-popup-modern',
            confirmButton: 'swal-button-confirm',
            cancelButton: 'swal-button-cancel'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Filtramos la lista para que queden todos MENOS el que tiene ese ID
            listaViajes = listaViajes.filter(viaje => viaje.id !== idParaBorrar);
            actualizarVista();
            guardar();
        }
    });
};

// 8. Editar Viaje (Se ejecuta al escribir en los inputs)
window.editarViaje = function (id, campo, valor) {
    // Buscar el viaje correcto
    const viaje = listaViajes.find(v => v.id === id);

    if (viaje) {
        // Si es precio, km o semana, asegurar que sea número
        if (campo === 'precio' || campo === 'km' || campo === 'semana') {
            viaje[campo] = parseFloat(valor) || 0;
        } else {
            viaje[campo] = valor;
        }
        guardar(); // Guardado silencioso automático
    }
};

// 9. Actualizar la Vista (Renderizar Tabla)
function actualizarVista() {
    const cuerpoTabla = document.getElementById('cuerpoTabla');
    const mensajeVacio = document.getElementById('mensajeVacio');
    const tituloTotalVista = document.querySelector('.tarjeta-total.semana .titulo-tarjeta');

    document.getElementById('etiquetaMes').innerText = mesActual;

    // Actualizar título dinámico
    if (semanaActual === 'todas') {
        tituloTotalVista.innerText = `TOTAL DEL MES DE ${mesActual.toUpperCase()}`;
    } else {
        tituloTotalVista.innerText = `TOTAL SEMANA ${semanaActual}`;
    }

    // Limpiar tabla actual
    cuerpoTabla.innerHTML = '';

    // Aplicar animación de entrada
    cuerpoTabla.classList.remove('fade-in');
    void cuerpoTabla.offsetWidth; // Trigger reflow
    cuerpoTabla.classList.add('fade-in');

    // Filtrar viajes: Solo los del MES actual
    let viajesVisibles = listaViajes.filter(v => v.mes === mesActual);

    // Si no estamos en "Ver Todo", filtramos también por SEMANA
    if (semanaActual !== 'todas') {
        viajesVisibles = viajesVisibles.filter(v => v.semana === semanaActual);
    } else {
        // Si vemos todo, ordenar por número de semana
        viajesVisibles.sort((a, b) => a.semana - b.semana);
    }

    // Mostrar u ocultar mensaje vacío
    if (viajesVisibles.length === 0) {
        mensajeVacio.style.display = 'block';
    } else {
        mensajeVacio.style.display = 'none';

        // Crear filas HTML
        viajesVisibles.forEach(viaje => {
            const fila = document.createElement('tr');

            fila.innerHTML = `
                    <td>
                        <select class="input-tabla" onchange="editarViaje(${viaje.id}, 'semana', this.value)">
                            <option value="1" ${viaje.semana === 1 ? 'selected' : ''}>Semana 1</option>
                            <option value="2" ${viaje.semana === 2 ? 'selected' : ''}>Semana 2</option>
                            <option value="3" ${viaje.semana === 3 ? 'selected' : ''}>Semana 3</option>
                            <option value="4" ${viaje.semana === 4 ? 'selected' : ''}>Semana 4</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="input-tabla" value="${viaje.cliente}" placeholder="Destino..." oninput="editarViaje(${viaje.id}, 'cliente', this.value)">
                    </td>
                    <td>
                        <select class="input-tabla" onchange="editarViaje(${viaje.id}, 'dia', this.value)">
                            <option ${viaje.dia === 'Lunes' ? 'selected' : ''}>Lunes</option>
                            <option ${viaje.dia === 'Martes' ? 'selected' : ''}>Martes</option>
                            <option ${viaje.dia === 'Miércoles' ? 'selected' : ''}>Miércoles</option>
                            <option ${viaje.dia === 'Jueves' ? 'selected' : ''}>Jueves</option>
                            <option ${viaje.dia === 'Viernes' ? 'selected' : ''}>Viernes</option>
                            <option ${viaje.dia === 'Sábado' ? 'selected' : ''}>Sábado</option>
                            <option ${viaje.dia === 'Domingo' ? 'selected' : ''}>Domingo</option>
                        </select>
                    </td>
                    <td>
                        <input type="number" class="input-tabla" value="${viaje.precio || ''}" placeholder="₡ 0" oninput="editarViaje(${viaje.id}, 'precio', this.value)">
                    </td>
                    <td>
                        <input type="number" step="0.1" class="input-tabla" value="${viaje.km || ''}" placeholder="0 km" oninput="editarViaje(${viaje.id}, 'km', this.value)">
                    </td>
                    <td style="text-align: center;">
                        <button class="boton-borrar" onclick="borrarViaje(${viaje.id})" title="Eliminar este viaje">
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
    calcularTotales();
}

// 10. Calcular Totales
function calcularTotales() {
    const formatearDinero = (monto) => '₡ ' + monto.toLocaleString('es-CR');

    // Total Global del Mes
    const viajesMes = listaViajes.filter(v => v.mes === mesActual);
    const totalMesDinero = viajesMes.reduce((suma, v) => suma + (v.precio || 0), 0);
    const totalMesKm = viajesMes.reduce((suma, v) => suma + (v.km || 0), 0);

    document.getElementById('totalMesDinero').innerText = formatearDinero(totalMesDinero);
    document.getElementById('totalMesKm').innerText = totalMesKm.toFixed(1) + ' km';

    // Total Vista Actual (Semana específica o todo)
    let viajesVista = viajesMes;
    if (semanaActual !== 'todas') {
        viajesVista = viajesMes.filter(v => v.semana === semanaActual);
    }

    const totalVistaDinero = viajesVista.reduce((suma, v) => suma + (v.precio || 0), 0);
    const totalVistaKm = viajesVista.reduce((suma, v) => suma + (v.km || 0), 0);

    document.getElementById('totalVistaDinero').innerText = formatearDinero(totalVistaDinero);
    document.getElementById('totalVistaKm').innerText = totalVistaKm.toFixed(1) + ' km';

    // Actualizar estado del botón PDF en tiempo real
    actualizarEstadoBotonPDF(viajesVista);

    // Renderizar totales diarios
    renderizarTotalesDiarios(viajesVista);
}

// Función auxiliar para validar botón PDF
function actualizarEstadoBotonPDF(viajes) {
    const botonPDF = document.querySelector('.boton-pdf');
    if (!botonPDF) return;

    // Debe haber al menos un viaje con datos válidos (km > 0, precio > 0, cliente no vacío)
    const hayDatosValidos = viajes.some(v =>
        v.km > 0 &&
        v.precio > 0 &&
        v.cliente && v.cliente.trim() !== ''
    );

    botonPDF.disabled = !hayDatosValidos;
}

// Función para renderizar totales por día
function renderizarTotalesDiarios(viajes) {
    const contenedorDias = document.getElementById('contenedorDias');
    contenedorDias.innerHTML = ''; // Limpiar

    const diasOrden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const formatearDinero = (monto) => '₡ ' + monto.toLocaleString('es-CR');

    // Mapa de clases para días (normalizando nombres)
    const mapaClasesDias = {
        'Lunes': 'dia-Lunes',
        'Martes': 'dia-Martes',
        'Miércoles': 'dia-Miercoles',
        'Jueves': 'dia-Jueves',
        'Viernes': 'dia-Viernes',
        'Sábado': 'dia-Sabado',
        'Domingo': 'dia-Domingo'
    };

    diasOrden.forEach(dia => {
        const viajesDia = viajes.filter(v => v.dia === dia);

        if (viajesDia.length > 0) {
            const totalDinero = viajesDia.reduce((suma, v) => suma + (v.precio || 0), 0);
            const totalKm = viajesDia.reduce((suma, v) => suma + (v.km || 0), 0);

            // Obtener clase específica para el día
            const claseDia = mapaClasesDias[dia] || '';

            const tarjeta = document.createElement('div');
            tarjeta.className = `tarjeta-total dia ${claseDia} fade-in`;
            tarjeta.innerHTML = `
                <div class="titulo-tarjeta">Total ${dia}</div>
                <div class="valor-dinero">${formatearDinero(totalDinero)}</div>
                <div class="valor-km">${totalKm.toFixed(1)} km</div>
            `;
            contenedorDias.appendChild(tarjeta);
        }
    });
}

// 11. Generar PDF Detallado
function generarPDF() {
    // Guardar la vista actual
    const vistaAnterior = semanaActual;

    // Cambiar a "Ver Todo" temporalmente para que el PDF salga completo del mes
    cambiarSemana('todas');

    // Esperar un momento breve para que la tabla se dibuje completa antes de imprimir
    setTimeout(() => {
        window.print();

        // Opcional: Si quieres volver a la vista anterior, descomenta la siguiente línea:
        // cambiarSemana(vistaAnterior);
    }, 300);
}