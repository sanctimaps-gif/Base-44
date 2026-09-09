/**
 * Base 44 — moteur d'IA autonome.
 *
 * Point d'entree unique. Le moteur recoit un message en langage naturel et un
 * AppSpec (eventuellement nul), puis retourne un AppSpec mis a jour accompagne
 * d'une reponse redigee.
 *
 * Independance : ce paquet n'a aucune dependance npm et n'effectue aucun appel
 * reseau. Tout le raisonnement (comprehension, planification, generation) est
 * realise par le code de ce dossier.
 */

import { classify, INTENTS } from './nlu/intent.js';
import { detectDomain } from './nlu/extract.js';
import { Memory } from './memory/memory.js';
import {
  planCreateApp, planAddEntity, planAddField, planAddPage,
  planRemove, planRename, planSetTheme,
} from './planner/planner.js';
import { validateSpec, repairSpec, createSpec } from './planner/spec.js';
import { coerceRecord, checkUnique } from './planner/records.js';
import { generateSampleData } from './knowledge/sampleData.js';
import { synthProject } from './synth/index.js';
import { BLUEPRINTS } from './knowledge/blueprints.js';
import { getProvider, isFullyIndependent, listProviders } from './providers/index.js';

export const ENGINE_NAME = 'Base 44 Engine';
export const ENGINE_VERSION = '1.0.0';

export class Base44Engine {
  /**
   * @param {{provider?: string, memory?: object}} options
   */
  constructor(options = {}) {
    this.provider = getProvider(options.provider || 'native');
    this.memory = Memory.from(options.memory);
  }

  /** Carte d'identite du moteur (affichee dans l'interface). */
  identity() {
    return {
      name: ENGINE_NAME,
      version: ENGINE_VERSION,
      provider: this.provider.name,
      independent: isFullyIndependent(),
      offline: true,
      externalCalls: 0,
      knowledge: {
        domains: BLUEPRINTS.length,
        entities: BLUEPRINTS.reduce((sum, b) => sum + b.entities.length, 0),
      },
      providers: listProviders(),
    };
  }

