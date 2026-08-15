// ALL-CAPS Italian stop names → the way Italy writes them.
//
// ANM shouts every stop (VIA S. CATERINA DA SIENA, PIAZZA TRIESTE E TRENTO,
// UNIVERSITA') while the street names on the map come from OSM in proper case
// (via Santa Caterina da Siena), and the two sit next to each other. Lowercasing
// is not a `toLowerCase()` away for two reasons: Italian keeps its articles and
// prepositions lowercase INSIDE a name (Trieste e Trento, Ponti Rossi, Largo
// degli Artisti), and it drops accents in capitals — the feed simply does not
// contain the information that UNIVERSITA is Università. What it does contain
// are words that also exist, properly written, in OSM: streets, squares,
// districts, churches, schools. So we build a dictionary of spellings out of
// the OSM extract we already download and rewrite the caps names word by word
// through it, falling back to a rule-based title case for anything unknown.
//
// The trailing apostrophe Italians type instead of a grave accent (UNIVERSITA',
// CITTA') is resolved by the dictionary too; where the dictionary has never
// seen the word, the apostrophe is turned into the grave accent by rule.

const WORD = /[A-Za-zÀ-ÿ']+/g;
const HAS_LOWER = /[a-zà-ÿ]/;
const VOWEL = /[AEIOUÀÈÉÌÒÙ]/;

// Dictionary keys are folded: accents stripped, trailing apostrophe dropped,
// upper case. The feed cannot write UNIVERSITÀ — it writes UNIVERSITA or
// UNIVERSITA' — so the key has to be the accent-free form on BOTH sides,
// otherwise the OSM spelling can never be found.
const fold = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/'$/, '').toUpperCase();

// Last resort for a word the dictionary does not know: Italians type a
// trailing apostrophe where the accent belongs (LIBERTA' = libertà). The grave
// accent is the right guess for every stop name in Naples — the acute only
// shows up in conjunctions (perché) that never head a stop.
const GRAVE = { A: 'à', E: 'è', I: 'ì', O: 'ò', U: 'ù' };
const apostropheAccent = (w) => (w.endsWith("'") && GRAVE[w.slice(-2, -1).toUpperCase()]
  ? w.slice(0, -2) + GRAVE[w.slice(-2, -1).toUpperCase()]
  : w);

// Written in capitals in normal Italian text too. Vowel-less tokens (FS, CTP,
// RFI, SS) need no listing — an Italian word always carries a vowel — so this
// set holds only the vowel-carrying ones.
const ACRONYMS = new Set([
  'ANM', 'EAV', 'ASL', 'IPM', 'INPS', 'INAIL', 'ACI', 'AGIP', 'ENEL', 'RAI',
  'ISTAT', 'IACP', 'IPIA', 'ITIS', 'ITC', 'IPSIA', 'AIAS', 'ARPAC', 'ANAS',
  'CIRA', 'CNR', 'UNINA', 'AORN', 'AOU', 'ASC',  // ASC = ascensore, ANM's public lifts
]);

// Articles, prepositions and connectives Italian never capitalizes mid-name.
const LOWER_WORDS = new Set([
  'DI', 'DE', 'DEL', 'DELLO', 'DELLA', 'DEI', 'DEGLI', 'DELLE', 'DELL',
  'DA', 'DAL', 'DALLO', 'DALLA', 'DAI', 'DAGLI', 'DALLE',
  'A', 'AD', 'AL', 'ALLO', 'ALLA', 'AI', 'AGLI', 'ALLE',
  'IN', 'NEL', 'NELLO', 'NELLA', 'NEI', 'NEGLI', 'NELLE',
  'SU', 'SUL', 'SULLO', 'SULLA', 'SUI', 'SUGLI', 'SULLE',
  'CON', 'PER', 'TRA', 'FRA', 'E', 'ED', 'O', 'OD',
  'IL', 'LO', 'LA', 'I', 'GLI', 'LE', 'UN', 'UNO', 'UNA',
]);

// Roman numerals used in Neapolitan names (Umberto I, Vittorio Emanuele III,
// XX Settembre, IV Novembre). They must never be title-cased into "Iv".
const ROMAN = /^(?:X{0,3})(?:IX|IV|V?I{0,3})$/;

// Dotted abbreviations, tried longest-first while peeling a token from the
// front ("P.ZZA" → "Piazza"). Written out in full and capitalized, the way
// Italian OSM writes the generic term on the base map right next to these
// labels ("Via Toledo", not "via Toledo"). "S." is left short: the feed cannot
// tell San from Santa and neither can we.
// The third field marks an abbreviation that may only be expanded where the
// name STARTS: a bare "V." is Via at the front and Vittorio anywhere else
// ("C.SO V. EMANUELE" is Corso Vittorio Emanuele, not Corso Via Emanuele), so
// mid-name it is left standing as the initial it is.
const ABBR = [
  ['P.ZZA', 'Piazza'], ['P.ZA', 'Piazza'], ['P.TTA', 'Piazzetta'],
  ['V.LE', 'Viale'], ['C.SO', 'Corso'], ['V.CO', 'Vico'], ['V.', 'Via', true],
  ['S.S.', 'SS.'], ['SS.', 'SS.'], ['S.', 'S.'], ['LGO.', 'Largo'],
  ['TRAV.', 'Traversa'], ['CALAT.', 'Calata'], ['GRAD.', 'Gradini'],
];

const title = (w) => w[0].toUpperCase() + w.slice(1).toLowerCase();

export function buildNameDict(osmDocs) {
  const seen = new Map(); // UPPER word → Map(spelling → count)
  for (const doc of osmDocs) {
    for (const e of doc.elements || []) {
      const name = e.tags && e.tags.name;
      if (!name || !HAS_LOWER.test(name)) continue; // caps names teach us nothing
      const words = name.match(WORD) || [];
      // the name-initial word is capitalized whatever it is, so it teaches
      // nothing about case — "Della Rocca" must not outvote the lowercase
      // "della" of "Piazza della Borsa"
      for (const w of words.slice(1)) {
        if (w.length < 3) continue;
        const k = fold(w);
        let m = seen.get(k);
        if (!m) seen.set(k, (m = new Map()));
        m.set(w, (m.get(w) || 0) + 1);
      }
    }
  }
  const dict = new Map();
  for (const [k, m] of seen) {
    let best = null, bestN = -1;
    for (const [w, n] of m) if (n > bestN) { best = w; bestN = n; }
    dict.set(k, best);
  }
  return dict;
}

function word(w, dict) {
  if (!/[A-Za-zÀ-ÿ]/.test(w) || /\d/.test(w)) return w;   // digits, "16A"
  if (ROMAN.test(w) && w.length > 0) return w;            // Umberto I, IV Novembre
  if (ACRONYMS.has(w)) return w;
  if (!VOWEL.test(w)) return w;                           // FS, CTP, RFI
  if (LOWER_WORDS.has(fold(w))) return w.toLowerCase();
  if (w.length >= 3) {
    const d = dict.get(fold(w));
    if (d) return d;                                      // accents live here
  }
  return title(apostropheAccent(w));
}

// Rewrite one name, WORD BY WORD. A name that already carries a lowercase
// letter is left exactly as it is — some ANM stops are written properly and
// must not be touched.
export function italianTitleCase(name, dict) {
  if (!name || !/[A-Z]/.test(name) || HAS_LOWER.test(name)) return name;
  let firstDone = false;
  // the underscore is a separator here, not a letter: ANM names its public
  // lifts CHIAIA_ASC1, SANITA_ASC — each half is a word of its own
  return name.split(/(\s+|[()\-–—,/"«»_]+)/).map((tok) => {
    if (!/[A-Za-zÀ-ÿ]/.test(tok)) {
      if (/\d/.test(tok)) firstDone = true;               // "1 MAGGIO" starts with a number
      return tok.includes('_') ? tok.replace(/_/g, ' ') : tok;
    }
    let out = '';
    let rest = tok;
    let abbrStart = false;
    // peel dotted abbreviations and initials off the front
    for (;;) {
      const hit = ABBR.find(([k, , startOnly]) => rest.startsWith(k) && !(startOnly && firstDone));
      if (hit) {
        if (!out) abbrStart = hit[1][0] !== hit[1][0].toUpperCase();
        out += hit[1];
        rest = rest.slice(hit[0].length);
        continue;
      }
      const m = rest.match(/^([A-Z])\./);                 // person's initial
      if (m) { out += m[0]; rest = rest.slice(m[0].length); continue; }
      break;
    }
    // "V.CATERINA" is written without a space; the expansion needs one back
    if (out && rest && /[A-Za-zÀ-ÿ]$/.test(out)) out += ' ';
    if (rest) {
      // an elided article carries its own case: DELL'ARENA → dell'Arena
      out += rest.split(/(?<=')/).map((p, i) => (i === 0 && p.endsWith("'")
        ? (LOWER_WORDS.has(fold(p)) ? p.toLowerCase() : word(p, dict))
        : word(p, dict))).join('');
    }
    if (!firstDone) {
      firstDone = true;
      // The first word of a name is capitalized whatever it is. Anchored: only
      // a LEADING lowercase letter is raised (possibly behind an opening
      // bracket or quote), never one in the middle of a word the dictionary
      // already spelled correctly.
      if (!abbrStart) out = out.replace(/^([^A-Za-zÀ-ÿ]*)([a-zà-ÿ])/, (m, p, c) => p + c.toUpperCase());
    }
    return out;
  }).join('')
    // the feed types an elision with a space behind it ("CENSI DELL' ARCO",
    // "MONTE SANT' ANGELO"); Italian writes it closed
    .replace(/([A-Za-zÀ-ÿ])'\s+/g, "$1'")
    .replace(/\s{2,}/g, ' ').trim();
}
