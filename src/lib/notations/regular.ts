// vi: ts=2 sw=2
import { Chord, type ChordNotation } from "../chord";
import { Note } from "../note";
import { csmNote, csmNumNotes, csmTension, lookup, numNote, type ModArg } from "../parseutil";

const modifiers: ((orig: ModArg) => ModArg | string | undefined)[] = [
  ({ s, notes }) => {
    const f = lookup(s.slice(0, 4), {
      "omit": () => {
        const { semi, remain } = csmNumNotes(s.slice(4));
        if (!semi) return;
        if (semi.length === 0) return "Invalid syntax after `(`";
        return { s: remain, notes: notes.filter(n => !semi.includes(n)) }
      },
      "dim7": () => {
        return { s: s.slice(4), notes: [3, 6, 9, ...notes.filter(n => [4, 7].includes(n))] };
      },
    });
    if (f) return f();
  },
  ({ s, notes }) => {
    // TODO: add()
    const f = lookup(s.slice(0, 3), {
      "aug": () => {
        return { s: s.slice(3), notes: notes.map(n => n === 7 ? 8 : n) };
      },
      "dim": () => {
        return { s: s.slice(3), notes: notes.map(n => [4, 7].includes(n) ? n - 1 : n) };
      },
      "sus": () => {
        const { semi, remain } = csmNumNotes(s.slice(3));
        if (!semi) return;
        if (semi.some(n => ![2, 4].includes(n)))
          return { s: s.slice(3), notes: notes.map(n => n === 4 ? 5 : n) };
        return { s: remain, notes: [...notes.filter(n => n !== 4), ...semi] };
      },
    });
    if (f) return f();
  },
  ({ s, notes }) => {
    const f = lookup(s[0], {
      "m": () => {
        if (s.slice(0, 3) === 'maj') return;
        return { s: s.slice(1), notes: notes.map(n => n === 4 ? 3 : n) };
      },
      "5": () => {
        return { s: s.slice(1), notes: notes.filter(n => n !== 4) };
      },
      "3": () => {
        return { s: s.slice(1), notes: notes.filter(n => n !== 7) };
      },
    });
    if (f) return f();
  },
]

export default class RegularChordNotation implements ChordNotation {
  name = {
    "en": "Regular",
    "ja": "西洋・ギター"
  };
  depKey = false;


  hdlNotes(remain: string): string | number[] {
    let notes = [4, 7]; // 3rd, 5th
    while (remain.length) {
      let done = false
      for (const mod of modifiers) {
        const ret = mod({ s: remain, notes });
        if (!ret) continue
        if (typeof ret === 'string') return ret;
        const { s: new_s, notes: new_notes } = ret;
        remain = new_s;
        notes = new_notes;
        done = true;
        break;
      }
      if (done) continue;
      const { semi, remain: new_remain } = csmTension(remain);
      if (!semi) return `unexpected suffix (remain: ${new_remain})`;
      remain = new_remain;
      notes = [...notes, ...semi];
    }
    notes = notes.sort().filter((n, idx, arr) => arr[idx - 1] !== n);
    return notes;
  }

  showNotes(s: string, chord: Chord): string {
    let add: string[] = [], omit = [];
    let notes = chord.notes.map(n => n.minus(chord.base));
    const hasNote = Array(22).fill(false);
    notes.forEach(n => hasNote[n] = true);
    const [min, maj] = hasNote.slice(3, 5);
    const [dp, fifth, aug, sixth] = hasNote.slice(6, 10);
    notes = notes.filter(n => ![3, 4, 6, 7, 8, 9].includes(n));
    const bits = (+min << 5) + (+maj << 4) + (+dp << 3) + (+fifth << 2) + (+aug << 1) + +sixth;
    // _, 6, aug, aug6, 5, 56, aug5, aug56
    const lookup = [
      [''], ['6'], ['aug'], ['aug6'], [''], ['6'], ['', '♯5'], ['6', '♯5'], // _
      ['♭5'], ['6♭5'], ['♭5♯5'], ['6♭5♯5'], ['', '♭5'], ['6', '♭5'], ['', '♭5', '♯5'], ['6', '♭5', '♯5'], // dp
      [''], ['6'], ['aug'], ['aug6'], [''], ['6'], [''], ['6'], // maj
      ['♭5'], ['6♭5'], ['♭5♯5'], ['6♭5♯5'], ['', '♭5'], ['6', '♭5'], ['', '♭5', '♯5'], ['6', '♭5', '♯5'], // maj dp
      ['m'], ['m6'], ['maug'], ['maug6'], ['m'], ['m6'], ['m', '♯5'], ['m6', '♯5'], // min
      ['dim'], ['dim7'], ['dim'], ['dim7'], ['dim', '5'], ['dim7', '5'], ['dim', '5', '♯5'], ['dim7', '5', '♯5'], // dim
      ['', '♯9'], ['6', '♯9'], ['aug', '♯9'], ['aug6', '♯9'], ['', '♯9'], ['6', '♯9'], ['', '♯5', '♯9'], ['6', '♯5', '♯9'], // min maj
      ['♭5', '♯9'], ['6♭5', '♯9'], ['♭5♯5', '♯9'], ['6♭5♯5', '♯9'], ['', '♭5', '♯9'], ['6', '♭5', '♯9'], ['', '♭5', '♯5', '♯9'], ['6', '♭5', '♯5', '♯9'], // dim maj
    ];
    const found = lookup[bits];
    s += found.shift();
    add.push(...found); // BUG: after this push() somehow add has `undefined` elements
    if (!min && !maj) {
      const sus2 = hasNote[2], sus4 = hasNote[5];
      if (sus2 || sus4) s += ['', 'sus2', 'sus4', 'sus(2,4)'][+sus4 << 1 + +sus2];
      else omit.push('3');
      notes = notes.filter(n => ![2, 5].includes(n));
    }
    if (!dp && !fifth && !aug) omit.push(5);
    const tbits = (+hasNote[10] << 4) + (+hasNote[11] << 3) + (+hasNote[14] << 2) + (+hasNote[17] << 1) + +hasNote[21];
    const tlookup = [
      [], ['', 13], ['', 11], ['', 11, 13],
      ['', 9], ['', 9, 13], ['', 9, 11], ['', 9, 11, 13],
      ['M7'], ['M7', 13], ['M7', 11], ['M7', 11, 13],
      ['M9'], ['M9', 13], ['M11'], ['M13'],
      [7], [7, 13], [7, 11], [7, 11, 13],
      [9], [9, 13], [11], [13],
    ];
    s += tlookup[tbits].shift()?.toString() ?? '';
    add.push(...tlookup[tbits].map(n => n.toString()));
    notes = notes.filter(n => ![10, 11, 14, 17, 21].includes(n));
    add.push(...notes.map(numNote));
    add = add.filter(n => n?.length);
    if (add.some(n => ['♭5', '5', '♯5'].includes(n))) s += 'add';
    if (add.length) s += '(' + add.join(',') + ')';
    return s;
  }

  parse(s: string, _key: Note): Chord | string | undefined {
    let { note: base, remain } = csmNote(s); // TODO: custom octave
    if (!base) return;
    const ret = this.hdlNotes(remain);
    if (typeof ret === 'string') return ret;
    const notes = ret.map(n => {
      const note = base.transpose(n).toNormalized();
      return note;
    });
    return new Chord(base, notes);
  }

  display(chord: Chord, _key: Note): string {
    return this.showNotes(chord.base.norm(), chord);
  }
}
