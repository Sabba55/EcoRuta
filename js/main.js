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
    

    // ----------------------------- INICIALIZACIÓN DEL MAPA -----------------------------
    const mymap = L.map('mapa').setView([-34.61, -58.38], 3); // Inicializar el mapa

    // Capa de azulejos de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mymap);

    // Agregar control de "Freezy" al mapa
    L.control.freezeMapControl({
        freezeOnAdd: false, //para que no se congele al toque
        hoverToThaw: false,
        freezeButtonWhenThawed: true, // para no mostrar el boton
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

    // ----------------------------- PRECIOS PROMEDIOS -----------------------------
    calcularPreciosPromedioPorProvincia()
    function calcularPreciosPromedioPorProvincia() {
        return fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv') // Devuelve la promesa aquí
            .then(response => response.text())
            .then(csvData => {
                const estaciones = Papa.parse(csvData, { header: true }).data;
    
                const preciosPorProvincia = {}; // Objeto para almacenar precios agrupados por provincia y producto
    
                // Fecha límite: 1 de junio de 2024
                const fechaLimite = new Date('2024-06-01');
    
                // Recorrer cada estación de servicio
                estaciones.forEach(estacion => {
                    const provincia = estacion.provincia; // Asumiendo que el CSV tiene una columna llamada "provincia"
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
                        return;
                    }
    
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
                });
    
                // Calcular el promedio de precios por provincia y producto
                const resultados = {};
                for (const provincia in preciosPorProvincia) {
                    resultados[provincia] = {};
    
                    for (const producto in preciosPorProvincia[provincia]) {
                        const data = preciosPorProvincia[provincia][producto];
                        resultados[provincia][producto] = (data.total / data.count).toFixed(2); // Promedio con 2 decimales
                    }
                }
    
                // Mostrar los resultados en la consola
                return resultados; // Devuelve el resultado procesado
            })
            .catch(error => {
                console.error('Error al cargar el archivo CSV:', error);
                throw error; // Propaga el error para manejarlo posteriormente
            });
    }
    
    // ----------------------------- CALCULAR RUTA -----------------------------
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
    
        const promesas = puntos.map(async (item, index) => {
            const provincia = await obtenerProvincia(item.punto.lat, item.punto.lng);
            provinciasSinCombustible.push(provincia);
            
            const marcador = L.circleMarker([item.punto.lat, item.punto.lng], {
                 radius: 10, color: 'orange', fillColor: 'orange', fillOpacity: 1 
                }).addTo(puntosSinCombustibleLayer);
    
            const icono = L.divIcon({
                className: 'fuel-icon', 
                html: '<i class="bi bi-fuel-pump-fill"></i>',  
                iconSize: [20, 20],  
                iconAnchor: [10, 10],  
            });
            




            // --- MEJORAR ---
            const marcadorConIcono = L.marker([item.punto.lat, item.punto.lng], { icon: icono }).addTo(puntosSinCombustibleLayer);
            marcadorConIcono.bindPopup(`Recorriste: ${item.distancia.toFixed(2)} km`);
                





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
    

   // ----------------------------- PEAJES JSON -----------------------------
    // Lista para almacenar los marcadores de peajes
    const peajeMarkers = [];

    fetch('module/SurtiPeaje/peajes.geojson')
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (!geometry || !geometry.coordinates) {
                    console.error('Geometría inválida en el feature:', feature);
                    return;
                }

                let coordinatesList = [];
                if (geometry.type === "MultiPoint") {
                    coordinatesList = geometry.coordinates;
                } else if (geometry.type === "Point") {
                    coordinatesList = [geometry.coordinates];
                }

                coordinatesList.forEach(coord => {
                    if (coord.length === 2) {
                        const lat = coord[1];
                        const lon = coord[0];

                        const peajeIcon = L.divIcon({
                            className: 'custom-div-icon',
                            html: '<div style="background-color: green; width: 5px; height: 5px; border-radius: 50%;"></div>',
                            iconSize: [8, 8],
                        });

                        const marker = L.marker([lat, lon], { icon: peajeIcon }).addTo(mymap);
                        marker.bindPopup(generarPopupPeaje(feature));

                        // Agregar el marcador a la lista para su gestión
                        peajeMarkers.push(marker);
                    } else {
                        console.error('Coordenadas inválidas:', coord);
                    }
                });
            });

            // Escuchar eventos de movimiento del mapa para actualizar visibilidad de los peajes
            mymap.on('moveend', actualizarVisibilidadPeajes);
        })
        .catch(error => console.error('Error al cargar el archivo JSON:', error));

    /* Oculta o muestra los peajes según si están dentro de la vista del usuario */
    function actualizarVisibilidadPeajes() {
        const bounds = mymap.getBounds(); // Obtener límites visibles del mapa

        peajeMarkers.forEach(marker => {
            const latLng = marker.getLatLng();
            if (bounds.contains(latLng)) {
                marker.setOpacity(1); // Mostrar si está dentro del mapa
            } else {
                marker.setOpacity(0); // Ocultar si está fuera del mapa
            }
        });
    }

    function generarPopupPeaje(feature) {
        const preciosPeaje = feature.properties.precios_peaje || {};

        // Mapeo de nombres de vehículos a imágenes y cantidad de ejes
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

        // Mapa para almacenar las tarifas sin duplicados
        const tarifasAgrupadas = new Map();

        Object.values(preciosPeaje).forEach(tarifa => {
            tarifa.vehiculos.forEach(vehiculo => {
                if (!imagenesVehiculos[vehiculo]) return; // Ignorar si no hay imagen mapeada

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
            <div style="font-family: Arial, sans-serif; text-align: center;">

                <!-- Encabezado -->
                <div style="margin-bottom: 5px;">
                    <b style="color: green; font-size: 18px;">${feature.properties.ruta.nombre}</b><br>
                    <b>Empresa:</b> ${feature.properties.empresa}<br>
                    <b>Tramo:</b> ${feature.properties.ruta.tramo}
                </div>

                <!-- Tabla de tarifas -->
                <div>
                    <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin: 0 auto; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #d4edda; border: 1px solid #000;">
                                <th style="padding: 3px; border: 1px solid #000;">Ejes</th>
                                <th style="padding: 3px; border: 1px solid #000;">Vehículo</th>
                                <th style="padding: 3px; border: 1px solid #000;">Tarifa</th>
                                <th style="padding: 3px; border: 1px solid #000;">Telepase</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from(tarifasAgrupadas.entries()).map(([vehiculo, tarifa]) => `
                                <tr style="border: 1px solid black; background-color: #f8f9fa;">
                                    <td style="text-align: center; padding: 3px; border: 1px solid #000;">
                                        <b>${tarifa.ejes}</b>
                                    </td>
                                    <td style="text-align: center; padding: 3px; border: 1px solid #000;">
                                        <img src="assets/tarifa_peajes/${tarifa.imagen}" 
                                            alt="${vehiculo}" style="width: 50px; height: auto; vertical-align: middle;">
                                    </td>
                                    <td style="text-align: center; padding: 3px; border: 1px solid #000;">
                                        <b>${tarifa.tarifa_basica}</b>
                                    </td>
                                    <td style="text-align: center; padding: 3px; border: 1px solid #000;">
                                        <b>${tarifa.telepase_basico}</b>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

            </div>
        `;
    }


    // ----------------------------- DETECTAR PEAJES EN LA RUTA Y CALCULAR COSTO -----------------------------
    async function detectarPeajesEnRuta(ruta) {
        try {
            const response = await fetch('module/SurtiPeaje/peajes.geojson');
            const data = await response.json();
    
            let peajesContador = new Map();
            let costoTotalPeajesEfectivo = 0;
            let costoTotalPeajesTelepase = 0;
    
            const vehiculoCategoria = localStorage.getItem("clasificacion") === "No clasificado" 
                ? "2 ejes (tall < 2.30m)(tall < 2.10m)" 
                : localStorage.getItem("clasificacion");

            // document.getElementById("index_vehiculo").textContent = vehiculoCategoria;
    
            const distanciaDefault = 9; // Distancia por defecto
    
            // Peajes que requieren una distancia específica
            const peajesConDistanciaEspecial = new Map([
                ["peaje_dock_sud_vuelta_0005", 25],
                ["peaje_isla_la_deseada_0008", 39],
                ["peaje_frontera_puente_libertador_general_san_martin_0015", 1100],
                ["peaje_frontera_puente_general_artigas_0015", 90],
                ["ferry_primera_angostura_0016", 25],                  
            ]);
    
            let deteccionesPeajes = new Map();
    
            if (!Array.isArray(ruta.coordinates) || ruta.coordinates.length === 0) {
                console.error("Error: La ruta no tiene coordenadas válidas.", ruta.coordinates);
                return;
            }
    
            data.features.forEach(feature => {
                const geometry = feature.geometry;
                if (!geometry || !geometry.coordinates) return;
    
                let coordenadasPeaje = [];
    
                if (geometry.type === 'Point') {
                    coordenadasPeaje.push(geometry.coordinates);
                } else if (geometry.type === 'MultiPoint') {
                    coordenadasPeaje = geometry.coordinates;
                }
    
                const peajeID = feature.id;
                const distanciaMaxima = peajesConDistanciaEspecial.get(peajeID) || distanciaDefault; // Asigna distancia según ID
    
                coordenadasPeaje.forEach(coord => {
                    if (!Array.isArray(coord) || coord.length < 2) {
                        console.warn("⚠️ Coordenadas de peaje inválidas:", coord);
                        return;
                    }
    
                    const peajeLatLng = L.latLng(coord[1], coord[0]);
                    const nombrePeaje = feature.properties.ruta.nombre;
                    const idEmpresa = feature.properties.idempresa;
                    const identificadorCasilla = `${nombrePeaje}-${coord[1]},${coord[0]}`;
    
                    // Verificar si el usuario tiene Telepase activado para esta empresa
                    const tieneTelepase = localStorage.getItem(idEmpresa) === "true";
    
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
                            if (registros.length === 0 || index - registros[registros.length - 1] > 5) {
                                registros.push(index);
                                peajesContador.set(identificadorCasilla, (peajesContador.get(identificadorCasilla) || 0) + 1);
    
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
    
            document.getElementById("resultado-total-peajes-efectivo").textContent = `$ ${costoTotalPeajesEfectivo.toFixed(2)}`;
            document.getElementById("resultado-total-peajes-telepase").textContent = `$ ${costoTotalPeajesTelepase.toFixed(2)}`;
    
            console.log(`✅ Cantidad de peajes en la ruta: ${peajesContador.size}`);
            console.log(`✅ Peajes atravesados:`, peajesContador);
            console.log(`✅ Costo total de peajes en efectivo para ${vehiculoCategoria}: $${costoTotalPeajesEfectivo}`);
            console.log(`✅ Costo total de peajes con Telepase para ${vehiculoCategoria}: $${costoTotalPeajesTelepase}`);

            gastoTotalPeajes = parseFloat(costoTotalPeajesEfectivo) + parseFloat(costoTotalPeajesTelepase);
    
            let resultadoPeajes = "";
            peajesContador.forEach((count, peaje) => {
                resultadoPeajes += `<p>${peaje}: ${count} veces</p>`;
            });
            document.getElementById("detalle-peajes").innerHTML = resultadoPeajes;
        } catch (error) {
            console.error('❌ Error al detectar peajes en la ruta:', error);
        }
    }
    

    // ----------------------------- CARGAR ESTACIONES DE SERVICIOS CSV -----------------------------    
    let markerCluster;

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
            html: '<div class="marker-circle"><strong>E</div>',
            iconSize: [20, 20],
        });
    }

    function crearPopupContent(empresaBandera, stations) {
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

        const productOrder = ['Nafta Super', 'Nafta Premium', 'Diesel Comun', 'Diesel Premium', 'GNC'];
        const productMap = {
            'Gas Oil Grado 2': 'Diesel Comun',
            'Gas Oil Grado 3': 'Diesel Premium',
            'Nafta (premium) de más de 95 Ron': 'Nafta Premium',
            'Nafta (súper) entre 92 y 95 Ron': 'Nafta Super',
        };

        const addedProducts = new Set();
        let popupContent = `<div class="popup-content"><div><b class="company-name">${empresaBandera}</b><br>`;

        productOrder.forEach(product => {
            stations.forEach(station => {
                const productName = productMap[station.producto] || station.producto;
                if (productName === product && !addedProducts.has(productName)) {
                    popupContent += `<b>${productName}</b>: $<span class="price">${station.precio}</span><br>`;
                    addedProducts.add(productName);
                }
            });
        });

        const fechaVigencia = formatearFechaVigencia(stations);
        popupContent += fechaVigencia;
        popupContent += `
            </div>
            <div class="logo_edes" style="display: flex; justify-content: center; align-items: center;">
                <img src="${companyLogoPaths[empresaBandera]}" alt="Logo de la estación" width="50" height="50">
            </div>
        </div>`;
        return popupContent;
    }

    function formatearFechaVigencia(stations) {
        const latest = stations.reduce((latest, current) => {
            return new Date(latest.fecha_vigencia) > new Date(current.fecha_vigencia) ? latest : current;
        }).fecha_vigencia;

        const formattedFecha = latest.split(' ')[0].split('-').reverse().join('-');
        const fechaActualizacion = new Date(latest);
        const fechaLimite = new Date('2024-12-30');

        const color = fechaActualizacion < fechaLimite ? 'red' : 'black';
        return `<br><b><span style="color: ${color};">Actualización:</span></b> ${formattedFecha}<br>`;
    }

    // Llamamos a la función para cargar las estaciones de servicio y obtenemos el objeto markerCluster
    cargarEstacionesServicio()
        .then(cluster => {
            // Guardamos el objeto markerCluster en la variable global
            markerCluster = cluster;
        })
        .catch(error => {
            // Manejamos cualquier error que ocurra durante la carga de las estaciones de servicio
            console.error('Error al cargar las estaciones de servicio:', error);
        });

    // Función para cargar las estaciones de servicio según el tipo de combustible seleccionado
    function cargarEstacionesPorTipo(tipoCombustible) {
        console.log(`Cargando estaciones por tipo de combustible: ${tipoCombustible}`);
    
        return new Promise((resolve, reject) => {

        // Limpiar los marcadores y grupo de marcadores del mapa
        if (markerCluster) {
            mymap.removeLayer(markerCluster);
        }
        
        // Crear un nuevo grupo de marcadores
        markerCluster = L.markerClusterGroup({
            iconCreateFunction: function (cluster) {
                return L.divIcon({
                    html: `<div class="marker-cluster-custom">${cluster.getChildCount()}</div>`,
                    className: 'marker-cluster-custom',
                    iconSize: L.point(30, 30), // Tamaño del icono del marcador
                });
            }
        });

        fetch('module/SurtiPeaje/precios-en-surtidor-resolucin-3142016.csv')
            .then(response => response.text())
            .then(csvData => {
                const parsedData = Papa.parse(csvData, { header: true }).data;

                // Filtrar las estaciones por tipo de combustible seleccionado
                const filteredStations = parsedData.filter(station => station.producto === tipoCombustible);

                // Objeto para almacenar las estaciones agrupadas por dirección
                const stationsByAddress = {};

                // Agrupar las estaciones por dirección
                filteredStations.forEach(row => {
                    const address = row.direccion;
                    if (!stationsByAddress[address]) {
                        stationsByAddress[address] = [];
                    }
                    stationsByAddress[address].push(row);
                });

                // Objeto para mapear empresaBandera a la ruta de la imagen del logo
                const companyLogoPaths = {
                    'AXION': 'assets/logo_estaciones/axion.png',
                    'DAPSA S.A.': 'assets/logo_estaciones/dapsa.png',
                    'YPF': 'assets/logo_estaciones/ypf.png',
                    'GULF': 'assets/logo_estaciones/gulf.png',
                    'PUMA': 'assets/logo_estaciones/puma.png',
                    'REFINOR': 'assets/logo_estaciones/refinor.png',
                    'SHELL C.A.P.S.A.': 'assets/logo_estaciones/shell.png',
                    'VOY': 'assets/logo_estaciones/voy.png',
                    'BLANCA': 'assets/logo_estaciones/cualquier_otro_nombre.png'
                };

                // Crear icono personalizado para los marcadores
                const customIcon = L.divIcon({
                    className: 'custom-marker-icon',
                    html: '<div class="marker-circle"><strong>E</div>',
                    iconSize: [20, 20], // Tamaño del icono
                });

                // Crear marcadores para cada dirección
                Object.keys(stationsByAddress).forEach(address => {
                    const stations = stationsByAddress[address];
                    const latitudes = stations.map(station => parseFloat(station.latitud));
                    const longitudes = stations.map(station => parseFloat(station.longitud));

                    // Verificar si hay valores de latitud o longitud que no son números válidos
                    if (latitudes.some(isNaN) || longitudes.some(isNaN)) {
                        console.error('Error: Valores de latitud o longitud no válidos para la dirección:', address);
                        return; // Salir del bucle para esta dirección si hay valores no válidos
                    }

                    // Tomar el promedio de las coordenadas para colocar el marcador en el centro de las estaciones
                    const avgLatitude = latitudes.reduce((acc, curr) => acc + curr, 0) / latitudes.length;
                    const avgLongitude = longitudes.reduce((acc, curr) => acc + curr, 0) / longitudes.length;

                    // Crear marcador para la empresa
                    const marker = L.marker([avgLatitude, avgLongitude], { icon: customIcon });

                    // Personalizar marcador con información relevante
                    let popupContent = `
                        <div class="popup-content">
                            <div>
                                <b class="company-name">${stations[0].empresabandera}</b><br>
                    `;

                // Crear un conjunto para realizar un seguimiento de los productos agregados al popup
                const addedProducts = new Set();

                    // Agregar los productos al popup (sin ordenar)
                    stations.forEach(station => {
                        let productName = '';
                        switch (station.producto) {
                            case 'Gas Oil Grado 2':
                                realProduct = "Gas Oil Grado 2"
                                productName = 'Gasoil Diesel';
                                break;
                            case 'Gas Oil Grado 3':
                                realProduct = "Gas Oil Grado 3"
                                productName = 'Gasoil Premium';
                                break;
                            case 'Nafta (premium) de más de 95 Ron':
                                realProduct = "Nafta (premium) de más de 95 Ron"
                                productName = 'Nafta Premium';
                                break;
                            case 'Nafta (súper) entre 92 y 95 Ron':
                                realProduct = "Nafta (súper) entre 92 y 95 Ron"
                                productName = 'Nafta Super';
                                break;
                            case 'GNC':
                                realProduct = "GNC"
                                productName = 'GNC';
                                break;
                            default:
                                productName = station.producto;
                        }

                        // Verificar si el producto ya ha sido agregado al popup
                        if (!addedProducts.has(productName) && realProduct === tipoCombustible) {
                            popupContent += `<b>${productName}</b>: $<span class="price">${station.precio}</span><br>`;
                            // Agregar el producto al conjunto para evitar agregarlo nuevamente
                            addedProducts.add(productName);
                        }
                    });

                    // Mostrar el dato de fecha_vigencia más reciente para esta empresa
                    const latestFechaVigencia = stations.reduce((latest, current) => {
                        return latest.fecha_vigencia > current.fecha_vigencia ? latest : current;
                    }).fecha_vigencia;

                    // Obtener solo la parte de la fecha (yyyy-mm-dd)
                    const fechaPart = latestFechaVigencia.split(' ')[0];

                    // Dividir la fecha en partes (año, mes, día)
                    const parts = fechaPart.split('-');
                    const formattedFechaVigencia = `${parts[2]}-${parts[1]}-${parts[0]}`; // Reordenar y formatear la fecha

                    // Fecha límite
                    const fechaLimite = new Date('2024-01-30');

                    // Convertir la fecha de actualización a un objeto Date
                    const fechaActualizacion = new Date(latestFechaVigencia);

                    // Verificar si la fecha de actualización es anterior a la fecha límite
                    if (fechaActualizacion.getTime() < fechaLimite.getTime()) {
                        // Si es anterior, agregar estilo CSS para color rojo
                        popupContent += `
                            <br>
                            <b><span style="color: red;">Actualización:</span></b> ${formattedFechaVigencia}<br>
                        `;
                    } else {
                        // Si no, mantener el estilo actual (negro)
                        popupContent += `
                            <br>
                            <b>Actualización:</b> ${formattedFechaVigencia}<br>
                        `;
                    }

                    // Continuar con la construcción del contenido del popup
                    popupContent += `
                        </div>
                            <div class="logo_edes" style="display: flex; justify-content: center; align-items: center;">
                                <img src="${companyLogoPaths[stations[0].empresabandera]}" alt="Logo de la estación" width="50" height="50">
                            </div>
                        </div>
                    `;

                    // Agregar el popup al marcador
                    marker.bindPopup(popupContent);

                    // Agregar marcador al grupo de marcadores agrupados
                    markerCluster.addLayer(marker);
                });

                // Agregar grupo de marcadores al mapa
                mymap.addLayer(markerCluster);

                resolve(markerCluster); //-------------------
            })
            .catch(error => {console.error('Error al cargar el archivo CSV de estaciones de servicio:', error)});
        });
    }


    // ----------------------------- ENVÍO DEL FORMULARIO -----------------------------
    const formularioViaje = document.getElementById('formulario-viaje');
    const mapaSection = document.getElementById("mapa");
    formularioViaje.addEventListener('submit', function (event) {
        event.preventDefault(); // Evita que el formulario se envíe
        mapaSection.scrollIntoView({ behavior: "smooth" });

        const origen = document.getElementById('inputOrigen').value;
        const destino = document.getElementById('inputDestino').value;

        if (origen && destino) {
            // Eliminar marcadores previos si existen
            if (marcadorOrigen) {
                mymap.removeLayer(marcadorOrigen);
                marcadorOrigen = null;
            }
            if (marcadorDestino) {
                mymap.removeLayer(marcadorDestino);
                marcadorDestino = null;
            }

            // Consultar coordenadas del origen
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origen)}&format=json&addressdetails=1`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const coordenadas = [data[0].lat, data[0].lon];
                        marcadorOrigen = L.marker(coordenadas).addTo(mymap).bindPopup(`<b>Origen:</b> ${origen}`);

                        // Verificar si ya tenemos el destino cargado para ajustar la vista
                        if (marcadorDestino) {
                            ajustarVista();
                        }
                    } else {
                        console.error("No se encontraron resultados para el origen:", origen);
                    }
                })
                .catch(error => console.error("Error al consultar Nominatim para el origen:", error));

            // Consultar coordenadas del destino
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destino)}&format=json&addressdetails=1`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const coordenadas = [data[0].lat, data[0].lon];
                        
                        marcadorDestino = L.marker(coordenadas).addTo(mymap).bindPopup(`<b>Destino:</b> ${destino}`);

                        // Verificar si ya tenemos el origen cargado para ajustar la vista
                        if (marcadorOrigen) {
                            ajustarVista();
                        }
                    } else {
                        console.error("No se encontraron resultados para el destino:", destino);
                    }
                })
                .catch(error => console.error("Error al consultar Nominatim para el destino:", error));

            // Obtener el tipo de combustible seleccionado
            const selectedCombustible = document.getElementById('inputTipoCombustible').value;

            // Cargar nuevas estaciones de servicio
            cargarEstacionesPorTipo(selectedCombustible)
                .then(cluster => {
                    markerCluster = cluster;
                })
                .catch(error => console.error('Error al cargar las estaciones de servicio:', error));
        }
    });
});
