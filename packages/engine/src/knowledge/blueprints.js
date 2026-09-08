/**
 * Base de connaissance metier de Base 44.
 *
 * Chaque "blueprint" decrit un domaine applicatif : les mots-cles qui
 * permettent de le reconnaitre, les entites a creer, leurs champs et les pages
 * a generer. C'est la memoire a long terme de l'IA — entierement locale.
 */

/** Raccourci de definition de champ. */
const f = (label, type, extra = {}) => ({ label, type, ...extra });

export const BLUEPRINTS = [
  {
    id: 'crm',
    label: 'CRM / Gestion commerciale',
    icon: 'users',
    keywords: [
      'crm', 'client', 'clients', 'prospect', 'prospects', 'vente', 'ventes', 'commercial',
      'contact', 'contacts', 'lead', 'leads', 'pipeline', 'opportunite', 'opportunites',
      'customer', 'customers', 'sales', 'deal', 'deals', 'relation client',
    ],
    theme: { primary: '#2563eb' },
    entities: [
      {
        label: 'Client',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Societe', 'text'),
          f('Email', 'email'),
          f('Telephone', 'phone'),
          f('Statut', 'select', { options: ['Prospect', 'Actif', 'Inactif', 'Perdu'] }),
          f('Adresse', 'longtext'),
          f('Notes', 'longtext'),
        ],
      },
      {
        label: 'Opportunite',
        icon: 'target',
        fields: [
          f('Titre', 'text', { required: true }),
          f('Client', 'relation', { ref: 'Client' }),
          f('Montant', 'currency'),
          f('Etape', 'select', { options: ['Qualification', 'Proposition', 'Negociation', 'Gagnee', 'Perdue'] }),
          f('Date de cloture', 'date'),
          f('Probabilite', 'percent'),
        ],
      },
      {
        label: 'Activite',
        icon: 'calendar',
        fields: [
          f('Sujet', 'text', { required: true }),
          f('Client', 'relation', { ref: 'Client' }),
          f('Type', 'select', { options: ['Appel', 'Email', 'Reunion', 'Relance'] }),
          f('Date', 'datetime'),
          f('Termine', 'boolean'),
          f('Compte rendu', 'longtext'),
        ],
      },
    ],
  },

  {
    id: 'tasks',
    label: 'Gestion de projets et taches',
    icon: 'check-square',
    keywords: [
      'tache', 'taches', 'todo', 'to do', 'projet', 'projets', 'kanban', 'sprint',
      'ticket', 'tickets', 'backlog', 'suivi', 'planning', 'organisation',
      'task', 'tasks', 'project', 'projects', 'issue', 'issues', 'board',
    ],
    theme: { primary: '#7c3aed' },
    entities: [
      {
        label: 'Projet',
        icon: 'folder',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Description', 'longtext'),
          f('Statut', 'select', { options: ['Planifie', 'En cours', 'En pause', 'Termine'] }),
          f('Date de debut', 'date'),
          f('Date de fin', 'date'),
          f('Avancement', 'percent'),
        ],
      },
      {
        label: 'Tache',
        icon: 'check-square',
        fields: [
          f('Titre', 'text', { required: true }),
          f('Projet', 'relation', { ref: 'Projet' }),
          f('Statut', 'select', { options: ['A faire', 'En cours', 'En revue', 'Termine'] }),
          f('Priorite', 'select', { options: ['Basse', 'Normale', 'Haute', 'Urgente'] }),
          f('Assigne a', 'text'),
          f('Echeance', 'date'),
          f('Description', 'longtext'),
        ],
        views: ['kanban'],
      },
    ],
  },

  {
    id: 'inventory',
    label: 'Stock et inventaire',
    icon: 'package',
    keywords: [
      'stock', 'stocks', 'inventaire', 'produit', 'produits', 'entrepot', 'magasin',
      'reference', 'references', 'fournisseur', 'fournisseurs', 'approvisionnement',
      'inventory', 'product', 'products', 'warehouse', 'supplier', 'suppliers', 'sku',
    ],
    theme: { primary: '#059669' },
    entities: [
      {
        label: 'Produit',
        icon: 'package',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Reference', 'text', { unique: true }),
          f('Categorie', 'select', { options: ['General', 'Matiere premiere', 'Fini', 'Consommable'] }),
          f('Prix', 'currency'),
          f('Quantite en stock', 'number'),
          f('Seuil d alerte', 'number'),
          f('Fournisseur', 'relation', { ref: 'Fournisseur' }),
          f('Photo', 'image'),
        ],
      },
      {
        label: 'Fournisseur',
        icon: 'truck',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email'),
          f('Telephone', 'phone'),
          f('Adresse', 'longtext'),
          f('Delai de livraison', 'number'),
        ],
      },
      {
        label: 'Mouvement',
        icon: 'repeat',
        fields: [
          f('Produit', 'relation', { ref: 'Produit' }),
          f('Type', 'select', { options: ['Entree', 'Sortie', 'Ajustement'] }),
          f('Quantite', 'number', { required: true }),
          f('Date', 'datetime'),
          f('Motif', 'text'),
        ],
      },
    ],
  },

  {
    id: 'ecommerce',
    label: 'Boutique en ligne',
    icon: 'shopping-cart',
    keywords: [
      'boutique', 'ecommerce', 'e commerce', 'commande', 'commandes', 'panier', 'vente en ligne',
      'shop', 'store', 'order', 'orders', 'cart', 'checkout', 'catalogue', 'catalog',
    ],
    theme: { primary: '#ea580c' },
    entities: [
      {
        label: 'Article',
        icon: 'tag',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Description', 'longtext'),
          f('Prix', 'currency', { required: true }),
          f('Stock', 'number'),
          f('Categorie', 'select', { options: ['Nouveaute', 'Best seller', 'Promotion', 'Archive'] }),
          f('Photo', 'image'),
          f('Publie', 'boolean'),
        ],
      },
      {
        label: 'Commande',
        icon: 'shopping-cart',
        fields: [
          f('Reference', 'text', { unique: true, required: true }),
          f('Client', 'relation', { ref: 'Client' }),
          f('Statut', 'select', { options: ['En attente', 'Payee', 'Expediee', 'Livree', 'Annulee'] }),
          f('Total', 'currency'),
          f('Date de commande', 'datetime'),
          f('Adresse de livraison', 'longtext'),
        ],
      },
      {
        label: 'Client',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email', { unique: true }),
          f('Telephone', 'phone'),
          f('Adresse', 'longtext'),
        ],
      },
    ],
  },

  {
    id: 'booking',
    label: 'Reservations et rendez-vous',
    icon: 'calendar',
    keywords: [
      'reservation', 'reservations', 'rendez vous', 'rdv', 'creneau', 'creneaux', 'agenda',
      'planning', 'salon', 'cabinet', 'coiffeur', 'restaurant table', 'consultation',
      'booking', 'bookings', 'appointment', 'appointments', 'schedule', 'reserve',
    ],
    theme: { primary: '#0d9488' },
    entities: [
      {
        label: 'Reservation',
        icon: 'calendar',
        fields: [
          f('Client', 'relation', { ref: 'Client' }),
          f('Prestation', 'relation', { ref: 'Prestation' }),
          f('Date et heure', 'datetime', { required: true }),
          f('Duree', 'number'),
          f('Statut', 'select', { options: ['Demandee', 'Confirmee', 'Honoree', 'Annulee'] }),
          f('Notes', 'longtext'),
        ],
        views: ['calendar'],
      },
      {
        label: 'Prestation',
        icon: 'star',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Duree', 'number'),
          f('Prix', 'currency'),
          f('Description', 'longtext'),
        ],
      },
      {
        label: 'Client',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email'),
          f('Telephone', 'phone'),
        ],
      },
    ],
  },

  {
    id: 'blog',
    label: 'Blog / Contenu editorial',
    icon: 'file-text',
    keywords: [
      'blog', 'article', 'articles', 'publication', 'publications', 'contenu', 'redaction',
      'magazine', 'actualite', 'actualites', 'newsletter', 'cms',
      'post', 'posts', 'content', 'editorial', 'news',
    ],
    theme: { primary: '#4f46e5' },
    entities: [
      {
        label: 'Article',
        icon: 'file-text',
        fields: [
          f('Titre', 'text', { required: true }),
          f('Chapeau', 'longtext'),
          f('Contenu', 'longtext'),
          f('Auteur', 'relation', { ref: 'Auteur' }),
          f('Categorie', 'select', { options: ['Actualite', 'Tutoriel', 'Opinion', 'Interview'] }),
          f('Tags', 'multiselect'),
          f('Image de couverture', 'image'),
          f('Publie', 'boolean'),
          f('Date de publication', 'date'),
        ],
      },
      {
        label: 'Auteur',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email'),
          f('Biographie', 'longtext'),
          f('Photo', 'image'),
        ],
      },
      {
        label: 'Commentaire',
        icon: 'message-circle',
        fields: [
          f('Article', 'relation', { ref: 'Article' }),
          f('Auteur', 'text'),
          f('Message', 'longtext'),
          f('Date', 'datetime'),
          f('Valide', 'boolean'),
        ],
      },
    ],
  },

  {
    id: 'support',
    label: 'Support et service client',
    icon: 'life-buoy',
    keywords: [
      'support', 'helpdesk', 'assistance', 'sav', 'reclamation', 'reclamations',
      'incident', 'incidents', 'demande', 'demandes',
      'ticketing', 'service desk', 'customer support', 'complaint',
    ],
    theme: { primary: '#dc2626' },
    entities: [
      {
        label: 'Ticket',
        icon: 'life-buoy',
        fields: [
          f('Sujet', 'text', { required: true }),
          f('Demandeur', 'text'),
          f('Email', 'email'),
          f('Priorite', 'select', { options: ['Basse', 'Normale', 'Haute', 'Critique'] }),
          f('Statut', 'select', { options: ['Ouvert', 'En cours', 'En attente', 'Resolu', 'Ferme'] }),
          f('Categorie', 'select', { options: ['Technique', 'Facturation', 'Commercial', 'Autre'] }),
          f('Description', 'longtext'),
          f('Assigne a', 'text'),
          f('Date d ouverture', 'datetime'),
        ],
        views: ['kanban'],
      },
    ],
  },

  {
    id: 'hr',
    label: 'Ressources humaines',
    icon: 'briefcase',
    keywords: [
      'rh', 'ressources humaines', 'employe', 'employes', 'salarie', 'salaries', 'personnel',
      'recrutement', 'candidat', 'candidats', 'conge', 'conges', 'absence', 'absences',
      'hr', 'employee', 'employees', 'staff', 'recruitment', 'candidate', 'leave', 'payroll',
    ],
    theme: { primary: '#0891b2' },
    entities: [
      {
        label: 'Employe',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Prenom', 'text'),
          f('Email', 'email', { unique: true }),
          f('Telephone', 'phone'),
          f('Poste', 'text'),
          f('Departement', 'select', { options: ['Direction', 'Technique', 'Commercial', 'Support', 'Administratif'] }),
          f('Date d embauche', 'date'),
          f('Salaire', 'currency'),
          f('Photo', 'image'),
        ],
      },
      {
        label: 'Conge',
        icon: 'sun',
        fields: [
          f('Employe', 'relation', { ref: 'Employe' }),
          f('Type', 'select', { options: ['Conges payes', 'RTT', 'Maladie', 'Sans solde'] }),
          f('Date de debut', 'date', { required: true }),
          f('Date de fin', 'date'),
          f('Statut', 'select', { options: ['Demande', 'Approuve', 'Refuse'] }),
          f('Motif', 'longtext'),
        ],
        views: ['calendar'],
      },
    ],
  },

  {
    id: 'finance',
    label: 'Finances et facturation',
    icon: 'credit-card',
    keywords: [
      'facture', 'factures', 'facturation', 'devis', 'comptabilite', 'depense', 'depenses',
      'budget', 'tresorerie', 'paiement', 'paiements', 'note de frais',
      'invoice', 'invoices', 'billing', 'quote', 'expense', 'expenses', 'accounting', 'finance',
    ],
    theme: { primary: '#16a34a' },
    entities: [
      {
        label: 'Facture',
        icon: 'file-text',
        fields: [
          f('Numero', 'text', { unique: true, required: true }),
          f('Client', 'relation', { ref: 'Client' }),
          f('Date d emission', 'date'),
          f('Date d echeance', 'date'),
          f('Montant HT', 'currency'),
          f('TVA', 'percent'),
          f('Montant TTC', 'currency'),
          f('Statut', 'select', { options: ['Brouillon', 'Envoyee', 'Payee', 'En retard', 'Annulee'] }),
        ],
      },
      {
        label: 'Depense',
        icon: 'credit-card',
        fields: [
          f('Libelle', 'text', { required: true }),
          f('Categorie', 'select', { options: ['Fournitures', 'Deplacement', 'Logiciel', 'Loyer', 'Autre'] }),
          f('Montant', 'currency', { required: true }),
          f('Date', 'date'),
          f('Justificatif', 'file'),
          f('Remboursee', 'boolean'),
        ],
      },
      {
        label: 'Client',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email'),
          f('Adresse', 'longtext'),
          f('SIRET', 'text'),
        ],
      },
    ],
  },

  {
    id: 'education',
    label: 'Education et formation',
    icon: 'book-open',
    keywords: [
      'ecole', 'cours', 'eleve', 'eleves', 'etudiant', 'etudiants', 'formation', 'formations',
      'note', 'notes', 'classe', 'classes', 'enseignant', 'professeur', 'apprentissage',
      'school', 'course', 'courses', 'student', 'students', 'teacher', 'grade', 'lesson',
    ],
    theme: { primary: '#d97706' },
    entities: [
      {
        label: 'Etudiant',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Prenom', 'text'),
          f('Email', 'email'),
          f('Date de naissance', 'date'),
          f('Classe', 'select', { options: ['Groupe A', 'Groupe B', 'Groupe C'] }),
          f('Photo', 'image'),
        ],
      },
      {
        label: 'Cours',
        icon: 'book-open',
        fields: [
          f('Intitule', 'text', { required: true }),
          f('Enseignant', 'text'),
          f('Description', 'longtext'),
          f('Duree', 'number'),
          f('Date', 'datetime'),
        ],
        views: ['calendar'],
      },
      {
        label: 'Evaluation',
        icon: 'award',
        fields: [
          f('Etudiant', 'relation', { ref: 'Etudiant' }),
          f('Cours', 'relation', { ref: 'Cours' }),
          f('Note', 'number'),
          f('Date', 'date'),
          f('Commentaire', 'longtext'),
        ],
      },
    ],
  },

  {
    id: 'health',
    label: 'Sante et bien-etre',
    icon: 'heart',
    keywords: [
      'sante', 'sport', 'fitness', 'entrainement', 'entrainements', 'seance', 'seances',
      'nutrition', 'repas', 'poids', 'patient', 'patients', 'medical', 'suivi medical',
      'workout', 'training', 'health', 'meal', 'diet', 'exercise',
    ],
    theme: { primary: '#e11d48' },
    entities: [
      {
        label: 'Seance',
        icon: 'activity',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Date', 'datetime'),
          f('Type', 'select', { options: ['Cardio', 'Musculation', 'Souplesse', 'Repos'] }),
          f('Duree', 'number'),
          f('Calories', 'number'),
          f('Ressenti', 'rating'),
          f('Notes', 'longtext'),
        ],
        views: ['calendar'],
      },
      {
        label: 'Mesure',
        icon: 'trending-up',
        fields: [
          f('Date', 'date', { required: true }),
          f('Poids', 'number'),
          f('Tour de taille', 'number'),
          f('Commentaire', 'longtext'),
        ],
      },
    ],
  },

  {
    id: 'realestate',
    label: 'Immobilier',
    icon: 'home',
    keywords: [
      'immobilier', 'bien', 'biens', 'appartement', 'appartements', 'maison', 'maisons',
      'location', 'locations', 'locataire', 'locataires', 'bail', 'agence immobiliere',
      'property', 'properties', 'real estate', 'rental', 'tenant', 'lease',
    ],
    theme: { primary: '#4b5563' },
    entities: [
      {
        label: 'Bien',
        icon: 'home',
        fields: [
          f('Titre', 'text', { required: true }),
          f('Type', 'select', { options: ['Appartement', 'Maison', 'Local', 'Terrain'] }),
          f('Adresse', 'longtext'),
          f('Surface', 'number'),
          f('Nombre de pieces', 'number'),
          f('Prix', 'currency'),
          f('Statut', 'select', { options: ['Disponible', 'Sous compromis', 'Vendu', 'Loue'] }),
          f('Photo', 'image'),
        ],
      },
      {
        label: 'Visite',
        icon: 'calendar',
        fields: [
          f('Bien', 'relation', { ref: 'Bien' }),
          f('Visiteur', 'text'),
          f('Telephone', 'phone'),
          f('Date et heure', 'datetime'),
          f('Compte rendu', 'longtext'),
        ],
        views: ['calendar'],
      },
    ],
  },

  {
    id: 'events',
    label: 'Evenementiel',
    icon: 'ticket',
    keywords: [
      'evenement', 'evenements', 'conference', 'seminaire', 'mariage', 'billet', 'billets',
      'participant', 'participants', 'inscription', 'inscriptions', 'invite', 'invites',
      'event', 'events', 'attendee', 'attendees', 'ticketing', 'registration',
    ],
    theme: { primary: '#7c3aed' },
    entities: [
      {
        label: 'Evenement',
        icon: 'ticket',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Description', 'longtext'),
          f('Date de debut', 'datetime'),
          f('Date de fin', 'datetime'),
          f('Lieu', 'text'),
          f('Capacite', 'number'),
          f('Prix', 'currency'),
          f('Image de couverture', 'image'),
        ],
        views: ['calendar'],
      },
      {
        label: 'Participant',
        icon: 'user',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Email', 'email'),
          f('Evenement', 'relation', { ref: 'Evenement' }),
          f('Statut', 'select', { options: ['Inscrit', 'Confirme', 'Present', 'Absent'] }),
          f('Date d inscription', 'datetime'),
        ],
      },
    ],
  },

  {
    id: 'restaurant',
    label: 'Restauration',
    icon: 'coffee',
    keywords: [
      'restaurant', 'menu', 'plat', 'plats', 'carte', 'cuisine', 'recette', 'recettes',
      'table', 'tables', 'serveur', 'commande restaurant', 'traiteur',
      'dish', 'dishes', 'recipe', 'recipes', 'food', 'kitchen',
    ],
    theme: { primary: '#ca8a04' },
    entities: [
      {
        label: 'Plat',
        icon: 'coffee',
        fields: [
          f('Nom', 'text', { required: true }),
          f('Categorie', 'select', { options: ['Entree', 'Plat', 'Dessert', 'Boisson'] }),
          f('Description', 'longtext'),
          f('Prix', 'currency'),
          f('Photo', 'image'),
          f('Disponible', 'boolean'),
          f('Allergenes', 'multiselect'),
        ],
      },
      {
        label: 'Commande',
        icon: 'clipboard',
        fields: [
          f('Numero de table', 'number'),
          f('Statut', 'select', { options: ['Prise', 'En cuisine', 'Servie', 'Payee'] }),
          f('Total', 'currency'),
          f('Heure', 'datetime'),
          f('Notes', 'longtext'),
        ],
        views: ['kanban'],
      },
    ],
  },

  {
    id: 'library',
    label: 'Bibliotheque / Collection',
    icon: 'book',
    keywords: [
      'bibliotheque', 'livre', 'livres', 'collection', 'emprunt', 'emprunts', 'catalogue',
      'film', 'films', 'musique', 'archive', 'archives', 'mediatheque',
      'library', 'book', 'books', 'borrow', 'loan', 'collection',
    ],
    theme: { primary: '#4f46e5' },
    entities: [
      {
        label: 'Ouvrage',
        icon: 'book',
        fields: [
          f('Titre', 'text', { required: true }),
          f('Auteur', 'text'),
          f('ISBN', 'text', { unique: true }),
          f('Categorie', 'select', { options: ['Roman', 'Essai', 'BD', 'Jeunesse', 'Technique'] }),
          f('Annee', 'number'),
          f('Couverture', 'image'),
          f('Disponible', 'boolean'),
        ],
      },
      {
        label: 'Emprunt',
        icon: 'repeat',
        fields: [
          f('Ouvrage', 'relation', { ref: 'Ouvrage' }),
          f('Emprunteur', 'text', { required: true }),
          f('Date d emprunt', 'date'),
          f('Date de retour', 'date'),
          f('Rendu', 'boolean'),
        ],
      },
    ],
  },
];

/** Blueprint utilise quand aucun domaine n'est reconnu. */
export const GENERIC_BLUEPRINT = {
  id: 'generic',
  label: 'Application sur mesure',
  icon: 'layout',
  keywords: [],
  theme: { primary: '#2563eb' },
  entities: [
    {
      label: 'Element',
      icon: 'layout',
      fields: [
        { label: 'Nom', type: 'text', required: true },
        { label: 'Description', type: 'longtext' },
        { label: 'Statut', type: 'select', options: ['Nouveau', 'En cours', 'Termine'] },
        { label: 'Date', type: 'date' },
      ],
    },
  ],
};

/** Index mot-cle -> blueprint, construit une seule fois au chargement. */
const KEYWORD_INDEX = (() => {
  const index = new Map();
  for (const bp of BLUEPRINTS) {
    for (const kw of bp.keywords) {
      if (!index.has(kw)) index.set(kw, []);
      index.get(kw).push(bp.id);
    }
  }
  return index;
})();

export function getBlueprint(id) {
  return BLUEPRINTS.find((b) => b.id === id) || GENERIC_BLUEPRINT;
}

export { KEYWORD_INDEX };
