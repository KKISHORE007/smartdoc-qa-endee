import express from 'express';
// import { ingestPdf } from '../services/ingestService.js';

const router = express.Router();

router.post('/upload', async (req, res) => {
    res.json({ message: 'Upload endpoint placeholder' });
});

export default router;
