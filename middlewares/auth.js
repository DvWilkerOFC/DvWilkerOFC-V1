const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../database/users.json');

const getTodayDate = () => new Date().toISOString().split('T')[0];

const authHandler = (req, res, next) => {
    const { apiKey } = req.query;
    const today = getTodayDate();

    if (!apiKey) {
        return res.status(401).sendFile(path.join(__dirname, '../public/404.html'));
    }

    if (!fs.existsSync(dbPath)) {
        return res.status(500).json({ status: false, message: "Error interno: Base de datos no encontrada" });
    }

    let users = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const userIndex = users.findIndex(u => u.key === apiKey);

    if (userIndex === -1) {
        return res.status(401).sendFile(path.join(__dirname, '../public/404.html'));
    }

    let user = users[userIndex];

    if (user.lastRequestDate !== today) {
        user.requestToday = 0;
        user.lastRequestDate = today;
    }

    if (user.requestToday >= user.limit) {
        return res.status(429).json({
            status: false,
            creator: "Félix Ofc",
            message: `Límite diario alcanzado (${user.limit}). Mejora tu plan en Kazuma API.`
        });
    }

    user.requestToday += 1;
    user.totalRequest += 1;
    
    users[userIndex] = user;
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));

    req.user = user;
    next();
};

const generateKey = () => {
    const gen = (len) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < len; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };
    return `kzm-${gen(8)}-${gen(8)}`;
};

module.exports = { authHandler, generateKey };