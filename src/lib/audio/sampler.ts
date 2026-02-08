import { Note } from '../note';

interface SampleInfo {
  note: string;
  octave: number;
  value: number;
  path: string;
  buffer?: AudioBuffer;
}

const SAMPLE_GROUPS: Record<string, string[]> = {
  'A': ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
  'C': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
  'D#': ['D#1', 'D#2', 'D#3', 'D#4', 'D#5', 'D#6', 'D#7'],
  'F#': ['F#1', 'F#2', 'F#3', 'F#4', 'F#5', 'F#6', 'F#7'],
};

export class PianoSampler {
  public stopped: number[] = [];
  public started: number[] = [];
  private audioContext: AudioContext | null = null;
  private sampleCache: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map();
  private availableSamples: SampleInfo[] = [];

  constructor() {
    for (const [note, samples] of Object.entries(SAMPLE_GROUPS)) {
      for (const sampleName of samples) {
        const match = sampleName.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
          const octave = parseInt(match[2]);
          const noteobj = Note.parse(match[1]);
          if (noteobj === undefined) throw Error(`bad note: ${match[1]}`);
          this.availableSamples.push({
            note,
            octave,
            value: noteobj.value,
            path: `/piano/${sampleName}v12.ogg`
          });
        }
      }
    }
    console.log('[Sampler] Available samples:', this.availableSamples.map(s => `${s.note}${s.octave}`));
  }

  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private getClosestSample(targetNote: Note): SampleInfo {
    const targetAbsolute = targetNote.value + (targetNote.octave - 1) * 12;

    let bestMatch = this.availableSamples[0];
    let bestDistance = Infinity;

    for (const sample of this.availableSamples) {
      const sampleAbsolute = sample.value + (sample.octave - 1) * 12;
      const distance = Math.abs(targetAbsolute - sampleAbsolute);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = sample;
      }
    }

    console.log(`[Sampler] ${targetNote.toString()}${targetNote.octave} → ${bestMatch.note}${bestMatch.octave} (distance: ${bestDistance} semitones)`);
    return bestMatch;
  }

  async loadSample(path: string): Promise<AudioBuffer> {
    path = path.replace('#', 's');

    if (this.sampleCache.has(path)) {
      return this.sampleCache.get(path)!;
    }

    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    const promise = fetch(path)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load ${path}: ${response.statusText}`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => this.getAudioContext().decodeAudioData(arrayBuffer))
      .then(buffer => {
        this.sampleCache.set(path, buffer);
        this.loadingPromises.delete(path);
        return buffer;
      })
      .catch(err => {
        this.loadingPromises.delete(path);
        throw err;
      });

    this.loadingPromises.set(path, promise);
    return promise;
  }

  async preloadAll(): Promise<void> {
    const promises = this.availableSamples.map(sample =>
      this.loadSample(sample.path).catch(err => {
        console.warn(`[Sampler] Failed to load sample: ${sample.path}`, err);
      })
    );
    await Promise.all(promises);
  }

  async playNote(note: Note, duration: number = 1.0, velocity: number = 0.7): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const sample = this.getClosestSample(note);

    let buffer: AudioBuffer;
    try {
      buffer = await this.loadSample(sample.path);
    } catch {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const sampleAbsolute = sample.value + (sample.octave - 1) * 12;
    const targetAbsolute = note.value + (note.octave - 1) * 12;
    const semitoneShift = targetAbsolute - sampleAbsolute;

    if (semitoneShift !== 0) {
      source.playbackRate.value = Math.pow(2, semitoneShift / 12);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.value = velocity * 0.5;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    source.start(now);

    const releaseTime = Math.min(duration * 0.8, 0.8);
    gainNode.gain.setValueAtTime(velocity * 0.5, now + duration - releaseTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.stop(now + duration + 0.1);
  }

  async playNotes(notes: Note[], duration: number): Promise<void> {
    for (const note of notes) {
      await this.playNote(note, duration);
    }
  }

  stopAll(): void {
    if (this.audioContext) {
      this.audioContext.suspend();
      this.audioContext = null;
    } else {
      console.log("no audioContext to stop")
    }
    this.stopped.push(...this.started);
    this.started = [];
  }

  start(id: number): void {
    this.started.push(id);
  }

  resume(): void {
    if (this.audioContext) {
      this.audioContext.resume();
    }
  }

  isReady(): boolean {
    return this.sampleCache.size > 0;
  }
}