  /**
   * Traite un message utilisateur.
   *
   * @param {string} message texte libre
   * @param {object|null} spec AppSpec courant (null pour une nouvelle app)
   * @returns {{spec: object, reply: string, intent: string, confidence: number,
   *            changes: object[], issues: object[], suggestions: string[]}}
   */
  chat(message, spec = null) {
    const text = String(message ?? '').trim();
    const hasApp = Boolean(spec && spec.entities?.length);

    this.memory.record({ role: 'user', message: text });

    if (!text) {
      return this.#respond(spec, {
        intent: INTENTS.UNKNOWN,
        confidence: 0,
        changes: [],
        reply: "Dites-moi ce que vous souhaitez construire, par exemple : « une application de gestion de clients avec un suivi des factures ».",
      });
    }

    const { intent, confidence } = classify(text, { hasApp });
    let result = { spec, changes: [], error: null };
    let reply = '';

    switch (intent) {
      case INTENTS.CREATE_APP: {
        const created = planCreateApp(text);
        result = { spec: created.spec, changes: created.changes };
        reply = this.#replyForCreation(created);
        break;
      }

      case INTENTS.ADD_ENTITY: {
        if (!hasApp) { result = planCreateApp(text); reply = this.#replyForCreation(result); break; }
        result = planAddEntity(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Entite ajoutee.');
        break;
      }

      case INTENTS.ADD_FIELD: {
        if (!hasApp) { result = planCreateApp(text); reply = this.#replyForCreation(result); break; }
        result = planAddField(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Champs mis a jour.');
        break;
      }

      case INTENTS.ADD_PAGE: {
        if (!hasApp) { result = planCreateApp(text); reply = this.#replyForCreation(result); break; }
        result = planAddPage(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Vue ajoutee.');
        break;
      }

      case INTENTS.REMOVE: {
        if (!hasApp) { reply = "Il n'y a encore rien a supprimer."; break; }
        result = planRemove(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Suppression effectuee.');
        break;
      }

      case INTENTS.RENAME: {
        if (!hasApp) { reply = "Creez d'abord une application, je pourrai ensuite la renommer."; break; }
        result = planRename(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Renommage effectue.');
        break;
      }

      case INTENTS.SET_THEME: {
        if (!hasApp) { result = planCreateApp(text); reply = this.#replyForCreation(result); break; }
        result = planSetTheme(spec, text);
        reply = result.error || this.#replyForChanges(result.changes, 'Theme mis a jour.');
        break;
      }

      case INTENTS.SEED_DATA: {
        if (!hasApp) { reply = "Creez d'abord une application pour que je puisse la remplir."; break; }
        reply = "Je genere un jeu de donnees d'exemple coherent pour chaque table.";
        result = { spec, changes: [{ kind: 'data', message: "Donnees d'exemple regenerees." }], seed: true };
        break;
      }

      case INTENTS.QUESTION:
        reply = this.#answerQuestion(text, spec);
        break;

      case INTENTS.SMALLTALK:
        reply = hasApp
          ? "Bonjour ! Dites-moi ce que vous voulez modifier dans votre application."
          : "Bonjour ! Decrivez l'application que vous souhaitez et je la construis.";
        break;

      default:
        reply = this.#replyForUnknown(text, hasApp);
        break;
    }

    return this.#respond(result.spec ?? spec, {
      intent,
      confidence,
      changes: result.changes || [],
      reply,
      seed: Boolean(result.seed),
    });
  }

  /** Construit la reponse finale : validation, auto-reparation, suggestions. */
  #respond(spec, { intent, confidence, changes, reply, seed = false }) {
    let issues = [];
    if (spec) {
      repairSpec(spec);
      issues = validateSpec(spec);
      // L'IA signale les avertissements mais ne bloque jamais l'utilisateur.
      const blocking = issues.filter((i) => i.level === 'error');
      if (blocking.length) {
        reply += `\n\nAttention : ${blocking.map((i) => i.message).join(' ')}`;
      }
    }

    this.memory.record({ role: 'assistant', message: reply, intent });

    return {
      spec,
      reply,
      intent,
      confidence,
      changes,
      issues,
      seed,
      suggestions: this.#suggest(spec, intent),
      memory: this.memory.toJSON(),
    };
  }

  /** Redige la reponse apres une creation d'application. */
  #replyForCreation(result) {
    const { spec, changes } = result;
    const entities = spec.entities.map((e) => e.labelPlural).join(', ');
    const views = [...new Set(spec.entities.flatMap((e) => e.views))].map(viewLabel);

    const lines = [
      `J'ai construit **${spec.name}**.`,
      '',
      `**Modele de donnees** — ${spec.entities.length} table(s) : ${entities}.`,
    ];

    for (const entity of spec.entities) {
      lines.push(`- **${entity.labelPlural}** : ${entity.fields.map((f) => f.label).join(', ')}`);
    }

    lines.push('');
    lines.push(
      `**Pages generees** — ${spec.pages.length} au total : un tableau de bord `
      + `et des vues ${formatList(views)}.`,
    );

    const extra = changes.filter((c) => c.kind === 'theme' || c.kind === 'domain');
    if (extra.length) {
      lines.push('');
      lines.push(extra.map((c) => `- ${c.message}`).join('\n'));
    }

    lines.push('');
    lines.push("Dites-moi ce que vous voulez ajuster : champs, tables, vues ou couleurs.");
    return lines.join('\n');
  }

  /** Redige la reponse apres une modification. */
  #replyForChanges(changes, fallback) {
    const meaningful = changes.filter((c) => c.kind !== 'noop');
    if (!meaningful.length) {
      const noop = changes.find((c) => c.kind === 'noop');
      return noop ? noop.message : fallback;
    }
    return meaningful.map((c) => `- ${c.message}`).join('\n');
  }

  /** Repond a une question sans modifier l'application. */
  #answerQuestion(text, spec) {
    const lower = text.toLowerCase();

    if (/\b(qui es tu|qui êtes|what are you|quel modele|quel modèle|which model|openai|chatgpt|gpt|claude|gemini|mistral)\b/.test(lower)) {
      return [
        `Je suis le moteur **${ENGINE_NAME}** v${ENGINE_VERSION}.`,
        '',
        "Je suis totalement independant : je n'utilise aucun modele d'IA tiers et je ne fais aucun appel reseau. Mon raisonnement repose sur mes propres composants — analyse linguistique FR/EN, base de connaissance metier, planificateur et generateur de code — tous embarques dans cette application.",
        '',
        `Ma base couvre actuellement ${BLUEPRINTS.length} domaines metier.`,
      ].join('\n');
    }

    if (/\b(que peux tu|que sais tu|what can you|capacites|capacités|aide|help)\b/.test(lower)) {
      return [
        'Voici ce que je sais faire :',
        '- **Creer une application complete** a partir d\'une simple description.',
        '- **Ajouter / supprimer** des tables et des champs.',
        '- **Ajouter des vues** : liste, kanban, calendrier, galerie, tableau de bord.',
        '- **Changer le theme** (couleur, mode clair/sombre, arrondis).',
        '- **Generer des donnees d\'exemple** coherentes.',
        '- **Exporter le code source** : SQL, API Express, composants React, types TypeScript.',
      ].join('\n');
    }

    if (spec?.entities?.length) {
      if (/\b(combien|how many)\b/.test(lower)) {
        const total = spec.entities.reduce((sum, e) => sum + e.fields.length, 0);
        return `**${spec.name}** compte ${spec.entities.length} table(s), ${total} champs et ${spec.pages.length} page(s).`;
      }
      const lines = [`Voici la structure actuelle de **${spec.name}** :`];
      for (const entity of spec.entities) {
        lines.push(`- **${entity.labelPlural}** (${entity.views.join(', ')}) : ${entity.fields.map((f) => `${f.label} (${f.type})`).join(', ')}`);
      }
      return lines.join('\n');
    }

    return "Decrivez l'application souhaitee et je la construis. Exemple : « un CRM pour suivre mes clients et mes factures ».";
  }

  /** Repond quand l'intention reste incertaine, sans jamais rester bloque. */
  #replyForUnknown(text, hasApp) {
    const domain = detectDomain(text);
    if (!hasApp && domain.score > 0) {
      return `Je peux partir sur une application de type **${domain.blueprint.label}**. Confirmez-moi en ecrivant par exemple : « cree une application de ${domain.blueprint.label.toLowerCase()} ».`;
    }
    return hasApp
      ? "Je n'ai pas bien saisi. Vous pouvez me demander d'ajouter un champ, une table, une vue, ou de changer le theme."
      : "Decrivez l'application que vous voulez creer et je m'occupe du reste.";
  }

  /** Propose les prochaines actions pertinentes. */
  #suggest(spec, intent) {
    if (!spec?.entities?.length) {
      return [
        'Cree une application de gestion de clients',
        'Un suivi de projets avec un kanban',
        'Une boutique en ligne avec commandes',
      ];
    }

    const suggestions = [];
    const first = spec.entities[0];

    if (!spec.entities.some((e) => e.views.includes('kanban'))) {
      suggestions.push(`Ajoute une vue kanban sur ${first.labelPlural.toLowerCase()}`);
    }
    if (!spec.entities.some((e) => e.views.includes('calendar'))) {
      suggestions.push('Ajoute une vue calendrier');
    }
    if (intent !== INTENTS.SET_THEME) {
      suggestions.push('Passe le theme en vert et en mode sombre');
    }
    suggestions.push(`Ajoute les champs notes et priorite a ${first.labelPlural.toLowerCase()}`);
    suggestions.push("Genere des donnees d'exemple");

    return suggestions.slice(0, 4);
  }

  /** Genere un jeu de donnees d'exemple pour un spec. */
  sampleData(spec, options) {
    return generateSampleData(spec, options);
  }

  /** Exporte le code source complet de l'application. */
  export(spec) {
    return synthProject(spec);
  }
}

/** Intitule francais d'un type de vue. */
function viewLabel(view) {
  return {
    list: 'liste', kanban: 'kanban', calendar: 'calendrier',
    gallery: 'galerie', detail: 'fiche', form: 'formulaire',
  }[view] || view;
}

/** Enumeration naturelle : « a, b et c ». */
function formatList(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Fabrique pratique. */
export function createEngine(options) {
  return new Base44Engine(options);
}

export {
  INTENTS, classify, detectDomain, Memory, createSpec,
  validateSpec, repairSpec, generateSampleData, synthProject, BLUEPRINTS,
  isFullyIndependent, listProviders, coerceRecord, checkUnique,
};
