import { Note } from './note';

export type ScaleType = 'major' | 'minor' | 'melodic-minor' | 'harmonic-minor';

export interface Scale {
  root: Note;
  type: ScaleType;
  notes: string[];
}

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11]
};

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteFromIndex(index: number): string {
  return NOTES[((index % 12) + 12) % 12];
}

export function createScale(root: string, type: ScaleType = 'minor'): Scale {
  const normalizedRoot = root.replace('♭', 'b').replace('♯', '#');
  const rootIndex = NOTES.indexOf(normalizedRoot);
  const intervals = SCALE_INTERVALS[type];
  const notes: string[] = intervals.map(interval => getNoteFromIndex(rootIndex + interval));
  return { root: new Note(root), type, notes };
}

export function getScaleByName(name: string): Scale | undefined {
  const normalized = name.replace('♭', 'b').replace('♯', '#');
  const rootIndex = NOTES.indexOf(normalized);
  if (rootIndex >= 0) {
    return createScale(normalized, 'minor');
  }
  return undefined;
}

export function getKeyNotes(key: string): string[] {
  const scale = getScaleByName(key);
  return scale?.notes ?? [];
}

export function getDegreeNotes(scale: Scale, degree: number): string[] {
  const normalizedDegree = ((degree - 1) % 7 + 7) % 7 + 1;
  const note = scale.notes[normalizedDegree - 1];
  return [note];
}

export function scaleDegreeToNote(scale: Scale, degree: number): string {
  const normalizedDegree = ((degree - 1) % 7 + 7) % 7 + 1;
  return scale.notes[normalizedDegree - 1];
}
