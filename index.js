const express = require('express');
const path = require('path');
const fs = require('fs');
const P = require('pino');
const chalk = require('chalk');
const { createInterface } = require('readline');
require('dotenv').config();

const { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const { authHandler } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3032;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

app.set('trust proxy', 1);
app.use(express.json());

const aiGemini = require('./routes/ai/gemini');
const aiChatgpt = require('./routes/ai/chatgpt');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const toolIp = require('./routes/tools/ip');
const toolInspect = require('./routes/tools/inspect');
const searchPin = require('./routes/search/pinterest');
const searchTt = require('./routes/search/tiktok');
const searchYt = require('./routes/search/ytsearch');
const dlFb = require('./routes/download/facebookvid');
const dlIg = require('./routes/download/instagramvid');
const dlTw = require('./routes/download/twitter');
const dlPin = require('./routes/download/pinterest');
const dlTt = require('./routes/download/tiktok');
const dlYta = require('./routes/download/ytaudio');
const dlYtv = require('./routes/download/ytvideo');
const dlSpotify = require('./routes/download/spotify');
const userAuth = require('./routes/users');

app.use('/api/auth', userAuth);
app.use('/api/ai/gemini', authHandler, aiGemini);
app.use('/api/ai/chatgpt', authHandler, aiChatgpt);
app.use('/api/tools/qr', authHandler, toolQr);
app.use('/api/tools/ssweb', authHandler, toolSsweb);
app.use('/api/tools/ip', authHandler, toolIp);
app.use('/api/tools/inspect', authHandler, toolInspect);
app.use('/api/search/pinterest', authHandler, searchPin);
app.use('/api/search/tiktok', authHandler, searchTt);
app.use('/api/search/youtube', authHandler, searchYt);
app.use('/api/download/facebook', authHandler, dlFb);
app.use('/api/download/instagram', authHandler, dlIg);
app.use('/api/download/twitter', authHandler, dlTw);
app.use('/api/download/pinterest', authHandler, dlPin);
app.use('/api/download/tiktok', authHandler, dlTt);
app.use('/api/download/ytaudio', authHandler, dlYta);
app.use('/api/download/ytvideo', authHandler, dlYtv);
app.use('/api/download/spotify', authHandler, dlSpotify);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/:page', (req, res, next) => {
    const filePath = path.join(__dirname, 'public', `${req.params.page}.html`);
    res.sendFile(filePath, (err) => err && next());
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

async function startKazuma() {
    const sessionDir = './sesion_api';
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' })),
        },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false
    });

    app.set('waClient', conn);

    if (!conn.authState.creds.registered) {
        setTimeout(async () => {
            let input = await question(chalk.cyan('\n[?] Introduce el número para la API:\n> '));
            let phoneNumber = input.replace(/[^0-9]/g, '');
            try {
                let code = await conn.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(chalk.black.bgCyan(`\nCODIGO DE VINCULACION: ${code}\n`));
            } catch (error) {
                console.error('Error al generar código:', error);
            }
        }, 3000);
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startKazuma();
        } else if (connection === 'open') {
            console.log(chalk.greenBright.bold('\n[✨] API VINCULADA A WHATSAPP'));
        }
    });

    app.listen(PORT, () => {
        console.log(chalk.magenta(`[🚀] Kazuma API corriendo en puerto ${PORT}`));
    });
}

startKazuma();