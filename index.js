const express = require('express');
const path = require('path');
require('dotenv').config();
const { authHandler } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3032;

app.set('trust proxy', 1);
app.use(express.json());

const aiGemini = require('./routes/ai/gemini');
const aiChatgpt = require('./routes/ai/chatgpt');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const searchPin = require('./routes/search/pinterest');
const searchTt = require('./routes/search/tiktok');
const dlFb = require('./routes/download/facebookvid');
const dlIg = require('./routes/download/instagramvid');
const dlTw = require('./routes/download/twitter');
const dlPin = require('./routes/download/pinterest');
const dlTt = require('./routes/download/tiktok');
const userAuth = require('./routes/users');

app.use('/api/auth', userAuth);

app.use('/api/ai/gemini', authHandler, aiGemini);
app.use('/api/ai/chatgpt', authHandler, aiChatgpt);
app.use('/api/tools/qr', authHandler, toolQr);
app.use('/api/tools/ssweb', authHandler, toolSsweb);
app.use('/api/search/pinterest', authHandler, searchPin);
app.use('/api/search/tiktok', authHandler, searchTt);
app.use('/api/download/facebook', authHandler, dlFb);
app.use('/api/download/instagram', authHandler, dlIg);
app.use('/api/download/twitter', authHandler, dlTw);
app.use('/api/download/pinterest', authHandler, dlPin);
app.use('/api/download/tiktok', authHandler, dlTt);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) return next();
    });
});

app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html']
}));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Kazuma API escuchando en el puerto ${PORT}`);
});