import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

async function test() {
    console.log("Launching browser...");
    let browser;
    try {
        browser = await puppeteerExtra.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto(`https://www.google.com/search?q=steve+jobs&hl=en`, { waitUntil: 'domcontentloaded' });
        
        console.log("Page loaded. Extracting...");
        try { await page.waitForSelector('div.g', { timeout: 3000 }); } catch(e){}
        
        const html = await page.content();
        import('fs').then(fs => fs.writeFileSync('google_dump.html', html));
        
        const results = await page.evaluate((max) => {
            const items = Array.from(document.querySelectorAll('div.g'));
            return items.map(el => {
                const titleEl = el.querySelector('h3');
                const snipEl = el.querySelector('.VwiC3b, .IsZvec');
                const linkEl = el.querySelector('a');
                
                return { 
                    title: titleEl ? titleEl.innerText : '', 
                    snippet: snipEl ? snipEl.innerText : '', 
                    url: linkEl ? linkEl.href : '' 
                };
            }).filter(i => i.title && i.snippet).slice(0, max);
        }, 5);
        
        console.log("RESULTS:", results);
    } catch(e) {
        console.error("ERR:", e.message);
    } finally {
        if(browser) await browser.close();
    }
}
test();
