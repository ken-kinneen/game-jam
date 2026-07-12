/**
 * Generates procedural ambient audio loops for scenes that don't have real audio files yet.
 * These are longer (5-10s) looping drones synthesized at boot time.
 */

interface AmbientRecipe {
  key: string;
  duration: number;
  build: (ctx: OfflineAudioContext) => void;
}

const AMBIENT_RECIPES: AmbientRecipe[] = [
  {
    key: 'ambience/hut_room',
    duration: 8,
    build: (ctx) => {
      // Quiet room tone with subtle low-frequency presence
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(45, 0);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, 0);
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(0.08, 1);
      gain.gain.setValueAtTime(0.08, 7);
      gain.gain.linearRampToValueAtTime(0, 8);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(8);
    },
  },
  {
    key: 'ambience/corridor_hum',
    duration: 10,
    build: (ctx) => {
      // Metallic resonance + dripping-like clicks
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, 0);
      osc.frequency.setValueAtTime(82, 5);
      osc.frequency.setValueAtTime(79, 10);
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(0.12, 1);
      gain.gain.setValueAtTime(0.12, 9);
      gain.gain.linearRampToValueAtTime(0, 10);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(10);

      // Add subtle filtered noise for texture
      const bufferSize = Math.ceil(ctx.sampleRate * 10);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.02;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, 0);
      filter.Q.setValueAtTime(2, 0);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.15, 0);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(0);
      noise.stop(10);
    },
  },
  {
    key: 'ambience/electrical_drone',
    duration: 6,
    build: (ctx) => {
      // 60Hz hum with harmonics — transformer sound
      const fundamentals = [60, 120, 180];
      const volumes = [0.15, 0.08, 0.04];
      for (let i = 0; i < fundamentals.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamentals[i], 0);
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(volumes[i], 0.5);
        gain.gain.setValueAtTime(volumes[i], 5.5);
        gain.gain.linearRampToValueAtTime(0, 6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(6);
      }
    },
  },
];

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

export async function generateAmbientPlaceholders(scene: Phaser.Scene): Promise<void> {
  const sampleRate = 22050;

  for (const recipe of AMBIENT_RECIPES) {
    if (scene.cache.audio.has(recipe.key)) continue;

    const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * recipe.duration), sampleRate);
    recipe.build(ctx);
    const rendered = await ctx.startRendering();
    const wav = audioBufferToWav(rendered);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      scene.load.audio(recipe.key, url);
      scene.load.once(`filecomplete-audio-${recipe.key}`, () => resolve());
      scene.load.once('loaderror', () => reject(new Error(`Failed: ${recipe.key}`)));
      scene.load.start();
    });
  }
}
