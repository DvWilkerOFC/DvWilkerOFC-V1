const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dbPath = path.join(__dirname, '../database/users.json');

const MI_TARJETA_ADMIN_UID = "224-345";
const MI_TARJETA_ADMIN_TOKEN = "1f0cf29b1e8fd77432d74cee58392c6763300ccaa52928b9f6587e133124b7ed";
const MI_TARJETA_ADMIN_NUMERO = "KZM-7D0F8839CDD12D83";

const getUsers = () => JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const saveUsers = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

router.get('/stats', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ status: false, message: "Email requerido" });

    let users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    return res.json({
        status: true,
        clicks: user.clicks !== undefined ? user.clicks : 0,
        ahorrado: user.ahorrado !== undefined ? user.ahorrado : 0
    });
});

router.post('/click', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: false, message: "Email requerido" });

    let users = getUsers();
    const userIdx = users.findIndex(u => u.email === email);
    if (userIdx === -1) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    if (users[userIdx].clicks === undefined) users[userIdx].clicks = 0;
    if (users[userIdx].ahorrado === undefined) users[userIdx].ahorrado = 0;

    users[userIdx].clicks += 1;

    let subioNivel = false;
    if (users[userIdx].clicks >= 20) {
        users[userIdx].clicks = 0;
        users[userIdx].ahorrado += 5;
        subioNivel = true;
    }

    saveUsers(users);
    return res.json({
        status: true,
        clicks: users[userIdx].clicks,
        ahorrado: users[userIdx].ahorrado,
        subioNivel
    });
});

router.post('/retirar', async (req, res) => {
    const { email, uidReceptor, numTarjetaReceptor } = req.body;
    if (!email || !uidReceptor || !numTarjetaReceptor) {
        return res.status(400).json({ status: false, message: "Faltan datos para procesar el retiro" });
    }

    let users = getUsers();
    const userIdx = users.findIndex(u => u.email === email);
    if (userIdx === -1) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

    const cantidadRetiro = users[userIdx].ahorrado || 0;
    if (cantidadRetiro <= 0) {
        return res.status(400).json({ status: false, message: "No tienes fondos suficientes para retirar" });
    }

    try {
        const respuestaBanco = await axios.post('https://bank.kazuma.uk/api/users/transfer', {
            tokenEmisor: MI_TARJETA_ADMIN_TOKEN,
            uidEmisor: MI_TARJETA_ADMIN_UID,
            numTarjetaEmisor: MI_TARJETA_ADMIN_NUMERO,
            uidReceptor: uidReceptor,
            numTarjetaReceptor: numTarjetaReceptor,
            cantidad: cantidadRetiro
        });

        if (respuestaBanco.status === 200) {
            users[userIdx].ahorrado = 0;
            users[userIdx].clicks = 0;
            saveUsers(users);

            return res.json({
                status: true,
                message: `¡Retiro exitoso! Se han enviado ${cantidadRetiro} KZM a tu tarjeta.`
            });
        } else {
            return res.status(400).json({ status: false, message: "Bank Kazuma rechazó la transferencia de fondos" });
        }
    } catch (err) {
        const errMsg = err.response && err.response.data ? err.response.data.error || err.response.data.message : err.message;
        return res.status(500).json({ status: false, message: "Error en la bóveda de pago: " + errMsg });
    }
});

module.exports = router;