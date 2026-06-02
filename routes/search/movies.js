const express = require('express');
const router = express.Router();
const axios = require('axios');

class PictaScraper {
  constructor() {
    this.apiUrl = 'https://api.picta.cu/v2/video/buscar/';
  }

  async searchContent(query) {
    try {
      const response = await axios.get(this.apiUrl, {
        params: {
          cant: 20,
          pagina: 1,
          texto: query
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://www.picta.cu',
          'Referer': 'https://www.picta.cu/'
        }
      });

      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results.map(item => ({
          id: item.id || '',
          title: item.nombre || '',
          overview: item.sinopsis || 'Sin descripción.',
          release_date: item.fecha_publicacion || '',
          duration: item.duracion || 0,
          views: item.cantidad_vistas || 0,
          thumbnail_url: item.url_imagen || null,
          url_platform: item.id ? `https://www.picta.cu/watch/${item.id}` : null,
          channel: item.canal?.nombre || 'Desconocido',
          category: 'Video'
        }));
      }

      return [];
    } catch (error) {
      return [];
    }
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