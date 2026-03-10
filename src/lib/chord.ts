import RegularChordNotation from './notations/regular';
import RomanChordNotation from './notations/roman';
import { Note } from './note';

export interface ChordNotation {
  /** Name of the notation */
  name: { [lang: string]: string };
  /** Whether this notation depends on the key */
  depKey: boolean;
  /** Parse a chord.
   *  @param s the chord as a trimmed string
   *  @param key the current key (scale major assumed)
   * */
  parse?(s: string, key: string): Chord | string | undefined;
  display?(chord: Chord, key: string): string;
}

export class Chord {
  base: Note;
  notes: Note[];

  constructor(base: Note, notes: Note[]) {
    this.base = base;
    this.notes = notes;
  }

  getNotes(): Note[] {
    const base = this.base.clone();
    base.octave = 2;
    return [base, ...this.notes]
  }
}

export function formatChordNotes(notes: Note[]): string {
  return notes.map(n => n.toString()).join(', ');
}

export const NOTATIONS: ChordNotation[] = [new RegularChordNotation, new RomanChordNotation];
