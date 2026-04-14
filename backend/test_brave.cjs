const axios = require('axios');
const cheerio = require('cheerio');

async function testBrave() {
    console.log("Testing Brave Scraper...");
    try {
        const response = await axios.get('https://search.brave.com/search', {
            params: { q: 'steve jobs' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.snippet').each((i, el) => {
            const titleEl = $(el).find('.snippet-title');
            const snippetEl = $(el).find('.snippet-description');
            const linkEl = $(el).find('a').first();

            if (titleEl.length && snippetEl.length) {
                results.push({
                    title: titleEl.text().trim(),
                    snippet: snippetEl.text().trim(),
                    url: linkEl.attr('href')
                });
            }
        });

        console.log(`FOUND ${results.length} RESULTS`);
        if (results.length > 0) {
            console.log(JSON.stringify(results.slice(0, 2), null, 2));
        }
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}

testBrave();
