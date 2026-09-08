/**
 * Memoire conversationnelle du moteur.
 *
 * L'IA conserve le fil de l'echange pour resoudre les references implicites
 * ("ajoute-lui un champ email" -> lui = la derniere entite manipulee).
 */

const MAX_TURNS = 40;

export class Memory {
  constructor(initial = {}) {
    this.turns = initial.turns ? [...initial.turns] : [];
    this.lastEntity = initial.lastEntity || null;
    this.lastIntent = initial.lastIntent || null;
    this.facts = { ...(initial.facts || {}) };
  }

  /** Enregistre un tour de conversation. */
  record(turn) {
    this.turns.push({ ...turn, at: new Date().toISOString() });
    if (this.turns.length > MAX_TURNS) {
      this.turns = this.turns.slice(-MAX_TURNS);
    }
    if (turn.intent) this.lastIntent = turn.intent;
    if (turn.entity) this.lastEntity = turn.entity;
    return this;
  }

  /** Memorise un fait durable sur le projet. */
  remember(key, value) {
    this.facts[key] = value;
    return this;
  }

  recall(key) {
    return this.facts[key];
  }

  /** N derniers messages utilisateur, du plus recent au plus ancien. */
  recentUserMessages(count = 5) {
    return this.turns
      .filter((t) => t.role === 'user')
      .slice(-count)
      .map((t) => t.message)
      .reverse();
  }

  /**
   * Le message contient-il une reference implicite a l'element precedent ?
   * ("ajoute-lui", "dedans", "a cette table", "add to it")
   */
  static hasAnaphora(message) {
    return /\b(lui|elle|y|dedans|cette table|cette entite|celle ci|celui ci|la meme|it|there|that one|that table)\b/i
      .test(String(message));
  }

  toJSON() {
    return {
      turns: this.turns,
      lastEntity: this.lastEntity,
      lastIntent: this.lastIntent,
      facts: this.facts,
    };
  }

  static from(json) {
    return new Memory(json || {});
  }
}
