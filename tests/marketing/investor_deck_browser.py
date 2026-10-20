"""Public navigation regression; run against the existing preview with python3."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:8080")
        await page.get_by_role("link", name="Ver deck de inversión", exact=True).wait_for()
        await page.wait_for_timeout(5000)
        await page.get_by_role("link", name="Ver deck de inversión", exact=True).click()
        await page.get_by_role("button", name="Lámina siguiente").wait_for()
        await page.wait_for_timeout(5000)
        await page.get_by_role("button", name="Lámina siguiente").click()
        await page.wait_for_timeout(300)
        assert await page.get_by_label("Seleccionar lámina").input_value() == "2"
        await page.get_by_role("button", name="Lámina anterior").focus()
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(300)
        assert await page.get_by_label("Seleccionar lámina").input_value() == "3"
        for n in range(1, 11):
            await page.get_by_label("Seleccionar lámina").select_option(str(n))
            await page.wait_for_timeout(300)
            assert await page.locator(".investor-slide img").evaluate("i => i.complete && i.naturalWidth > 0")
        for width in [1440, 390, 320]:
            await page.set_viewport_size({"width": width, "height": 1800})
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        async with page.expect_download(timeout=120000) as download:
            await page.get_by_role("button", name="Descargar PDF", exact=True).click()
        path = Path("/tmp/browser/investor-deck/regression.pdf")
        path.parent.mkdir(parents=True, exist_ok=True)
        await (await download.value).save_as(path)
        assert path.read_bytes().startswith(b"%PDF")
        await browser.close()
    print("Public deck navigation and PDF download passed")
asyncio.run(main())
