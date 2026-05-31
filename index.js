const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { authHandler } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3032;

app.set('trust proxy', 1);
app.use(express.json());

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const settingsPath = path.join(__dirname, 'database', 'settings.json');
if (!fs.existsSync(path.dirname(settingsPath))) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}
if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ activeTheme: "default" }, null, 2));
}

const getActiveThemePath = () => {
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        const theme = settings.activeTheme || 'default';
        if (theme === 'default') return path.join(__dirname, 'public');
        
        const customPath = path.join(__dirname, 'themes', theme);
        if (fs.existsSync(customPath)) return customPath;
    } catch (e) {}
    return path.join(__dirname, 'public');
};

const aiGemini = require('./routes/ai/gemini');
const aiChatgpt = require('./routes/ai/chatgpt');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const toolIp = require('./routes/tools/ip');
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
app.use('/api/tools/ssweb', authHandler, toolIp);
app.use('/api/tools/ip', authHandler, toolIp);
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

app.use((req, res, next) => {
    const themeStatic = getActiveThemePath();
    express.static(themeStatic, { extensions: ['html'] })(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html']
}));

app.get('/', (req, res) => {
    const themePath = getActiveThemePath();
    const customIndex = path.join(themePath, 'index.html');
    if (fs.existsSync(customIndex)) {
        return res.render(customIndex);
    }
    res.render(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const themePath = getActiveThemePath();
    
    const customFile = path.join(themePath, `${page}.html`);
    if (fs.existsSync(customFile)) {
        return res.render(customFile, (err, html) => {
            if (!err) return res.send(html);
            res.render(path.join(__dirname, 'public', `${page}.html`), (err2, html2) => {
                if (!err2) return res.send(html2);
                next();
            });
        });
    }

    const defaultFile = path.join(__dirname, 'public', `${page}.html`);
    res.render(defaultFile, (err, html) => {
        if (!err) return res.send(html);
        next();
    });
});

app.use((req, res) => {
    const themePath = getActiveThemePath();
    const custom404 = path.join(themePath, '404.html');
    if (fs.existsSync(custom404)) {
        return res.status(404).render(custom404);
    }
    res.status(404).render(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Kazuma API escuchando en el puerto ${PORT}`);
});