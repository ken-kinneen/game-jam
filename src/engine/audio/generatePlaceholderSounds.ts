/**
 * Generates procedural placeholder sound effects using Web Audio API.
 * Each sound is synthesized into a WAV blob, then registered with Phaser's audio cache.
 * Replace with real assets by adding files to mods/core/assets/ and updating the manifest.
 */

interface ToneParams {
  frequency: number;
  duration: number;
  type: OscillatorType;
  attack: number;
  decay: number;
  volume: number;
  slide?: number;
}

function synthesize(ctx: OfflineAudioContext, params: ToneParams): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = params.type;
  osc.frequency.setValueAtTime(params.frequency, 0);
  if (params.slide) {
    osc.frequency.linearRampToValueAtTime(params.frequency + params.slide, params.duration);
  }

  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(params.volume, params.attack);
  gain.gain.setValueAtTime(params.volume, params.duration - params.decay);
  gain.gain.linearRampToValueAtTime(0, params.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(params.duration);
}

function synthesizeNoise(
  ctx: OfflineAudioContext,
  duration: number,
  volume: number,
  attack: number,
  decay: number,
): void {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(volume, attack);
  gain.gain.setValueAtTime(volume, duration - decay);
  gain.gain.linearRampToValueAtTime(0, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, 0);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  source.stop(duration);
}

async function renderSound(
  sampleRate: number,
  duration: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<ArrayBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
  build(ctx);
  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered);
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numFrames = buffer.length;
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wav);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample * 0x7fff, true);
    offset += 2;
  }

  return wav;
}

interface SoundRecipe {
  key: string;
  duration: number;
  build: (ctx: OfflineAudioContext) => void;
}

const RECIPES: SoundRecipe[] = [
  {
    key: 'sfx/item_pickup',
    duration: 0.25,
    build: (ctx) => {
      synthesize(ctx, {
        frequency: 600,
        duration: 0.25,
        type: 'sine',
        attack: 0.01,
        decay: 0.15,
        volume: 0.6,
        slide: 400,
      });
    },
  },
  {
    key: 'sfx/upgrade_acquired',
    duration: 0.6,
    build: (ctx) => {
      synthesize(ctx, {
        frequency: 440,
        duration: 0.3,
        type: 'triangle',
        attack: 0.01,
        decay: 0.1,
        volume: 0.5,
      });
      synthesize(ctx, {
        frequency: 660,
        duration: 0.3,
        type: 'triangle',
        attack: 0.01,
        decay: 0.15,
        volume: 0.5,
      });
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, 0.25);
      gain.gain.setValueAtTime(0, 0);
      gain.gain.setValueAtTime(0, 0.25);
      gain.gain.linearRampToValueAtTime(0.6, 0.3);
      gain.gain.linearRampToValueAtTime(0, 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0.25);
      osc.stop(0.6);
    },
  },
  {
    key: 'sfx/cave_enter',
    duration: 1.0,
    build: (ctx) => {
      synthesize(ctx, {
        frequency: 120,
        duration: 1.0,
        type: 'sine',
        attack: 0.05,
        decay: 0.6,
        volume: 0.4,
        slide: -60,
      });
      synthesizeNoise(ctx, 1.0, 0.15, 0.1, 0.5);
    },
  },
  {
    key: 'sfx/cave_exit',
    duration: 0.8,
    build: (ctx) => {
      synthesize(ctx, {
        frequency: 200,
        duration: 0.8,
        type: 'sine',
        attack: 0.05,
        decay: 0.4,
        volume: 0.4,
        slide: 100,
      });
    },
  },
  {
    key: 'sfx/player_death',
    duration: 1.5,
    build: (ctx) => {
      synthesize(ctx, {
        frequency: 300,
        duration: 1.5,
        type: 'sawtooth',
        attack: 0.01,
        decay: 1.0,
        volume: 0.5,
        slide: -250,
      });
      synthesizeNoise(ctx, 1.5, 0.2, 0.05, 0.8);
    },
  },
];

/**
 * Generate all placeholder sounds and register them with Phaser's sound manager.
 * Call during BootScene.create() after normal asset loading.
 */
export async function generatePlaceholderSounds(scene: Phaser.Scene): Promise<void> {
  const sampleRate = 44100;

  for (const recipe of RECIPES) {
    if (scene.cache.audio.has(recipe.key)) continue;

    const wav = await renderSound(sampleRate, recipe.duration, recipe.build);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      scene.load.audio(recipe.key, url);
      scene.load.once(`filecomplete-audio-${recipe.key}`, () => resolve());
      scene.load.once('loaderror', () => reject(new Error(`Failed to load ${recipe.key}`)));
      scene.load.start();
    });
  }
}
