const axios = require('axios');
const cheerio = require('cheerio');

async function testStartpage() {
    console.log("Testing Startpage Scraper...");
    try {
        const response = await axios.get('https://www.startpage.com/sp/search', {
            params: { query: 'steve jobs' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.w-gl__result').each((i, el) => {
            const titleEl = $(el).find('.w-gl__result-title');
            const snippetEl = $(el).find('.w-gl__description');
            const linkEl = $(el).find('a.w-gl__result-title');

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

testStartpage();
