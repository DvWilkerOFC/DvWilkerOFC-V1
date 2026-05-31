const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateKey } = require('../middlewares/auth');

const dbPath = path.join(__dirname, '../database/users.json');
let startTime = Date.now();

const CLIENT_ID = "019e7fb2-98fd-73c1-aa36-2062ae44607f";
const CLIENT_SECRET = "9Z0lHmqyygXamEEQYyaX8swbl1lFr1fjbShxAwiw";
const REDIRECT_URI = "https://rest.kazuma.giize.com/api/auth/kazuma/callback";
const KAZUMA_URL = "https://dash.kazuma.giize.com";

const getUsers = () => JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const saveUsers = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

router.get('/kazuma', (req, res) => {
    const authUrl = `${KAZUMA_URL}/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=user`;
    res.redirect(authUrl);
});

router.get('/kazuma/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ status: false, message: "Código de autorización no proporcionado" });
    }

    try {
        const tokenResponse = await axios.post(`${KAZUMA_URL}/oauth/token`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
            code: code
        });

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(`${KAZUMA_URL}/api/user`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const kazumaUser = userResponse.data;
        const email = kazumaUser.email;
        const username = kazumaUser.username || kazumaUser.name || email.split('@')[0];

        let users = getUsers();
        let user = users.find(u => u.email === email);

        if (!user) {
            user = {
                username,
                email,
                password: `oauth-kazuma-${generateKey()}`,
                key: generateKey(),
                role: "user",
                plan: "free",
                limit: 100,
                requestToday: 0,
                totalRequest: 0,
                profile_img: kazumaUser.avatar || "https://upload.yotsuba.giize.com/u/oco-1ZRU.jpg",
                lastRequestDate: new Date().toISOString().split('T')[0]
            };
            users.push(user);
            saveUsers(users);
        }

        res.redirect(`https://api.kazumahosting.com/?apiKey=${user.key}&username=${encodeURIComponent(user.username)}`);
    } catch (err) {
        res.status(500).json({ status: false, message: "Error en la autenticación con Kazuma Hosting" });
    }
});

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "Faltan datos obligatorios" });
    }

    try {
        let users = getUsers();
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ status: false, message: "El correo ya existe" });
        }

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
        res.status(500).json({ status: false, message: "Error en el servidor durante el registro" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: false, message: "Email y contraseña requeridos" });
    }

    try {
        let users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            return res.status(401).json({ status: false, message: "Credenciales incorrectas" });
        }

        res.json({
            status: true,
            creator: "Félix Ofc",
            data: {
                username: user.username,
                email: user.email,
                key: user.key,
                role: user.role,
                plan: user.plan,
                limit: user.limit,
                profileImg: user.profile_img || "https://upload.yotsuba.giize.com/u/oco-1ZRU.jpg"
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno en el servidor" });
    }
});

router.get('/me', (req, res) => {
    const { apiKey } = req.query;
    if (!apiKey) return res.status(400).json({ status: false, message: "ApiKey requerida" });

    let users = getUsers();
    const user = users.find(u => u.key === apiKey);
    if (!user) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    res.json({
        status: true,
        creator: "Félix Ofc",
        data: {
            username: user.username,
            email: user.email,
            key: user.key,
            role: user.role,
            plan: user.plan,
            profile_img: user.profile_img || "https://upload.yotsuba.giize.com/u/oco-1ZRU.jpg",
            requests: {
                today: user.requestToday,
                total: user.totalRequest,
                limit: user.limit,
                remaining: user.limit - user.requestToday
            }
        }
    });
});

router.post('/update-profile', (req, res) => {
    const { apiKey, type, value } = req.body;

    if (!apiKey || !type || value === undefined) {
        return res.status(400).json({ status: false, message: "Faltan parámetros" });
    }

    let users = getUsers();
    const userIdx = users.findIndex(u => u.key === apiKey);

    if (userIdx === -1) {
        return res.status(404).json({ status: false, message: "Llave maestra inválida" });
    }

    const allowedFields = ['username', 'email', 'password', 'profile_img'];
    if (!allowedFields.includes(type)) {
        return res.status(400).json({ status: false, message: "Acción no permitida para este campo" });
    }

    if (users[userIdx].email === 'frasesbebor@gmail.com' && type === 'password') {
         return res.status(403).json({ status: false, message: "No puedes cambiar la contraseña del ADMIN raíz" });
    }

    users[userIdx][type] = value;
    saveUsers(users);

    res.json({ 
        status: true, 
        message: "Protocolo actualizado",
        field: type
    });
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
        .map(u => ({
            username: u.username,
            total: u.totalRequest,
            initial: u.username.charAt(0).toUpperCase()
        }));
    res.json({ status: true, totalUsers: users.length, globalRequests, uptime: startTime, top5: topUsers });
});

router.get('/admin/all', (req, res) => {
    const { apiKey } = req.query;
    const users = getUsers();
    const admin = users.find(u => u.key === apiKey && u.role === 'admin');
    if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });
    res.json({ status: true, users });
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

module.exports = router;