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

module.exports = router;
