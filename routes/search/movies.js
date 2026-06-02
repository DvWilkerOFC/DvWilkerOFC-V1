const express = require('express');
const router = express.Router();
const axios = require('axios');

class MovieSearch {
  constructor() {
    this.apiKey = process.env.TMDB_API_KEY;
    this.baseUrl = 'https://api.themoviedb.org/3';
  }

  async searchMovie(query, language = 'es-ES') {
    try {
      const response = await axios.get(`${this.baseUrl}/search/movie`, {
        params: {
          api_key: this.apiKey,
          query: query,
          language: language,
          include_adult: false
        }
      });
      return this.formatResults(response.data.results || []);
    } catch (error) {
      return null;
    }
  }

  formatResults(results) {
    return results.map((item) => {
      return {
        id: item.id || '',
        title: item.title || '',
        original_title: item.original_title || '',
        overview: item.overview || 'Sin sinopsis disponible.',
        release_date: item.release_date || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        popularity: item.popularity || 0,
        original_language: item.original_language || ''
      };
    });
  }
}

const movieSearchInstance = new MovieSearch();

router.get('/', async (req, res) => {
  const query = (req.query.query || '').trim();
  const lang = (req.query.lang || 'es-ES').trim();

  if (!query) {
    return res.status(400).json({ status: false, error: 'Query parameter is required' });
  }

  try {
    const result = await movieSearchInstance.searchMovie(query, lang);
    if (!result) {
      return res.status(500).json({ status: false, error: 'Failed to fetch movies data' });
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