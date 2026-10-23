import sys, asyncio
from playwright.async_api import async_playwright
src, out = sys.argv[1], sys.argv[2]
script = sys.argv[3] if len(sys.argv) > 3 else ''
html = open(src).read()
if not html.lstrip().lower().startswith('<!doctype'):
    html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1240, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        async def handle(r):
            if r.request.url.startswith('http://test.local/'):
                await r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html)
            else:
                await r.abort()
        await pg.route('**/*', handle)
        await pg.goto('http://test.local/')
        if script:
            await pg.evaluate(script)
            await pg.goto('http://test.local/')
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=out, full_page=True)
        print('errors', errs)
        await b.close()
asyncio.run(main())
