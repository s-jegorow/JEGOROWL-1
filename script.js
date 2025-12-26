/* audio engine - param-stuff */

let audioContext;      // main audio context
let oscillator;        // main tone generator
let gainNode;          // volume/envelope control
let filter;            // lowpass filter
let lfoOscillator;     // low frequency oscillator for modulation
let lfoGain;           // controls lfo modulation depth
let isPlaying = false; // playback state
let chaosInterval;     // interval for chaos effect
let frequency = 440;   // current frequency in hz
let waveType = 0;      // 0: sine, 1: square, 2: sawtooth, 3: triangle
const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
const waveNames = ['SINE', 'SQUARE', 'SAW', 'TRI'];
let filterCutoff = 2000;    // filter cutoff frequency in hz
let filterResonance = 8;    // filter resonance/q value
let lfoSpeed = 2;      // lfo frequency in hz
let lfoDepth = 0;      // lfo modulation depth (0-1)
let attackTime = 0.01;      // attack time in seconds
let decayTime = 0.1;        // decay time in seconds
let sustainLevel = 0.7;     // sustain level (0-1)
let releaseTime = 0.3;      // release time in seconds
let chaosLevel = 0;    // amount of random frequency deviation (0-1)
let learnModeActive = false;
let tooltipsData = {};

