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




module.exports = router;
