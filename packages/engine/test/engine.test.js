import test from 'node:test';
import assert from 'node:assert/strict';

import { Base44Engine, INTENTS, isFullyIndependent } from '../src/index.js';
import { classify } from '../src/nlu/intent.js';
import { detectDomain, extractFields, extractTheme } from '../src/nlu/extract.js';
import { inferFieldType } from '../src/knowledge/fieldTypes.js';
import { validateSpec } from '../src/planner/spec.js';
import { generateSampleData } from '../src/knowledge/sampleData.js';
import { synthProject } from '../src/synth/index.js';

test('le moteur est totalement independant : aucun fournisseur externe', () => {
  assert.equal(isFullyIndependent(), true);
  const engine = new Base44Engine();
  const id = engine.identity();
  assert.equal(id.independent, true);
  assert.equal(id.externalCalls, 0);
  assert.equal(id.provider, 'native');
});

test('classification : creation d application', () => {
  const { intent } = classify('cree une application de gestion de clients', { hasApp: false });
  assert.equal(intent, INTENTS.CREATE_APP);
});

test('classification : ajout de champ sur une app existante', () => {
  const { intent } = classify('ajoute les champs email et telephone', { hasApp: true });
  assert.equal(intent, INTENTS.ADD_FIELD);
});

test('classification : question', () => {
  const { intent } = classify('que peux tu faire ?', { hasApp: true });
  assert.equal(intent, INTENTS.QUESTION);
});

test('detection de domaine : CRM', () => {
  const { blueprint } = detectDomain('je veux suivre mes clients et mes opportunites de vente');
  assert.equal(blueprint.id, 'crm');
});

test('detection de domaine : gestion de taches', () => {
  const { blueprint } = detectDomain('un outil de suivi de projets et de taches avec un kanban');
  assert.equal(blueprint.id, 'tasks');
});

test('inference de type de champ', () => {
  assert.equal(inferFieldType('Email'), 'email');
  assert.equal(inferFieldType('Telephone'), 'phone');
  assert.equal(inferFieldType('Prix'), 'currency');
  assert.equal(inferFieldType('Date de naissance'), 'date');
  assert.equal(inferFieldType('Statut'), 'select');
  assert.equal(inferFieldType('Description'), 'longtext');
  assert.equal(inferFieldType('Quantite'), 'number');
  assert.equal(inferFieldType('Photo'), 'image');
  assert.equal(inferFieldType('Nom'), 'text');
});

test('extraction de champs depuis une phrase', () => {
  const fields = extractFields('avec les champs nom, email et telephone');
  const labels = fields.map((f) => f.label.toLowerCase());
  assert.ok(labels.includes('nom'));
  assert.ok(labels.includes('email'));
  assert.ok(labels.includes('telephone'));
  assert.equal(fields.find((f) => f.label.toLowerCase() === 'email').type, 'email');
});

test('extraction de theme', () => {
  const theme = extractTheme('mets le theme en vert et en mode sombre');
  assert.equal(theme.mode, 'dark');
  assert.equal(theme.primary, '#16a34a');
});

test('creation complete d une application CRM', () => {
  const engine = new Base44Engine();
  const result = engine.chat('cree une application de gestion de clients avec un suivi des opportunites');

  assert.equal(result.intent, INTENTS.CREATE_APP);
  assert.ok(result.spec.entities.length >= 2, 'plusieurs entites attendues');
  assert.ok(result.spec.pages.length >= 3, 'plusieurs pages attendues');
  assert.ok(result.spec.pages.some((p) => p.type === 'dashboard'), 'un tableau de bord est attendu');
  assert.equal(validateSpec(result.spec).filter((i) => i.level === 'error').length, 0);
  assert.match(result.reply, /Modele de donnees/);
});

test('conversation multi-tours : creer puis enrichir', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree une application de suivi de projets');
  const spec = created.spec;
  const entityCount = spec.entities.length;

  const added = engine.chat('ajoute une table Fournisseurs', spec);
  assert.equal(added.spec.entities.length, entityCount + 1);
  assert.ok(added.spec.entities.some((e) => /fournisseur/i.test(e.label)));

  const withField = engine.chat('ajoute les champs email et telephone', added.spec);
  const allFields = withField.spec.entities.flatMap((e) => e.fields.map((f) => f.name));
  assert.ok(allFields.includes('email'));

  const themed = engine.chat('passe le theme en violet', withField.spec);
  assert.equal(themed.spec.theme.primary, '#7c3aed');
});

