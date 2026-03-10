import { Chord, type ChordNotation } from '../chord';
import { Note } from '../note';
import { semitonesFromAccidentals } from '../parseutil';
import RegularChordNotation from './regular';

const flatKeys = new Set(['F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭']);

const normalizeKeyName = (key: string): string => {
  if (!key) return key;
  const letter = key[0]?.toUpperCase() ?? '';
  const rest = key.slice(1).replace(/#/g, '♯').replace(/b/g, '♭');
  return `${letter}${rest}`;
};

export default class RomanChordNotation extends RegularChordNotation implements ChordNotation {
  name = {
    "en": "Roman Numerals",
    "ja": "ローマ",
  };
  depKey = true;

  parseRoman(s: string): { semi?: number, s: string } {
    if (s[0] === 'I') {
      if (s[1] === 'V') return { semi: 5, s: s.slice(2) };
      if (s[1] === 'I') {
        if (s[2] === 'I') return { semi: 4, s: s.slice(3) };
        return { semi: 2, s: s.slice(2) };
      }
      return { semi: 0, s: s.slice(1) };
    }
    if (s[0] === 'V') {
      if (s[1] === 'I') {
        if (s[2] === 'I') return { semi: 11, s: s.slice(3) };
        return { semi: 9, s: s.slice(2) };
      }
      return { semi: 7, s: s.slice(1) };
    }
    return { s };
  }

  parse(s: string, key: string): Chord | string | undefined {
    let { semi, s: remain } = this.parseRoman(s.toUpperCase());
    if (semi === undefined) return;
    remain = s.slice(s.length - remain.length);
    const end = remain.split('').findIndex(ch => !'#♯b♭♮'.includes(ch));
    semi += semitonesFromAccidentals(remain.slice(0, end));
    const base = Note.parse(key)!.transpose(semi);
    let ret = this.hdlNotes(remain.slice(end));
    if (typeof ret === 'string') return ret;
    if ('iv'.includes(s[0])) ret = ret.map(n => n === 4 ? 3 : n);
    const notes = ret.map(n => {
      const note = base.transpose(n).toNormalized();
      note.octave += 2;
      return note;
    });
    return new Chord(base, notes);
  }

  display(chord: Chord, key: string): string {
    const normalizedKey = normalizeKeyName(key);
    const keyNote = Note.parse(normalizedKey) ?? Note.parse(key) ?? chord.base;
    const preferFlats = flatKeys.has(normalizedKey);
    const lookup = preferFlats
      ? ['I', 'II♭', 'II', 'III♭', 'III', 'IV', 'V♭', 'V', 'VI♭', 'VI', 'VII♭', 'VII']
      : ['I', 'I♯', 'II', 'III♭', 'III', 'IV', 'V♭', 'V', 'V♯', 'VI', 'VII♭', 'VII'];
    return this.showNotes(lookup[chord.base.diff12(keyNote)], chord);
  }
}
