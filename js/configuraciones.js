document.addEventListener("DOMContentLoaded", () => {

    // ------------------ Barra del formulario ------------------
    const rangeInput = document.getElementById("carga_tanque");
    const rangeValue = document.getElementById("rangeValue");

    function obtenerValorConvertido(valor) {
        return (valor / 100).toFixed(2); 
    }

    let valorGuardado = localStorage.getItem("carga_tanque");     // Verificar si hay un valor guardado en localStorage

    if (valorGuardado === null) {
        valorGuardado = "55"; 
        localStorage.setItem("carga_tanque", obtenerValorConvertido(valorGuardado));
    } else {
        valorGuardado = parseFloat(valorGuardado) * 100;
    }

    // Asignar el valor al input y mostrarlo en el span con porcentaje
    rangeInput.value = valorGuardado;
    rangeValue.textContent = valorGuardado.toFixed(0) + "%";

    rangeInput.addEventListener("input", function () {
        rangeValue.textContent = rangeInput.value + "%"; 
    });

    rangeInput.addEventListener("change", function () {
        const valorConvertido = obtenerValorConvertido(rangeInput.value);
        localStorage.setItem("carga_tanque", valorConvertido);
    });


    
    // ------------------ Elementos del formulario ------------------
    const tipoVehiculo = document.getElementById("tipo-vehiculo");
    const cantidadEjes = document.getElementById("cantidad-ejes");
    const altura = document.getElementById("altura");
    const precioCombustible = document.getElementById("precio-combustible");
    const errorMsg = document.getElementById("error-msg");


    if (tipoVehiculo && cantidadEjes && altura && precioCombustible) { // Verificar si los elementos existen antes de ejecutar código
        
        const opcionesVehiculo = {
            vehiculo_01: { ejes: `<option value="">No aplica</option>`, altura: `<option value="">No aplica</option>`, disabled: true },
            vehiculo_02: { 
                ejes: `<option value="2">2</option>`,
                altura: `<option value="">Selecciona la altura</option><option value="(tall < 2.10m)">Menor a 2,10m</option><option value="(tall < 2.30m)">Menor a 2,30m</option>`,
                disabled: false
            },
            vehiculo_03: { 
                ejes: `<option value="">Selecciona la cantidad de ejes</option><option value="3">3</option><option value="4">4</option>`,
                altura: `<option value="">Selecciona la altura</option><option value="(tall < 2.10m)">Menor a 2,10m</option><option value="(tall < 2.30m)">Menor a 2,30m</option>`,
                disabled: false
            },
            vehiculo_04: { 
                ejes: `<option value="">Selecciona la cantidad de ejes</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="+6">+6</option>`,
                altura: `<option value="">Selecciona la altura</option><option value="(tall > 2.10m)">Mayor a 2,10m</option><option value="(tall > 2.30m)">Mayor a 2,30m</option>`,
                disabled: false
            },
            vehiculo_05: { 
                ejes: `<option value="">Selecciona la cantidad de ejes</option><option value="2">2</option><option value="3">3</option>`,
                altura: `<option value="">Selecciona la altura</option><option value="(tall > 2.10m)">Mayor a 2,10m</option><option value="(tall > 2.30m)">Mayor a 2,30m</option>`,
                disabled: false
            }
        };

        // Función para cargar valores desde LocalStorage
        function cargarValores() {
            tipoVehiculo.value = localStorage.getItem("tipoVehiculo") || "";
            cantidadEjes.value = localStorage.getItem("cantidadEjes") || "";
            altura.value = localStorage.getItem("altura") || "";
            precioCombustible.value = localStorage.getItem("precioCombustible") || "";
        }

        // Función para actualizar las opciones según el vehículo seleccionado
        function actualizarOpciones() {
            const seleccion = tipoVehiculo.value;
            const opciones = opcionesVehiculo[seleccion] || opcionesVehiculo.vehiculo_05;

            // Guardar valores actuales antes de reiniciar opciones
            const ejesGuardado = localStorage.getItem("cantidadEjes");
            const alturaGuardada = localStorage.getItem("altura");

            // Aplicar opciones según el vehículo seleccionado
            cantidadEjes.innerHTML = opciones.ejes;
            altura.innerHTML = opciones.altura;

            // Habilitar o deshabilitar los select
            cantidadEjes.disabled = opciones.disabled;
            altura.disabled = opciones.disabled;

            // Restaurar valores guardados después de actualizar opciones
            if (ejesGuardado) cantidadEjes.value = ejesGuardado;
            if (alturaGuardada) altura.value = alturaGuardada;

            // Guardar valores en LocalStorage
            localStorage.setItem("tipoVehiculo", seleccion);
            localStorage.setItem("cantidadEjes", cantidadEjes.value);
            localStorage.setItem("altura", altura.value);

            clasificarVehiculo();
        }

        // Función para clasificar el vehículo
        function clasificarVehiculo() {
            const seleccion = tipoVehiculo.value;
            const ejes = cantidadEjes.value;
            const alturaSeleccionada = altura.value;

            let clasificacion = "No clasificado"; // Valor por defecto

            switch (seleccion) {
                case "vehiculo_01":
                    clasificacion = "Motocicleta";
                    break;
        
                case "vehiculo_02":
                    if (ejes === "2" && alturaSeleccionada === "(tall < 2.10m)") {
                        clasificacion = "2 ejes (tall < 2.10m)";
                    } else if (ejes === "2" && alturaSeleccionada === "(tall < 2.30m)") {
                        clasificacion = "2 ejes (tall < 2.30m)(tall < 2.10m)";
                    }
                    break;
        
                case "vehiculo_03":
                    if (ejes === "3" && alturaSeleccionada === "(tall < 2.10m)") {
                        clasificacion = "3 ejes (tall < 2.10m) sin rueda doble";
                    } else if (ejes === "3" && alturaSeleccionada === "(tall < 2.30m)") {
                        clasificacion = "3 ejes (tall < 2.30m)(tall < 2.10m) sin rueda doble";
                    } else if (ejes === "4" && alturaSeleccionada === "(tall < 2.10m)") {
                        clasificacion = "4 ejes (tall < 2.10m) sin rueda doble";
                    } else if (ejes === "4" && alturaSeleccionada === "(tall < 2.30m)") {
                        clasificacion = "4 ejes (tall < 2.30m)(tall < 2.10m) sin rueda doble";
                    }
                    break;
        
                case "vehiculo_04":
                    if (ejes === "2" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "2 ejes (tall > 2.10m)" ;
                    } else if (ejes === "2" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "2 ejes (tall > 2.30m)(tall > 2.10m)";
        
                    } else if (ejes === "3" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "3 ejes (tall > 2.10m)";
                    } else if (ejes === "3" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "3 ejes (tall > 2.10m)(tall > 2.30m)";
        
                    } else if (ejes === "4" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "4 ejes (tall > 2.10m)";
                    } else if (ejes === "4" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "4 ejes (tall > 2.10m)(tall > 2.30m)";
                        
                    } else if (ejes === "5" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "5 ejes";
                    } else if (ejes === "5" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "5 ejes";
                                    
                    } else if (ejes === "6" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "6 ejes";
                    } else if (ejes === "6" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "6 ejes";
        
                    } else if (ejes === "+6" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "+6 ejes";
                    } else if (ejes === "+6" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "+6 ejes";
                    }
                    break;            
                
                case "vehiculo_05":
                    if (ejes === "2" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "2 ejes (tall > 2.10m)";
                    } else if (ejes === "2" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "2 ejes (tall > 2.30m)(tall > 2.10m)";
                    } else if (ejes === "3" && alturaSeleccionada === "(tall > 2.10m)") {
                        clasificacion = "3 ejes (tall > 2.10m)";
                    } else if (ejes === "3" && alturaSeleccionada === "(tall > 2.30m)") {
                        clasificacion = "3 ejes (tall > 2.10m)(tall > 2.30m)";
                    }
                    break;
                default:
                    clasificacion = "No clasificado";
            }

            console.log("Clasificación:", clasificacion); // Para depuración

            localStorage.setItem("clasificacion", clasificacion); // Guardar clasificación en LocalStorage
        }

        // Eventos para guardar valores
        tipoVehiculo.addEventListener("change", actualizarOpciones);
        cantidadEjes.addEventListener("change", () => {
            localStorage.setItem("cantidadEjes", cantidadEjes.value);
            clasificarVehiculo();
        });
        altura.addEventListener("change", () => {
            localStorage.setItem("altura", altura.value);
            clasificarVehiculo();
        });
        precioCombustible.addEventListener("input", () => localStorage.setItem("precioCombustible", precioCombustible.value));

        // Cargar valores y actualizar la interfaz al cargar la página
        cargarValores();
        actualizarOpciones();
    }



// ------------------ Carga de telepases ------------------
fetch('/module/SurtiPeaje/telepases.json')
    .then(response => response.json())
    .then(data => {
        let telepaseContainer = document.querySelector("#tabla-telepase");

        data.forEach(peaje => {
            let row = document.createElement("div");
            row.classList.add("telepase-row");

            let cellNombre = document.createElement("div");
            cellNombre.textContent = peaje.nombre;
            cellNombre.classList.add("telepase-name");

            let cellTelepase = document.createElement("div");
            cellTelepase.classList.add("telepase-buttons");

            let btnSi = document.createElement("button");
            btnSi.textContent = "Sí";
            btnSi.classList.add("btn-green");
            btnSi.onclick = () => seleccionarOpcion(peaje.id, true);

            let btnNo = document.createElement("button");
            btnNo.textContent = "No";
            btnNo.classList.add("btn-red");
            btnNo.onclick = () => seleccionarOpcion(peaje.id, false);

            let seleccionGuardada = localStorage.getItem(peaje.id);
            if (seleccionGuardada === "true") {
                btnSi.classList.add("btn-selected");
                btnNo.classList.add("btn-disabled");
            } else {
                btnNo.classList.add("btn-selected");
                btnSi.classList.add("btn-disabled");

                if (seleccionGuardada === null) {
                    localStorage.setItem(peaje.id, false);
                }
            }

            // Asignar atributos para identificar cada botón
            btnSi.setAttribute("data-peaje-id", peaje.id);
            btnNo.setAttribute("data-peaje-id", peaje.id);

            cellTelepase.appendChild(btnSi);
            cellTelepase.appendChild(btnNo);

            row.appendChild(cellNombre);
            row.appendChild(cellTelepase);
            telepaseContainer.appendChild(row);
        });

        // Aplicar restricciones según el estado de "Telepase Nacional"
        actualizarPeajesRelacionados();
    })
    .catch(error => console.error("Error cargando los datos:", error));

function seleccionarOpcion(peajeId, esSi) {
    let telepaseNacionalActivo = localStorage.getItem("telepase-nacional") === "true";

    // No permitir cambios en los peajes relacionados si Telepase Nacional está activo
    let peajesRelacionados = [
        "autopistas-sol",
        "autopistas-oeste",
        "caminos-uruguay",
        "ceamse",
        "ausa",
        "aubasa",
        "corredores-viales",
        "camino-sierras"
    ];

    if (telepaseNacionalActivo && peajesRelacionados.includes(peajeId)) {
        return; // Bloqueamos el cambio
    }

    let botones = document.querySelectorAll(`[data-peaje-id='${peajeId}']`);
    let btnSi = botones[0];
    let btnNo = botones[1];

    if (peajeId === "telepase-nacional") {
        actualizarPeajesRelacionados(esSi);
    }

    btnSi.classList.remove("btn-selected", "btn-disabled");
    btnNo.classList.remove("btn-selected", "btn-disabled");

    if (esSi) {
        btnSi.classList.add("btn-selected");
        btnNo.classList.add("btn-disabled");
    } else {
        btnNo.classList.add("btn-selected");
        btnSi.classList.add("btn-disabled");
    }

    localStorage.setItem(peajeId, esSi);
}

// Función para bloquear/desbloquear los peajes relacionados
function actualizarPeajesRelacionados(activar = null) {
    let telepaseNacionalActivo = localStorage.getItem("telepase-nacional") === "true";

    if (activar !== null) {
        telepaseNacionalActivo = activar;
        localStorage.setItem("telepase-nacional", activar);
    }

    let peajesRelacionados = [
        "autopistas-sol",
        "autopistas-oeste",
        "caminos-uruguay",
        "ceamse",
        "ausa",
        "aubasa",
        "corredores-viales",
        "camino-sierras"
    ];

    peajesRelacionados.forEach(peajeId => {
        let botones = document.querySelectorAll(`[data-peaje-id='${peajeId}']`);
        if (botones.length === 0) return;

        let btnSi = botones[0];
        let btnNo = botones[1];

        if (telepaseNacionalActivo) {
            btnSi.classList.add("btn-selected");
            btnNo.classList.remove("btn-selected");
            btnSi.classList.remove("btn-disabled");
            btnNo.classList.add("btn-disabled");
            localStorage.setItem(peajeId, true);
        } else {
            btnSi.classList.remove("btn-selected");
            btnNo.classList.add("btn-selected");
            btnSi.classList.add("btn-disabled");
            btnNo.classList.remove("btn-disabled");
            localStorage.setItem(peajeId, false);
        }
    });
}





    
    // Verifica que el precio del combustible internacional este entre esos valores
    precioCombustible.addEventListener("input", function () {
        const value = parseInt(precioCombustible.value);
        if (isNaN(value) || value < 1000 || value > 1800) {
            errorMsg.style.display = "block";
        } else {
            errorMsg.style.display = "none";
        }
    });

    precioCombustible.addEventListener("blur", function () {
        let value = parseInt(precioCombustible.value);
        if (isNaN(value) || value < 1000) value = 1000;
        else if (value > 1800) value = 1800;
        precioCombustible.value = value;
        localStorage.setItem("precioCombustible", value);
    });
});


