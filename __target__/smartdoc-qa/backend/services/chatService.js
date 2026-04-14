import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { webSearch, formatSearchResults } from './webSearchService.js';

dotenv.config({ path: '../.env' });

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

/**
 * Ask a question about a document given the document's text content.
 * If broadSearch is true, also fetches web results (or uses provided ones) to augment the answer.
 */
export async function askQuestion(documentText, question, chatHistory = [], broadSearch = false, prefetchedWebContext = null) {
    // Build context: truncate doc text if too long for context window
    const maxContextChars = broadSearch ? 8000 : 12000;
    const truncatedDoc = (documentText && documentText.length > maxContextChars)
        ? documentText.substring(0, maxContextChars) + '\n\n[...document truncated for context length...]'
        : (documentText || '');

    let webContext = prefetchedWebContext || '';
    if (broadSearch && !prefetchedWebContext) {
        try {
            const searchResults = await webSearch(question, 5);
            webContext = formatSearchResults(searchResults);
        } catch (err) {
            console.error('Web search failed:', err.message);
            webContext = 'Web search was unavailable.';
        }
    }

    let systemPrompt = '';
    if (broadSearch && truncatedDoc) {
        systemPrompt = `You are SmartDoc AI — an intelligent document analysis assistant with broad search capabilities.
You have been given the content of a document uploaded by the user, AND additional web search results.
Your job is to answer the user's questions using BOTH the document content and the web search results.
Clearly distinguish between information from the document and information from web sources.
When citing web information, mention it comes from online sources.
Be concise but thorough. Use formatting (bullet points, numbered lists) when it helps clarity.

--- DOCUMENT CONTENT ---
${truncatedDoc}
--- END OF DOCUMENT ---

--- WEB SEARCH RESULTS ---
${webContext}
--- END OF WEB RESULTS ---`;
    } else if (broadSearch) {
        systemPrompt = `You are SmartDoc AI — an intelligent assistant with access to real-time web search.
You have been provided with real-time web search results to answer the user's question.
Your job is to read these web search results and synthesize a highly accurate, helpful, and comprehensive answer directly addressing the user's question.

--- WEB SEARCH RESULTS ---
${webContext}
--- END OF WEB RESULTS ---`;
    } else {
        systemPrompt = `You are SmartDoc AI — an intelligent document analysis assistant. 
You have been given the full content of a document uploaded by the user. 
Your job is to answer the user's questions about this document accurately and helpfully.
If the answer is not found in the document, say so clearly.
Be concise but thorough. Use formatting (bullet points, numbered lists) when it helps clarity.

--- DOCUMENT CONTENT ---
${truncatedDoc}
--- END OF DOCUMENT ---`;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: question }
    ];

    try {
        const completion = await groq.chat.completions.create({
            messages,
            model: MODEL,
            temperature: 0.3,
            max_tokens: 2048,
        });

        return completion.choices[0]?.message?.content || 'No response generated.';
    } catch (error) {
        console.error('Groq API error:', error.message);
        throw new Error(`Failed to get AI response: ${error.message}`);
    }
}
