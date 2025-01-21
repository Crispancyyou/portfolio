const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Add stealth plugin to Puppeteer to help bypass bot detection
puppeteer.use(StealthPlugin());

// In-memory cache for the *latest* live forex data
const forexCache = {
  data: null,
  lastUpdated: null,
};

// File path to store the historical data in plain text lines
const HISTORY_FILE = path.join(__dirname, "forex_history.txt");

/**
 * Ensure the history file exists
 */
function ensureHistoryFileExists() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "", "utf8");
  }
}

/**
 * Append new data to the history file
 */
function appendToHistory(newData) {
  ensureHistoryFileExists();
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(newData) + "\n", "utf8");
  console.log("Appended new data to history file:", newData);
}

/**
 * Get Chromium executable path based on the OS
 */
function getChromiumPath() {
  const platform = process.platform; // 'linux', 'win32', 'darwin'

  if (platform === "linux") {
    const linuxPath = path.resolve(
      __dirname,
      "static-chromium/chrome/ungoogled-chromium_131.0.6778.244_1.vaapi_linux/chrome"
    );

    if (fs.existsSync(linuxPath)) {
      return linuxPath;
    } else {
      throw new Error(`Linux Chromium binary not found at ${linuxPath}`);
    }
  } else if (platform === "win32") {
    const windowsPath = path.resolve(
      __dirname,
      "static-chromium/chrome/win64-130.0.6723.116/chrome-win64/chrome.exe"
    );

    if (fs.existsSync(windowsPath)) {
      return windowsPath;
    } else {
      throw new Error(`Windows Chromium binary not found at ${windowsPath}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Main function that Puppeteer uses to scrape the actual data
async function scrapeForexData() {
  const url = "https://www.investing.com/charts/forex-charts";

  let browser;
  try {
    const chromiumPath = getChromiumPath();
    console.log(`Using Chromium from: ${chromiumPath}`);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath, // Use the determined Chromium path
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    // Set a real user-agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
    );

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "font"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    let receivedData = false;

    // Listen for specific responses
    page.on("response", async (response) => {
      try {
        const respUrl = response.url();
        if (respUrl.includes("/quotes?symbols=Real-time%20Currencies%20%3AEUR%2FUSD")) {
          console.log("Intercepted target response:", respUrl);

          const json = await response.json();
          if (json && json.d && Array.isArray(json.d) && json.d.length > 0) {
            const item = json.d[0];
            const v = item?.v || null;

            if (v) {
              const newData = {
                O: parseFloat(v.open_price),
                H: parseFloat(v.high_price),
                L: parseFloat(v.low_price),
                C: parseFloat(v.lp), // Last price
                timestamp: new Date().toISOString(),
              };

              forexCache.data = newData;
              forexCache.lastUpdated = Date.now();
              receivedData = true;

              console.log("Got live data from real response:", newData);
              appendToHistory(newData);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing target response:", err);
      }
    });

    // Navigate to the page
    console.log("Navigating to URL:", url);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Handle cookie banners
    try {
      await page.click('button[id^="onetrust-accept-btn"]', { timeout: 3000 });
      console.log("Clicked cookie consent");
    } catch (err) {}

    await page.waitForTimeout(5000);
    await browser.close();

    if (!receivedData || !forexCache.data) {
      throw new Error("No real-time data intercepted.");
    }

    const { O, H, L, C } = forexCache.data;
    if (!O || !H || !L || !C) {
      throw new Error("Got data, but missing O/H/L/C fields.");
    }

    return forexCache.data;
  } catch (error) {
    console.error("Scraping error:", error.message);
    if (browser) await browser.close();
    throw error;
  }
}

// Start the scraping loop
async function startScrapingLoop() {
  while (true) {
    try {
      await scrapeForexData();
    } catch (err) {
      console.error("Error in scraping loop; will retry:", err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

startScrapingLoop();

// Express route to get the current data
router.get("/", (req, res) => {
  if (!forexCache.data) {
    return res.status(503).json({ error: "No forex data available yet." });
  }
  res.json(forexCache.data);
});

module.exports = router;
