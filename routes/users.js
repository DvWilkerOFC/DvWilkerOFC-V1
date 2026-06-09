const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateKey } = require('../middlewares/auth');

const dbPath = path.join(__dirname, '../database/users.json');
const settingsPath = path.join(__dirname, '../database/settings.json');
let startTime = Date.now();

const CLIENT_ID = "Ov23lieMMOdvhCjel8An";
const CLIENT_SECRET = "9e12dd5d35e49b9c5f1777aca9ced2e9b5de91b9";
const REDIRECT_URI = "https://rest.kazuma.giize.com/api/auth/github/callback";

const COBRADOR_UID_TARJETA = "224-981";
const PLANES_TIENDA = {
    'basico': { precio: 15, limit: 2500, planName: 'basico' },
    'pro': { precio: 20, limit: 5000, planName: 'pro' },
    'empresarial': { precio: 30, limit: 70000, planName: 'empresarial' }
};

const getUsers = () => JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const saveUsers = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

router.get('/store/saved-card', (req, res) => {
    const { apiKey } = req.query;
    if (!apiKey) return res.status(400).json({ status: false, message: "ApiKey requerida" });

    const users = getUsers();
    const user = users.find(u => u.key === apiKey);
    if (!user) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    if (user.saved_card) {
        const last4 = user.saved_card.numTarjetaEmisor.slice(-4);
        return res.json({
            status: true,
            hasCard: true,
            card: {
                uidEmisor: user.saved_card.uidEmisor,
                numTarjetaEmisor: `•••• •••• •••• ${last4}`
            }
        });
    }

    return res.json({ status: true, hasCard: false });
});

router.post('/store/checkout', async (req, res) => {
    const { apiKey, planId, recordarTarjeta, tokenEmisor, uidEmisor, numTarjetaEmisor } = req.body;
    
    if (!apiKey || !planId) return res.status(400).json({ status: false, message: "Parámetros incompletos" });

    let users = getUsers();
    const userIdx = users.findIndex(u => u.key === apiKey);
    if (userIdx === -1) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    const planSeleccionado = PLANES_TIENDA[planId];
    if (!planSeleccionado) return res.status(400).json({ status: false, message: "Plan de pago inválido" });

    let finalToken = tokenEmisor;
    let finalUid = uidEmisor;
    let finalCardNum = numTarjetaEmisor;

    if (users[userIdx].saved_card && !tokenEmisor) {
        finalToken = users[userIdx].saved_card.tokenEmisor;
        finalUid = users[userIdx].saved_card.uidEmisor;
        finalCardNum = users[userIdx].saved_card.numTarjetaEmisor;
    }

    if (!finalToken || !finalUid || !finalCardNum) {
        return res.status(400).json({ status: false, message: "Faltan credenciales financieras de Bank Kazuma" });
    }

    try {
        const respuestaBanco = await axios.post('https://bank.kazuma.uk/api/users/transfer', {
            tokenEmisor: finalToken,
            uidEmisor: finalUid,
            numTarjetaEmisor: finalCardNum,
            uidReceptor: COBRADOR_UID_TARJETA,
            cantidad: planSeleccionado.precio
        });

        if (respuestaBanco.status === 200) {
            users[userIdx].plan = planSeleccionado.planName;
            users[userIdx].limit = planSeleccionado.limit;

            if (recordarTarjeta) {
                users[userIdx].saved_card = {
                    tokenEmisor: finalToken,
                    uidEmisor: finalUid,
                    numTarjetaEmisor: finalCardNum
                };
            }

            saveUsers(users);
            return res.json({ 
                status: true, 
                message: `¡Transacción exitosa! Tu plan ha sido actualizado a ${planSeleccionado.planName.toUpperCase()}.` 
            });
        } else {
            return res.status(400).json({ status: false, message: "El banco rechazó la transacción" });
        }

    } catch (err) {
        const errMsg = err.response && err.response.data ? err.response.data.error || err.response.data.message : err.message;
        return res.status(500).json({ status: false, message: "Error al procesar el pago: " + errMsg });
    }
});

