import express from 'express';
import { webSearch, formatSearchResults } from '../services/webSearchService.js';
import { askQuestion } from '../services/chatService.js';
import { documentStore } from './documentRoutes.js';

const router = express.Router();

/**
 * POST /api/search/broad
 * Perform a web search for a question and return summarized results
 * Body: { query, documentId }
 */
router.post('/broad', async (req, res) => {
    try {
        const { query, documentId, chatHistory } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'No search query provided' });
        }

        let searchQuery = query.trim();
        const lowerQ = searchQuery.toLowerCase();
        
        // Context-aware Broad Search: If the user query implies looking at the document ("this", "it", "image", "document")
        // and we have a documentId, inject the filename into the search query for significantly better Web results.
        if (documentId && documentStore[documentId]) {
            const doc = documentStore[documentId];
            if (lowerQ.includes('this') || lowerQ.includes('it') || lowerQ.includes('image') || lowerQ.includes('picture') || lowerQ.includes('document')) {
                const docTitle = doc.originalName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
                if (docTitle) {
                    searchQuery = `${searchQuery} ${docTitle}`;
                }
            }
        }

        // Perform web search via Smart Proxy (automatically falls back to DDG if needed)
        console.log(`[Smart Search] Querying for: "${searchQuery}"`);
        const searchResults = await webSearch(searchQuery, 6);
        const formattedResults = formatSearchResults(searchResults);

        // Generate AI summary combining web search (and doc if available)
        let aiSummary = null;
        if (documentId && documentStore[documentId]) {
            const doc = documentStore[documentId];
            aiSummary = await askQuestion(doc.text, searchQuery, chatHistory || [], true, formattedResults);
        } else {
            // No document uploaded, purely a web question
            aiSummary = await askQuestion('', searchQuery, chatHistory || [], true, formattedResults);
        }

        res.json({
            success: true,
            results: searchResults,
            aiSummary,
            formattedResults,
            searchQuery
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed: ' + error.message });
    }
});

export default router;
