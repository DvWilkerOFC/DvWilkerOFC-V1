const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3032;

app.set('trust proxy', 1);

app.use(express.json());

const validateApiKey = (req, res, next) => {
    const { apiKey } = req.query;
    const masterKey = process.env.API_KEY || 'root';

    if (!apiKey || apiKey !== masterKey) {
        return res.status(401).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    next();
};

const aiGemini = require('./routes/ai/gemini');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const searchPin = require('./routes/search/pinterest');
const searchTt = require('./routes/search/tiktok');
const dlFb = require('./routes/download/facebookvid');
const dlIg = require('./routes/download/instagramvid');
const dlTw = require('./routes/download/twitter');
const dlPin = require('./routes/download/pinterest');
const dlTt = require('./routes/download/tiktok');

app.use('/api/ai/gemini', validateApiKey, aiGemini);
app.use('/api/tools/qr', validateApiKey, toolQr);
app.use('/api/tools/ssweb', validateApiKey, toolSsweb);
app.use('/api/search/pinterest', validateApiKey, searchPin);
app.use('/api/search/tiktok', validateApiKey, searchTt);
app.use('/api/download/facebook', validateApiKey, dlFb);
app.use('/api/download/instagram', validateApiKey, dlIg);
app.use('/api/download/twitter', validateApiKey, dlTw);
app.use('/api/download/pinterest', validateApiKey, dlPin);
app.use('/api/download/tiktok', validateApiKey, dlTt);

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    
    res.sendFile(filePath, (err) => {
        if (err) {
            next();
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT} con rutas limpias.`);
});