const NOTES = {
  sfx_collect: [660, 880], sfx_win: [523, 659, 784],
  sfx_error: [210, 150], sfx_lose: [260, 190, 120],
  sfx_destroy: [440, 330], sfx_click: [520],
};

let buttonClickAudio;

export function playButtonClick() {
  if (typeof Audio === 'undefined') return;
  if (!buttonClickAudio) {
    buttonClickAudio = new Audio(`${import.meta.env.BASE_URL}assets/bt_click.mp3`);
    buttonClickAudio.preload = 'auto';
    buttonClickAudio.volume = 0.55;
  }
  buttonClickAudio.currentTime = 0;
  buttonClickAudio.play().catch(() => {});
}

export function playGameSound(scene, key) {
  const kenneyKey = key === 'sfx_collect' || key === 'sfx_win' ? 'kenney_collect'
    : key === 'sfx_error' || key === 'sfx_lose' ? 'kenney_error' : 'kenney_click';
  if (scene?.cache?.audio?.exists(kenneyKey)) {
    scene.sound.play(kenneyKey, { volume: 0.32 });
    return;
  }
  const context = scene?.sound?.context;
  if (!context || typeof context.createOscillator !== 'function') return;
  if (context.state === 'suspended') context.resume().catch(() => {});
  for (const [index, frequency] of (NOTES[key] || [440]).entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.075;
    oscillator.type = key === 'sfx_error' || key === 'sfx_lose' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  }
}
