const { createFFmpeg, fetchFile } = FFmpeg;

const uploadInput = document.getElementById('upload-json');
const convertButton = document.getElementById('convert-button');
const lottieContainer = document.getElementById('lottie-container');
const canvas = document.getElementById('lottie-canvas');
const ctx = canvas.getContext('2d');
const colorSelectorsContainer = document.getElementById('colorSelectorsContainer');

// const colorSelectorsContainer = document.createElement('div'); // Contenedor para los selectores
// lottieContainer.appendChild(colorSelectorsContainer);

let frames = [];
let animation = null;
let animationData = null; // Guardar la animación cargada
let originalLottie = true;
let originalColor;
let previousColor;
let colorState = {};
let timeoutId;
// Función para extraer los colores únicos del JSON
function extractUniqueColors(data) {
    const colors = new Set();
    if (data.layers) {
        data.layers.forEach(layer => {
            if (layer.shapes) {
                layer.shapes.forEach(shape => {
                    if (shape.it) {
                        shape.it.forEach(item => {
                            if (item.c && item.c.k) {
                                const color = item.c.k.slice(0, 3); // Tomamos los primeros 3 valores (RGB)
                                colors.add(color.join(",")); // Convertimos a string para hacer un Set
                            }
                        });
                    }
                });
            }
        });
    }

    return Array.from(colors); // Devolvemos un array de colores únicos
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
    const input = event.target; // Obtenemos el input que disparó el evento
    const newColor = input.value; // Obtener el color en formato HEX
    const rgbColor = hexToRgb(newColor); // Convertir a RGB (0-255)
    const colorArray = [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255]; // Normalizar a 0-1

    const originalColor = input.dataset.originalColor; // Obtenemos el color original del dataset
    const previousColor = input.dataset.previousColor; // Obtenemos el color anterior del dataset

    // Llama a la función para modificar colores utilizando originalColor y previousColor
    modifyColorsByOriginal(animationData, originalColor, previousColor, colorArray); // Modificar colores

    // Actualizamos el color anterior a nuevo
    input.dataset.previousColor = colorArray.join(","); // Guardar el color anterior como cadena normalizada

    reloadLottie(animationData); // Recargar la animación Lottie con los nuevos colores
}

// Función para modificar los colores específicos
function modifyColorsByOriginal(data, originalColor, previousColor, newColorArray) {
    if (data.layers) {
        data.layers.forEach(layer => {
            if (layer.shapes) {
                layer.shapes.forEach(shape => {
                    if (shape.it) {
                        shape.it.forEach(item => {
                            if (item.c && item.c.k) {
                                const currentColor = item.c.k.slice(0, 3).join(","); // Convertir a cadena normalizada
                                
                                // Comparamos con el originalColor y previousColor
                                if (isColorMatch(currentColor, originalColor) || isColorMatch(currentColor, previousColor)) {
                                    item.c.k = [...newColorArray, 1]; // Cambiar al nuevo color
                                }
                            }
                        });
                    }
                });
            }
        });
    }
}

// Función para verificar si los colores coinciden
function isColorMatch(currentColor, colorToCompare) {
    const currentRGB = currentColor.split(",").map(Number);
    const compareRGB = colorToCompare.split(",").map(Number);

    // Verificamos que los valores de color estén prácticamente en el mismo rango
    return (
        Math.abs(currentRGB[0] - compareRGB[0]) < 0.01 &&
        Math.abs(currentRGB[1] - compareRGB[1]) < 0.01 &&
        Math.abs(currentRGB[2] - compareRGB[2]) < 0.01
    );
}


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
