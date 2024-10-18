const { createFFmpeg, fetchFile } = FFmpeg; // Ahora puedes usar FFmpeg desde la variable global FFmpeg

const uploadInput = document.getElementById('upload-json');
const convertButton = document.getElementById('convert-button');
const colorPicker = document.getElementById('color-picker');
const lottieContainer = document.getElementById('lottie-container');
const canvas = document.getElementById('lottie-canvas');
const ctx = canvas.getContext('2d');
let frames = [];
let animation = null;

uploadInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        let animationData = JSON.parse(e.target.result);

        // Modificar colores dentro del JSON
        function modifyColors(data, color) {
            const rgbColor = hexToRgb(color); // Convierte el color hex a RGB
            if (data.layers) {
                data.layers.forEach(layer => {
                    if (layer.shapes) {
                        layer.shapes.forEach(shape => {
                            if (shape.it) {
                                shape.it.forEach(item => {
                                    // Cambiar el color de relleno (fill)
                                    if (item.c) {
                                        item.c.k = [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, 1]; // Cambiar a valores entre 0 y 1
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }

        // Llamamos a la función que modifica los colores
        modifyColors(animationData, colorPicker.value);

        if (animation) {
            animation.destroy(); // Destruye cualquier animación anterior
        }

        // Cargar y renderizar la nueva animación Lottie con los colores modificados
        animation = lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'svg',
            loop: false,
            autoplay: true,
            animationData: animationData
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
            convertButton.disabled = false; // Habilitar el botón de convertir
        });
    };

    reader.readAsText(file);
});

// Función para convertir el color hex a un objeto RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

convertButton.addEventListener('click', async () => {
    if (frames.length) {
        await convertFramesToMOV(frames);
    }
});

async function convertFramesToMOV(frames) {
    convertButton.disabled = true; // Desactivar mientras se realiza la conversión
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();

    // Guardar cada frame PNG en el sistema de archivos virtual de FFmpeg
    for (let i = 0; i < frames.length; i++) {
        const pngData = frames[i].split(',')[1];
        const pngBuffer = Uint8Array.from(atob(pngData), c => c.charCodeAt(0));
        ffmpeg.FS('writeFile', `frame${i}.png`, pngBuffer);
    }

    // Convertir los frames a MOV con transparencia
    await ffmpeg.run('-r', '30', '-i', 'frame%d.png', '-c:v', 'qtrle', '-pix_fmt', 'rgba', 'output.mov');

    // Obtener el archivo MOV generado
    const data = ffmpeg.FS('readFile', 'output.mov');

    // Convertir el archivo a Blob para descargar
    const videoBlob = new Blob([data.buffer], { type: 'video/quicktime' });
    const url = URL.createObjectURL(videoBlob);

    // Crear enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation.mov';
    document.body.appendChild(a);
    a.click();

    console.log('Conversion to MOV complete!');
    convertButton.disabled = false; // Reactivar el botón
}
