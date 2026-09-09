/**
 * Validation des enregistrements, derivee du spec d'une entite.
 *
 * Vit dans le moteur (et non dans le serveur) pour que l'API HTTP et le mode
 * autonome navigateur appliquent exactement les memes regles.
 */

/**
 * Valide et normalise un enregistrement d'apres le spec de l'entite.
 * @returns {{values: object, errors: string[]}}
 */
export function coerceRecord(entity, body = {}, { partial = false } = {}) {
  const values = {};
  const errors = [];

  for (const field of entity.fields) {
    // Champ absent : en creation il peut manquer a l'appel, en mise a jour
    // partielle son absence signifie simplement « ne pas toucher ».
    if (!Object.hasOwn(body, field.name)) {
      if (!partial && field.required) errors.push(`${field.label} est obligatoire.`);
      continue;
    }

    const raw = body[field.name];
    const empty = raw === null || raw === undefined || raw === '';

    if (empty) {
      if (field.required && !partial) errors.push(`${field.label} est obligatoire.`);
      values[field.name] = field.type === 'multiselect' ? [] : '';
      continue;
    }

    switch (field.type) {
      case 'number':
      case 'currency':
      case 'percent':
      case 'rating': {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errors.push(`${field.label} doit etre un nombre.`);
        } else {
          values[field.name] = num;
        }
        break;
      }

      case 'boolean':
        values[field.name] = raw === true || raw === 'true' || raw === 1 || raw === '1';
        break;

      case 'select':
        if (field.options?.length && !field.options.includes(String(raw))) {
          errors.push(`${field.label} : « ${raw} » n'est pas une valeur autorisee.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'multiselect': {
        const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const invalid = field.options?.length
          ? list.filter((v) => !field.options.includes(v))
          : [];
        if (invalid.length) {
          errors.push(`${field.label} : valeurs non autorisees (${invalid.join(', ')}).`);
        } else {
          values[field.name] = list;
        }
        break;
      }

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) {
          errors.push(`${field.label} : adresse e-mail invalide.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'date':
      case 'datetime':
        if (Number.isNaN(Date.parse(String(raw)))) {
          errors.push(`${field.label} : date invalide.`);
        } else {
          values[field.name] = String(raw);
        }
        break;

      case 'json':
        if (typeof raw === 'object') {
          values[field.name] = raw;
        } else {
          try {
            values[field.name] = JSON.parse(String(raw));
          } catch {
            errors.push(`${field.label} : JSON invalide.`);
          }
        }
        break;

      default:
        values[field.name] = String(raw);
    }
  }

  return { values, errors };
}

/** Verifie les contraintes d'unicite declarees dans le spec. */
export function checkUnique(entity, rows, values, ignoreId = null) {
  const errors = [];
  for (const field of entity.fields.filter((f) => f.unique)) {
    const value = values[field.name];
    if (value === undefined || value === '') continue;
    const clash = rows.some((r) => r.id !== ignoreId && r[field.name] === value);
    if (clash) errors.push(`${field.label} doit etre unique (« ${value} » existe deja).`);
  }
  return errors;
}
