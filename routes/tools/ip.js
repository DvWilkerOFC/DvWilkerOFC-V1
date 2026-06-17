const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
    const { ip } = req.query;

    if (!ip) {
        return res.status(400).json({ 
            status: false, 
            error: "Debes proporcionar una dirección IP." 
        });
    }

    try {
        const fields = 'status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,mobile,hosting,query';
        const response = await axios.get(`http://ip-api.com/json/${ip.trim()}?fields=${fields}`);
        
        const data = response.data;

        if (data.status !== "success") {
            return res.status(404).json({ 
                status: false, 
                error: data.message || "No se encontró información." 
            });
        }

        res.json({
            status: true,
            creator: "DvWilkerOFC",
            result: {
                ip: data.query,
                pais: data.country,
                codigo_pais: data.countryCode,
                region: data.regionName,
                codigo_region: data.region,
                ciudad: data.city,
                distrito: data.district || "N/A",
                codigo_postal: data.zip,
                latitud: data.lat,
                longitud: data.lon,
                zona_horaria: data.timezone,
                isp: data.isp,
                organizacion: data.org,
                as: data.as,
                es_movil: data.mobile,
                es_hosting: data.hosting
            }
        });

    } catch (error) {
        res.status(500).json({ 
            status: false, 
            error: "Error en la solicitud." 
        });
    }
});

module.exports = router;