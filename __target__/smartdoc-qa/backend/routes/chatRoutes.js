import express from 'express';
import { askQuestion } from '../services/chatService.js';
import { documentStore } from './documentRoutes.js';

const router = express.Router();

/**
 * POST /api/chat
 * Send a question about an uploaded document
 * Body: { documentId, question, chatHistory }
 */
router.post('/', async (req, res) => {
    try {
        const { documentId, question, chatHistory = [] } = req.body;

        if (!documentId) {
            return res.status(400).json({ error: 'No document ID provided' });
        }
        if (!question || !question.trim()) {
            return res.status(400).json({ error: 'No question provided' });
        }

        const doc = documentStore[documentId];
        if (!doc) {
            return res.status(404).json({ error: 'Document not found. Please upload a document first.' });
        }
        if (!doc.isRead || !doc.text) {
            return res.status(400).json({ error: 'Document has not been read yet. Please read the document first.' });
        }

        const answer = await askQuestion(doc.text, question.trim(), chatHistory);

        res.json({
            success: true,
            answer,
            documentId,
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process question: ' + error.message });
    }
});

export default router;
