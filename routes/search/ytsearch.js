const express = require('express');
const router = express.Router();
const axios = require('axios');

const YOUTUBE_API_KEY = 'AIzaSyBrEzNhCrLssglTZK9XT2bVzMnF80wiZKE';

function formatDuration(isoDuration) {
    if (!isoDuration) return "00:00";
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "00:00";
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatPublishedAt(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

router.get('/', async (req, res) => {
    const query = req.query.q;
    let limit = parseInt(req.query.limit) || 20;

    if (isNaN(limit)) limit = 20;
    if (limit > 50) limit = 50;

    if (!query) {
        return res.status(400).json({
            status: false,
            creator: "Félix Ofc",
            error: "Falta el parámetro 'q'"
        });
    }

    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
        const searchRes = await axios.get(searchUrl);

        const items = searchRes.data.items || [];
        if (items.length === 0) {
            return res.json({
                status: true,
                creator: "Félix Ofc",
                query: query,
                total_results: 0,
                result: []
            });
        }

        const videoIds = items.map(item => item.id.videoId).join(',');

        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
        const detailsRes = await axios.get(detailsUrl);

        const channelIds = [...new Set(items.map(item => item.snippet.channelId))].join(',');
        let channelMap = {};

        if (channelIds) {
            const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${YOUTUBE_API_KEY}`;
            const channelsRes = await axios.get(channelsUrl);
            channelsRes.data.items.forEach(channel => {
                channelMap[channel.id] = channel.statistics.subscriberCount;
            });
        }

        const results = detailsRes.data.items.map(video => {
            const snippet = video.snippet;
            const stats = video.statistics || {};

            return {
                title: snippet.title || "Sin título",
                channel: snippet.channelTitle || "Desconocido",
                channelId: snippet.channelId || "",
                subscribers: channelMap[snippet.channelId] ? parseInt(channelMap[snippet.channelId]).toLocaleString() : "N/A",
                publishedAt: formatPublishedAt(snippet.publishedAt),
                duration: formatDuration(video.contentDetails.duration),
                views: stats.viewCount ? parseInt(stats.viewCount).toLocaleString() : "0",
                likes: stats.likeCount ? parseInt(stats.likeCount).toLocaleString() : "0",
                comments: stats.commentCount ? parseInt(stats.commentCount).toLocaleString() : "0",
                thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "",
                url: `https://www.youtube.com/watch?v=${video.id}`
            };
        });

        res.json({
            status: true,
            creator: "Félix Ofc",
            query: query,
            total_results: results.length,
            result: results
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            creator: "Félix Ofc",
            error: "Error al realizar la búsqueda en YouTube."
        });
    }
});

module.exports = router;