async function loadTooltips() {
  try {
    const response = await fetch('tooltips.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    tooltipsData = JSON.parse(text);
    console.log('tooltips loaded successfully');
  } catch (error) {
    console.error('could not load tooltips:', error);
    console.error('error details:', error.message);
  }
}


const owlNeutral = `    ___
    {0,0}
    |)__)
    -"-"-`;

const owlLeft = `    ___
    {0,0}
   /)__)
    -"-"-`;

const owlRight = `    ___
    {0,0}
    (__(\\
    -"-"-`;

const shrugEmoji = `

  ¯\\_(ツ)_/¯

`;

let bootComplete = false;

async function runBootSequence() {
  const display = document.querySelector('.ascii-display');
  const displayGrid = document.querySelector('.display-grid');

  const bootMessages = [
    'INITIALIZING JEGOROWL-1...',
    'LOADING OSCILLATORS......',
    'CALIBRATING FILTERS......',
    'ENABLING CHAOS MODE......'
  ];

  const bootDiv = document.createElement('div');
  bootDiv.id = 'boot-sequence';
  bootDiv.style.cssText = 'text-align: center; font-size: 14px; line-height: 2; padding: 30px;';
  display.appendChild(bootDiv);

  const progressDiv = document.createElement('div');
  progressDiv.style.marginBottom = '20px';
  const messagesDiv = document.createElement('div');

  bootDiv.appendChild(progressDiv);
  bootDiv.appendChild(messagesDiv);

  for (let i = 0; i < bootMessages.length; i++) {
    const progress = Math.floor(((i + 1) / bootMessages.length) * 100);
    const filled = Math.floor((progress / 100) * 16);
    const empty = 16 - filled;
    progressDiv.textContent = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress}%`;
    messagesDiv.textContent = bootMessages[i];
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  progressDiv.textContent = `[${'█'.repeat(16)}] 100%`;
  await new Promise(resolve => setTimeout(resolve, 300));

  bootDiv.remove();
  displayGrid.classList.add('show');
  bootComplete = true;
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(freq) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const halfSteps = 12 * Math.log2(freq / C0);
  const halfStepsRounded = Math.round(halfSteps);
  const octave = Math.floor(halfStepsRounded / 12);
  const note = noteNames[halfStepsRounded % 12];
  return `${note}${octave}`;
}

/* display update */
function updateParamDisplay() {
  const noteName = frequencyToNote(frequency);
  document.getElementById('param-note').textContent = `${noteName} (${Math.round(frequency)} Hz)`;
  document.getElementById('param-wave').textContent = waveNames[waveType];
  document.getElementById('param-filt').textContent = `${Math.round(filterCutoff)} Hz`;
}

/* knob initialization */
function initKnobs() {
  const knobs = document.querySelectorAll('.knob');

  knobs.forEach(knob => {
    let isDragging = false;
    let startY = 0;
    let startRotation = 0;
    let currentRotation = 0;

    knob.addEventListener('mousedown', (e) => {
      if (learnModeActive) return;
      isDragging = true;
      startY = e.clientY;
      startRotation = currentRotation;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging || learnModeActive) return;
      const deltaY = startY - e.clientY;
      currentRotation = Math.max(-135, Math.min(135, startRotation + deltaY));
      knob.style.transform = `rotate(${currentRotation}deg)`;
      const normalized = (currentRotation + 135) / 270;
      updateParameter(knob.id, normalized);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  });
}

/* parameter update */
function updateParameter(knobId, normalized) {
  switch (knobId) {
    case 'freq-knob':
      frequency = 110 + normalized * 770;
      document.getElementById('freq-value').textContent = Math.round(frequency) + ' Hz';
      if (oscillator) oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      updateParamDisplay();
      break;

    case 'cutoff-knob':
      filterCutoff = 200 + normalized * 4800;
      document.getElementById('cutoff-value').textContent = Math.round(filterCutoff) + ' Hz';
      if (filter) filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
      updateParamDisplay();
      break;

    case 'resonance-knob':
      filterResonance = 0.1 + normalized * 19.9;
      document.getElementById('resonance-value').textContent = filterResonance.toFixed(1);
      if (filter) filter.Q.setValueAtTime(filterResonance, audioContext.currentTime);
      break;

    case 'lfo-speed-knob':
      lfoSpeed = 0.1 + normalized * 9.9;
      document.getElementById('lfo-speed-value').textContent = lfoSpeed.toFixed(1) + ' Hz';
      if (lfoOscillator) lfoOscillator.frequency.setValueAtTime(lfoSpeed, audioContext.currentTime);
      break;

    case 'lfo-depth-knob':
      lfoDepth = normalized;
      document.getElementById('lfo-depth-value').textContent = Math.round(lfoDepth * 100) + '%';
      if (lfoGain) lfoGain.gain.setValueAtTime(lfoDepth * 100, audioContext.currentTime);
      break;

    case 'attack-knob':
      attackTime = 0.001 + normalized * 1.999;
      document.getElementById('attack-value').textContent = attackTime.toFixed(2) + 's';
      break;

    case 'decay-knob':
      decayTime = 0.01 + normalized * 1.99;
      document.getElementById('decay-value').textContent = decayTime.toFixed(2) + 's';
      break;

    case 'sustain-knob':
      sustainLevel = normalized;
      document.getElementById('sustain-value').textContent = sustainLevel.toFixed(2);
      break;

    case 'release-knob':
      releaseTime = 0.01 + normalized * 2.99;
      document.getElementById('release-value').textContent = releaseTime.toFixed(2) + 's';
      break;

    case 'chaos-knob':
      chaosLevel = normalized;
      document.getElementById('chaos-value').textContent = Math.round(chaosLevel * 100) + '%';
      break;
  }
}

/* wave toggle */
function initWaveToggle() {
  const toggleOptions = document.querySelectorAll('.toggle-option');

  toggleOptions.forEach(option => {
    option.addEventListener('click', () => {
      toggleOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      waveType = parseInt(option.dataset.wave);
      document.getElementById('wave-value').textContent = waveNames[waveType];
      if (oscillator) oscillator.type = waveTypes[waveType];
      updateParamDisplay();
    });
  });
}

/* audio engine start */
function startSound() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  oscillator = audioContext.createOscillator();
  oscillator.type = waveTypes[waveType];
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
  filter.Q.setValueAtTime(filterResonance, audioContext.currentTime);

  lfoOscillator = audioContext.createOscillator();
  lfoOscillator.type = 'sine';
  lfoOscillator.frequency.setValueAtTime(lfoSpeed, audioContext.currentTime);

  lfoGain = audioContext.createGain();
  lfoGain.gain.setValueAtTime(lfoDepth * 100, audioContext.currentTime);

  gainNode = audioContext.createGain();
  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.3, now + attackTime);
  gainNode.gain.linearRampToValueAtTime(0.3 * sustainLevel, now + attackTime + decayTime);

  lfoOscillator.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  lfoOscillator.start();

  isPlaying = true;
  document.getElementById('play-btn').classList.add('active');
  document.getElementById('play-btn').textContent = '⏸ STOP';
  document.getElementById('param-status').textContent = 'PLAYING';

  startOwlAnimation();
  startChaos();
}

/* audio engine stop */
function stopSound() {
  if (gainNode && audioContext) {
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    setTimeout(() => {
      if (oscillator) oscillator.stop();
      if (lfoOscillator) lfoOscillator.stop();
      if (audioContext) audioContext.close();
      oscillator = null;
      lfoOscillator = null;
      audioContext = null;
    }, releaseTime * 1000);
  }

  isPlaying = false;
  document.getElementById('play-btn').classList.remove('active');
  document.getElementById('play-btn').textContent = '▶ PLAY';
  document.getElementById('param-status').textContent = 'STOPPED';

  stopOwlAnimation();
  stopChaos();
  document.getElementById('display-owl').textContent = owlNeutral;
}

/* owl animation */
let owlAnimationInterval;

function startOwlAnimation() {
  let toggle = false;
  owlAnimationInterval = setInterval(() => {
    const display = document.getElementById('display-owl');
    display.textContent = toggle ? owlLeft : owlRight;
    toggle = !toggle;
  }, 200);
}

function stopOwlAnimation() {
  if (owlAnimationInterval) {
    clearInterval(owlAnimationInterval);
    owlAnimationInterval = null;
  }
}

/* chaos mode */
function startChaos() {
  chaosInterval = setInterval(() => {
    if (chaosLevel > 0 && oscillator) {
      const randomFreq = frequency + (Math.random() - 0.5) * frequency * chaosLevel;
      oscillator.frequency.setValueAtTime(randomFreq, audioContext.currentTime);
    }
  }, 100);
}

function stopChaos() {
  if (chaosInterval) {
    clearInterval(chaosInterval);
    chaosInterval = null;
  }
}

/* learn mode ui */
document.getElementById('learn-btn').addEventListener('click', () => {
  learnModeActive = !learnModeActive;
  document.getElementById('learn-btn').classList.toggle('active', learnModeActive);
  document.body.classList.toggle('learn-mode-active', learnModeActive);
});

/* modal handling */
function openModal(paramKey) {
  const tooltip = tooltipsData[paramKey];
  if (!tooltip) return;

  document.getElementById('modal-title').textContent = tooltip.title;
  document.getElementById('modal-what').textContent = tooltip.what.replace(/\\n/g, '\n');
  document.getElementById('modal-how').textContent = tooltip.how.replace(/\\n/g, '\n');
  document.getElementById('modal-tips').textContent = tooltip.tips.replace(/\\n/g, '\n');
  document.getElementById('learn-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('learn-modal').classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);

document.getElementById('learn-modal').addEventListener('click', (e) => {
  if (e.target.id === 'learn-modal') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

document.querySelectorAll('.control[data-param]').forEach(control => {
  control.addEventListener('click', (e) => {
    if (learnModeActive) {
      openModal(control.dataset.param);
      e.stopPropagation();
    }
  });
});

/* button handlers */
document.getElementById('play-btn').addEventListener('click', () => {
  isPlaying ? stopSound() : startSound();
});

document.getElementById('feature-btn').addEventListener('click', () => {
  const display = document.getElementById('display-owl');
  if (!isPlaying) {
    display.textContent = display.textContent.includes('¯') ? owlNeutral : shrugEmoji;
  }
});

/* initialization */
runBootSequence().then(() => {
  loadTooltips();
  initKnobs();
  initWaveToggle();
  updateParamDisplay();
});