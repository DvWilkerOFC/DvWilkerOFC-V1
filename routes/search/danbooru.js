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
        const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(cleanTags)}`;
        
        const response = await fetch(url);
        const data = await response.json();

        const results = data
            .map(post => ({
                id: post.id,
                source: post.source,
                file: post.file_url,
                width: post.image_width,
                height: post.image_height,
                rating: post.rating
            }))
            .filter(item => typeof item.file === 'string' && /\.(jpe?g|png|gif)$/.test(item.file));

        if (results.length === 0) {
            return res.status(404).json({ 
                status: false, 
                message: `No se encontraron resultados para: ${tags}` 
            });
        }

        res.json({
            status: true,
            author: "Kazuma API",
            query: tags,
            count: results.length,
            results: results
        });

    } catch (err) {
        res.status(500).json({ 
            status: false, 
            message: 'Error al conectar con Danbooru.' 
        });
    }
});

module.exports = router;