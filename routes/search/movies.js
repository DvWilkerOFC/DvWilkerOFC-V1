const express = require('express');
const router = express.Router();
const axios = require('axios');

class PictaScraper {
  constructor() {
    this.baseUrl = 'https://www.picta.cu/buscar';
  }

  async searchContent(query) {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          tipo: 'video',
          busqueda: query
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.8'
        }
      });

      return this.parseHTML(response.data);
    } catch (error) {
      return null;
    }
  }

  parseHTML(html) {
    const results = [];
    
    // Al ser una SPA, sus datos suelen venir pre-cargados en una etiqueta script de estado inicial o configuración.
    // Buscamos estructuras JSON o bloques de datos inyectados en el HTML.
    const stateRegex = /__INITIAL_STATE__\s*=\s*({.+?});/g;
    const match = stateRegex.exec(html);
    
    if (match && match[1]) {
      try {
        const initialState = JSON.parse(match[1]);
        const videos = initialState.buscar?.resultados || [];
        
        return videos.map(item => ({
          id: item.id || '',
          title: item.nombre || '',
          overview: item.sinopsis || 'Sin descripción.',
          release_date: item.fecha || '',
          duration: item.duracion || 0,
          views: item.vistas || 0,
          thumbnail_url: item.imagen ? `https://www.picta.cu${item.imagen}` : null,
          url_platform: item.id ? `https://www.picta.cu/watch/${item.id}` : null,
          channel: item.canal || 'Desconocido',
          category: 'Video'
        }));
      } catch (e) {
        // Si falla el parseo del estado inicial, continuamos con el fallback alternativo
      }
    }

    // Fallback básico por si los datos vienen estructurados en componentes renderizados
    const blockRegex = /<div class="video-card".*?data-id="(.+?)".*?title="(.+?)".*?>/g;
    let blockMatch;
    
    while ((blockMatch = blockRegex.exec(html)) !== null) {
      results.push({
        id: blockMatch[1] || '',
        title: blockMatch[2] || '',
        overview: 'Extraído mediante estructura web.',
        release_date: '',
        duration: 0,
        views: 0,
        thumbnail_url: null,
        url_platform: blockMatch[1] ? `https://www.picta.cu/watch/${blockMatch[1]}` : null,
        channel: 'Desconocido',
        category: 'Video'
      });
    }

    return results;
  }
}

const pictaScraperInstance = new PictaScraper();

router.get('/', async (req, res) => {
  const query = (req.query.query || '').trim();

  if (!query) {
    return res.status(400).json({ status: false, error: 'Query parameter is required' });
  }

  try {
    const result = await pictaScraperInstance.searchContent(query);
    if (!result) {
      return res.status(500).json({ status: false, error: 'Failed to parse content from Picta' });
    }

    res.json({
      status: true,
      creator: 'Félix Ofc',
      data: result
    });
  } catch (error) {
    res.status(500).json({ status: false, error: error.message });
  }
});

module.exports = router;