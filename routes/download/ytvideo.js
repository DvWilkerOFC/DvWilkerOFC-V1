const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
const validQualities = ['144', '240', '360', '480', '720', '1080'];
const m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;

const is = axios.create({
    headers: {
        'content-type': 'application/json',
        'origin': 'https://yt.savetube.me',
        'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
    }
});

const decrypt = async (enc) => {
    const sr = Buffer.from(enc, 'base64');
    const keyBuffer = Buffer.from(ky, 'hex');
    const iv = sr.slice(0, 16);
    const dt = sr.slice(16);
    const dc = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
    return JSON.parse(Buffer.concat([dc.update(dt), dc.final()]).toString());
};

const getCdn = async () => {
    try {
        const response = await is.get("https://media.savetube.vip/api/random-cdn");
        return { status: true, data: response.data.cdn };
    } catch {
        return { status: false };
    }
};

router.get('/', async (req, res) => {
    const { url, quality = '360' } = req.query;

    if (!url) {
        return res.status(400).json({
            status: false,
            creator: "Félix Ofc",
            error: "Falta el parámetro 'url'"
        });
    }

    if (!validQualities.includes(quality)) {
        return res.status(400).json({
            status: false,
            creator: "Félix Ofc",
            error: `Calidad inválida. Usa: ${validQualities.join(', ')}`
        });
    }

    const id = url.match(m)?.[3];
    if (!id) {
        return res.status(400).json({
            status: false,
            creator: "Félix Ofc",
            error: "ID de YouTube no encontrado."
        });
    }

    try {
        const cdn = await getCdn();
        if (!cdn.status) throw new Error();

        const infoRes = await is.post(`https://${cdn.data}/v2/info`, { 
            url: `https://www.youtube.com/watch?v=${id}` 
        });
        
        const dec = await decrypt(infoRes.data.data);

        const dlRes = await is.post(`https://${cdn.data}/download`, {
            id: id,
            downloadType: 'video',
            quality: quality,
            key: dec.key
        });

        if (req.query.download === 'true') {
            return res.redirect(dlRes.data.data.downloadUrl);
        }

        res.json({
            status: true,
            creator: "Félix Ofc",
            result: {
                title: dec.title,
                thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                duration: dec.duration,
                quality: quality + 'p',
                format: "MP4",
                download_url: dlRes.data.data.downloadUrl
            }
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "Félix Ofc",
            error: "Error al procesar la descarga de video."
        });
    }
});

module.exports = router;