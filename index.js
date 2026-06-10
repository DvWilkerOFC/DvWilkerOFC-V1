const express = require('express');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
require('dotenv').config();
const { authHandler } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3032;

app.set('trust proxy', 1);
app.use(express.json());

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const settingsPath = path.join(__dirname, 'database', 'settings.json');
const usersPath = path.join(__dirname, 'database', 'users.json');
const globalThemesPath = path.join(__dirname, 'themes');

if (!fs.existsSync(path.dirname(settingsPath))) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}
if (!fs.existsSync(globalThemesPath)) {
    fs.mkdirSync(globalThemesPath, { recursive: true });
}

const checkAndRepairJSON = (filePath, defaultContent) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    } else {
        try {
            const content = fs.readFileSync(filePath, 'utf-8').trim();
            if (!content) {
                fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
            } else {
                JSON.parse(content);
            }
        } catch (e) {
            fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
        }
    }
};

checkAndRepairJSON(settingsPath, { activeTheme: "default", maintenance: "active" });
checkAndRepairJSON(usersPath, []);

const getSettings = () => {
    try {
        const content = fs.readFileSync(settingsPath, 'utf-8').trim();
        return content ? JSON.parse(content) : { activeTheme: "default", maintenance: "active" };
    } catch (e) {
        return { activeTheme: "default", maintenance: "active" };
    }
};

const getActiveThemePath = () => {
    const settings = getSettings();
    const theme = settings.activeTheme || 'default';
    if (theme === 'default') return path.join(__dirname, 'public');

    const customPath = path.join(__dirname, 'themes', theme);
    if (fs.existsSync(customPath)) return customPath;
    return path.join(__dirname, 'public');
};

app.use((req, res, next) => {
    const settings = getSettings();
    if (settings.maintenance === 'mant' && !req.path.startsWith('/api/')) {
        return res.render(path.join(__dirname, 'public', 'mant.html'), (err, html) => {
            if (!err) return res.send(html);
            res.status(503).send("Servidor en mantenimiento.");
        });
    }
    next();
});

app.use('/assets', express.static(path.join(__dirname, 'public')));
app.use('/themes', express.static(path.join(__dirname, 'themes')));

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    const themePath = getActiveThemePath();
    express.static(themePath)(req, res, () => {
        express.static(path.join(__dirname, 'public'))(req, res, next);
    });
});

const aiGemini = require('./routes/ai/gemini');
const aiChatgpt = require('./routes/ai/chatgpt');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const toolIp = require('./routes/tools/ip');
const searchPin = require('./routes/search/pinterest');
const searchTt = require('./routes/search/tiktok');
const searchYt = require('./routes/search/ytsearch');
const searchMovies = require('./routes/search/movies');
const dlFb = require('./routes/download/facebookvid');
const dlIg = require('./routes/download/instagramvid');
const dlTw = require('./routes/download/twitter');
const dlPin = require('./routes/download/pinterest');
const dlTt = require('./routes/download/tiktok');
const dlYta = require('./routes/download/ytaudio');
const dlYtv = require('./routes/download/ytvideo');
const dlSpotify = require('./routes/download/spotify');
const userAuth = require('./routes/users');
const juegoClicker = require('./routes/juego');

app.use('/api/auth', userAuth);
app.use('/api/juego', juegoClicker);

app.use('/api/ai/gemini', authHandler, aiGemini);
app.use('/api/ai/chatgpt', authHandler, aiChatgpt);
app.use('/api/tools/qr', authHandler, toolQr);
app.use('/api/tools/ssweb', authHandler, toolSsweb);
app.use('/api/tools/ip', authHandler, toolIp);
app.use('/api/search/pinterest', authHandler, searchPin);
app.use('/api/search/tiktok', authHandler, searchTt);
app.use('/api/search/youtube', authHandler, searchYt);
app.use('/api/search/movies', authHandler, searchMovies);
app.use('/api/download/facebook', authHandler, dlFb);
app.use('/api/download/instagram', authHandler, dlIg);
app.use('/api/download/twitter', authHandler, dlTw);
app.use('/api/download/pinterest', authHandler, dlPin);
app.use('/api/download/tiktok', authHandler, dlTt);
app.use('/api/download/ytaudio', authHandler, dlYta);
app.use('/api/download/ytvideo', authHandler, dlYtv);
app.use('/api/download/spotify', authHandler, dlSpotify);

const webRoutes = {
    '/admin': 'admin.html',
    '/dash': 'dash.html',
    '/shop': 'shop.html',
    '/game/clicker': '/game/clicker.html',
    '/login': 'login.html',
    '/register': 'register.html',
    '/profile': 'profile.html',
    '/clicker': 'clicker.html',
    '/tos/terms': 'tos/terms.html',
    '/endpoints/ai': 'endpoints/ai.html',
    '/endpoints/download': 'endpoints/download.html',
    '/endpoints/search': 'endpoints/search.html',
    '/endpoints/tools': 'endpoints/tools.html'
};

app.get('/', (req, res) => {
    const themePath = getActiveThemePath();
    const customIndex = path.join(themePath, 'index.html');
    if (fs.existsSync(customIndex)) {
        return res.render(customIndex);
    }
    res.render(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();

    let cleanPath = req.path;
    if (cleanPath.endsWith('/') && cleanPath.length > 1) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const targetFile = webRoutes[cleanPath];

    if (targetFile) {
        const themePath = getActiveThemePath();
        const customFile = path.join(themePath, targetFile);

        if (fs.existsSync(customFile)) {
            return res.render(customFile);
        }

        const defaultFile = path.join(__dirname, 'public', targetFile);
        if (fs.existsSync(defaultFile)) {
            return res.render(defaultFile);
        }
    }

    next();
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            status: false,
            message: "Endpoint no encontrado o ruta incorrecta."
        });
    }

    const themePath = getActiveThemePath();
    const custom404 = path.join(themePath, '404.html');
    if (fs.existsSync(custom404)) {
        return res.status(404).render(custom404);
    }
    res.status(404).render(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Kazuma Rest escuchando en el puerto ${PORT}`);
});