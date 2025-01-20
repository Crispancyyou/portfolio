const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Example existing routes

router.get("/", function (req, res, next) {
  res.render("index", { title: "Developer Portal" });
});

router.get("/portfolio", function (req, res, next) {
  res.render("portfolio", { title: "Portfolio" });
});

router.get("/aboutme", function (req, res, next) {
  res.render("aboutme", { title: "About me" });
});

router.get("/contact", function (req, res, next) {
  res.render("contact", { title: "Contact" });
});

router.get("/forex", function (req, res, next) {
  res.render("forex", { title: "Forex" });
});

/**
 * NEW ROUTE: Return the entire forex_history.txt as JSON
 * Assuming forex_history.txt is literally in the same folder as index.js
 */
router.get("/forex/history", function (req, res) {
  try {
    // Build the path to forex_history.txt in the same directory as index.js
    const HISTORY_FILE = path.join(__dirname, "forex_history.txt");

    // If file doesn't exist, return an empty array
    if (!fs.existsSync(HISTORY_FILE)) {
      return res.json([]);
    }

    const content = fs.readFileSync(HISTORY_FILE, "utf8").trim();
    if (!content) {
      return res.json([]);
    }

    // Each line is one JSON object
    const lines = content.split("\n");
    const historyData = lines.map((line) => JSON.parse(line));

    res.json(historyData);
  } catch (err) {
    console.error("Error reading forex history file:", err);
    res.status(500).json({ error: "Unable to read history file" });
  }
});

module.exports = router;
