const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

router.get('/', async (req, res) => {
    const tags = req.query.tags;

    if (!tags) {
        return res.status(400).json({ 
            status: false, 
            message: 'Debes proporcionar el parámetro ?tags= para buscar.' 
        });
    }

    try {
        const cleanTags = tags.replace(/\s+/g, '_');
        const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(cleanTags)}`;
        
        const response = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } 
        });
        
        const data = await response.json();
        const results = (Array.isArray(data) ? data : (data?.post || data?.data || []))
            .map(i => i?.file_url || i?.sample_url || i?.preview_url)
            .filter(u => typeof u === 'string' && /\.(jpe?g|png|gif|mp4)$/i.test(u));

        if (results.length === 0) {
            return res.status(404).json({ 
                status: false, 
                message: `No se encontraron resultados para: ${tags}` 
            });
        }

        res.json({
            status: true,
            author: "Félix Ofc",
            query: tags,
            count: results.length,
            results: [...new Set(results)].sort(() => Math.random() - 0.5)
        });

    } catch (err) {
        res.status(500).json({ 
            status: false, 
            message: 'Error al conectar con Rule34.' 
        });
    }
});

module.exports = router;