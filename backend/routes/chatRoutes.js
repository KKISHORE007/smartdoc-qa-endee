import express from 'express';
// import { queryDocuments } from '../services/queryService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    res.json({ message: 'Chat endpoint placeholder' });
});

export default router;
