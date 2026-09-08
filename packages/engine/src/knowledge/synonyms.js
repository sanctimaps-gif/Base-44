/**
 * Table de concepts — synonymes francais / anglais.
 *
 * Elle permet a l'IA de reconnaitre qu'« employees » et « employes » designent
 * la meme chose, et donc d'eviter de creer deux tables pour un seul concept
 * lorsque la demande melange les deux langues.
 */

import { singularize, snake } from '../util/text.js';

/** concept canonique -> variantes reconnues. */
const CONCEPTS = {
  client: ['client', 'customer', 'contact', 'prospect', 'lead', 'acheteur', 'buyer'],
  employe: ['employe', 'employee', 'salarie', 'staff', 'collaborateur', 'personnel', 'worker'],
  conge: ['conge', 'leave', 'absence', 'vacation', 'holiday', 'repos'],
  produit: ['produit', 'product', 'article', 'item', 'marchandise', 'good'],
  commande: ['commande', 'order', 'achat', 'purchase'],
  facture: ['facture', 'invoice', 'billing', 'bill'],
  devis: ['devis', 'quote', 'quotation', 'estimate'],
  depense: ['depense', 'expense', 'spending', 'cout', 'cost'],
  paiement: ['paiement', 'payment', 'reglement', 'transaction'],
  tache: ['tache', 'task', 'todo', 'action', 'chore'],
  projet: ['projet', 'project', 'chantier', 'programme'],
  ticket: ['ticket', 'incident', 'issue', 'reclamation', 'complaint', 'demande', 'request'],
  fournisseur: ['fournisseur', 'supplier', 'vendor', 'prestataire'],
  stock: ['stock', 'inventaire', 'inventory'],
  mouvement: ['mouvement', 'movement', 'transfert', 'transfer'],
  reservation: ['reservation', 'booking', 'rendez vous', 'rdv', 'appointment'],
  prestation: ['prestation', 'service', 'offre'],
  evenement: ['evenement', 'event', 'conference', 'seminaire'],
  participant: ['participant', 'attendee', 'invite', 'guest', 'inscrit'],
  article_blog: ['post', 'publication', 'billet'],
  auteur: ['auteur', 'author', 'redacteur', 'writer'],
  commentaire: ['commentaire', 'comment', 'avis', 'review'],
  etudiant: ['etudiant', 'student', 'eleve', 'apprenant', 'learner'],
  cours: ['cours', 'course', 'lesson', 'lecon', 'formation', 'module'],
  evaluation: ['evaluation', 'grade', 'note', 'exam', 'examen', 'test'],
  ouvrage: ['ouvrage', 'livre', 'book', 'volume'],
  emprunt: ['emprunt', 'loan', 'borrowing', 'pret'],
  bien: ['bien', 'property', 'propriete', 'logement', 'appartement', 'maison', 'house', 'apartment'],
  visite: ['visite', 'visit', 'viewing', 'tour'],
  plat: ['plat', 'dish', 'recette', 'recipe', 'menu item'],
  seance: ['seance', 'session', 'workout', 'entrainement', 'training'],
  mesure: ['mesure', 'measurement', 'metric', 'releve'],
  opportunite: ['opportunite', 'opportunity', 'deal', 'affaire'],
  activite: ['activite', 'activity', 'interaction'],
};

/** Index inverse : variante -> concept canonique. */
const INDEX = (() => {
  const map = new Map();
  for (const [concept, variants] of Object.entries(CONCEPTS)) {
    for (const variant of variants) {
      map.set(snake(variant), concept);
    }
  }
  return map;
})();

/**
 * Ramene un mot a son concept canonique.
 * Retourne le mot singularise si aucun concept ne correspond.
 */
export function canonical(word = '') {
  const key = snake(word);
  if (INDEX.has(key)) return INDEX.get(key);

  const singularFr = snake(singularize(key, 'fr'));
  if (INDEX.has(singularFr)) return INDEX.get(singularFr);

  const singularEn = snake(singularize(key, 'en'));
  if (INDEX.has(singularEn)) return INDEX.get(singularEn);

  return singularFr;
}

/** Deux mots designent-ils le meme concept ? */
export function sameConcept(a, b) {
  return canonical(a) === canonical(b);
}
