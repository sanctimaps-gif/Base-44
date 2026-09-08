/**
 * Couche d'adaptateurs de modeles.
 *
 * IMPORTANT — independance :
 * Le moteur natif (`native`) est le seul fournisseur actif par defaut. Il
 * raisonne uniquement avec les regles, lexiques et blueprints de ce paquet :
 * aucun reseau, aucune cle d'API, aucun service d'IA tiers.
 *
 * Ce registre existe pour que l'application reste ouverte : si un jour vous
 * souhaitez brancher un modele externe, vous enregistrez un adaptateur ici sans
 * modifier une seule ligne du reste de Base 44. Tant que rien n'est enregistre,
 * l'IA demeure totalement autonome.
 */

/** Fournisseur natif : delegue au planificateur local. */
export const nativeProvider = {
  name: 'native',
  offline: true,
  external: false,
  description: "Moteur de raisonnement local de Base 44 (aucune dependance externe).",
};

const registry = new Map([['native', nativeProvider]]);

/**
 * Enregistre un adaptateur externe.
 * @param {{name: string, complete: Function}} provider
 */
export function registerProvider(provider) {
  if (!provider?.name) throw new Error('Un adaptateur doit avoir un nom.');
  if (provider.name === 'native') throw new Error('Le fournisseur natif ne peut pas etre remplace.');
  if (typeof provider.complete !== 'function') {
    throw new Error("Un adaptateur externe doit exposer une methode complete().");
  }
  registry.set(provider.name, { external: true, offline: false, ...provider });
  return provider;
}

export function getProvider(name = 'native') {
  return registry.get(name) || nativeProvider;
}

export function listProviders() {
  return [...registry.values()].map(({ name, offline, external, description }) => ({
    name, offline, external, description,
  }));
}

/** Vrai tant qu'aucun modele externe n'est enregistre. */
export function isFullyIndependent() {
  return [...registry.values()].every((p) => !p.external);
}
