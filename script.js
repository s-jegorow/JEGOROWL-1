/* ==========================================
   AUDIO ENGINE - Web Audio API Setup
   ========================================== */

// Core audio nodes
let audioContext;      // Main audio context
let oscillator;        // Main tone generator
let gainNode;          // Volume/envelope control
let filter;            // Lowpass filter
let lfoOscillator;     // Low Frequency Oscillator for modulation
let lfoGain;           // Controls LFO modulation depth
let isPlaying = false; // Playback state
let chaosInterval;     // Interval for chaos effect

/* ==========================================
   SYNTH PARAMETERS
   ========================================== */

// Oscillator settings
let frequency = 440;   // Current frequency in Hz
let waveType = 0;      // 0: sine, 1: square, 2: sawtooth, 3: triangle
const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
const waveNames = ['SINE', 'SQUARE', 'SAW', 'TRI'];

// Filter settings - adjusted for better audibility
let filterCutoff = 2000;    // Filter cutoff frequency in Hz (raised from 1000)
let filterResonance = 8;    // Filter resonance/Q value (raised from 5 for more character)

// LFO (Low Frequency Oscillator) settings
let lfoSpeed = 2;      // LFO frequency in Hz
let lfoDepth = 0;      // LFO modulation depth (0-1)

// ADSR Envelope settings
let attackTime = 0.01;      // Attack time in seconds
let decayTime = 0.1;        // Decay time in seconds
let sustainLevel = 0.7;     // Sustain level (0-1)
let releaseTime = 0.3;      // Release time in seconds

// Chaos effect
let chaosLevel = 0;    // Amount of random frequency deviation (0-1)

/* ==========================================
   LEARN MODE
   ========================================== */

let learnModeActive = false;
let tooltipsData = {};

