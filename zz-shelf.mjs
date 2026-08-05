import { chromium } from 'playwright';
const SHOT = '/tmp/claude-0/-home-user-Zenith/a09a6c78-5083-5559-a9f5-86255558153e/scratchpad';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

// Serve a recognisable fake cover for both hosts (real ones are proxy-blocked).
const PNG = (h) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">
     <rect width="300" height="450" fill="hsl(${h},60%,42%)"/>
     <circle cx="150" cy="150" r="70" fill="hsl(${h},70%,72%)"/>
     <rect x="40" y="300" width="220" height="26" fill="hsl(${h},70%,80%)"/>
     <rect x="40" y="345" width="150" height="18" fill="hsl(${h},60%,66%)"/>
   </svg>`);
let n = 0;
await page.route(/covers\.openlibrary\.org|books\.google\.com|googleusercontent/, async r => {
  await r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PNG((n++ * 47) % 360) });
});

await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await page.evaluate(() => {
  localStorage.setItem('zenith_data_wiped_v1', 'done');
  localStorage.setItem('zenith_onboarding_completed_v1', 'true');
  localStorage.setItem('zenith_tour_v2', JSON.stringify({ seenAt: Date.now() }));
  localStorage.setItem('zenith_session_active', JSON.stringify({ userHandle: 'Will', sessionToken: 'm', timestamp: Date.now() }));
});

// Seed a shelf: some with covers already resolved, some without.
await page.evaluate(async () => {
  const titles = [
    ['Dune', 'Frank Herbert', '9780441013593'],
    ['Oathbringer', 'Brandon Sanderson', '9780765326379'],
    ['Neuromancer', 'William Gibson', '9780441569595'],
    ['The Hobbit', 'J.R.R. Tolkien', '9780547928227'],
    ['Piranesi', 'Susanna Clarke', '9781635575637'],
    ['Project Hail Mary', 'Andy Weir', '9780593135204'],
  ];
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('ZenithOS');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = db.transaction('library_books', 'readwrite');
  const st = tx.objectStore('library_books');
  titles.forEach(([title, author, isbn], i) => st.put({
    id: 'seed-' + i, title, author, isbn13: isbn,
    readingStatus: i < 4 ? 'COMPLETED' : 'TBR',
    userRating: i < 4 ? 5 - (i % 3) : 0,
    readCount: 1, totalPages: 400, addedAt: Date.now(),
    // half pre-resolved so we see both states even if the sweep is slow
    ...(i % 2 === 0 ? { coverUrl: 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg', coverCheckedAt: Date.now() } : {}),
  }));
  await new Promise(r => { tx.oncomplete = r; tx.onerror = r; tx.onabort = r; });
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);

// Navigate to the Library
const link = page.locator('button[data-tour="nav-book-tracker"]');
if (await link.count()) { await link.click(); } else {
  await page.locator('button:has-text("Library")').first().click();
}
await page.waitForTimeout(6000);
await page.screenshot({ path: `${SHOT}/shelf-1-rest.png` });

const spines = page.locator('button[title*="—"]');
console.log('spines on shelf:', await spines.count());
const withArt = await page.locator('button img[class*="spineArt"]').count();
console.log('spines showing jacket art at rest:', withArt);

if (await spines.count()) {
  await spines.nth(2).hover();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT}/shelf-2-hover.png` });
}
await browser.close();
