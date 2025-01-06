var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Developer Portal' });
});

/* GET portfolio page. */
router.get('/portfolio', function(req, res, next) {
  res.render('portfolio', { title: 'Portfolio' });
});

/* GET aboutme page. */
router.get('/aboutme', function(req, res, next) {
  res.render('aboutme', { title: 'About me' });
});

/* GET aboutme page. */
router.get('/contact', function(req, res, next) {
  res.render('contact', { title: 'Contact' });
});



module.exports = router;
