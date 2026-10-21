const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('login', { title: 'Connexion' });
});

router.get('/', (req, res) => {
  res.render('/accueil', { title: 'Accueil' });
});

module.exports = router;