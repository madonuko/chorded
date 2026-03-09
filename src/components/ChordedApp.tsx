import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { ParsedChord, ParsedInput } from '../lib/parser';
import { formatChordNotes, type ChordNotation, Chord } from '../lib/chord';
import { Note } from '../lib/note';
import { semitonesFromAccidentals } from '../lib/parseutil';
import { initPiano, playChords, stopPlayback } from '../lib/audio/player';
import RegularChordNotation from '../lib/notations/regular';
import RomanChordNotation from '../lib/notations/roman';

const KEY_OPTIONS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const DEFAULT_KEY = 'A';
const DEFAULT_BPM = 135;
const DEFAULT_BEATS_IN_BAR = 4;
const DEFAULT_INPUT = 'Fm7 G7 | Cm7 ~ ~ Cbm7 Bbm7 ~ Eb9 ~ |\nAb△7 G9 | Cm7 ~ Bbm7 Eb9 |\nFm7 Bm7 | Dm7♭5 Gaug7 Cm7 Eb9 |\nAbM7 Bb7 Eb C7';

function parseKeyNote(key: string): Note {
  const baseIndex = 'CDEFGAB'.indexOf(key[0]);
  if (baseIndex === -1) return new Note(0, 'C');
  const accidental = key.slice(1);
  const semitones = baseIndex * 2 + semitonesFromAccidentals(accidental);
  const value = ((semitones % 12) + 12) % 12;
  return new Note(value, key);
}

function formatBeatDuration(duration: number): string {
  const beats = duration;
  if (beats === 1) return '1';
  if (beats === 0.5) return '1/2';
  if (beats === 0.25) return '1/4';
  if (beats === 1.5) return '1 1/2';
  if (beats === 2) return '2';
  if (beats === 3) return '3';
  if (beats === 4) return '4';
  return beats.toString();
}

