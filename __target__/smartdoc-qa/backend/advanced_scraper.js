import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

async function scrapeGoogle(query) {
    console.log(`Starting Stealth Scrape for: ${query}`);
    let browser;
    try {
        browser = await puppeteerExtra.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Use a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("Navigating...");
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`, { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for results
        console.log("Waiting for results...");
        try {
            await page.waitForSelector('div.g', { timeout: 10000 });
        } catch(e) {
            console.log("Selectors 'div.g' not found. Trying alternative.");
            try { await page.waitForSelector('h3', { timeout: 5000 }); } catch(e2){}
        }

        const results = await page.evaluate(() => {
            const list = [];
            // Common selectors for title/snippet/link
            const mainResults = document.querySelectorAll('div.g');
            mainResults.forEach(el => {
                const title = el.querySelector('h3')?.innerText;
                const link = el.querySelector('a')?.href;
                const snippet = el.querySelector('.VwiC3b, .IsZvec')?.innerText;
                if (title && link) {
                    list.push({ title, url: link, snippet: snippet || '' });
                }
            });
            
            // If main selector failed, try falling back to just headers
            if(list.length === 0) {
              const headers = document.querySelectorAll('h3');
              headers.forEach(h => {
                const title = h.innerText;
                const link = h.closest('a')?.href;
                // find parent then find snippet
                const parent = h.closest('div.tF2Cxc, div.Gx5Zad');
                const snippet = parent?.querySelector('.VwiC3b, .s3v9rd')?.innerText;
                if(title && link) list.push({title, url: link, snippet: snippet || ''});
              });
            }
            return list;
        });

        console.log(`SCRAPE SUCCESS: FOUND ${results.length} RESULTS`);
        return results;
    } catch (error) {
        console.error('SCRAPE FAILED:', error.message);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

scrapeGoogle('steve jobs').then(res => {
    console.log(JSON.stringify(res.slice(0, 3), null, 2));
});