// Load tooltips from JSON file
async function loadTooltips() {
  try {
    const response = await fetch('tooltips.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    tooltipsData = JSON.parse(text);
    console.log('Tooltips loaded successfully');
  } catch (error) {
    console.error('Could not load tooltips:', error);
    console.error('Error details:', error.message);
  }
}

/* ==========================================
   ASCII ART - Display Content
   ========================================== */

// Simple classic owl (neutral position) - with ZERO eyes
const owlNeutral = `    ___
    {0,0}
    |)__)
    -"-"-`;

// Owl looking left (animation frame)
const owlLeft = `    ___
    {0,0}
   /)__)
    -"-"-`;

// Owl looking right (animation frame)
const owlRight = `    ___
    {0,0}
    (__(\\
    -"-"-`;

// Shrug emoji for "More Features" button
const shrugEmoji = `

  ¯\\_(ツ)_/¯

`;

/* ==========================================
   BOOT SEQUENCE
   ========================================== */

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
  
  // Create boot display
  const bootDiv = document.createElement('div');
  bootDiv.id = 'boot-sequence';
  bootDiv.style.cssText = 'text-align: center; font-size: 14px; line-height: 2; padding: 30px;';
  display.appendChild(bootDiv);
  
  const progressDiv = document.createElement('div');
  progressDiv.style.marginBottom = '20px';
  const messagesDiv = document.createElement('div');
  
  bootDiv.appendChild(progressDiv);
  bootDiv.appendChild(messagesDiv);
  
  // Show messages one by one with progress bar updating at top
  for (let i = 0; i < bootMessages.length; i++) {
    // Update progress bar at top (stays in same position)
    const progress = Math.floor(((i + 1) / bootMessages.length) * 100);
    const filled = Math.floor((progress / 100) * 16);
    const empty = 16 - filled;
    progressDiv.textContent = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress}%`;
    
    // Update message below
    messagesDiv.textContent = bootMessages[i];
    
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  
  // Final 100% pause
  progressDiv.textContent = `[${'█'.repeat(16)}] 100%`;
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Remove boot sequence, show main display
  bootDiv.remove();
  displayGrid.classList.add('show');
  bootComplete = true;
}

/* ==========================================
   FREQUENCY TO NOTE CONVERSION
   ========================================== */

// Note names
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Convert frequency to musical note
function frequencyToNote(freq) {
  // A4 = 440 Hz is our reference
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75); // C0 frequency
  
  // Calculate how many half steps away from C0
  const halfSteps = 12 * Math.log2(freq / C0);
  const halfStepsRounded = Math.round(halfSteps);
  
  // Get note name and octave
  const octave = Math.floor(halfStepsRounded / 12);
  const note = noteNames[halfStepsRounded % 12];
  
  return `${note}${octave}`;
}

/* ==========================================
   DISPLAY UPDATE FUNCTIONS
   ========================================== */

// Update parameter display
function updateParamDisplay() {
  // Update note display
  const noteName = frequencyToNote(frequency);
  document.getElementById('param-note').textContent = `${noteName} (${Math.round(frequency)} Hz)`;
  
  // Update wave display
  document.getElementById('param-wave').textContent = waveNames[waveType];
  
  // Update filter display
  document.getElementById('param-filt').textContent = `${Math.round(filterCutoff)} Hz`;
}

/* ==========================================
   KNOB INITIALIZATION
   Handles drag interaction for rotary controls
   ========================================== */

function initKnobs() {
  const knobs = document.querySelectorAll('.knob');
  
  knobs.forEach(knob => {
    let isDragging = false;
    let startY = 0;
    let startRotation = 0;
    let currentRotation = 0;

    // Mouse down - start dragging (only if not in learn mode)
    knob.addEventListener('mousedown', (e) => {
      if (learnModeActive) return; // Don't drag in learn mode
      
      isDragging = true;
      startY = e.clientY;
      startRotation = currentRotation;
      e.preventDefault();
    });

    // Mouse move - update rotation and parameter
    document.addEventListener('mousemove', (e) => {
      if (!isDragging || learnModeActive) return; // Don't drag in learn mode

      // Calculate rotation based on vertical mouse movement
      // Moving up = increase, moving down = decrease
      const deltaY = startY - e.clientY;
      currentRotation = startRotation + deltaY;
      
      // Limit rotation to -135° to +135° (270° total range)
      currentRotation = Math.max(-135, Math.min(135, currentRotation));

      // Apply rotation visually
      knob.style.transform = `rotate(${currentRotation}deg)`;

      // Normalize rotation to 0-1 range for parameter mapping
      const normalized = (currentRotation + 135) / 270;

      // Update the corresponding parameter
      updateParameter(knob.id, normalized);
    });

    // Mouse up - stop dragging
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  });
}

/* ==========================================
   PARAMETER UPDATE FUNCTION
   Maps knob rotation (0-1) to actual synth parameters
   ========================================== */

function updateParameter(knobId, normalized) {
  switch(knobId) {
    case 'freq-knob':
      // Frequency range: 110 Hz (low A) to 880 Hz (high A)
      frequency = 110 + normalized * 770;
      document.getElementById('freq-value').textContent = Math.round(frequency) + ' Hz';
      // Update live if oscillator is running
      if (oscillator) oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      updateParamDisplay(); // Update display
      break;

    case 'cutoff-knob':
      // Filter Cutoff range: 200 Hz to 5000 Hz
      filterCutoff = 200 + normalized * 4800;
      document.getElementById('cutoff-value').textContent = Math.round(filterCutoff) + ' Hz';
      if (filter) filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
      updateParamDisplay(); // Update display
      break;

    case 'resonance-knob':
      // Filter Resonance/Q range: 0.1 to 20
      filterResonance = 0.1 + normalized * 19.9;
      document.getElementById('resonance-value').textContent = filterResonance.toFixed(1);
      if (filter) filter.Q.setValueAtTime(filterResonance, audioContext.currentTime);
      break;

    case 'lfo-speed-knob':
      // LFO Speed range: 0.1 Hz to 10 Hz
      lfoSpeed = 0.1 + normalized * 9.9;
      document.getElementById('lfo-speed-value').textContent = lfoSpeed.toFixed(1) + ' Hz';
      if (lfoOscillator) lfoOscillator.frequency.setValueAtTime(lfoSpeed, audioContext.currentTime);
      break;

    case 'lfo-depth-knob':
      // LFO Depth range: 0% to 100%
      lfoDepth = normalized;
      document.getElementById('lfo-depth-value').textContent = Math.round(lfoDepth * 100) + '%';
      // LFO gain controls how much the filter is modulated
      if (lfoGain) lfoGain.gain.setValueAtTime(lfoDepth * 100, audioContext.currentTime);
      break;

    case 'attack-knob':
      // Attack time range: 0.001s (instant) to 2s (slow)
      attackTime = 0.001 + normalized * 1.999;
      document.getElementById('attack-value').textContent = attackTime.toFixed(2) + 's';
      break;

    case 'decay-knob':
      // Decay time range: 0.01s to 2s
      decayTime = 0.01 + normalized * 1.99;
      document.getElementById('decay-value').textContent = decayTime.toFixed(2) + 's';
      break;

    case 'sustain-knob':
      // Sustain level range: 0.0 (silent) to 1.0 (full volume)
      sustainLevel = normalized;
      document.getElementById('sustain-value').textContent = sustainLevel.toFixed(2);
      break;

    case 'release-knob':
      // Release time range: 0.01s to 3s
      releaseTime = 0.01 + normalized * 2.99;
      document.getElementById('release-value').textContent = releaseTime.toFixed(2) + 's';
      break;

    case 'chaos-knob':
      // Chaos level range: 0% (no chaos) to 100% (maximum randomness)
      chaosLevel = normalized;
      document.getElementById('chaos-value').textContent = Math.round(chaosLevel * 100) + '%';
      break;
  }
}

/* ==========================================
   WAVE TOGGLE SWITCH
   Handles waveform selection (sine, square, saw, triangle)
   ========================================== */

function initWaveToggle() {
  const toggleOptions = document.querySelectorAll('.toggle-option');
  
  toggleOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active state from all options
      toggleOptions.forEach(opt => opt.classList.remove('active'));
      
      // Add active state to clicked option
      option.classList.add('active');
      
      // Update waveform type
      waveType = parseInt(option.dataset.wave);
      document.getElementById('wave-value').textContent = waveNames[waveType];
      
      // Update oscillator waveform if currently playing
      if (oscillator) {
        oscillator.type = waveTypes[waveType];
      }
      
      updateParamDisplay();
    });
  });
}

/* ==========================================
   AUDIO ENGINE - START SOUND
   Creates and connects all audio nodes
   Web Audio API chain: Oscillator → Filter → Gain → Output
   ========================================== */

function startSound() {
  // Create audio context (required for all Web Audio operations)
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create main oscillator (tone generator)
  oscillator = audioContext.createOscillator();
  oscillator.type = waveTypes[waveType];
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Create lowpass filter
  filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, audioContext.currentTime);
  filter.Q.setValueAtTime(filterResonance, audioContext.currentTime);

  // Create LFO (Low Frequency Oscillator for filter modulation)
  lfoOscillator = audioContext.createOscillator();
  lfoOscillator.type = 'sine';  // LFO is always sine wave
  lfoOscillator.frequency.setValueAtTime(lfoSpeed, audioContext.currentTime);

  // LFO gain node controls modulation depth
  lfoGain = audioContext.createGain();
  lfoGain.gain.setValueAtTime(lfoDepth * 100, audioContext.currentTime);

  // Create main gain node for volume and envelope control
  gainNode = audioContext.createGain();
  
  // Apply ADSR envelope
  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0, now);  // Start at 0 volume
  gainNode.gain.linearRampToValueAtTime(0.3, now + attackTime);  // Attack to peak
  gainNode.gain.linearRampToValueAtTime(0.3 * sustainLevel, now + attackTime + decayTime);  // Decay to sustain

  // Connect LFO to filter frequency for modulation effect
  lfoOscillator.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  // Connect main audio chain: Oscillator → Filter → Gain → Speakers
  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Start both oscillators
  oscillator.start();
  lfoOscillator.start();
  
  isPlaying = true;

  // Update UI to show playing state
  document.getElementById('play-btn').classList.add('active');
  document.getElementById('play-btn').textContent = '⏸ STOP';
  document.getElementById('param-status').textContent = 'PLAYING';

  // Start visual feedback and chaos effect
  startOwlAnimation();
  startChaos();
}

/* ==========================================
   AUDIO ENGINE - STOP SOUND
   Applies release envelope and cleans up audio nodes
   ========================================== */

function stopSound() {
  if (gainNode && audioContext) {
    // Apply release envelope (fade out)
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);  // Cancel any scheduled changes
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);  // Set current value
    gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);  // Fade to 0

    // Stop oscillators after release time has elapsed
    setTimeout(() => {
      if (oscillator) oscillator.stop();
      if (lfoOscillator) lfoOscillator.stop();
      if (audioContext) audioContext.close();
      
      // Clean up references
      oscillator = null;
      lfoOscillator = null;
      audioContext = null;
    }, releaseTime * 1000);
  }

  isPlaying = false;

  // Update UI to show stopped state
  document.getElementById('play-btn').classList.remove('active');
  document.getElementById('play-btn').textContent = '▶ PLAY';
  document.getElementById('param-status').textContent = 'STOPPED';

  // Stop visual feedback and chaos effect
  stopOwlAnimation();
  stopChaos();

  // Reset display to neutral owl
  document.getElementById('display-owl').textContent = owlNeutral;
}

/* ==========================================
   OWL ANIMATION
   Makes the owl "look" left and right to the rhythm
   ========================================== */

let owlAnimationInterval;

function startOwlAnimation() {
  let toggle = false;
  
  // Alternate between left and right positions every 200ms
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

/* ==========================================
   CHAOS MODE
   Randomly modulates frequency for glitch/wobble effects
   Higher chaos level = more extreme frequency deviations
   ========================================== */

function startChaos() {
  chaosInterval = setInterval(() => {
    if (chaosLevel > 0 && oscillator) {
      // Calculate random frequency deviation
      // Range: ±(frequency * chaosLevel)
      const randomFreq = frequency + (Math.random() - 0.5) * frequency * chaosLevel;
      oscillator.frequency.setValueAtTime(randomFreq, audioContext.currentTime);
    }
  }, 100);  // Update chaos effect every 100ms
}

function stopChaos() {
  if (chaosInterval) {
    clearInterval(chaosInterval);
    chaosInterval = null;
  }
}

/* ==========================================
   LEARN MODE FUNCTIONALITY
   ========================================== */

// Toggle Learn Mode
document.getElementById('learn-btn').addEventListener('click', () => {
  learnModeActive = !learnModeActive;
  const learnBtn = document.getElementById('learn-btn');
  
  if (learnModeActive) {
    learnBtn.classList.add('active');
    document.body.classList.add('learn-mode-active');
  } else {
    learnBtn.classList.remove('active');
    document.body.classList.remove('learn-mode-active');
  }
});

// Open modal with tooltip content
function openModal(paramKey) {
  const tooltip = tooltipsData[paramKey];
  if (!tooltip) return;
  
  // Replace \n with actual newlines for proper display
  document.getElementById('modal-title').textContent = tooltip.title;
  document.getElementById('modal-what').textContent = tooltip.what.replace(/\\n/g, '\n');
  document.getElementById('modal-how').textContent = tooltip.how.replace(/\\n/g, '\n');
  document.getElementById('modal-tips').textContent = tooltip.tips.replace(/\\n/g, '\n');
  
  document.getElementById('learn-modal').classList.remove('hidden');
}

// Close modal
function closeModal() {
  document.getElementById('learn-modal').classList.add('hidden');
}

// Modal close button
document.getElementById('modal-close').addEventListener('click', closeModal);

// Close modal on background click
document.getElementById('learn-modal').addEventListener('click', (e) => {
  if (e.target.id === 'learn-modal') {
    closeModal();
  }
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Add click handlers to all controls for Learn Mode
document.querySelectorAll('.control[data-param]').forEach(control => {
  control.addEventListener('click', (e) => {
    if (learnModeActive) {
      const paramKey = control.dataset.param;
      openModal(paramKey);
      e.stopPropagation();
    }
  });
});

/* ==========================================
   BUTTON HANDLERS
   ========================================== */

// Play/Stop button - toggles sound on/off
document.getElementById('play-btn').addEventListener('click', () => {
  if (!isPlaying) {
    startSound();
  } else {
    stopSound();
  }
});

// More Features button - toggles display between owl and shrug emoji
document.getElementById('feature-btn').addEventListener('click', () => {
  const display = document.getElementById('display-owl');
  
  // Only change display when not playing (so it doesn't interfere with animation)
  if (!isPlaying) {
    // Toggle between owl and shrug
    if (display.textContent.includes('¯')) {
      display.textContent = owlNeutral;
    } else {
      display.textContent = shrugEmoji;
    }
  }
});

/* ==========================================
   INITIALIZATION
   Called when page loads - sets up all interactive elements
   ========================================== */

// Run boot sequence first
runBootSequence().then(() => {
  loadTooltips(); // Load tooltip data from JSON
  initKnobs();
  initWaveToggle();
  updateParamDisplay(); // Initialize parameter display
});