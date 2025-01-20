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
 * Make sure the file exists; if not, create it empty.
 */
function ensureHistoryFileExists() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "", "utf8");
  }
}

/**
 * Appends the new data to the history file, *every time* a new response is intercepted.
 * This will log *all* data points (including duplicates) to track each update in time.
 */
function appendToHistory(newData) {
  ensureHistoryFileExists();
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(newData) + "\n", "utf8");
  console.log("Appended new data to history file:", newData);
}

// Main function that Puppeteer uses to scrape the actual data
async function scrapeForexData() {
  const url = "https://www.investing.com/charts/forex-charts";

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    // Spoof a real user-agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
    );

    // Block images & fonts for speed
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

    // ---- Listen for XHR/Fetch responses matching the actual live data feed ----
    page.on("response", async (response) => {
      try {
        const respUrl = response.url();

        // Adjust this substring to match EXACT request from DevTools
        // e.g. "/quotes?symbols=Real-time%20Currencies%20%3AEUR%2FUSD"
        if (respUrl.includes("/quotes?symbols=Real-time%20Currencies%20%3AEUR%2FUSD")) {
          console.log("Intercepted target response:", respUrl);

          // Parse the JSON
          const json = await response.json();

          // Should match the structure you mentioned:
          // {
          //   "s":"ok",
          //   "d":[
          //     {
          //       "s":"ok",
          //       "n":"Real-time Currencies :EUR/USD",
          //       "v":{
          //         "ch":"0.0112",
          //         "chp":"1.09",
          //         "short_name":"EUR/USD",
          //         "lp":"1.0394",
          //         "open_price":"1.0299",
          //         "high_price":"1.0430",
          //         "low_price":"1.0267",
          //         "prev_close_price":"1.0282",
          //         ...
          //       }
          //     }
          //   ]
          // }

          if (json && json.d && Array.isArray(json.d) && json.d.length > 0) {
            const item = json.d[0];
            const v = item?.v || null;

            if (v) {
              // Build your data object
              const newData = {
                O: parseFloat(v.open_price),
                H: parseFloat(v.high_price),
                L: parseFloat(v.low_price),
                C: parseFloat(v.lp), // last price
                timestamp: new Date().toISOString(),
              };

              // Save in memory for immediate use
              forexCache.data = newData;
              forexCache.lastUpdated = Date.now();
              receivedData = true;

              console.log("Got live data from real response:", newData);

              // APPEND THIS DATA POINT EVERY TIME
              appendToHistory(newData);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing target response:", err);
      }
    });

    // ---- Navigate to the actual page ----
    console.log("Navigating to URL:", url);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Some sites need you to accept cookies (if a banner appears)
    try {
      await page.click('button[id^="onetrust-accept-btn"]', { timeout: 3000 });
      console.log("Clicked cookie consent");
    } catch (err) {
      // No banner or cannot click
    }

    // Wait a bit for the XHR request to fire and respond
    await page.waitForTimeout(5000);

    await browser.close();

    // Validate we actually got data
    if (!receivedData || !forexCache.data) {
      throw new Error("No real-time data intercepted. Possibly the request was never made.");
    }

    // Ensure we have all 4 fields
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

// This loop just keeps re-running the scrape every 30 seconds
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

// Immediately start the loop
startScrapingLoop();

// Express route to return the current data
router.get("/", (req, res) => {
  if (!forexCache.data) {
    return res.status(503).json({ error: "No forex data available yet." });
  }
  res.json(forexCache.data);
});

module.exports = router;
