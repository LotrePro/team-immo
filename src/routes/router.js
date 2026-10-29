const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const CONTRATS = ['CDD' , 'CDI'];


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

function validerPersonnel(body) {
  const valeurs = {
    matricule: (body.matricule || '').trim(),
    nomComplet: (body.nomComplet || '').trim(),
    adresse: (body.adresse || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    telephone: (body.telephone || '').trim(),
    contrat: body.contrat || '',
    dateEmbauche: body.dateEmbauche || '',
  };

  const erreurs = [];

  if (!valeurs.matricule) erreurs.push('Le matricule est obligatoire.');
  else if (valeurs.matricule.length > 50) erreurs.push('Le matricule est trop long (50 caractères max).');

  if (!valeurs.nomComplet) erreurs.push('Le nom complet est obligatoire.');
  if (!valeurs.adresse) erreurs.push("L'adresse est obligatoire.");

  if (!valeurs.email) erreurs.push("L'email est obligatoire.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeurs.email)) erreurs.push("L'email n'est pas valide.");

  if (!valeurs.telephone) erreurs.push('Le numéro de téléphone est obligatoire.');
  else if (!/^[0-9+\s().-]{8,20}$/.test(valeurs.telephone)) erreurs.push('Le numéro de téléphone n\'est pas valide.');

  if (!CONTRATS.includes(valeurs.contrat)) erreurs.push('Le contrat doit être CDD ou CDI.');

  if (!valeurs.dateEmbauche || isNaN(new Date(valeurs.dateEmbauche))) {
    erreurs.push("La date d'embauche est obligatoire et doit être valide.");
  }

  return { valeurs, erreurs };
}

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

// Formulaire d'ajout
router.get('/personnel/ajouter', auth, (req, res) => {
  res.render('ajouter', {
    title: 'Ajout',
    erreurs: [],
    valeurs: { contrat: 'CDI' },
  });
});

// Création
router.post('/personnel/ajouter', auth, async (req, res) => {
  const { valeurs, erreurs } = validerPersonnel(req.body);

  const reafficher = (status) =>
    res.status(status).render('ajouter', { title: 'Ajout', erreurs, valeurs });

  if (erreurs.length) return reafficher(400);

  try {
    // Vérification des doublons
    const [parMatricule, parEmail] = await Promise.all([
      prisma.personnel.findUnique({ where: { matricule: valeurs.matricule } }),
      prisma.personnel.findUnique({ where: { email: valeurs.email } }),
    ]);
    if (parMatricule) erreurs.push('Ce matricule existe déjà.');
    if (parEmail) erreurs.push('Cet email est déjà utilisé.');
    if (erreurs.length) return reafficher(409);

    await prisma.personnel.create({
      data: {
        ...valeurs,
        dateEmbauche: new Date(valeurs.dateEmbauche),
      },
    });
    res.redirect('/accueil');
  } catch (err) {
    // P2002 = doublon détecté par la base (cas de deux envois simultanés)
    if (err.code === 'P2002') {
      erreurs.push('Ce matricule ou cet email existe déjà.');
      return reafficher(409);
    }
    console.error(err);
    erreurs.push('Erreur serveur, réessayez.');
    reafficher(500);
  }
});

// Formulaire de modification
router.get('/personnel/:matricule/modifier', auth, async (req, res) => {
  try {
    const p = await prisma.personnel.findUnique({
      where: { matricule: req.params.matricule },
    });
    if (!p) return res.redirect('/accueil');

    res.render('modifier', {
      title: 'Modifier',
      erreurs: [],
      valeurs: {
        ...p,
        dateEmbauche: p.dateEmbauche.toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

// Enregistrement de la modification
router.post('/personnel/:matricule/modifier', auth, async (req, res) => {
  const matricule = req.params.matricule;

  // Le matricule vient de l'URL, jamais du formulaire
  const { valeurs, erreurs } = validerPersonnel({ ...req.body, matricule });

  const reafficher = (status) =>
    res.status(status).render('modifier', { title: 'Modifier', erreurs, valeurs });

  if (erreurs.length) return reafficher(400);

  try {
    // Email déjà pris par UN AUTRE membre ?
    const autre = await prisma.personnel.findFirst({
      where: { email: valeurs.email, NOT: { matricule } },
    });
    if (autre) {
      erreurs.push('Cet email est déjà utilisé par un autre membre.');
      return reafficher(409);
    }

    const { matricule: _ignore, ...donnees } = valeurs;
    await prisma.personnel.update({
      where: { matricule },
      data: { ...donnees, dateEmbauche: new Date(valeurs.dateEmbauche) },
    });
    res.redirect('/accueil');
  } catch (err) {
    if (err.code === 'P2025') return res.redirect('/accueil'); // supprimé entre-temps
    if (err.code === 'P2002') {
      erreurs.push('Cet email est déjà utilisé.');
      return reafficher(409);
    }
    console.error(err);
    erreurs.push('Erreur serveur, réessayez.');
    reafficher(500);
  }
});


// Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;