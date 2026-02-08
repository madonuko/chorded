import { type Chord, Chord as ChordClass } from './chord';

export interface ParsedChord {
  chord: Chord | null;
  duration: number;
  isRest: boolean;
  isBar: boolean;
}

export interface ParsedInput {
  bars: ParsedChord[][];
  rawInput: string;
  timeSignature: { numerator: number; denominator: number };
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export function parseTimeSignature(str: string): TimeSignature {
  const match = str.trim().match(/^(\d+)\/(\d+)$/);
  if (match) {
    return { numerator: parseInt(match[1]), denominator: parseInt(match[2]) };
  }
  return { numerator: 4, denominator: 4 };
}

export function getBeatDuration(timeSignature: TimeSignature): number {
  return timeSignature.denominator / 4;
}

export function parseInput(input: string, timeSignature?: TimeSignature): ParsedInput {
  const ts = timeSignature ?? { numerator: 4, denominator: 4 };
  const normalizedInput = input.replace(/\n/g, ' ');
  const tokens = normalizedInput.split(/\s+/).filter(t => t.length > 0);

  const bars: ParsedChord[][] = [];
  let currentBar: ParsedChord[] = [];
  let lastChord: ParsedChord | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '|') {
      if (currentBar.length > 0) {
        bars.push(currentBar);
      }
      currentBar = [];
      lastChord = null;
      continue;
    }

    if (token === '_') {
      lastChord = {
        chord: null,
        duration: getBeatDuration(ts),
        isRest: true,
        isBar: false
      };
      currentBar.push(lastChord);
      continue;
    }

    let duration = getBeatDuration(ts);
    let chordToken = token;

    if (token.includes('~')) {
      const tildes = (token.match(/~/g) || []).length;
      duration = getBeatDuration(ts) * (1 + tildes * 0.5);
      chordToken = token.replace(/~/g, '');
    }

    const chord = ChordClass.parse(chordToken);
    const parsed: ParsedChord = {
      chord,
      duration,
      isRest: false,
      isBar: false
    };

    if (chord && lastChord && chord.base.toString() === lastChord.chord?.base.toString()) {
      lastChord.duration += duration;
    } else {
      lastChord = parsed;
      currentBar.push(parsed);
    }
  }

  if (currentBar.length > 0) {
    bars.push(currentBar);
  }

  return { bars, rawInput: input, timeSignature: ts };
}

export function getTotalDuration(bars: ParsedChord[][]): number {
  return bars.reduce((sum, bar) => sum + bar.reduce((s, c) => s + c.duration, 0), 0);
}

export function formatDuration(duration: number): string {
  const beats = duration;
  if (beats === 1) return '1 beat';
  if (beats === 1.5) return '1½ beats';
  if (Number.isInteger(beats)) return `${beats} beats`;
  return `${beats} beats`;
}
