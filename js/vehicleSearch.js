document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("#csv-table tbody");
    const googleSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQaJ68k1PRU4SzvwGoidM6QTexlA7LFlldjPQavEZawHQYmSju1j1cQ7GRCfA1KNh97nBFeoINm_kuO/pub?gid=0&single=true&output=csv";

    let currentPage = 1; // Página actual
    const rowsPerPage = 15; // Número de filas por página
    let totalRows = 0; // Número total de filas
    let tableData = []; // Almacenará todos los datos
    let filteredData = []; // Almacenará los datos filtrados

    const botonBorrar = document.getElementById("boton_configuracion02");
    const formulario = document.getElementById("form-configuracion");

    botonBorrar.addEventListener("click", () => {
        formulario.reset(); // Resetea todos los campos del formulario
    });

    // Objeto que asigna colores a cada marca
    const marcaColores = {
        Toyota: "#ffffff",
        Fiat: "#7e3535",
        Chevrolet: "#ffd037",
        Peugeot: "#3f42ff",
        Renault: "#fffc3f",
        Volkswagen: "#120edb",
        Ford: "#869bf7",
        Honda: "#C1FFD7",
        BMW: "#FFC1E3",
        Audi: "#FFF5C1",
        Mercedes: "#9c9c9c",
        Citroen: "#ff0000",
        Jeep: "#417944",
        MercedesBenz: "#00ffff",
        Mini: "#ad5656",
        Nissan: "#ad2e2e",
        
        // Agrega más marcas y colores aquí
    };

    // Función para obtener el color de fondo según la marca
    function obtenerColorMarca(marca) {
        return marcaColores[marca] || "#FFFFFF"; // Color por defecto si no se encuentra la marca
    }

    // Función para cargar datos desde Google Sheets
    function cargarDatos() {
        Papa.parse(googleSheetURL, {
            download: true,
            header: true,
            complete: function (result) {
                tableData = result.data;
                filteredData = tableData; // Por defecto, mostramos todos los datos
                totalRows = filteredData.length;
                mostrarPagina(currentPage);
                actualizarBotones();
            },
            error: function (err) {
                console.error("Error al cargar los datos: ", err);
            }
        });
    }

    // Función para mostrar una página específica
    function mostrarPagina(pagina) {
        tableBody.innerHTML = ""; // Limpiar tabla
        const startIndex = (pagina - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalRows);

        // Iterar solo sobre las filas correspondientes a la página
        filteredData.slice(startIndex, endIndex).forEach(row => {
            const tr = document.createElement("tr");

            Object.entries(row).forEach(([key, cell]) => {
                const td = document.createElement("td");
                td.textContent = cell;

                // Si la columna es "Marca", aplica el color de fondo
                if (key === "Marca") {
                    td.style.backgroundColor = obtenerColorMarca(cell);
                }

                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    // Función para actualizar los botones de paginación
    function actualizarBotones() {
        document.getElementById("pagina-actual").textContent = currentPage;
        document.getElementById("boton-anterior").disabled = currentPage === 1;
        document.getElementById("boton-siguiente").disabled = currentPage === Math.ceil(totalRows / rowsPerPage);
    }

    // Event Listeners para los botones de paginación
    document.getElementById("boton-anterior").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            mostrarPagina(currentPage);
            actualizarBotones();
        }
    });

    document.getElementById("boton-siguiente").addEventListener("click", () => {
        if (currentPage < Math.ceil(totalRows / rowsPerPage)) {
            currentPage++;
            mostrarPagina(currentPage);
            actualizarBotones();
        }
    });

    // Función para filtrar los datos de acuerdo a los valores del formulario
    function filtrarDatos() {
        const marca = document.getElementById("marca").value;
        const modelo = document.getElementById("modelo").value;
        const motor = document.getElementById("motor").value;
        const combustible = document.getElementById("combustible").value;

        filteredData = tableData.filter(row => {
            return (
                (marca ? row.Marca.toLowerCase().includes(marca.toLowerCase()) : true) &&
                (modelo ? row.Modelo.toLowerCase().includes(modelo.toLowerCase()) : true) &&
                (motor ? row.Motor.toLowerCase().includes(motor.toLowerCase()) : true) &&
                (combustible ? row["Tipo Combustible"].toLowerCase().includes(combustible.toLowerCase()) : true)
            );
        });

        totalRows = filteredData.length; // Actualizar el total de filas después del filtrado
        currentPage = 1; // Volver a la primera página después de aplicar el filtro
        mostrarPagina(currentPage);
        actualizarBotones();
    }

    document.getElementById("form-configuracion").addEventListener("submit", function(event) {
        event.preventDefault(); // Evitar que el formulario se envíe al presionar Enter
        filtrarDatos(); // Llamar a la función de filtro cuando el formulario no se envía
    });

    // Event Listener para el botón de "Confirmar"
    document.getElementById("boton_configuracion").addEventListener("click", filtrarDatos);

    // Cargar datos al iniciar
    cargarDatos();
});