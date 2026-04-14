const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGoogle(query) {
    console.log(`Scraping Google for: ${query}`);
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=10`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.google.com/',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // In mobile view (ZINbbc), standard results have a specific structure
        $('div.ZINbbc').each((i, el) => {
            // Find the main link container
            const a = $(el).find('a').first();
            const href = a.attr('href');
            
            // Mobile titles are usually in these classes
            const titleEl = $(el).find('.vvjwJb, .uE6v8b, .BNeawe.vvjwJb').first();
            // Snippets are usually in these
            const snippetEl = $(el).find('.s3v9rd, .AP7Wnd, .BNeawe.s3v9rd').last();

            if (href && href.startsWith('/url?q=')) {
                let cleanUrl = href.split('/url?q=')[1].split('&sa=')[0];
                cleanUrl = decodeURIComponent(cleanUrl);

                const title = titleEl.text().trim();
                const snippet = snippetEl.text().trim();

                if (title && snippet && !results.some(r => r.url === cleanUrl)) {
                    results.push({
                        title,
                        snippet,
                        url: cleanUrl
                    });
                }
            }
        });

        return results;
    } catch (error) {
        console.error('Scrape failed:', error.message);
        return [];
    }
}

scrapeGoogle('steve jobs').then(res => {
    console.log(`Found ${res.length} results.`);
    console.log(JSON.stringify(res.slice(0, 3), null, 2));
});
