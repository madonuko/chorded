import type { Chord } from './chord';

export interface ParsedChord {
  chord: Chord | null;
  duration: number;
  isRest: boolean;
  isBar: boolean;
}

export interface ParsedInput {
  bars: ParsedChord[][];
  rawInput: string;
}
