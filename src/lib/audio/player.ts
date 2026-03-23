import type { ParsedInput } from '../parser';
import type { Chord } from '../chord';
import { PianoSampler } from './sampler';

const CLICK_SAMPLE_PATH = '/mouse-click.wav';

class AudioGlobals {
  sampler: PianoSampler | null = null;
  isInitialized = false;
  clickEnabled = false;
  clickBuffer: AudioBuffer | null = null;
  clickLoadingPromise: Promise<AudioBuffer> | null = null;
  sustainedNotes: Array<{ source: AudioBufferSourceNode; gainNode: GainNode }> = [];

  static instance: AudioGlobals | null = null;

  static get(): AudioGlobals {
    if (!AudioGlobals.instance) {
      AudioGlobals.instance = new AudioGlobals();
    }
    return AudioGlobals.instance;
  }
}

const globals = AudioGlobals.get();

async function loadClickSample(): Promise<AudioBuffer> {
  if (!globals.sampler) throw new Error('Sampler not initialized');
  const ctx = globals.sampler.getAudioContext();
  if (globals.clickBuffer) return globals.clickBuffer;
  if (globals.clickLoadingPromise) return globals.clickLoadingPromise;
  globals.clickLoadingPromise = fetch(CLICK_SAMPLE_PATH)
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load ${CLICK_SAMPLE_PATH}: ${response.statusText}`);
      return response.arrayBuffer();
    })
    .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
    .then(buffer => {
      globals.clickBuffer = buffer;
      globals.clickLoadingPromise = null;
      return buffer;
    })
    .catch(err => {
      globals.clickLoadingPromise = null;
      throw err;
    });
  return globals.clickLoadingPromise;
}

function playClickAt(buffer: AudioBuffer, startTime: number, volume: number): void {
  if (!globals.sampler) return;
  const ctx = globals.sampler.getAudioContext();
  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  source.buffer = buffer;
  gainNode.gain.value = volume;
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start(startTime);
}

export async function initPiano(): Promise<void> {
  if (globals.isInitialized) return;

  globals.sampler = new PianoSampler();
  await globals.sampler.preloadAll();
  globals.isInitialized = true;
}

export function setClickEnabled(enabled: boolean): void {
  globals.clickEnabled = enabled;
}

export async function playChords(
  parsed: ParsedInput,
  bpm: number,
  beatsInBar: number
): Promise<void> {
  if (!globals.sampler) await initPiano();
  if (!globals.sampler) throw new Error('Sampler not initialized');

  const beatDuration = 60 / bpm;
  const ctx = globals.sampler.getAudioContext();
  const startAt = ctx.currentTime + 0.08;

  let delay = 0;
  const id = Date.now();

  globals.sampler.start(id);

  let clickBuffer: AudioBuffer | null = null;
  try {
    clickBuffer = await loadClickSample();
  } catch (err) {
    console.warn('[Click] Failed to load click sample', err);
  }

  type ChordEvent = {
    time: number;
    duration: number;
    notes: ReturnType<Chord['getNotes']>;
    scheduled: boolean;
  };

  type ClickEvent = {
    time: number;
    scheduled: boolean;
  };

  const chordEvents: ChordEvent[] = [];
  const clickEvents: ClickEvent[] = [];

  let clickDelay = 0;
  const barBeats = Math.max(1, beatsInBar);
  for (const _bar of parsed.bars) {
    for (let beat = 0; beat < barBeats; beat += 1) {
      clickEvents.push({ time: clickDelay, scheduled: false });
      clickDelay += beatDuration;
    }
  }

  for (const bar of parsed.bars) {
    for (const parsedChord of bar) {
      const chordDuration = beatDuration * parsedChord.duration;

      if (parsedChord.isRest) {
        delay += chordDuration;
        continue;
      }

      if (parsedChord.chord) {
        const chordNotes = parsedChord.chord.getNotes();
        chordEvents.push({
          time: delay,
          duration: chordDuration * 2,
          notes: chordNotes,
          scheduled: false
        });
        delay += chordDuration;
      }
    }
  }

  const scheduleAheadTime = 0.12;
  const totalDuration = Math.max(delay, clickDelay);

  const tick = () => {
    const sampler = globals.sampler;
    if (!sampler) return;
    if (sampler.stopped.includes(id) || !sampler.started.includes(id)) return;

    const now = ctx.currentTime;
    const scheduleUntil = now + scheduleAheadTime;

    for (const event of chordEvents) {
      const eventTime = startAt + event.time;
      if (!event.scheduled && eventTime <= scheduleUntil) {
        event.scheduled = true;
        sampler.playNotesAt(event.notes, eventTime, event.duration).catch(() => undefined);
      }
    }

    for (const event of clickEvents) {
      const eventTime = startAt + event.time;
      if (!event.scheduled && eventTime <= scheduleUntil) {
        if (globals.clickEnabled && clickBuffer) {
          playClickAt(clickBuffer, eventTime, 0.5);
        }
        if (eventTime < now - 0.02 || globals.clickEnabled) {
          event.scheduled = true;
        }
      }
    }

    if (now >= startAt + totalDuration) {
      const i = sampler.started.indexOf(id);
      if (i !== -1) sampler.started.splice(i, 1);
      const j = sampler.stopped.indexOf(id);
      if (j !== -1) sampler.stopped.splice(j, 1);
      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

export async function playChordOnce(chord: Chord, bpm: number, beats: number): Promise<void> {
  if (!globals.sampler) await initPiano();
  if (!globals.sampler) throw new Error('Sampler not initialized');

  const beatDuration = 60 / bpm;
  const ctx = globals.sampler.getAudioContext();
  const startAt = ctx.currentTime + 0.02;
  const duration = beatDuration * beats * 2;
  await globals.sampler.playNotesAt(chord.getNotes(), startAt, duration);
}

export async function startChordSustain(chord: Chord): Promise<void> {
  if (!globals.sampler) await initPiano();
  if (!globals.sampler) throw new Error('Sampler not initialized');

  if (globals.sustainedNotes.length > 0) {
    globals.sampler.stopSustainedNotes(globals.sustainedNotes);
    globals.sustainedNotes = [];
  }

  globals.sustainedNotes = await globals.sampler.playNotesSustain(chord.getNotes());
}

export function stopChordSustain(): void {
  if (!globals.sampler) return;
  if (globals.sustainedNotes.length === 0) return;
  globals.sampler.stopSustainedNotes(globals.sustainedNotes);
  globals.sustainedNotes = [];
}

export function stopPlayback(): void {
  if (globals.sampler) {
    globals.sampler.stopAll();
  } else {
    console.log("no sampler, nothing to stop");
  }
}

export function resumePlayback(): void {
  if (globals.sampler) {
    globals.sampler.resume();
  }
}

export function isPianoReady(): boolean {
  return globals.isInitialized;
}
