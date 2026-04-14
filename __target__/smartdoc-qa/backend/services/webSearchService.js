import axios from 'axios';
import * as cheerio from 'cheerio';

// Highly reliable global Search Proxies (SearXNG instances) 
// that aggregate Google, Bing, and Brave results without API keys.
const SEARCH_PROXIES = [
    'https://search.ononoki.org',
    'https://searx.be',
    'https://searx.divided-by-zero.eu',
    'https://searx.work',
    'https://searx.rhscz.eu',
    'https://search.mdn.social',
    'https://paulgo.io'
];

/**
 * Primary Search: Attempts to fetch results from global search proxies.
 */
async function tryProxySearch(query, numResults = 5) {
    for (const baseUrl of SEARCH_PROXIES) {
        try {
            console.log(`[Smart Search] Attempting proxy: ${baseUrl}`);
            const response = await axios.get(`${baseUrl}/search`, {
                params: {
                    q: query,
                    format: 'json',
                    engines: 'google,bing,brave',
                    language: 'en-US'
                },
                timeout: 3500 // Fast timeout to cycle through if an instance is slow/down
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                console.log(`[Smart Search] Success via ${baseUrl}`);
                return response.data.results.slice(0, numResults).map(r => ({
                    title: r.title || 'Untitled Result',
                    snippet: r.content || r.snippet || '',
                    url: r.url || ''
                }));
            }
        } catch (error) {
            console.warn(`[Smart Search] Proxy ${baseUrl} unavailable: ${error.message}`);
            continue; // Try next proxy
        }
    }
    return null; // All proxies failed
}

/**
 * Main Web Search Entry Point: 
 * Prioritizes Google API (if key exists) -> Smart Proxy -> DuckDuckGo Fallback.
 */
export async function webSearch(query, numResults = 5) {
    // 1. Official Google API (if user manually provided keys in .env)
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
        try {
            const res = await axios.get('https://customsearch.googleapis.com/customsearch/v1', {
                params: {
                    key: process.env.GOOGLE_SEARCH_API_KEY,
                    cx: process.env.GOOGLE_SEARCH_CX,
                    q: query,
                    num: Math.min(numResults, 10)
                },
                timeout: 5000
            });
            if (res.data && res.data.items) {
                return res.data.items.map(item => ({
                    title: item.title || '',
                    snippet: item.snippet || '',
                    url: item.link || ''
                }));
            }
        } catch (err) {
            console.error('[Smart Search] Official Google API failed, falling back to Proxy.');
        }
    }

    // 2. Smart Proxy (Google/Bing/Brave aggregator)
    const proxyResults = await tryProxySearch(query, numResults);
    if (proxyResults && proxyResults.length > 0) return proxyResults;

    // 3. Fallback: DuckDuckGo Instant Answer API
    try {
        console.log('[Smart Search] Falling back to DuckDuckGo API');
        const res = await axios.get('https://api.duckduckgo.com/', {
            params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
            timeout: 5000
        });

        const data = res.data;
        const results = [];
        if (data.Abstract) {
            results.push({
                title: data.Heading || 'Search Result',
                snippet: data.Abstract,
                url: data.AbstractURL || ''
            });
        }

        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            for (const topic of data.RelatedTopics.slice(0, numResults)) {
                if (topic.Text) {
                    results.push({
                        title: topic.Text.substring(0, 80),
                        snippet: topic.Text,
                        url: topic.FirstURL || ''
                    });
                }
            }
        }

        if (results.length > 0) return results.slice(0, numResults);
    } catch (err) {
        console.warn('[Smart Search] DuckDuckGo API failed');
    }

    // 4. Final Fallback: Scraping standard search results
    return await scrapeSearchResults(query, numResults);
}

/**
 * Hard Fallback: Uses Wikipedia Search API if proxy APIs are down or blocked.
 * This is highly reliable and provides clean, structured summaries for general knowledge queries.
 */
async function scrapeSearchResults(query, numResults = 5) {
    try {
        console.log('[Smart Search] Falling back to Wikipedia API...');
        const url = `https://en.wikipedia.org/w/api.php`;
        const response = await axios.get(url, {
            params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                utf8: 1,
                format: 'json',
                srlimit: numResults
            },
            headers: { 
                'User-Agent': 'SmartDoc-QA/1.0 (https://github.com/KKISHORE007/smartdoc-qa) axios/1.x'
            },
            timeout: 5000
        });

        if (response.data && response.data.query && response.data.query.search) {
            const results = response.data.query.search.map(item => {
                // Wikipedia returns HTML snippets, so we strip the tags
                const cleanSnippet = item.snippet.replace(/<[^>]+>/g, '').trim();
                return {
                    title: `Wikipedia: ${item.title}`,
                    snippet: cleanSnippet + '...',
                    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
                };
            });

            if (results.length > 0) {
                console.log(`[Smart Search] Wikipedia API successful. Found ${results.length} results.`);
                return results;
            }
        }
        throw new Error('No results from Wikipedia');
    } catch (error) {
        console.error('[Smart Search] Final search fallback failed:', error.message);
        return [{ title: 'No results found', snippet: 'Broad Search could not connect to web sources. Please check your connection or try again later.', url: '' }];
    }
}

/**
 * Format search results into a string for the AI context
 */
export function formatSearchResults(results) {
    if (!results || results.length === 0 || (results.length === 1 && results[0].title === 'No results found')) {
        return 'No additional web results found.';
    }

    return results.map((r, i) =>
        `[Web Result ${i + 1}] ${r.title}\n${r.snippet}${r.url ? '\nSource: ' + r.url : ''}`
    ).join('\n\n');
}