router.get('/github', (req, res) => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user:email`;
    res.redirect(authUrl);
});

router.get('/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ status: false, message: "Código de autorización no proporcionado" });

    try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            redirect_uri: REDIRECT_URI
        }, { headers: { Accept: 'application/json' } });

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return res.status(400).json({ status: false, message: "Error al obtener el token de acceso" });

        const userResponse = await axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } });
        const emailsResponse = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } });

        const githubUser = userResponse.data;
        const primaryEmailObj = emailsResponse.data.find(e => e.primary) || emailsResponse.data[0];
        const email = primaryEmailObj ? primaryEmailObj.email : `${githubUser.login}@github.local`;
        const username = githubUser.login || githubUser.name || email.split('@')[0];

        let users = getUsers();
        let user = users.find(u => u.email === email);

        if (!user) {
            user = {
                username,
                email,
                password: `oauth-github-${generateKey()}`,
                key: generateKey(),
                role: "user",
                plan: "free",
                limit: 100,
                requestToday: 0,
                totalRequest: 0,
                profile_img: githubUser.avatar_url || "https://upload.yotsuba.giize.com/u/oco-1ZRU.jpg",
                lastRequestDate: new Date().toISOString().split('T')[0]
            };
            users.push(user);
            saveUsers(users);
        }

        res.cookie('apiKey', user.key, { maxAge: 5 * 60 * 1000, httpOnly: false });
        res.redirect('https://rest.kazuma.giize.com/login');
    } catch (err) {
        res.status(500).json({ status: false, message: "Error en la autenticación con GitHub" });
    }
});

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ status: false, message: "Faltan datos" });

    try {
        let users = getUsers();
        if (users.find(u => u.email === email)) return res.status(400).json({ status: false, message: "El correo ya existe" });

        const newUser = {
            username,
            email,
            password,
            key: generateKey(),
            role: "user",
            plan: "free",
            limit: 100,
            requestToday: 0,
            totalRequest: 0,
            profile_img: "https://upload.yotsuba.giize.com/u/oco-1ZRU.jpg", 
            lastRequestDate: new Date().toISOString().split('T')[0]
        };
        users.push(newUser);
        saveUsers(users);
        res.json({ status: true, creator: "Félix Ofc", message: "Registro exitoso", key: newUser.key });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: false, message: "Datos requeridos" });

    try {
        let users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) return res.status(401).json({ status: false, message: "Credenciales incorrectas" });

        res.json({
            status: true,
            creator: "Félix Ofc",
            data: { username: user.username, email: user.email, key: user.key, role: user.role, plan: user.plan, limit: user.limit, profileImg: user.profile_img }
        });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

router.get('/me', (req, res) => {
    const { apiKey } = req.query;
    if (!apiKey) return res.status(400).json({ status: false, message: "ApiKey requerida" });

    let users = getUsers();
    const user = users.find(u => u.key === apiKey);
    if (!user) return res.status(404).json({ status: false, message: "No encontrado" });

    res.json({
        status: true,
        creator: "Félix Ofc",
        data: {
            username: user.username,
            email: user.email,
            key: user.key,
            role: user.role,
            plan: user.plan,
            profile_img: user.profile_img,
            requests: { today: user.requestToday, total: user.totalRequest, limit: user.limit, remaining: user.limit - user.requestToday }
        }
    });
});

router.post('/update-profile', (req, res) => {
    const { apiKey, type, value } = req.body;
    if (!apiKey || !type || value === undefined) return res.status(400).json({ status: false, message: "Faltan parámetros" });

    let users = getUsers();
    const userIdx = users.findIndex(u => u.key === apiKey);
    if (userIdx === -1) return res.status(404).json({ status: false, message: "Llave inválida" });

    const allowedFields = ['username', 'email', 'password', 'profile_img'];
    if (!allowedFields.includes(type)) return res.status(400).json({ status: false, message: "No permitido" });

    if (users[userIdx].email === 'frasesbebor@gmail.com' && type === 'password') {
         return res.status(403).json({ status: false, message: "Acción restringida" });
    }

    users[userIdx][type] = value;
    saveUsers(users);
    res.json({ status: true, message: "Protocolo actualizado", field: type });
});

router.get('/stats', (req, res) => {
    const users = getUsers();
    const routesPath = path.join(__dirname, '../routes');
    let endpointCount = 0;
    try {
        const folders = fs.readdirSync(routesPath);
        folders.forEach(folder => {
            const fullPath = path.join(routesPath, folder);
            if (fs.lstatSync(fullPath).isDirectory()) {
                const files = fs.readdirSync(fullPath);
                endpointCount += files.length;
            }
        });
    } catch (e) { endpointCount = 0; }
    res.json({ status: true, users: users.length, endpoints: endpointCount });
});

router.get('/dashboard-global', (req, res) => {
    const users = getUsers();
    let globalRequests = 0;
    users.forEach(u => globalRequests += (u.totalRequest || 0));
    const topUsers = users
        .filter(u => u.totalRequest > 0)
        .sort((a, b) => b.totalRequest - a.totalRequest)
        .slice(0, 5)
        .map(u => ({ username: u.username, total: u.totalRequest, initial: u.username.charAt(0).toUpperCase() }));
    res.json({ status: true, totalUsers: users.length, globalRequests, uptime: startTime, top5: topUsers });
});

router.get('/admin/all', (req, res) => {
    const { apiKey } = req.query;
    const users = getUsers();
    const admin = users.find(u => u.key === apiKey && u.role === 'admin');
    if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });
    res.json({ status: true, users });
});

router.get('/admin/user-inspect', (req, res) => {
    const { adminKey, targetEmail } = req.query;
    if (!adminKey || !targetEmail) return res.status(400).json({ status: false, message: "Faltan parámetros requeridos" });

    const users = getUsers();
    const admin = users.find(u => u.key === adminKey && u.role === 'admin');
    if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });

    const targetUser = users.find(u => u.email === targetEmail);
    if (!targetUser) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    res.json({
        status: true,
        creator: "Félix Ofc",
        data: {
            username: targetUser.username,
            email: targetUser.email,
            password: targetUser.password,
            key: targetUser.key,
            role: targetUser.role,
            plan: targetUser.plan,
            limit: targetUser.limit,
            requestToday: targetUser.requestToday,
            totalRequest: targetUser.totalRequest,
            profile_img: targetUser.profile_img,
            lastRequestDate: targetUser.lastRequestDate
        }
    });
});

router.post('/admin/update', (req, res) => {
    const { adminKey, targetEmail, newData } = req.body;
    let users = getUsers();
    const admin = users.find(u => u.key === adminKey && u.role === 'admin');
    if (!admin || targetEmail === 'frasesbebor@gmail.com') return res.status(403).json({ status: false });

    const idx = users.findIndex(u => u.email === targetEmail);
    if (idx !== -1) {
        users[idx] = { ...users[idx], ...newData };
        saveUsers(users);
        return res.json({ status: true });
    }
    res.status(404).json({ status: false });
});

router.post('/admin/delete', (req, res) => {
    const { adminKey, targetEmail } = req.body;
    let users = getUsers();
    const admin = users.find(u => u.key === adminKey && u.role === 'admin');
    if (!admin || targetEmail === 'frasesbebor@gmail.com') return res.status(403).json({ status: false });

    users = users.filter(u => u.email !== targetEmail);
    saveUsers(users);
    res.json({ status: true });
});

router.get('/admin/themes', (req, res) => {
    const { apiKey } = req.query;
    const users = getUsers();
    const admin = users.find(u => u.key === apiKey && u.role === 'admin');
    if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });

    const themesDir = path.resolve(__dirname, '../themes');
    let themeList = ['default'];

    try {
        if (!fs.existsSync(themesDir)) fs.mkdirSync(themesDir, { recursive: true });
        const files = fs.readdirSync(themesDir);
        files.forEach(file => {
            const fullPath = path.join(themesDir, file);
            if (fs.lstatSync(fullPath).isDirectory()) themeList.push(file);
        });
    } catch (e) {}

    let activeTheme = 'default';
    try {
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            if (settings.activeTheme) activeTheme = settings.activeTheme;
        }
    } catch (e) {}

    res.json({ status: true, themes: themeList, active: activeTheme });
});

router.post('/admin/theme/set', (req, res) => {
    const { apiKey, themeName } = req.body;
    const users = getUsers();
    const admin = users.find(u => u.key === apiKey && u.role === 'admin');
    if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });
    if (!themeName) return res.status(400).json({ status: false, message: "Nombre de tema requerido" });

    try {
        if (themeName !== 'default') {
            const targetDir = path.resolve(__dirname, '../themes', themeName);
            if (!fs.existsSync(targetDir) || !fs.lstatSync(targetDir).isDirectory()) {
                return res.status(400).json({ status: false, message: "El tema seleccionado no existe físicamente en el servidor" });
            }
        }

        let currentSettings = {};
        if (fs.existsSync(settingsPath)) currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        currentSettings.activeTheme = themeName;

        fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
        res.json({ status: true, message: `Tema cambiado a: ${themeName}` });
    } catch (e) {
        res.status(500).json({ status: false, message: "Error al guardar la configuración" });
    }
});

module.exports = router;