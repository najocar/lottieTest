const express = require('express');
const app = express();
const path = require('path');

// Configurar encabezados COOP y COEP
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Servir los archivos estáticos (HTML, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor en el puerto 8080
app.listen(8080, () => {
  console.log('Servidor iniciado en http://localhost:8080');
});
