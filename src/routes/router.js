const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');


router.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/accueil');
  res.render('login', { title: 'Connexion', layout: false, erreur: null });
});


router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/accueil');
  res.render('login', { title: 'Connexion', layout: false, erreur: null });
});


router.post('/login', async (req, res) => {
  const { matricule, password } = req.body;

  if (!matricule || !password) {
    return res.status(400).render('login', {
      title: 'Connexion', layout: false,
      erreur: 'Matricule et mot de passe requis',
    });
  }

  try {
    const user = await prisma.user.findUnique({ where: { matricule } });

  
    if (!user || user.password !== password) {
      return res.status(401).render('login', {
        title: 'Connexion', layout: false,
        erreur: 'Identifiants incorrects',
      });
    }

    req.session.userId = user.id;
    res.redirect('/accueil');
  } catch (err) {
    console.error(err);
    res.status(500).render('login', {
      title: 'Connexion', layout: false,
      erreur: 'Erreur serveur',
    });
  }
});


router.get('/accueil', auth, async (req, res) => {
  try {
    const personnels = await prisma.personnel.findMany({
      orderBy: { matricule: 'asc' },
    });
    res.render('accueil', { title: 'Accueil', personnels });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/personnel/:matricule/supprimer', auth, async (req, res) => {
  try {
    await prisma.personnel.delete({
      where: { matricule: req.params.matricule },
    });
  } catch (err) {
    if (err.code !== 'P2025') console.error(err);
  }
  res.redirect('/accueil');
});

// Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;