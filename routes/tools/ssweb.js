const express = require('express');
const router = express.Router();
const { chromium } = require("playwright");

async function takeScreenshot(url, theme, device) {
  let browser;
  try {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const deviceSettings = {
      desktop: { width: 1920, height: 1080 },
      mobile: { width: 375, height: 812, isMobile: true, hasTouch: true },
      tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
    };
    const selectedDevice = deviceSettings[device] || deviceSettings.desktop;
    await page.setViewportSize({ width: selectedDevice.width, height: selectedDevice.height });
    await page.goto(formattedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate((currentTheme) => {
      document.body.style.backgroundColor = currentTheme === "dark" ? "#1a1a1a" : "#ffffff";
      document.body.style.color = currentTheme === "dark" ? "#ffffff" : "#000000";
    }, theme);
    await page.waitForTimeout(1000);
    return await page.screenshot({ fullPage: true, type: "png" });
  } finally {
    if (browser) await browser.close();
  }
}

router.get('/', async (req, res) => {
  const { url, theme = "light", device = "desktop" } = req.query;
  if (!url) return res.status(400).json({ status: false, error: "URL requerida" });
  try {
    const buffer = await takeScreenshot(url.trim(), theme, device);
    res.set("Content-Type", "image/png");
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ status: false, error: error.message });
  }
});

module.exports = router;
