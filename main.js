const { createFFmpeg, fetchFile } = FFmpeg; // Ahora puedes usar FFmpeg desde la variable global FFmpeg

const uploadInput = document.getElementById('upload-json');
const convertButton = document.getElementById('convert-button');
const lottieContainer = document.getElementById('lottie-container');
const canvas = document.getElementById('lottie-canvas');
const ctx = canvas.getContext('2d');
let frames = [];
let animation = null;

uploadInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const animationData = JSON.parse(e.target.result);
        if (animation) {
            animation.destroy(); // Destruye cualquier animación anterior
        }

        // Cargar y renderizar la nueva animación Lottie
        animation = lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'canvas',
            loop: false,
            autoplay: true,
            animationData: animationData
        });

        frames = [];
        animation.addEventListener('enterFrame', () => {
            canvas.width = lottieContainer.clientWidth;
            canvas.height = lottieContainer.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dibujar el frame actual en el canvas
            ctx.drawImage(lottieContainer.querySelector('canvas'), 0, 0);

            // Guardar cada frame como PNG con transparencia
            const dataUrl = canvas.toDataURL('image/png');
            frames.push(dataUrl);
        });

        animation.addEventListener('complete', () => {
            console.log('All frames captured.');
            convertButton.disabled = false; // Habilitar el botón de convertir
        });
    };

    reader.readAsText(file);
});

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
