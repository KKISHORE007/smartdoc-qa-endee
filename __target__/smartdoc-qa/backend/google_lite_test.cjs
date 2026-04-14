const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGoogleLite(query) {
    console.log(`Scraping Google Lite for: ${query}`);
    try {
        const response = await axios.get('https://www.google.com/search', {
            params: { q: query, gbv: '1', hl: 'en' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Google Lite (gbv=1) results are usually in div.kCrYT or similar
        // Let's look for link containers
        $('div.kCrYT').each((i, el) => {
            const h3 = $(el).find('h3');
            const a = $(el).find('a').first();
            const href = a.attr('href');

            if (h3.length && href && href.startsWith('/url?q=')) {
                let url = href.split('/url?q=')[1].split('&sa=')[0];
                url = decodeURIComponent(url);

                // Snippet is usually in the next div or a peer
                const parent = $(el).closest('div');
                const snippet = $(el).next().text().trim() || 'No snippet';

                results.push({
                    title: h3.text().trim(),
                    url: url,
                    snippet: snippet
                });
            }
        });

        // Some versions use different containers
        if (results.length === 0) {
           $('h3').each((i, el) => {
               const title = $(el).text();
               const a = $(el).closest('a');
               const href = a.attr('href');
               if(href && href.startsWith('/url?q=')) {
                  let url = href.split('/url?q=')[1].split('&sa=')[0];
                  url = decodeURIComponent(url);
                  results.push({ title, url, snippet: 'Result from Google' });
               }
           });
        }

        return results;
    } catch (error) {
        console.error('Lite Scrape failed:', error.message);
        return [];
    }
}

scrapeGoogleLite('steve jobs').then(res => {
    console.log(`Found ${res.length} results.`);
    console.log(JSON.stringify(res.slice(0, 3), null, 2));
});
