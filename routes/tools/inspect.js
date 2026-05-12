const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    const { link } = req.query;
    const client = req.app.get('waClient');

    if (!link) return res.status(400).json({ status: false, error: "Link is required" });
    if (!client) return res.status(500).json({ status: false, error: "WhatsApp client not initialized" });

    try {
        const isChannel = link.includes('whatsapp.com/channel/');
        const isInvite = link.includes('chat.whatsapp.com/');

        if (isChannel) {
            const channelId = link.split('/').pop();
            const metadata = await client.newsletterMetadata("invite", channelId);
            return res.json({
                status: true,
                creator: "Félix Ofc",
                type: "channel",
                data: metadata
            });
        }

        if (isInvite) {
            const inviteCode = link.split('/').pop();
            const groupMetadata = await client.groupGetInviteInfo(inviteCode);
            return res.json({
                status: true,
                creator: "Félix Ofc",
                type: "group",
                data: groupMetadata
            });
        }

        res.status(400).json({ status: false, error: "Invalid WhatsApp link" });

    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

module.exports = router;