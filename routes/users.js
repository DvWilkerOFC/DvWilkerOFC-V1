const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { generateKey } = require('../middlewares/auth');
const dbPath = path.join(__dirname, '../database/users.json');

const getUsers = () => JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const saveUsers = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

router.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ status: false, message: "Faltan datos" });

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
        lastRequestDate: new Date().toISOString().split('T')[0]
    };

    users.push(newUser);
    saveUsers(users);

    res.json({ status: true, creator: "Félix Ofc", message: "Registro exitoso", key: newUser.key });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    let users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) return res.status(401).json({ status: false, message: "Credenciales inválidas" });

    res.json({
        status: true,
        creator: "Félix Ofc",
        data: {
            username: user.username,
            key: user.key,
            plan: user.plan,
            limit: user.limit
        }
    });
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
            plan: user.plan,
            requests: {
                today: user.requestToday,
                total: user.totalRequest,
                limit: user.limit,
                remaining: user.limit - user.requestToday
            }
        }
    });
});

module.exports = router;