test('ajout d une vue kanban cree le champ statut manquant', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree une application de bibliotheque');
  const result = engine.chat('ajoute une vue kanban sur les ouvrages', created.spec);

  const entity = result.spec.entities.find((e) => e.views.includes('kanban'));
  assert.ok(entity, 'une entite doit porter la vue kanban');
  assert.ok(entity.display.statusField, 'un champ statut doit exister');
});

test('suppression d un champ', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree un crm');
  const target = created.spec.entities[0];
  const field = target.fields.find((f) => f.type === 'phone') || target.fields[1];

  const result = engine.chat(`supprime le champ ${field.label}`, created.spec);
  const still = result.spec.entities
    .flatMap((e) => e.fields)
    .some((f) => f.name === field.name);
  assert.equal(still, false);
});

test('renommage d une entite', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree une application de gestion de clients');
  const result = engine.chat('renomme Clients en Adherents', created.spec);
  assert.ok(result.spec.entities.some((e) => /adherent/i.test(e.label)));
});

test('le spec reste valide apres suppression d une entite referencee', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree un crm');
  const result = engine.chat('supprime l entite Clients', created.spec);
  const errors = validateSpec(result.spec).filter((i) => i.level === 'error');
  assert.equal(errors.length, 0);
  // Les relations orphelines ont ete converties en texte.
  const orphans = result.spec.entities
    .flatMap((e) => e.fields)
    .filter((f) => f.type === 'relation' && !result.spec.entities.some((e) => e.name === f.ref));
  assert.equal(orphans.length, 0);
});

test('les donnees d exemple respectent les types et les relations', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree un crm complet');
  const data = generateSampleData(spec, { perEntity: 5 });

  for (const entity of spec.entities) {
    assert.equal(data[entity.name].length, 5);
    for (const row of data[entity.name]) {
      for (const field of entity.fields) {
        const value = row[field.name];
        if (field.type === 'boolean') assert.equal(typeof value, 'boolean');
        if (field.type === 'number' || field.type === 'currency') assert.equal(typeof value, 'number');
        if (field.type === 'multiselect') assert.ok(Array.isArray(value));
        if (field.type === 'select' && field.options?.length) {
          assert.ok(field.options.includes(value));
        }
        if (field.type === 'relation' && field.ref) {
          assert.ok(data[field.ref].some((r) => r.id === value), 'la relation doit pointer vers un enregistrement reel');
        }
      }
    }
  }
});

test('le jeu de donnees est deterministe a graine egale', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree une application de stock');
  const a = generateSampleData(spec, { perEntity: 3, seed: 7 });
  const b = generateSampleData(spec, { perEntity: 3, seed: 7 });
  assert.deepEqual(a, b);
});

test('export du code source', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree une application de facturation');
  const files = engine.export(spec);

  assert.ok(files['schema.sql'].includes('CREATE TABLE'));
  assert.ok(files['server.js'].includes('express'));
  assert.ok(files['types.ts'].includes('export interface'));
  assert.ok(files['README.md'].includes(spec.name));
  for (const entity of spec.entities) {
    assert.ok(files[`src/pages/${entity.name}List.jsx`], `liste manquante pour ${entity.name}`);
    assert.ok(files[`src/pages/${entity.name}Form.jsx`], `formulaire manquant pour ${entity.name}`);
  }
});

test('le code React genere est syntaxiquement plausible', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree une application de gestion de taches');
  const files = synthProject(spec);
  const list = files[`src/pages/${spec.entities[0].name}List.jsx`];

  // Equilibre des accolades et parentheses : garde-fou contre les templates casses.
  const open = (list.match(/\{/g) || []).length;
  const close = (list.match(/\}/g) || []).length;
  assert.equal(open, close);
  assert.ok(list.includes('export default function'));
});

test('les qualificatifs ne deviennent pas des tables', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat(
    'cree une application de gestion de clients avec un suivi des factures et un theme vert',
  );
  const labels = spec.entities.map((e) => e.label.toLowerCase());

  // « theme vert » decrit l'apparence, « suivi des factures » designe Factures.
  assert.ok(!labels.some((l) => /vert|theme/.test(l)), `table parasite : ${labels.join(', ')}`);
  assert.ok(!labels.some((l) => /^suivi/.test(l)), `table parasite : ${labels.join(', ')}`);
  assert.ok(labels.includes('facture'), 'la table Factures doit exister');
  assert.equal(spec.theme.primary, '#16a34a');
});

