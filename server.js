const express = require('express');
const app = express();
const path = require('path');

// Configurar encabezados COOP y COEP
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  // res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Servir los archivos estáticos (HTML, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor en el puerto especificado por Vercel
app.listen(process.env.PORT || 8080, () => {
  console.log('Servidor iniciado');
});
