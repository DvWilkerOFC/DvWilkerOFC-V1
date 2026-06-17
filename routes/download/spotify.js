const express = require('express');
const router = express.Router();
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const UA = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
const BASE = "https://spowload.cc";
const ENTRY = `${BASE}/en2`;
const OEMBED = "https://open.spotify.com/oembed";

const absUrl = (u) => u && /^https?:\/\//i.test(u) ? u : (u?.startsWith("/") ? `${BASE}${u}` : `${BASE}/${u}`);

const pickHiddenToken = (html) => {
    const m = html.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["'][^>]*name=["']_token["']/i);
    return m?.[1] || null;
};

const pickMetaCsrf = (html) => html.match(/name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;

const pickCover = (html) => {
    const m = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    return m?.[1] || null;
};

async function fetchSpotifyOembed(url) {
    try {
        const r = await axios.get(OEMBED, {
            params: { url },
            headers: { "user-agent": UA },
            validateStatus: (s) => s < 500
        });
        const title = r.data?.title || "";
        const parts = title.split(" - ").map(s => s.trim());
        return { 
            ok: true, 
            name: parts[0] || null, 
            artist: parts[1] || null, 
            thumbnail: r.data?.thumbnail_url || null 
        };
    } catch {
        return { ok: false };
    }
}

router.get('/', async (req, res) => {
    const url = String(req.query.url || "").trim();

    if (!url || !/open\.spotify\.com\/track\//i.test(url)) {
        return res.status(400).json({
            status: false,
            creator: "DvWilkerOFC",
            error: "Proporciona una URL válida de Spotify Track."
        });
    }

    try {
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 45000, headers: { "user-agent": UA } }));
        
        const oembed = await fetchSpotifyOembed(url);
        const entryRes = await client.get(ENTRY);
        const entryToken = pickHiddenToken(entryRes.data);

        if (!entryToken) throw new Error("No se pudo iniciar la sesión de descarga.");

        const analyzeRes = await client.post(`${BASE}/analyze`, new URLSearchParams({ _token: entryToken, trackUrl: url }).toString(), {
            maxRedirects: 0,
            validateStatus: (s) => s >= 200 && s < 400,
            headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE, referer: ENTRY }
        });

        const trackPageUrl = absUrl(analyzeRes.headers.location);
        const trackRes = await client.get(trackPageUrl);
        const cover = pickCover(trackRes.data) || oembed.thumbnail;
        const csrf = pickMetaCsrf(trackRes.data) || pickHiddenToken(trackRes.data);

        if (!csrf) throw new Error("Error de validación de tokens.");

        const convertRes = await client.post(`${BASE}/convert`, { urls: url, cover }, {
            headers: { "x-csrf-token": csrf, "x-xsrf-token": csrf, origin: BASE, referer: trackPageUrl }
        });

        const directUrl = convertRes.data?.url;
        if (!directUrl) throw new Error("No se obtuvo enlace de descarga.");

        res.json({
            status: true,
            creator: "DvWilkerOFC",
            result: {
                title: oembed.name,
                artist: oembed.artist,
                thumbnail: cover,
                download_url: directUrl
            }
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "DvWilkerOFC",
            error: "Error al procesar la canción de Spotify."
        });
    }
});

module.exports = router;