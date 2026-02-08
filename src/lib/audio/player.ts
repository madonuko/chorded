import type { ParsedInput } from '../parser';
import type { Scale } from '../scales';
import { PianoSampler } from './sampler';

let sampler: PianoSampler | null = null;
let isInitialized = false;

export async function initPiano(): Promise<void> {
  if (isInitialized) return;

  sampler = new PianoSampler();
  await sampler.preloadAll();
  isInitialized = true;
}

export async function playChords(
  parsed: ParsedInput,
  scale: Scale,
  bpm: number,
  onNoteStart?: (notes: string[]) => void,
  onNoteEnd?: () => void
): Promise<void> {
  if (!sampler) await initPiano();
  if (!sampler) throw new Error('Sampler not initialized');

  const beatDuration = 60 / bpm;

  let delay = 0;

  const id = Date.now();

  sampler.start(id);

  for (const bar of parsed.bars) {
    for (const parsedChord of bar) {
      const chordDuration = beatDuration * parsedChord.duration;

      if (parsedChord.isRest) {
        delay += chordDuration;
        continue;
      }

      if (parsedChord.chord) {
        setTimeout(async () => {
          if (!parsedChord.chord || !sampler) return;
          if (sampler.stopped.includes(id) || !sampler.started.includes(id)) return;
          const chordNotes = parsedChord.chord.getNotes();
          const noteNames = chordNotes.map(n => `${n.toString()}${n.octave}`);

          onNoteStart?.(noteNames);

          await sampler.playNotes(chordNotes, chordDuration);

          onNoteEnd?.();
        }, delay * 1000);
        delay += chordDuration;
      }
    }
  }
  setTimeout(() => {
    const i = sampler?.started.indexOf(id);

    if (i && i !== -1) {
      sampler?.started.splice(i, 1);
    }

    const j = sampler?.stopped.indexOf(id);

    if (j && j !== -1) {
      sampler?.stopped.splice(j, 1);
    }
  })
}

export function stopPlayback(): void {
  if (sampler) {
    sampler.stopAll();
  } else {
    console.log("no sampler, nothing to stop");
  }
}

export function resumePlayback(): void {
  if (sampler) {
    sampler.resume();
  }
}

export function isPianoReady(): boolean {
  return isInitialized;
}
