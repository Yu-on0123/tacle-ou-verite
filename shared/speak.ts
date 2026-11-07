/**
 * Couche de formulation : adapte le texte d'une carte à ceux qui jouent.
 *
 * Dans les cartes :
 *   {a|b}             a si vous êtes deux, b si vous êtes plus
 *   [[a|b]]           a pour un garçon, b pour une fille (celui qui reçoit la carte)
 *   {cible}           le prénom d'un autre joueur tiré au sort (l'autre, en duo)
 *   mis(e), doux(ce)… s'accordent au sexe de celui qui reçoit la carte
 * En duo, « la personne de ton choix », « quelqu'un d'ici », « chaque personne »
 * deviennent le prénom de l'autre joueur.
 */
import type { Player } from './types';

export interface SpeakCtx {
  who: Pick<Player, 'sex'>;
  /** Les autres joueurs (sans celui qui reçoit la carte). */
  others: Pick<Player, 'name'>[];
  /** Un prénom pour {cible} (par défaut le premier des autres). */
  target?: string;
}

/** Reste de vocabulaire qui n'a de sens qu'à plusieurs, après adaptation au duo. */
export const GROUP_ONLY =
  /(?<!\p{L})(les autres|tout le monde|le groupe|du groupe|ici|salon|chacun|chacune|collectif|présent(?:e|s|es)?|voisin|voisine|à ta gauche|à ta droite)(?!\p{L})/iu;

const de = (name: string): string => (/^[aeiouyàâéèêëîïôöûüh]/i.test(name) ? `d’${name}` : `de ${name}`);

function genderize(text: string, sex: 'M' | 'F'): string {
  const f = sex === 'F';
  let t = text.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, (_m, m: string, fem: string) => (f ? fem : m));
  t = t.replace(/(\p{L}+)\((e|ée|se|ce)\)/gu, (_m, base: string, suf: string) => {
    if (!f) return base;
    if (suf === 'se') return base.replace(/x$/, '') + 'se';
    if (suf === 'ce') return base.replace(/x$/, '') + 'ce';
    return base + 'e';
  });
  return t;
}

export function speak(text: string, ctx: SpeakCtx): string {
  const duo = ctx.others.length === 1;
  const other = ctx.others[0]?.name ?? '';
  let t = text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_m, a: string, b: string) => (duo ? a : b));
  t = t.replace(/\{cible\}/g, ctx.target ?? other);
  t = genderize(t, ctx.who.sex);
  if (duo && other) {
    t = t
      .replace(/\b(?:de|d’) (?:la personne de ton choix|quelqu’un d’ici|chaque personne présente|chaque personne|chaque fille présente|chaque fille|tout le monde)/gi, de(other))
      .replace(/(?:la personne de ton choix|quelqu’un d’ici|chaque personne présente|chaque personne|chaque fille présente|chaque fille|tout le monde)/gi, other);
  }
  // En groupe, « quelqu’un d’ici » se lit « quelqu’un ici » : « ici » désigne le groupe sans ambiguïté.
  if (!duo) t = t.replace(/(?<!\p{L})d’ici(?!\p{L})/giu, 'ici');
  return t.replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Vrai si le texte ne se dit pas à deux. */
export function groupOnly(text: string): boolean {
  const asDuo = speak(text, { who: { sex: 'M' }, others: [{ name: 'Alex' }] });
  return GROUP_ONLY.test(asDuo);
}

/** Vrai si le texte a une version spéciale « à deux ». */
export function hasDuoVariant(text: string): boolean {
  return /\{[^{}|]*\|[^{}|]*\}/.test(text);
}