test('une vue demandee ne cree pas de table homonyme', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('je veux une appli de suivi de projets avec un kanban');
  const labels = spec.entities.map((e) => e.label.toLowerCase());

  assert.ok(!labels.some((l) => /kanban/.test(l)), `table parasite : ${labels.join(', ')}`);
  assert.ok(spec.entities.some((e) => e.views.includes('kanban')), 'la vue kanban doit etre active');
});

test('un concept exprime en anglais ne duplique pas la table francaise', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('build an app to manage employees and their leave requests');
  const labels = spec.entities.map((e) => e.label.toLowerCase());

  assert.ok(!labels.includes('employee'), 'Employe et Employee ne doivent pas coexister');
  assert.ok(!labels.some((l) => /leave/.test(l)), 'Conge et Leave ne doivent pas coexister');
  assert.ok(spec.entities.length >= 2);
});

test('des entites inventees remplacent le modele generique', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree une application avec des voitures, des chauffeurs et des trajets');
  const labels = spec.entities.map((e) => e.label.toLowerCase());

  assert.ok(!labels.includes('element'), 'le modele de repli doit disparaitre');
  assert.ok(labels.includes('voiture'));
  assert.ok(labels.includes('chauffeur'));
  assert.ok(labels.includes('trajet'));
});

test('le nom de l application est coupe aux complements', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat(
    'cree une application de gestion de clients avec un suivi des factures et un theme vert',
  );
  assert.equal(spec.name, 'Gestion de clients');
});

test('une vue s applique a l entite nommee dans la phrase', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree une application de gestion de clients avec un suivi des factures');
  const result = engine.chat('ajoute une vue kanban sur les factures', spec);

  const withKanban = result.spec.entities.filter((e) => e.views.includes('kanban'));
  assert.equal(withKanban.length, 1);
  assert.match(withKanban[0].label, /facture/i);
});

test('une entite ajoutee est nommee au singulier, sans le verbe', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree un crm');
  const result = engine.chat('ajoute une table Fournisseurs', spec);

  const added = result.spec.entities.find((e) => /fournisseur/i.test(e.label));
  assert.ok(added, 'la table doit exister');
  assert.equal(added.label, 'Fournisseur');
  assert.equal(added.labelPlural, 'Fournisseurs');
});

test('l entite cible d un ajout de champ n est pas prise pour un champ', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree un crm');
  const withEntity = engine.chat('ajoute une table Fournisseurs', created.spec);
  const result = engine.chat('ajoute les champs email et telephone aux fournisseurs', withEntity.spec);

  const target = result.spec.entities.find((e) => /fournisseur/i.test(e.label));
  const names = target.fields.map((f) => f.name);
  assert.ok(names.includes('email'));
  assert.ok(names.includes('telephone'));
  assert.ok(!names.some((n) => /fournisseur/.test(n)), `champ parasite : ${names.join(', ')}`);

  // Les champs ne doivent pas avoir atterri sur la mauvaise entite.
  const client = result.spec.entities.find((e) => /client/i.test(e.label));
  assert.equal(client.fields.filter((f) => f.name === 'email').length, 1);
});

test('une demande vide ne casse pas le moteur', () => {
  const engine = new Base44Engine();
  const result = engine.chat('');
  assert.equal(result.spec, null);
  assert.ok(result.reply.length > 0);
});

test('une demande incomprehensible reste sans effet destructeur', () => {
  const engine = new Base44Engine();
  const created = engine.chat('cree un crm');
  const before = JSON.stringify(created.spec);
  const result = engine.chat('xyzzy qwerty blurb', created.spec);
  assert.equal(JSON.stringify(result.spec), before);
  assert.ok(result.reply.length > 0);
});

test('la memoire conserve le fil de la conversation', () => {
  const engine = new Base44Engine();
  engine.chat('cree un crm');
  engine.chat('ajoute un champ notes');
  assert.ok(engine.memory.turns.length >= 4);
  assert.ok(engine.memory.recentUserMessages(2).length === 2);
});

test('le moteur decrit son identite quand on l interroge', () => {
  const engine = new Base44Engine();
  const { spec } = engine.chat('cree un crm');
  const result = engine.chat('quel modele utilises tu ?', spec);
  assert.match(result.reply, /independant/i);
});
