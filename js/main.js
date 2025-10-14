document.addEventListener('DOMContentLoaded', function () {
    // Menu hamburguesa
    const nav = document.querySelector("#nav");
    const abrir = document.querySelector("#abrir_hamburguesa");
    const cerrar = document.querySelector("#cerrar_hamburguesa");

    abrir.addEventListener("click", () => nav.classList.add("visible"));
    cerrar.addEventListener("click", () => nav.classList.remove("visible"));

    // Range input
    const rangeInput = document.getElementById('kmsPorLitro');
    const rangeValue = document.getElementById('rangeValue');
    const decreaseBtn = document.getElementById('decreaseBtn');
    const increaseBtn = document.getElementById('increaseBtn');

    rangeValue.textContent = rangeInput.value;

    rangeInput.addEventListener('input', function() {
        rangeValue.textContent = parseFloat(this.value).toFixed(1);
    });

    decreaseBtn.addEventListener('click', () => {
        let newValue = parseFloat(rangeInput.value) - 0.1;
        if (newValue < parseFloat(rangeInput.min)) newValue = parseFloat(rangeInput.min);
        rangeInput.value = newValue.toFixed(1);
        rangeValue.textContent = newValue.toFixed(1);
    });

    increaseBtn.addEventListener('click', () => {
        let newValue = parseFloat(rangeInput.value) + 0.1;
        if (newValue > parseFloat(rangeInput.max)) newValue = parseFloat(rangeInput.max);
        rangeInput.value = newValue.toFixed(1);
        rangeValue.textContent = newValue.toFixed(1);
    });
    
    // ============================================================================================================================
    // ---------------------------- INICIALIZACIÓN DEL MAPA ----------------------------------------------------------------------
    // ============================================================================================================================
    const mymap = L.map('mapa').setView([-34.61, -58.38], 3); // Inicializar el mapa

    // Capa de azulejos de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mymap);

    // Crear un control de geocodificación
    const geocoder = L.Control.Geocoder.nominatim();
    let marcadorOrigen, marcadorDestino, rutaControl;

    // Función para ajustar la vista del mapa
    function ajustarVista() {
        eliminarMarcadoresYRuta();

        if (marcadorOrigen && marcadorDestino) {
            // Ajustar la vista del mapa para que muestre ambos marcadores
            const bounds = L.latLngBounds([marcadorOrigen.getLatLng(), marcadorDestino.getLatLng()]);
            mymap.fitBounds(bounds);
                        
            calcularRuta();
        }
    }

    function eliminarMarcadoresYRuta() {
        try {
            if (marcadorOrigen) {
                mymap.removeLayer(marcadorOrigen);
            }
            if (marcadorDestino) {
                mymap.removeLayer(marcadorDestino);
            }
            if (rutaControl) {
                mymap.removeControl(rutaControl);
                rutaControl = null; // Asegurar que la referencia se elimine
            }
    
            // Eliminar cualquier línea de ruta que haya quedado en el mapa
            mymap.eachLayer(function (layer) {
                if (layer instanceof L.Polyline && !layer._popup) {
                    mymap.removeLayer(layer);
                }
            });
    
        } catch (error) {
            console.error('Error al eliminar marcadores y ruta:', error);
        }
    }    

    // ============================================================================================================================
    // ---------------------------------- PRECIOS PROMEDIOS ----------------------------------------------------------------------
    // ============================================================================================================================
    calcularPreciosPromedioPorProvincia();

    function calcularPreciosPromedioPorProvincia() {
        return fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv')
            .then(response => response.text())
            .then(csvData => {
                const estaciones = Papa.parse(csvData, { header: true }).data;
                const preciosPorProvincia = agruparPreciosPorProvincia(estaciones); //Objeto para almacenar precios agrupados x provincia y producto
                const resultados = calcularPromedios(preciosPorProvincia);
                console.log(resultados)
                return resultados;
            })
            .catch(error => {
                console.error('Error al cargar el archivo CSV:', error);
                throw error;
            });
    }

    function agruparPreciosPorProvincia(estaciones) {
        const preciosPorProvincia = {};
        const fechaLimite = new Date('2025-04-01'); // 01/04/2025  ES LA FECHA LIMITE DE PRECIO

        estaciones.forEach(estacion => { // Recorremos cada estacion de servicio para validar
            if (esEstacionValida(estacion, fechaLimite)) {
                agregarPrecioAGrupo(preciosPorProvincia, estacion);
            }
        });

        return preciosPorProvincia;
    }

    function esEstacionValida(estacion, fechaLimite) {
        const provincia = estacion.provincia;
        const producto = estacion.producto; // Nombre del producto (Nafta Super, Diesel, etc.)
        const precio = parseFloat(estacion.precio); // Precio del producto
        const fechaVigencia = new Date(estacion.fecha_vigencia); // Fecha de vigencia

        // Validar datos: precio válido, fecha válida y posterior al 1 de junio de 2024
        if (
            !provincia || 
            !producto || 
            isNaN(precio) || 
            isNaN(fechaVigencia.getTime()) || 
            fechaVigencia <= fechaLimite
        ) {
            return false;
        }

        return true;
    }

    function agregarPrecioAGrupo(preciosPorProvincia, estacion) {
        const provincia = estacion.provincia;
        const producto = estacion.producto;
        const precio = parseFloat(estacion.precio);

        // Inicializar la estructura si no existe
        if (!preciosPorProvincia[provincia]) {
            preciosPorProvincia[provincia] = {};
        }
        if (!preciosPorProvincia[provincia][producto]) {
            preciosPorProvincia[provincia][producto] = { total: 0, count: 0 };
        }

        // Sumar el precio y contar las ocurrencias
        preciosPorProvincia[provincia][producto].total += precio;
        preciosPorProvincia[provincia][producto].count += 1;
    }

    function calcularPromedios(preciosPorProvincia) { // Calcular el promedio de precios por provincia y producto
        const resultados = {};

        for (const provincia in preciosPorProvincia) {
            resultados[provincia] = {};

            for (const producto in preciosPorProvincia[provincia]) {
                const data = preciosPorProvincia[provincia][producto];
                resultados[provincia][producto] = (data.total / data.count).toFixed(2);
            }
        }

        return resultados;
    }

    // ============================================================================================================================
    // ------------------------------------- CALCULAR RUTA -----------------------------------------------------------------------
    // ============================================================================================================================
    let puntosSinCombustibleLayer = L.layerGroup().addTo(mymap);
    let provinciasSinCombustible = [];
    let gastoTotalPeajes = 0;
    
    async function obtenerProvincia(lat, lng) {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await response.json();
        return data.address.state ? normalizarTexto(data.address.state) : 'PROVINCIA DESCONOCIDA';
    }
    
    function normalizarTexto(texto) {
        return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    }
    
    function limpiarResultados() {
        document.getElementById('resultado-km').innerText = '';
        document.getElementById('resultado-tiempo').innerText = '';
        document.getElementById('resultado-litros').innerText = '';
        document.getElementById('capacidadTanque').innerText = '';
        puntosSinCombustibleLayer.clearLayers();
    }
    
    async function procesarRuta(event, preciosPorProvincia) {
        const ruta = event.routes[0];
        const distancia = ruta.summary.totalDistance / 1000;
        const tiempoEnMinutos = ruta.summary.totalTime / 60;
        const kmsPorLitro = document.getElementById('kmsPorLitro').value;
        const capacidadTanque = document.getElementById('capacidadTanque').value;
        let cargarTanque = parseFloat(localStorage.getItem("carga_tanque")) || 0.60;
        const distanciaConCombustible = (capacidadTanque * cargarTanque) * kmsPorLitro;
        let distanciaAcumulada = distanciaConCombustible;
        const puntosSinCombustible = [];
    
        document.getElementById('resultado-km').innerText = `${distancia.toFixed(2)} km`;
        document.getElementById('resultado-tiempo').innerText = `${Math.floor(tiempoEnMinutos / 60)} h ${Math.round(tiempoEnMinutos % 60)} min`;
        document.getElementById('resultado-litros').innerText = `${(distancia / kmsPorLitro).toFixed(2)} L`;
        await detectarPeajesEnRuta(ruta);
    
        for (let i = 1; i < ruta.coordinates.length; i++) {
            const puntoAnterior = ruta.coordinates[i - 1];
            const puntoActual = ruta.coordinates[i];
            distanciaAcumulada += L.latLng(puntoAnterior).distanceTo(L.latLng(puntoActual)) / 1000;
    
            if (distanciaAcumulada >= distanciaConCombustible) {
                if (i > 1) puntosSinCombustible.push({ punto: puntoActual, distancia: distanciaAcumulada });
                distanciaAcumulada = 0;
            }
        }
        await procesarPuntosSinCombustible(puntosSinCombustible, preciosPorProvincia, kmsPorLitro);
    }
    

    async function procesarPuntosSinCombustible(puntos, preciosPorProvincia, kmsPorLitro) {
        let gastoTotalCombustible = 0;
        const tipoCombustible = document.getElementById('inputTipoCombustible').value;
        if (!tipoCombustible) return console.warn('Por favor, selecciona un tipo de combustible');

        // Variables para acumular kilómetros y combustible
        let kmAcumulados = 0;
        let combustibleAcumulado = 0;

        const promesas = puntos.map(async (item, index) => {
            const provincia = await obtenerProvincia(item.punto.lat, item.punto.lng);
            provinciasSinCombustible.push(provincia);
            
            // Acumular kilómetros y combustible
            kmAcumulados += item.distancia;
            const litrosEnEstePunto = item.distancia / kmsPorLitro;
            combustibleAcumulado += litrosEnEstePunto;

            // Marcador circular naranja (sin ícono, para que quede debajo)
            const marcador = L.circleMarker([item.punto.lat, item.punto.lng], {
                radius: 10, 
                color: '#ff6b35', 
                fillColor: '#ff8c42', 
                fillOpacity: 0.8,
                weight: 2,
                zIndexOffset: -100 // Prioridad baja para que quede debajo
                }).addTo(puntosSinCombustibleLayer);

            // Ícono de bomba de combustible
            const icono = L.divIcon({
                className: 'fuel-icon', 
                html: '<i class="bi bi-fuel-pump-fill"></i>',  
                iconSize: [20, 20],  
                iconAnchor: [10, 10],  
            });

            // Buscar estaciones cercanas
            const estacionesCercanas = await buscarEstacionesCercanas(
                item.punto.lat, 
                item.punto.lng, 
                tipoCombustible, 
                20 // Radio en km
            );

            // Generar HTML de la tabla de estaciones
            let tablaEstacionesHTML = '';
            if (estacionesCercanas.length === 0) {
                tablaEstacionesHTML = `
                    <div class="no-estaciones-mensaje">
                        <i class="bi bi-info-circle"></i>
                        <p>No se encontraron estaciones cercanas, utilice el mapa para su planificación</p>
                    </div>
                `;
            } else {
                tablaEstacionesHTML = `
                    <div class="popup-estaciones-table-container">
                        <table class="popup-estaciones-table">
                            <thead>
                                <tr>
                                    <th>Logo</th>
                                    <th>Localidad</th>
                                    <th>Precio</th>
                                    <th>Ubicación</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${estacionesCercanas.map(estacion => `
                                    <tr>
                                        <td class="td-logo">
                                            <img src="${estacion.logo}" alt="${estacion.empresa}" class="estacion-logo">
                                        </td>
                                        <td class="td-localidad">${estacion.localidad}</td>
                                        <td class="td-precio">$ ${estacion.precio}</td>
                                        <td class="td-ubicacion">
                                            <button class="btn-ubicacion" onclick="alert('Función en desarrollo')">
                                                <i class="bi bi-geo-alt-fill"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // Crear contenido del popup mejorado con valores acumulados
            const popupContent = `
                <div class="popup-combustible-modern">
                    <!-- Header con alerta -->
                    <div class="popup-combustible-header">
                        <div class="popup-alerta-icon">
                            <i class="bi bi-exclamation-triangle-fill"></i>
                        </div>
                        <div class="popup-alerta-title">
                            <h3>Recomendamos cargar combustible en esta zona</h3>
                        </div>
                    </div>
                    
                    <div class="popup-divider"></div>
                    
                    <!-- Información del recorrido -->
                    <div class="popup-combustible-info">
                        <div class="info-row">
                            <span class="info-label"><i class="bi bi-speedometer2"></i> Kilómetros recorridos:</span>
                            <span class="info-value">${kmAcumulados.toFixed(2)} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label"><i class="bi bi-droplet-fill"></i> Combustible consumido:</span>
                            <span class="info-value">${combustibleAcumulado.toFixed(2)} L</span>
                        </div>
                    </div>

                    <div class="popup-divider"></div>

                    <!-- Tabla de estaciones cercanas -->
                    <div class="popup-estaciones-section">
                        <h4 class="estaciones-title">Estaciones Cercanas en Radio 15km</h4>
                        ${tablaEstacionesHTML}
                    </div>
                </div>
            `;

            // Marcador con ícono (CON ALTA PRIORIDAD)
            const marcadorConIcono = L.marker([item.punto.lat, item.punto.lng], { 
                icon: icono,
                zIndexOffset: 1000 // Alta prioridad para que aparezca siempre arriba
            }).addTo(puntosSinCombustibleLayer);
            
            marcadorConIcono.bindPopup(popupContent, {
                maxWidth: 400,
                className: 'custom-popup-combustible'
            });

            const provinciaCalculo = index === 0 ? provinciasSinCombustible[0] : provinciasSinCombustible[index];
            const precioLitro = preciosPorProvincia[provinciaCalculo]?.[tipoCombustible] || localStorage.getItem("precio-combustible");
            const costoEnProvincia = (item.distancia / kmsPorLitro) * precioLitro;
            gastoTotalCombustible += costoEnProvincia;
        });
        await Promise.all(promesas);

        const ultimaProvincia = provinciasSinCombustible.at(-1);
        const precioUltimaProvincia = preciosPorProvincia[ultimaProvincia]?.[tipoCombustible] || localStorage.getItem("precio-combustible");
        const distanciaRestante = parseFloat(document.getElementById('resultado-km').innerText) - puntos.reduce((acc, item) => acc + item.distancia, 0);
        gastoTotalCombustible += (distanciaRestante / kmsPorLitro) * precioUltimaProvincia;

        document.getElementById("resultado-gasto").textContent = `$ ${gastoTotalCombustible.toFixed(2)}`;
        document.getElementById("gasto-total").textContent = `$ ${(parseFloat(gastoTotalCombustible) + parseFloat(gastoTotalPeajes)).toFixed(2)}`;

        const combustibleInternacional = localStorage.getItem("precioCombustible")
        document.getElementById("index_combust_internacional").textContent = combustibleInternacional 
    }

    async function calcularRuta() {
        if (!marcadorOrigen || !marcadorDestino) return;
        try {
            limpiarResultados();
            const preciosPorProvincia = await calcularPreciosPromedioPorProvincia();
            const provinciaOrigen = await obtenerProvincia(marcadorOrigen.getLatLng().lat, marcadorOrigen.getLatLng().lng);
            provinciasSinCombustible = [provinciaOrigen];
            
            rutaControl = L.Routing.control({
                waypoints: [L.latLng(marcadorOrigen.getLatLng()), L.latLng(marcadorDestino.getLatLng())],
                routeWhileDragging: true,
                show: true,
                // lineOptions: {
                //     styles: [
                //         { color: '#000000ff', weight: 5, opacity: 0.8 },  // Ruta principal azul
                //         { color: '#ff0000ff', weight: 2, opacity: 0.6 }   // Borde blanco
                //     ]
                // },
                //createMarker: function() { return null; } // Ocultar marcadores por defecto de leaflet-routing
            }).addTo(mymap);
            
            rutaControl.on('routesfound', (event) => procesarRuta(event, preciosPorProvincia));
            rutaControl.on('waypointschanged', () => {
                provinciasSinCombustible = [];
                puntosSinCombustibleLayer.clearLayers();
            });
        } catch (error) {
            console.error('Error al calcular la ruta:', error);
        }
    }

    async function buscarEstacionesCercanas(lat, lng, tipoCombustible, radioKm) {
        try {
            const response = await fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv');
            const csvData = await response.text();
            const estaciones = Papa.parse(csvData, { header: true }).data;

            // Mapa para almacenar estaciones únicas por dirección
            const estacionesUnicas = new Map();

            // Filtrar estaciones por tipo de combustible y calcular distancias
            estaciones.forEach(estacion => {
                // Validar que tenga el tipo de combustible seleccionado
                if (estacion.producto !== tipoCombustible) return;
                
                // Validar coordenadas válidas
                const latitud = parseFloat(estacion.latitud);
                const longitud = parseFloat(estacion.longitud);
                if (isNaN(latitud) || isNaN(longitud)) return;
                
                // Validar precio válido
                const precio = parseFloat(estacion.precio);
                if (isNaN(precio)) return;
                
                // Calcular distancia usando Leaflet
                const distancia = L.latLng(lat, lng).distanceTo(L.latLng(latitud, longitud)) / 1000; // Convertir a km
                
                // Filtrar por radio
                if (distancia > radioKm) return;
                
                // Crear clave única usando dirección + coordenadas para evitar duplicados
                const claveUnica = `${estacion.direccion}_${latitud.toFixed(6)}_${longitud.toFixed(6)}`;
                
                // Si no existe o si el precio es mejor, agregar/actualizar
                if (!estacionesUnicas.has(claveUnica)) {
                    estacionesUnicas.set(claveUnica, {
                        empresa: estacion.empresabandera,
                        localidad: estacion.localidad || estacion.direccion || 'Sin localidad',
                        precio: precio.toFixed(2),
                        distancia: distancia,
                        latitud: latitud,
                        longitud: longitud,
                        logo: companyLogoPaths[estacion.empresabandera] || companyLogoPaths['BLANCA']
                    });
                }
            });

            // Convertir Map a array, ordenar por distancia y tomar las 3 más cercanas
            const estacionesConDistancia = Array.from(estacionesUnicas.values())
                .sort((a, b) => a.distancia - b.distancia)
                .slice(0, 3);

            return estacionesConDistancia;
        } catch (error) {
            console.error('Error al buscar estaciones cercanas:', error);
            return [];
        }
    }
    
    // ============================================================================================================================
    // ------------------------------------- PEAJES JSON -------------------------------------------------------------------------
    // ============================================================================================================================
    
    // ============== CONFIGURACIÓN Y VARIABLES GLOBALES - PEAJES
    const peajeMarkers = [];

    // Mapeo de vehículos a imágenes y cantidad de ejes
    const imagenesVehiculos = {
        "Motocicleta": { imagen: "motocicleta.png", ejes: 2 }, 
        "2 ejes (tall < 2.10m)": { imagen: "2_ejes_tall_men_2.10m.png", ejes: 2 },
        "2 ejes (tall > 2.10m)": { imagen: "2_ejes_tall_may_2.10m.png", ejes: 2 },
        "3 ejes (tall < 2.10m) sin rueda doble": { imagen: "3_ejes_tall_men_2.10m_sin_rueda_doble.png", ejes: 3 },
        "3 ejes (tall > 2.10m)": { imagen: "3_ejes_tall_may_2.10m.png", ejes: 3 },
        "4 ejes (tall < 2.10m) sin rueda doble": { imagen: "4_ejes_tall_men_2.10m_sin_rueda_doble.png", ejes: 4 },
        "4 ejes (tall > 2.10m)": { imagen: "4_ejes_tall_may_2.10m.png", ejes: 4 },
        "5 ejes": { imagen: "5_ejes.png", ejes: 5 },
        "6 ejes": { imagen: "6_ejes.png", ejes: 6 },
        "+6 ejes": { imagen: "+6_ejes.png", ejes: "6+" },
    };

    // Peajes que requieren una distancia específica (en metros)
    const peajesConDistanciaEspecial = new Map([
        ["peaje_dock_sud_vuelta_0005", 25],
        ["peaje_isla_la_deseada_0008", 39],
        ["peaje_frontera_puente_libertador_general_san_martin_0015", 1100],
        ["peaje_frontera_puente_general_artigas_0015", 90],
        ["ferry_primera_angostura_0016", 25],                  
    ]);

    const distanciaDefault = 9; // Distancia por defecto en metros

    // ============== FUNCIÓN DE GENERACIÓN DE POPUP MODERNIZADA
    function generarPopupPeaje(feature) {
        const preciosPeaje = feature.properties.precios_peaje || {};
        const tarifasAgrupadas = new Map();

        // Agrupar tarifas sin duplicados
        Object.values(preciosPeaje).forEach(tarifa => {
            tarifa.vehiculos.forEach(vehiculo => {
                if (!imagenesVehiculos[vehiculo]) return;

                if (!tarifasAgrupadas.has(vehiculo)) {
                    tarifasAgrupadas.set(vehiculo, {
                        ejes: imagenesVehiculos[vehiculo].ejes,
                        imagen: imagenesVehiculos[vehiculo].imagen,
                        tarifa_basica: tarifa.tarifa_basica ?? "N/A",
                        telepase_basico: tarifa.telepase_basico ?? "N/A"
                    });
                }
            });
        });

        return `
            <div class="popup-peaje-modern">
                <!-- Header -->
                <div class="popup-peaje-header">
                    <div class="popup-peaje-icon">
                        <i class="bi bi-shield-check"></i>
                    </div>
                    <div class="popup-peaje-title">
                        <h3>${feature.properties.ruta.nombre}</h3>
                    </div>
                </div>
                
                <div class="popup-divider"></div>
                
                <!-- Info Cards -->
                <div class="popup-peaje-info">
                    <div class="info-badge">
                        <span class="info-label">Empresa:</span>
                        <span class="info-value">${feature.properties.empresa}</span>
                    </div>
                    <div class="info-badge">
                        <span class="info-label">Tramo:</span>
                        <span class="info-value">${feature.properties.ruta.tramo}</span>
                    </div>
                </div>

                <!-- Tabla de tarifas -->
                <div class="popup-peaje-table-container">
                    <table class="popup-peaje-table">
                        <thead>
                            <tr>
                                <th>Ejes</th>
                                <th>Vehículo</th>
                                <th>Tarifa</th>
                                <th>Telepase</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from(tarifasAgrupadas.entries()).map(([vehiculo, tarifa]) => `
                                <tr>
                                    <td class="td-ejes">${tarifa.ejes}</td>
                                    <td class="td-vehiculo">
                                        <img src="assets/tarifa_peajes/${tarifa.imagen}" 
                                            alt="${vehiculo}" class="vehiculo-img">
                                    </td>
                                    <td class="td-precio">${tarifa.tarifa_basica}</td>
                                    <td class="td-telepase">${tarifa.telepase_basico}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ============== FUNCIONES DE GESTIÓN DE MARCADORES
    function crearIconoPeaje() {
        return L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: green; width: 5px; height: 5px; border-radius: 50%;"></div>',
            iconSize: [8, 8],
        });
    }

    function procesarCoordenadasPeaje(geometry) {
        let coordinatesList = [];
        
        if (geometry.type === "MultiPoint") {
            coordinatesList = geometry.coordinates;
        } else if (geometry.type === "Point") {
            coordinatesList = [geometry.coordinates];
        }
        
        return coordinatesList;
    }

    function actualizarVisibilidadPeajes() {
        const bounds = mymap.getBounds();

        peajeMarkers.forEach(marker => {
            const latLng = marker.getLatLng();
            if (bounds.contains(latLng)) {
                marker.setOpacity(1);
            } else {
                marker.setOpacity(0);
            }
        });
    }

    // ============== CARGA INICIAL DE PEAJES
    fetch('module/SurtiPeaje/peajes.geojson')
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (!geometry || !geometry.coordinates) {
                    console.error('Geometría inválida en el feature:', feature);
                    return;
                }

                const coordinatesList = procesarCoordenadasPeaje(geometry);

                coordinatesList.forEach(coord => {
                    if (coord.length === 2) {
                        const lat = coord[1];
                        const lon = coord[0];

                        const marker = L.marker([lat, lon], { icon: crearIconoPeaje() }).addTo(mymap);
                        marker.bindPopup(generarPopupPeaje(feature));

                        peajeMarkers.push(marker);
                    } else {
                        console.error('Coordenadas inválidas:', coord);
                    }
                });
            });

            // Escuchar eventos de movimiento del mapa
            mymap.on('moveend', actualizarVisibilidadPeajes);
    })
    .catch(error => console.error('Error al cargar el archivo JSON:', error));

    // ============== DETECCIÓN Y CÁLCULO DE PEAJES EN RUTA
    async function detectarPeajesEnRuta(ruta) {
        try {
            const response = await fetch('module/SurtiPeaje/peajes.geojson');
            const data = await response.json();

            let peajesContador = new Map();
            let costoTotalPeajesEfectivo = 0;
            let costoTotalPeajesTelepase = 0;

            // Obtener categoría del vehículo
            const vehiculoCategoria = localStorage.getItem("clasificacion") === "No clasificado" 
                ? "2 ejes (tall < 2.30m)(tall < 2.10m)" 
                : localStorage.getItem("clasificacion");

            let deteccionesPeajes = new Map();

            // Validar que la ruta tenga coordenadas válidas
            if (!Array.isArray(ruta.coordinates) || ruta.coordinates.length === 0) {
                console.error("Error: La ruta no tiene coordenadas válidas.", ruta.coordinates);
                return;
            }

            // Procesar cada peaje del GeoJSON
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (!geometry || !geometry.coordinates) return;

                const coordenadasPeaje = procesarCoordenadasPeaje(geometry);
                const peajeID = feature.id;
                const distanciaMaxima = peajesConDistanciaEspecial.get(peajeID) || distanciaDefault;

                coordenadasPeaje.forEach(coord => {
                    if (!Array.isArray(coord) || coord.length < 2) {
                        console.warn("⚠️ Coordenadas de peaje inválidas:", coord);
                        return;
                    }

                    const peajeLatLng = L.latLng(coord[1], coord[0]);
                    const nombrePeaje = feature.properties.ruta.nombre;
                    const idEmpresa = feature.properties.idempresa;
                    const identificadorCasilla = `${nombrePeaje}-${coord[1]},${coord[0]}`;

                    // Verificar si el usuario tiene Telepase para esta empresa
                    const tieneTelepase = localStorage.getItem(idEmpresa) === "true";

                    // Verificar proximidad con cada punto de la ruta
                    ruta.coordinates.forEach((coordRuta, index) => {
                        if (!coordRuta || typeof coordRuta.lat !== 'number' || typeof coordRuta.lng !== 'number') {
                            console.warn("⚠️ Coordenada de ruta inválida:", coordRuta);
                            return;
                        }

                        const rutaLatLng = L.latLng(coordRuta.lat, coordRuta.lng);
                        
                        if (rutaLatLng.distanceTo(peajeLatLng) <= distanciaMaxima) {
                            if (!deteccionesPeajes.has(identificadorCasilla)) {
                                deteccionesPeajes.set(identificadorCasilla, []);
                            }

                            const registros = deteccionesPeajes.get(identificadorCasilla);
                            
                            // Evitar duplicados cercanos (más de 5 puntos de separación)
                            if (registros.length === 0 || index - registros[registros.length - 1] > 5) {
                                registros.push(index);
                                peajesContador.set(identificadorCasilla, (peajesContador.get(identificadorCasilla) || 0) + 1);

                                // Calcular tarifa según vehículo
                                const tarifas = feature.properties.precios_peaje;
                                for (const tarifaKey in tarifas) {
                                    if (tarifas[tarifaKey].vehiculos.includes(vehiculoCategoria)) {
                                        let tarifaAplicada = tieneTelepase 
                                            ? tarifas[tarifaKey].telepase_basico ?? tarifas[tarifaKey].tarifa_basica 
                                            : tarifas[tarifaKey].tarifa_basica;

                                        if (tieneTelepase && tarifas[tarifaKey].telepase_basico !== undefined) {
                                            costoTotalPeajesTelepase += tarifaAplicada;
                                        } else {
                                            costoTotalPeajesEfectivo += tarifaAplicada;
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    });
                });
            });

            // Actualizar resultados en el DOM
            document.getElementById("resultado-total-peajes-efectivo").textContent = `$ ${costoTotalPeajesEfectivo.toFixed(2)}`;
            document.getElementById("resultado-total-peajes-telepase").textContent = `$ ${costoTotalPeajesTelepase.toFixed(2)}`;

            console.log(`✅ Cantidad de peajes en la ruta: ${peajesContador.size}`);
            console.log(`✅ Peajes atravesados:`, peajesContador);
            console.log(`✅ Costo total de peajes en efectivo para ${vehiculoCategoria}: $${costoTotalPeajesEfectivo}`);
            console.log(`✅ Costo total de peajes con Telepase para ${vehiculoCategoria}: $${costoTotalPeajesTelepase}`);

            gastoTotalPeajes = parseFloat(costoTotalPeajesEfectivo) + parseFloat(costoTotalPeajesTelepase);

            // Generar detalle de peajes
            let resultadoPeajes = "";
            peajesContador.forEach((count, peaje) => {
                resultadoPeajes += `<p>${peaje}: ${count} veces</p>`;
            });
            document.getElementById("detalle-peajes").innerHTML = resultadoPeajes;
            
        } catch (error) {
            console.error('❌ Error al detectar peajes en la ruta:', error);
        }
    }
    
    // ============================================================================================================================
    // ----------------------- CARGAR ESTACIONES DE SERVICIOS CSV -----------------------------------------------------------------
    // ============================================================================================================================

    // ============== CONFIGURACIÓN Y VARIABLES GLOBALES 
    let markerCluster;

    // Configuración de logos de empresas
    const companyLogoPaths = {
        'AXION': 'assets/logo_estaciones/axion.png',
        'DAPSA S.A.': 'assets/logo_estaciones/dapsa.png',
        'YPF': 'assets/logo_estaciones/ypf.png',
        'GULF': 'assets/logo_estaciones/gulf.png',
        'PUMA': 'assets/logo_estaciones/puma.png',
        'REFINOR': 'assets/logo_estaciones/refinor.png',
        'SHELL C.A.P.S.A.': 'assets/logo_estaciones/shell.png',
        'VOY': 'assets/logo_estaciones/voy.png',
        'BLANCA': 'assets/logo_estaciones/cualquier_otro_nombre.png',
    };

    // Mapeo de nombres de productos
    const productMap = {
        'Gas Oil Grado 2': 'Diesel Comun',
        'Gas Oil Grado 3': 'Diesel Premium',
        'Nafta (premium) de más de 95 Ron': 'Nafta Premium',
        'Nafta (súper) entre 92 y 95 Ron': 'Nafta Super',
        'GNC': 'GNC'
    };

    // Orden de visualización de productos
    const productOrder = ['Nafta Super', 'Nafta Premium', 'Diesel Comun', 'Diesel Premium', 'GNC'];

    // ============== FUNCIONES AUXILIARES - AGRUPACIÓN Y VALIDACIÓN 
    function agruparPorDireccion(data) {
        return data.reduce((groups, row) => {
            const address = row.direccion;
            if (!groups[address]) groups[address] = [];
            groups[address].push(row);
            return groups;
        }, {});
    }

    function validarCoordenadas(stations) {
        return !stations.some(({ latitud, longitud }) => isNaN(parseFloat(latitud)) || isNaN(parseFloat(longitud)));
    }

    function calcularCoordenadasPromedio(stations) {
        const avg = (values) => values.reduce((acc, val) => acc + parseFloat(val), 0) / values.length;
        return {
            lat: avg(stations.map(({ latitud }) => latitud)),
            lng: avg(stations.map(({ longitud }) => longitud)),
        };
    }

    // ============== FUNCIONES DE CREACIÓN DE ELEMENTOS DEL MAPA 
    function crearMarkerCluster() {
        return L.markerClusterGroup({
            iconCreateFunction: (cluster) => L.divIcon({
                html: `<div class="marker-cluster-custom">${cluster.getChildCount()}</div>`,
                className: 'marker-cluster-custom',
                iconSize: L.point(30, 30),
            }),
        });
    }

    function crearIconoPersonalizado() {
        return L.divIcon({
            className: 'custom-marker-icon',
            html: '<div class="marker-circle"><strong><i class="bi bi-fuel-pump"></i></div>',
            iconSize: [20, 20],
        });
    }

    // ============== FUNCIONES DE FORMATO Y PRESENTACIÓN 
    function formatearFechaVigencia(stations) {
        const latest = stations.reduce((latest, current) => {
            return new Date(latest.fecha_vigencia) > new Date(current.fecha_vigencia) ? latest : current;
        }).fecha_vigencia;

        const formattedFecha = latest.split(' ')[0].split('-').reverse().join('-');
        const fechaActualizacion = new Date(latest);
        const fechaLimite = new Date('2025-08-30');

        const statusClass = fechaActualizacion < fechaLimite ? 'status-outdated' : 'status-updated';
        const statusIcon = fechaActualizacion < fechaLimite ? '⚠️' : '✓';
        
        return `
            <div class="popup-update ${statusClass}">
                <span class="update-icon">${statusIcon}</span>
                <span class="update-text">Actualización: ${formattedFecha}</span>
            </div>`;
    }

    function crearPopupContent(empresaBandera, stations) {
        const addedProducts = new Set();
        let popupContent = `
            <div class="popup-modern">
                <div class="popup-header">
                    <div class="popup-logo">
                        <img src="${companyLogoPaths[empresaBandera]}" alt="Logo ${empresaBandera}" width="40" height="40">
                    </div>
                    <div class="popup-company">
                        <h3>${empresaBandera}</h3>
                    </div>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-products">`;

        productOrder.forEach(product => {
            stations.forEach(station => {
                const productName = productMap[station.producto] || station.producto;
                if (productName === product && !addedProducts.has(productName)) {
                    popupContent += `
                        <div class="popup-product-item">
                            <span class="product-name">${productName}</span>
                            <span class="product-price">${station.precio}</span>
                        </div>`;
                    addedProducts.add(productName);
                }
            });
        });

        const fechaVigencia = formatearFechaVigencia(stations);
        popupContent += `
                </div>
                <div class="popup-footer">
                    ${fechaVigencia}
                </div>
            </div>`;
        return popupContent;
    }

    // ============== FUNCIÓN PRINCIPAL - CARGAR TODAS LAS ESTACIONES 
    function cargarEstacionesServicio() {
        return new Promise((resolve, reject) => {
            fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv')
                .then(response => response.text())
                .then(csvData => {
                    const parsedData = Papa.parse(csvData, { header: true }).data;

                    const stationsByAddress = agruparPorDireccion(parsedData);
                    markerCluster = crearMarkerCluster();

                    Object.keys(stationsByAddress).forEach(address => {
                        const stations = stationsByAddress[address];
                        if (!validarCoordenadas(stations)) return;

                        const { lat: avgLat, lng: avgLng } = calcularCoordenadasPromedio(stations);
                        const empresaBandera = stations[0].empresabandera;
                        const popupContent = crearPopupContent(empresaBandera, stations);
                        
                        const marker = L.marker([avgLat, avgLng], { icon: crearIconoPersonalizado() });
                        marker.bindPopup(popupContent);
                        markerCluster.addLayer(marker);
                    });

                    mymap.addLayer(markerCluster);
                    resolve(markerCluster);
                })
                .catch(error => {
                    console.error('Error al cargar el archivo CSV:', error);
                    reject(error);
                });
        });
    }

    // ============== FUNCIÓN AUXILIAR - CREAR POPUP FILTRADO POR TIPO DE COMBUSTIBLE 
    function crearPopupContentFiltrado(empresaBandera, stations, tipoCombustible) {
        const addedProducts = new Set();
        let popupContent = `
            <div class="popup-modern">
                <div class="popup-header">
                    <div class="popup-logo">
                        <img src="${companyLogoPaths[empresaBandera]}" alt="Logo ${empresaBandera}" width="40" height="40">
                    </div>
                    <div class="popup-company">
                        <h3>${empresaBandera}</h3>
                    </div>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-products">`;

        // Agregar productos filtrados
        stations.forEach(station => {
            let productName = '';
            let realProduct = '';
            
            switch (station.producto) {
                case 'Gas Oil Grado 2':
                    realProduct = "Gas Oil Grado 2";
                    productName = 'Gasoil Diesel';
                    break;
                case 'Gas Oil Grado 3':
                    realProduct = "Gas Oil Grado 3";
                    productName = 'Gasoil Premium';
                    break;
                case 'Nafta (premium) de más de 95 Ron':
                    realProduct = "Nafta (premium) de más de 95 Ron";
                    productName = 'Nafta Premium';
                    break;
                case 'Nafta (súper) entre 92 y 95 Ron':
                    realProduct = "Nafta (súper) entre 92 y 95 Ron";
                    productName = 'Nafta Super';
                    break;
                case 'GNC':
                    realProduct = "GNC";
                    productName = 'GNC';
                    break;
                default:
                    productName = station.producto;
            }

            if (!addedProducts.has(productName) && realProduct === tipoCombustible) {
                popupContent += `
                    <div class="popup-product-item">
                        <span class="product-name">${productName}</span>
                        <span class="product-price">${station.precio}</span>
                    </div>`;
                addedProducts.add(productName);
            }
        });

        // ============== FUNCIÓN SECUNDARIA - CARGAR ESTACIONES POR TIPO DE COMBUSTIBLE ==============
        // Agregar fecha de vigencia
        const latestFechaVigencia = stations.reduce((latest, current) => {
            return latest.fecha_vigencia > current.fecha_vigencia ? latest : current;
        }).fecha_vigencia;

        const fechaPart = latestFechaVigencia.split(' ')[0];
        const parts = fechaPart.split('-');
        const formattedFechaVigencia = `${parts[2]}-${parts[1]}-${parts[0]}`;

        const fechaLimite = new Date('2025-08-30');
        const fechaActualizacion = new Date(latestFechaVigencia);

        const statusClass = fechaActualizacion < fechaLimite ? 'status-outdated' : 'status-updated';
        const statusIcon = fechaActualizacion < fechaLimite ? '⚠️' : '✓';

        popupContent += `
                </div>
                <div class="popup-footer">
                    <div class="popup-update ${statusClass}">
                        <span class="update-icon">${statusIcon}</span>
                        <span class="update-text">Actualización: ${formattedFechaVigencia}</span>
                    </div>
                </div>
            </div>`;
        
        return popupContent;
    }

    function cargarEstacionesPorTipo(tipoCombustible) {
        console.log(`Cargando estaciones por tipo de combustible: ${tipoCombustible}`);

        return new Promise((resolve, reject) => {
            // Limpiar marcadores existentes
            if (markerCluster) {
                mymap.removeLayer(markerCluster);
            }
            
            // Crear nuevo grupo de marcadores
            markerCluster = crearMarkerCluster();

            fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv')
                .then(response => response.text())
                .then(csvData => {
                    const parsedData = Papa.parse(csvData, { header: true }).data;

                    // Filtrar por tipo de combustible
                    const filteredStations = parsedData.filter(station => station.producto === tipoCombustible);
                    const stationsByAddress = agruparPorDireccion(filteredStations);

                    // Crear marcadores para cada dirección
                    Object.keys(stationsByAddress).forEach(address => {
                        const stations = stationsByAddress[address];
                        
                        if (!validarCoordenadas(stations)) {
                            console.error('Error: Valores de latitud o longitud no válidos para la dirección:', address);
                            return;
                        }

                        const { lat: avgLatitude, lng: avgLongitude } = calcularCoordenadasPromedio(stations);
                        const empresaBandera = stations[0].empresabandera;
                        const popupContent = crearPopupContentFiltrado(empresaBandera, stations, tipoCombustible);
                        
                        const marker = L.marker([avgLatitude, avgLongitude], { icon: crearIconoPersonalizado() });
                        marker.bindPopup(popupContent);
                        markerCluster.addLayer(marker);
                    });

                    mymap.addLayer(markerCluster);
                    resolve(markerCluster);
                })
                .catch(error => {
                    console.error('Error al cargar el archivo CSV de estaciones de servicio:', error);
                    reject(error);
                });
        });
    }

    // ============== INICIALIZACIÓN 
    cargarEstacionesServicio()
        .then(cluster => {
            markerCluster = cluster;
        })
        .catch(error => {
            console.error('Error al cargar las estaciones de servicio:', error);
        });

    // ============================================================================================================================
    // --------------------------------- ENVÍO DEL FORMULARIO ---------------------------------------------------------------------
    // ============================================================================================================================
    const formularioViaje = document.getElementById('formulario-viaje');
    const mapaSection = document.getElementById("mapa");

    formularioViaje.addEventListener('submit', function (event) {
        event.preventDefault();
        manejarEnvioFormulario();
    });

    function manejarEnvioFormulario() {
        mapaSection.scrollIntoView({ behavior: "smooth" });

        const origen = document.getElementById('inputOrigen').value;
        const destino = document.getElementById('inputDestino').value;

        if (origen && destino) {
            limpiarMarcadoresPrevios();
            procesarOrigenYDestino(origen, destino);
            cargarEstacionesPorCombustibleSeleccionado();
        }
    }

    function limpiarMarcadoresPrevios() {
        if (marcadorOrigen) {
            mymap.removeLayer(marcadorOrigen);
            marcadorOrigen = null;
        }
        if (marcadorDestino) {
            mymap.removeLayer(marcadorDestino);
            marcadorDestino = null;
        }
    }

    function procesarOrigenYDestino(origen, destino) {
        buscarYCrearMarcador(origen, 'origen');
        buscarYCrearMarcador(destino, 'destino');
    }

    function buscarYCrearMarcador(lugar, tipo) {
        const urlBusqueda = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(lugar)}&format=json&addressdetails=1`;

        fetch(urlBusqueda)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    crearMarcadorEnMapa(data[0], lugar, tipo);
                } else {
                    console.error(`No se encontraron resultados para el ${tipo}:`, lugar);
                }
            })
            .catch(error => console.error(`Error al consultar Nominatim para el ${tipo}:`, error));
    }

    function crearMarcadorEnMapa(data, lugar, tipo) {
        const coordenadas = [data.lat, data.lon];
        const etiqueta = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const marcador = L.marker(coordenadas).addTo(mymap).bindPopup(`<b>${etiqueta}:</b> ${lugar}`);

        if (tipo === 'origen') {
            marcadorOrigen = marcador;
            if (marcadorDestino) ajustarVista();
        } else if (tipo === 'destino') {
            marcadorDestino = marcador;
            if (marcadorOrigen) ajustarVista();
        }
    }

    function cargarEstacionesPorCombustibleSeleccionado() {
        const selectedCombustible = document.getElementById('inputTipoCombustible').value;

        cargarEstacionesPorTipo(selectedCombustible)
            .then(cluster => {
                markerCluster = cluster;
            })
            .catch(error => console.error('Error al cargar las estaciones de servicio:', error));
    }
});
