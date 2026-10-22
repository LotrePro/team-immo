const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('login', { title: 'Connexion', layout: false });
});

router.get('/accueil', (req, res) => {
  res.render('user/accueil', { title: 'Accueil' });
});

module.exports = router;