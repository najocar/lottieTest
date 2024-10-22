const { createFFmpeg, fetchFile } = FFmpeg;

const uploadInput = document.getElementById('upload-json');
const convertButton = document.getElementById('convert-button');
const lottieContainer = document.getElementById('lottie-container');
const canvas = document.getElementById('lottie-canvas');
const ctx = canvas.getContext('2d');
const colorSelectorsContainer = document.getElementById('colorSelectorsContainer');

let frames = [];
let animation = null;
let animationData = null; // Guardar la animación cargada
let originalLottie = true;
let timeoutId;

// Función para extraer colores únicos del JSON
function extractUniqueColors(data) {
    const colors = new Set();

    // Función recursiva para explorar el JSON
    function recursiveSearch(obj) {
        if (typeof obj === 'object' && obj !== null) {
            // Si encontramos un color en formato RGB
            if (Array.isArray(obj.c) && obj.c.length >= 3) {
                colors.add(obj.c.slice(0, 3).join(",")); // Agregar el color como string
            }
            // Si encontramos un color en formato RGBA
            if (Array.isArray(obj.k) && obj.k.length >= 4) {
                colors.add(obj.k.slice(0, 3).join(",")); // Agregar color RGB (0-1)
            }
            // Si encontramos un color en un objeto de 'shapes'
            if (Array.isArray(obj.shapes)) {
                obj.shapes.forEach(shape => recursiveSearch(shape));
            }

            // Iterar sobre las propiedades del objeto
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // Si encontramos un objeto o un array, buscamos recursivamente
                    if (typeof obj[key] === 'object') {
                        recursiveSearch(obj[key]);
                    }
                }
            }
        }
    }

    // Comenzar la búsqueda desde el objeto raíz
    recursiveSearch(data);
    return Array.from(colors);
}


// Crear un selector de color para cada color único
function createColorSelectors(colors) {
    colors.forEach((color, index) => {
        const rgb = color.split(',').map(c => Math.round(c * 255)); // Convertimos de 0-1 a 0-255
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]); // Convertimos a formato HEX

        // Crear label e input
        const label = document.createElement('label');
        label.innerText = `Color ${index + 1}:`;
        const input = document.createElement('input');
        input.type = 'color';
        input.value = hex;
        input.dataset.originalColor = color; // Guardamos el color original en formato RGB normalizado
        input.dataset.previousColor = color; // Guardamos el color anterior también

        input.addEventListener('input', (event) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    handleColorChange(event)
                }, 300);
        });

        colorSelectorsContainer.appendChild(label);
        colorSelectorsContainer.appendChild(input);
    });
}

// Función para manejar el cambio de color
function handleColorChange(event) {
    console.log('Color changed:', event.target.value);
    const input = event.target;
    const newColor = input.value; // Obtener el color en formato HEX
    const rgbColor = hexToRgb(newColor); // Convertir a RGB (0-255)
    const colorArray = [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255]; // Normalizar a 0-1

    const originalColor = input.dataset.originalColor;
    const previousColor = input.dataset.previousColor;

    modifyColorsByOriginal(animationData, originalColor, previousColor, colorArray);

    input.dataset.previousColor = colorArray.join(",");

    reloadLottie(animationData);
}

// Función para modificar los colores específicos
function modifyColorsByOriginal(data, originalColor, previousColor, newColorArray) {
    const targetColor = originalColor.split(",").map(Number);
    const previousColorArray = previousColor.split(",").map(Number);

    // Función recursiva para buscar y modificar colores
    function recursiveModify(obj) {
        if (typeof obj === 'object' && obj !== null) {
            // Verificar si hay un color en formato RGBA en el objeto
            if (Array.isArray(obj.c) && obj.c.length >= 3) {
                const currentColor = obj.c.slice(0, 3); // Asegurarse de que sea un array
                if (isColorMatch(currentColor, targetColor) || isColorMatch(currentColor, previousColorArray)) {
                    obj.c = [...newColorArray, 1]; // Cambiar al nuevo color, añadir alfa 1
                }
            }

            // Verificar si hay un color en formato RGBA en el objeto
            if (Array.isArray(obj.k) && obj.k.length >= 3) {
                const currentColor = obj.k.slice(0, 3); // Asegurarse de que sea un array
                if (isColorMatch(currentColor, targetColor) || isColorMatch(currentColor, previousColorArray)) {
                    obj.k = [...newColorArray, 1]; // Cambiar al nuevo color, añadir alfa 1
                }
            }

            // Si hay shapes, buscar dentro de ellos
            if (Array.isArray(obj.shapes)) {
                obj.shapes.forEach(shape => recursiveModify(shape));
            }

            // Recorrer otras propiedades del objeto
            for (let key in obj) {
                if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                    recursiveModify(obj[key]); // Llamada recursiva para propiedades anidadas
                }
            }
        }
    }

    // Comenzar la búsqueda desde el objeto raíz
    recursiveModify(data);
}

