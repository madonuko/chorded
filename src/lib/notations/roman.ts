import { Chord, type ChordNotation } from '../chord';
import type { Note } from '../note';
import { semitonesFromAccidentals } from '../parseutil';
import RegularChordNotation from './regular';

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

  parse(s: string, key: Note): Chord | string | undefined {
    let { semi, s: remain } = this.parseRoman(s.toUpperCase());
    if (semi === undefined) return;
    remain = s.slice(s.length - remain.length);
    const end = remain.split('').findIndex(ch => !'#♯b♭♮'.includes(ch));
    semi += semitonesFromAccidentals(remain.slice(0, end));
    const base = key.transpose(semi);
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

  display(chord: Chord, key: Note): string {
    return this.showNotes(['I', 'I♯', 'II', 'III♭', 'III', 'IV', 'V♭', 'V', 'V♯', 'VI', 'VII♭', 'VII'][chord.base.diff12(key)], chord);
  }
}
