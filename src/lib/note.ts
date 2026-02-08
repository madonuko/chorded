// vi: ts=2 sw=2

import { csmNote, semitonesFromAccidentals } from "./parseutil";

/*
 * We define the value of C = 0, C# = 1, ...
 *
 * A4 = 440Hz
 */
export class Note {
  value: number = NaN;
  orig: string;
  octave: number;

  constructor(value: number, orig: string, octave: number = 4) {
    this.value = value; this.orig = orig; this.octave = octave;
  }

  static parse(s: string, octave: number = 4): Note | undefined {
    const { note, remain } = csmNote(s, octave);
    if (remain.length) return;
    return note;
  }

  toString(): string {
    return this.orig;
  }

  toFrequency(): number {
    if (isNaN(this.value)) return NaN;
    const A4 = 440;
    const semitonesFromA4 = (this.octave - 4) * 12 + (this.value - 9);
    return A4 * Math.pow(2, semitonesFromA4 / 12);
  }

  transpose(semitones: number): Note {
    const octaveChange = Math.floor((this.value + semitones) / 12);
    const newOctave = this.octave + octaveChange;
    const add = semitones > 0 ? '♯'.repeat(semitones) : '♭'.repeat(-semitones);
    const value = (this.value + semitones) % 12;

    return new Note(value > 0 ? value : value + 12, this.orig + add, newOctave);
  }

  static fromInterval(root: Note, interval: string): Note | undefined {
    let si = '', i = 0;
    while ('0' <= interval[i] && interval[i] <= '9') si += interval[i++];
    interval = interval.slice(i);
    if (interval.split('').some(ch => !'#♯b♭♮'.includes(ch))) return;
    return root.transpose(parseInt(si) * 2 + semitonesFromAccidentals(interval));
  }

  clone(): Note {
    return new Note(this.value, this.orig, this.octave);
  }

  norm(): string {
    return "CDEFGAB"[this.value / 2] + "♯".repeat(this.value % 2);
  }

  /** calculate semitones for (this - other) */
  minus(other: Note) {
    return this.value - other.value;
  }
}

export function normalizeNoteName(note: string): string | undefined {
  return Note.parse(note)?.norm();
}
