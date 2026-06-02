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

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const settingsPath = path.join(__dirname, 'database', 'settings.json');
const usersPath = path.join(__dirname, 'database', 'users.json');

if (!fs.existsSync(path.dirname(settingsPath))) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}
if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ activeTheme: "default", maintenance: "active" }, null, 2));
}
if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify([], null, 2));
}

const getSettings = () => {
    try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
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
    const themePath = getActiveThemePath();
    express.static(themePath)(req, res, (err) => {
        if (err) return next(err);
        express.static(path.join(__dirname, 'public'))(req, res, next);
    });
});

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

    const themePath = getActiveThemePath();
    let sanitizedPath = req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
    
    let targetFile = sanitizedPath + '.html';
    if (sanitizedPath === '') targetFile = '/index.html';

    const customFile = path.join(themePath, targetFile);
    if (fs.existsSync(customFile) && fs.lstatSync(customFile).isFile()) {
        return res.render(customFile);
    }

    const defaultFile = path.join(__dirname, 'public', targetFile);
    if (fs.existsSync(defaultFile) && fs.lstatSync(defaultFile).isFile()) {
        return res.render(defaultFile);
    }

    const customIndexSub = path.join(themePath, sanitizedPath, 'index.html');
    if (fs.existsSync(customIndexSub) && fs.lstatSync(customIndexSub).isFile()) {
        return res.render(customIndexSub);
    }

    const defaultIndexSub = path.join(__dirname, 'public', sanitizedPath, 'index.html');
    if (fs.existsSync(defaultIndexSub) && fs.lstatSync(defaultIndexSub).isFile()) {
        return res.render(defaultIndexSub);
    }

    next();
});

app.use((req, res) => {
    const themePath = getActiveThemePath();
    const custom404 = path.join(themePath, '404.html');
    if (fs.existsSync(custom404)) {
        return res.status(404).render(custom404);
    }
    res.status(404).render(path.join(__dirname, 'public', '404.html'));
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let creationState = {
    active: false,
    step: 0,
    role: '',
    email: '',
    username: '',
    password: ''
};

const showMenu = () => {
    console.log(`\n=== KAZUMA API - MENÚ DE COMANDOS ===`);
    console.log(`> p:menu                   - Muestra esta lista de comandos.`);
    console.log(`> mode:active              - Activa el acceso normal a toda la API.`);
    console.log(`> mode:mant                - Pone la interfaz web en mantenimiento.`);
    console.log(`> p:user/admin/create      - Inicia asistente para crear un Administrador.`);
    console.log(`> p:user/user/create       - Inicia asistente para crear un Usuario común.`);
    console.log(`=====================================\n`);
};

rl.on('line', (line) => {
    const input = line.trim();

    if (creationState.active) {
        if (creationState.step === 1) {
            if (input === '1' || input.toLowerCase() === 'yes') {
                creationState.step = 2;
                process.stdout.write('Tu e-mail: ');
            } else if (input === '2' || input.toLowerCase() === 'no') {
                console.log('[CONSOLE] Acción cancelada.\n');
                creationState.active = false;
            } else {
                console.log('\nHola, bienvenido a tu terminal de kazuma API, estás seguro de esta acción.');
                console.log('1. yes');
                console.log('2. no\n');
            }
            return;
        }

        if (creationState.step === 2) {
            if (!input) {
                process.stdout.write('El e-mail no puede estar vacío. Tu e-mail: ');
                return;
            }
            creationState.email = input;
            creationState.step = 3;
            process.stdout.write('Tu Username: ');
            return;
        }

        if (creationState.step === 3) {
            creationState.username = input || 'UserAdmin';
            creationState.step = 4;
            process.stdout.write('Tu contraseña: ');
            return;
        }

        if (creationState.step === 4) {
            if (!input) {
                process.stdout.write('La contraseña no puede estar vacía. Tu contraseña: ');
                return;
            }
            creationState.password = input;
            creationState.step = 5;
            process.stdout.write('¿Estas seguro? Escribe (yes) o (no): ');
            return;
        }

        if (creationState.step === 5) {
            if (input.toLowerCase() === 'yes') {
                try {
                    const currentUsers = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
                    const generatedKey = `Kazuma_${crypto.randomBytes(8).toString('hex')}`;
                    const isPremium = creationState.role === 'admin' ? 'premium' : 'free';
                    const maxLimit = creationState.role === 'admin' ? 99999 : 100;

                    const newUser = {
                        username: creationState.username,
                        email: creationState.email,
                        password: creationState.password,
                        key: generatedKey,
                        role: creationState.role,
                        limit: maxLimit,
                        requestToday: 0,
                        plan: isPremium
                    };

                    currentUsers.push(newUser);
                    fs.writeFileSync(usersPath, JSON.stringify(currentUsers, null, 2));

                    console.log(`\n[CONSOLE] Cuenta registrada con éxito en la Base de Datos:`);
                    console.log(`> Rol Asignado: ${newUser.role.toUpperCase()}`);
                    console.log(`> Usuario: ${newUser.username}`);
                    console.log(`> Email: ${newUser.email}`);
                    console.log(`> Pass: ${newUser.password}`);
                    console.log(`> API Key: ${newUser.key}\n`);
                } catch (err) {
                    console.log(`[ERROR] No se pudo guardar el usuario: ${err.message}\n`);
                }
                creationState.active = false;
            } else if (input.toLowerCase() === 'no') {
                console.log('[CONSOLE] Registro abortado por el usuario.\n');
                creationState.active = false;
            } else {
                process.stdout.write('¿Estas seguro? Escribe (yes) o (no): ');
            }
            return;
        }
    }

    if (input === 'p:menu') {
        showMenu();
    } 

    else if (input === 'p:user/admin/create') {
        creationState = { active: true, step: 1, role: 'admin', email: '', username: '', password: '' };
        console.log('\nHola, bienvenido a tu terminal de kazuma API, estás seguro de esta acción.');
        console.log('1. yes');
        console.log('2. no\n');
    } 

    else if (input === 'p:user/user/create') {
        creationState = { active: true, step: 1, role: 'user', email: '', username: '', password: '' };
        console.log('\nHola, bienvenido a tu terminal de kazuma API, estás seguro de esta acción.');
        console.log('1. yes');
        console.log('2. no\n');
    } 

    else if (input.startsWith('mode:')) {
        const modeValue = input.split('mode:')[1];
        if (modeValue === 'active' || modeValue === 'mant') {
            try {
                const settings = getSettings();
                settings.maintenance = modeValue;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
                console.log(`[CONSOLE] Modo del sistema actualizado a: ${modeValue.toUpperCase()}`);
            } catch (err) {
                console.log(`[ERROR] No se pudo escribir en la configuración: ${err.message}`);
            }
        } else {
            console.log(`[CONSOLE] Parámetro inválido. Usa 'mode:active' o 'mode:mant'`);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Kazuma API escuchando en el puerto ${PORT}`);
});