function buildParsedInput(
  input: string,
  beatsInBar: number,
  notation: ChordNotation,
  key: Note
): ParsedInput {
  const normalizedInput = input.replace(/\n/g, ' ');
  const tokens = normalizedInput.split(/\s+/).filter(t => t.length > 0);
  const barBeats = Math.max(1, beatsInBar);

  const barTokens: string[][] = [];
  let currentTokens: string[] = [];

  for (const token of tokens) {
    if (token === '|') {
      barTokens.push(currentTokens);
      currentTokens = [];
      continue;
    }
    currentTokens.push(token);
  }

  if (currentTokens.length > 0) barTokens.push(currentTokens);

  const countTokenUnits = (token: string): number => {
    if (token === '_') return 1;
    if (token === '~') return 1;
    const tildes = (token.match(/~/g) || []).length;
    const chordToken = token.replace(/~/g, '');
    if (chordToken.length === 0) return tildes;
    return 1 + tildes;
  };

  const bars: ParsedChord[][] = [];

  for (const tokensInBar of barTokens) {
    const unitsTotal = tokensInBar.reduce((sum, token) => sum + countTokenUnits(token), 0) || 1;
    const unitDuration = barBeats / unitsTotal;

    const currentBar: ParsedChord[] = [];
    let lastChord: ParsedChord | null = null;

    for (const token of tokensInBar) {
      if (token === '_') {
        lastChord = {
          chord: null,
          duration: unitDuration,
          isRest: true,
          isBar: false
        };
        currentBar.push(lastChord);
        continue;
      }

      const tildes = (token.match(/~/g) || []).length;
      const chordToken = token.replace(/~/g, '');

      if (chordToken.length === 0) {
        if (lastChord) {
          lastChord.duration += unitDuration * tildes;
        }
        continue;
      }

      let chord: Chord | null = null;
      if (notation.parse) {
        const parsed = notation.parse(chordToken, key);
        if (parsed instanceof Chord) {
          chord = parsed;
        } else if (typeof parsed === 'string') {
          console.log(`[Chord Parser] ${chordToken}: ${parsed}`);
        }
      }

      const duration = unitDuration * (1 + tildes);
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

    bars.push(currentBar);
  }

  return { bars, rawInput: input };
}

export default function ChordedApp() {
  const notations = useMemo(() => [new RegularChordNotation(), new RomanChordNotation()], []);

  const [key, setKey] = useState(DEFAULT_KEY);
  const [bpm, setBpm] = useState(DEFAULT_BPM.toString());
  const [beatsInBar, setBeatsInBar] = useState(DEFAULT_BEATS_IN_BAR.toString());
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [fromNotation, setFromNotation] = useState(notations[0].name.en);
  const [toNotation, setToNotation] = useState(notations[0].name.en);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const beatsInBarValue = useMemo(() => {
    const parsed = parseInt(beatsInBar, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BEATS_IN_BAR;
  }, [beatsInBar]);

  const keyNote = useMemo(() => parseKeyNote(key), [key]);

  const fromNotationObj = useMemo(
    () => notations.find(n => n.name.en === fromNotation) ?? notations[0],
    [fromNotation, notations]
  );

  const toNotationObj = useMemo(
    () => notations.find(n => n.name.en === toNotation) ?? notations[0],
    [toNotation, notations]
  );

  const parsed = useMemo<ParsedInput>(() => {
    return buildParsedInput(input, beatsInBarValue, fromNotationObj, keyNote);
  }, [input, beatsInBarValue, fromNotationObj, keyNote]);

  useEffect(() => {
    console.log('[Chord Parser] Input:', input);
    console.log('[Chord Parser] Key:', key);
    console.log('[Chord Parser] Beats in Bar:', beatsInBarValue);
  }, [input, key, beatsInBarValue]);

  useEffect(() => {
    parsed.bars.forEach(bar => {
      bar.forEach(item => {
        if (!item.chord) return;
        const notes = item.chord.getNotes();
        console.log(`[Chord Parser] Parsed: "${item.chord.base.toString()}" → Notes: [${formatChordNotes(notes)}]`);
      });
    });
  }, [parsed]);

  const startPlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      return;
    }

    try {
      await initPiano();
      setIsPlaying(true);
      await playChords(
        parsed,
        { root: keyNote, type: 'minor', notes: [] },
        parseInt(bpm, 10) || DEFAULT_BPM,
        (notes) => setActiveNotes(notes),
        () => setActiveNotes([])
      );
    } catch (err) {
      console.error('Playback error:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [bpm, isPlaying, keyNote, parsed]);

  const stop = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
    setActiveNotes([]);
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          >
            {KEY_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">BPM</label>
          <input
            type="number"
            value={bpm}
            min={40}
            max={240}
            onChange={(event) => setBpm(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beats in Bar</label>
          <input
            type="number"
            min={1}
            value={beatsInBar}
            placeholder="4"
            onChange={(event) => setBeatsInBar(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Notation</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={fromNotation}
            onChange={(event) => setFromNotation(event.target.value)}
          >
            {notations.map((notation) => (
              <option key={`from-${notation.name.en}`} value={notation.name.en}>{notation.name.en}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Notation</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={toNotation}
            onChange={(event) => setToNotation(event.target.value)}
          >
            {notations.map((notation) => (
              <option key={`to-${notation.name.en}`} value={notation.name.en}>{notation.name.en}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chords</label>
        <textarea
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg font-mono text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="Enter chords separated by spaces. Use | for bars, ~ to extend, _ for rest."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button
          className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          onClick={startPlayback}
        >
          {isPlaying ? 'Playing...' : 'Play'}
        </button>
        <button
          className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          onClick={stop}
        >
          Stop
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Converted</h2>
        <div className="p-4 bg-white rounded-lg border border-gray-200 min-h-[80px]">
          {parsed.bars.map((bar, barIndex) => (
            <div key={`bar-${barIndex}`} className="flex flex-wrap gap-2 mb-2 last:mb-0">
              {bar.map((item, idx) => {
                if (item.isRest) {
                  return (
                    <span key={`rest-${barIndex}-${idx}`} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-400">—</span>
                  );
                }

                if (item.chord) {
                  const display = toNotationObj.display(item.chord, keyNote);
                  console.log(item.chord);
                  const notes = formatChordNotes(item.chord.getNotes());
                  return (
                    <span
                      key={`chord-${barIndex}-${idx}`}
                      className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-900 hover:bg-indigo-100 cursor-help relative"
                      title={notes}
                    >
                      {display}
                      <span className="text-xs ml-1 opacity-60 select-none">{formatBeatDuration(item.duration)}</span>
                    </span>
                  );
                }

                return (
                  <span key={`err-${barIndex}-${idx}`} className="px-3 py-2 rounded-lg bg-red-50 text-red-500">?</span>
                );
              })}
              {barIndex < parsed.bars.length - 1 && <span className="text-gray-400 self-center">|</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Notes</h2>
        <div className="flex gap-2 flex-wrap min-h-[40px]">
          {activeNotes.map(note => (
            <span key={note} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">{note}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
