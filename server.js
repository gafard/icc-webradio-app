const { createServer } = require('https');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Chemins vers les certificats générés par mkcert
// Note: mkcert génère souvent 'localhost+3.pem' si plusieurs domaines sont spécifiés
const httpsOptions = {
    key: fs.readFileSync('./localhost+3-key.pem'),
    cert: fs.readFileSync('./localhost+3.pem'),
};

app.prepare().then(() => {
    createServer(httpsOptions, (req, res) => {
        handle(req, res);
    }).listen(3000, '0.0.0.0', (err) => {
        if (err) throw err;
        console.log('> Ready on https://localhost:3000');
        console.log('> Ready on https://10.21.219.214:3000');
        console.log('> Note: Acceptez le certificat de sécurité sur votre mobile si nécessaire');
    });
});
