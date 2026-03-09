// vi: ts=2 sw=2
import { Note } from "./note";


export type ModArg = { s: string, notes: number[] };

export const semitonesFromAccidentals = (s: string) => {
  const natural = s.lastIndexOf('♮');
  if (natural !== -1) s = s.slice(natural + 1);
  return count(s, '♯#') - count(s, 'b♭');
}

/** Count number of occurences (of any character in `c`) in `s` (ASCII-only) */
export const count = (s: string, c: string) => s.split('').filter(ch => c.includes(ch)).length;

export const chbetween = (ch: string, left: string, right: string) => left <= ch && ch <= right;

/**
 * Try to consume `s` to obtain a note.
 * @param s the string to consume
 * @param octave specify potential octave of note
 */
export function csmNote(s: string, octave: number = 4): { note?: Note, remain: string } {
  if (!chbetween(s[0], 'A', 'G')) return { remain: s };
  const base = "C D EF G A B".indexOf(s[0]);
  let end = s.slice(1).split('').findIndex(ch => !'#♯b♭♮'.includes(ch));
  end = end === -1 ? s.length : end + 1;
  let value = base + semitonesFromAccidentals(s.slice(1, end));
  while (value < 0) {
    value += 12;
    octave -= 1;
  }
  return {
    note: new Note(value, s.slice(0, end), octave),
    remain: s.slice(end),
  };
}

export const numNoteLookup = [0, 2, 4, 5, 7, 9, 11];

export function csmNumNote(s: string): { semi?: number, remain: string } {
  const i = s.split('').findIndex(ch => !'#♯b♭♮'.includes(ch));
  if (i === -1 || s[i] === '0') return { remain: s };
  let j = s.slice(i).split('').findIndex(ch => !chbetween(ch, '0', '9'));
  if (j === 0) return { remain: s };
  j = j === -1 ? s.length : i + j;
  const num = parseInt(s.slice(i, j)) - 1;
  numNoteLookup[num % 7] + 12 * Math.floor(num / 7);
  const semi = semitonesFromAccidentals(s.slice(0, i)) + parseInt(s.slice(i, j)) * 2 - 2;
  if (isNaN(semi)) return { remain: s };
  return { semi, remain: s.slice(j) };
}

/**
 * Consume numnotes inside (parentheses)
 *
 * if semi === [], there are syntax errors inside the parentheses.
 *
 * @param s the string to consume
 */
export function csmNumNotes(s: string, opts?: { M7?: boolean, must_paren?: boolean }): { semi?: number[], remain: string } {
  // TODO: impl M7
  if (s[0] !== '(') {
    if (opts?.must_paren) return { remain: s };
    const { semi, remain } = csmNumNote(s);
    if (remain.length) return { remain };
    return { semi: [semi!], remain }
  }
  const semi = [];
  for (let i = 1; ; ++i) {
    const { semi: lastsemi, remain } = csmNumNote(s);
    if (!lastsemi) return { semi: [], remain };
    semi.push(lastsemi);
    s = remain.trimStart();
    if (s[0] === ',') s = s.slice(1).trimStart();
    else if (s[0] === ')') break;
  }
  return { semi, remain: s.slice(1) };
}

export function csmTension(s: string, opts?: { kw_ext?: boolean }): { semi?: number[], remain: string } {
  // TODO: impl kw_ext
  // FIX: edge case 711 713 913
  // TODO: 6th?
  const new_s = s.replace(/^[Mm]aj|△|Δ/, 'M');
  if (new_s[0] == 'M') {
    let i = 0;
    while (chbetween(new_s[++i], '0', '9'))
      if (i > 2) return { remain: s };
    const lookup: { [k: string]: number[] } = {
      '7': [11],
      '9': [11, 14],
      '11': [11, 14, 17],
      '13': [11, 14, 17, 21],
    }
    const semi = lookup[new_s.slice(1, i)];
    return { semi, remain: semi ? new_s.slice(i) : s };
  }
  do {
    let i = -1;
    while (chbetween(s[++i], '0', '9'))
      if (i > 1) break;
    const lookup: { [k: string]: number[] } = {
      '7': [10],
      '9': [10, 14],
      '11': [10, 14, 17],
      '13': [10, 14, 17, 21],
    }
    const semi = lookup[s.slice(0, i)];
    if (semi) return { semi, remain: s.slice(i) };
  } while (0);
  let { semi, remain } = csmNumNote(s);
  return { semi: semi ? [semi] : undefined, remain };
}

export function lookup<T>(s: string, table: { [k: string]: T }): T | undefined {
  return table[s];
}

export function numNote(semi: number): string {
  if (semi < 12) return ['1', '♯1', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'][semi];
  else return ['8', '♭9', '9', '♯9', '10', '♭11', '11', '♯11', '12', '♭13', '13', '♯13'][semi % 12];
}

export function numNote2Note(numNote: string, key: Note): string | undefined {
  const i = numNote.slice(1).split('').findIndex(ch => !'#♯b♭♮'.includes(ch));
  if (i === -1) return;
  parseInt(numNote.slice(i))
}
