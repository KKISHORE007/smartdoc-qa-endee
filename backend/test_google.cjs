const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const response = await axios.get('https://www.google.com/search', {
            params: { q: 'steve jobs', hl: 'en' },
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // In the mobile view Google returns, standard result blocks often use div with a nested specific structure
        $('div.ZINbbc, a').each((i, el) => {
            const titleEl = $(el).find('div.BNeawe.vvjwJb.AP7Wnd');
            const snippetEl = $(el).find('div.BNeawe.s3v9rd.AP7Wnd').first();
            
            let url = '';
            if (el.tagName === 'a') url = $(el).attr('href');
            else url = $(el).find('a').attr('href');
            
            if (titleEl.length && snippetEl.length && url && url.startsWith('/url?q=')) {
                // Clean url
                url = url.split('/url?q=')[1].split('&sa=')[0];
                url = decodeURIComponent(url);
                
                const title = titleEl.text().trim();
                const snippet = snippetEl.text().trim();

                // avoid duplicates
                if (title && snippet && !results.some(r => r.url === url)) {
                    results.push({ title, snippet, url });
                }
            }
        });
        
        console.log("FOUND RESULTS:", results.length);
        console.log(results.slice(0, 3));
    } catch(e) {
        console.error("FAIL:", e.message);
    }
}
test();
