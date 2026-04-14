import express from 'express';
import History from '../models/History.js';

const router = express.Router();

/**
 * GET /api/history/:userId
 * Fetch all histories for a user
 */
router.get('/:userId', async (req, res) => {
    try {
        const histories = await History.findAll({
            where: { userId: req.params.userId },
            order: [['updatedAt', 'DESC']]
        });
        res.json({ success: true, histories });
    } catch (error) {
        console.error('Fetch history error:', error);
        res.status(500).json({ error: 'Failed to fetch histories' });
    }
});

/**
 * POST /api/history
 * Save or update a session history
 * Body: { userId, docId, docName, docSize, docType, readPreview, localDocText, messages, chatMode }
 */
router.post('/', async (req, res) => {
    try {
        const { userId, docId, docName, docSize, docType, readPreview, localDocText, messages, chatMode } = req.body;

        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        // Create a new record every save (or we could update an existing one if we tracked session IDs)
        // For complete auditing, we'll create a new record that acts as an immutable session snapshot
        const historyRecord = await History.create({
            userId,
            docId,
            docName,
            docSize,
            docType,
            readPreview,
            localDocText,
            messages,
            chatMode
        });

        res.json({ success: true, history: historyRecord });
    } catch (error) {
        console.error('Save history error:', error);
        res.status(500).json({ error: 'Failed to save history' });
    }
});

/**
 * DELETE /api/history/:id
 * Delete a specific history interaction from DB
 */
router.delete('/:id', async (req, res) => {
    try {
        await History.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete history error:', error);
        res.status(500).json({ error: 'Failed to delete history' });
    }
});

export default router;