// Función para verificar si los colores coinciden
function isColorMatch(currentColor, colorToCompare) {
    // Asegurarse de que ambos sean arrays
    if (!Array.isArray(currentColor) || !Array.isArray(colorToCompare)) {
        return false; // Si no son arrays, no puede haber coincidencia
    }

    // Verificamos colores estén prácticamente en el mismo rango
    return (
        Math.abs(currentColor[0] - colorToCompare[0]) < 0.01 &&
        Math.abs(currentColor[1] - colorToCompare[1]) < 0.01 &&
        Math.abs(currentColor[2] - colorToCompare[2]) < 0.01
    );
}


// Función para verificar si los colores coinciden
// function isColorMatch(currentColor, colorToCompare) {
//     const currentRGB = currentColor.split(",").map(Number);
//     const compareRGB = colorToCompare.split(",").map(Number);

//     // Verificamos que los valores de color estén prácticamente en el mismo rango
//     return (
//         Math.abs(currentRGB[0] - compareRGB[0]) < 0.01 &&
//         Math.abs(currentRGB[1] - compareRGB[1]) < 0.01 &&
//         Math.abs(currentRGB[2] - compareRGB[2]) < 0.01
//     );
// }


// Recargar la animación Lottie
function reloadLottie(data) {
    convertButton.disabled = true;
    if (animation) {
        animation.destroy(); // Destruir la animación anterior
    }

    animation = lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: false, // Ahora la animación no se repetirá
        autoplay: true,
        animationData: data
    });

    frames = [];
    animation.addEventListener('enterFrame', () => {
        const svgElement = lottieContainer.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);

        // Crear una imagen a partir del SVG serializado
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);

        img.onload = () => {
            canvas.width = svgElement.clientWidth;
            canvas.height = svgElement.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dibujar el SVG en el canvas
            ctx.drawImage(img, 0, 0);

            // Guardar el frame como PNG
            const dataUrl = canvas.toDataURL('image/png');
            frames.push(dataUrl);
        };
    });

    animation.addEventListener('complete', () => {
        console.log('All frames captured.');
        convertButton.disabled = false;
    });
}

// Procesar el archivo JSON y extraer colores
uploadInput.addEventListener('change', function(event) {
    colorSelectorsContainer.innerHTML = '';
    const file = event.target.files[0];
    const reader = new FileReader();
    convertButton.disabled = true;
    originalLottie = true;

    reader.onload = function(e) {
        animationData = JSON.parse(e.target.result); // Guardar animación cargada en variable global

        // Extraer colores únicos y crear selectores
        const uniqueColors = extractUniqueColors(animationData);
        createColorSelectors(uniqueColors);

        // Cargar la animación
        reloadLottie(animationData);
    };

    reader.readAsText(file);
});

// Convertir colores hex a RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

// Convertir RGB a formato HEX
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Convertir los frames a MOV cuando se presiona el botón
convertButton.addEventListener('click', async () => {
    console.log('Converting frames to MOV...');
    if (frames.length) {
        console.log('Frames captured:', frames.length);
        await convertFramesToMOV(frames);
    }
});

async function convertFramesToMOV(frames) {
    convertButton.disabled = true; // Desactivar el botón para evitar múltiples clics
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load(); // Cargar FFmpeg

    // Escribir cada frame como un archivo PNG en el sistema de archivos virtual de FFmpeg
    for (let i = 0; i < frames.length; i++) {
        const pngData = frames[i].split(',')[1]; // Extraer la parte base64 del data URL
        const pngBuffer = Uint8Array.from(atob(pngData), c => c.charCodeAt(0)); // Convertir base64 a buffer
        console.log(`Frame ${i} size: ${pngBuffer.length}`); // Verificar tamaño del buffer
        ffmpeg.FS('writeFile', `frame${i}.png`, pngBuffer); // Escribir el archivo PNG
    }

    // Imprimir los archivos en el sistema de archivos virtual para verificación
    console.log('Archivos en el sistema de archivos virtual:', ffmpeg.FS('readdir', '/'));

    // Ejecutar el comando FFmpeg
    try {
        await ffmpeg.run('-r', '30', '-i', 'frame%d.png', '-analyzeduration', '10000000', '-probesize', '10000000', '-c:v', 'qtrle', '-pix_fmt', 'rgba', 'output.mov');
    } catch (error) {
        console.error('Error durante la ejecución de FFmpeg:', error); // Log para ver si ocurre algún error
        convertButton.disabled = false; // Habilitar el botón si ocurre un error
        return; // Salir de la función si hay un error
    }

    // Leer el archivo MOV creado
    const data = ffmpeg.FS('readFile', 'output.mov');
    
    // Crear un Blob del archivo MOV
    const videoBlob = new Blob([data.buffer], { type: 'video/quicktime' });
    const url = URL.createObjectURL(videoBlob); // Crear un objeto URL

    // Crear un enlace para descargar el archivo MOV
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation.mov';
    document.body.appendChild(a);
    a.click(); // Simular clic para descargar

    // Limpiar el URL para evitar fugas de memoria
    URL.revokeObjectURL(url);
    
    convertButton.disabled = false; // Habilitar el botón al finalizar
}
