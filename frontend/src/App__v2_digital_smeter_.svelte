<script>
  const VERSION = "3.1.0 with mobile support and enhancements";

  import { onDestroy, onMount, tick, afterUpdate } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import copy from "copy-to-clipboard";
  import { RollingMax } from "efficient-rolling-stats";
  import { writable } from "svelte/store";

  import PassbandTuner from "./lib/PassbandTuner.svelte";
  import FrequencyInput from "./lib/FrequencyInput.svelte";
  import FrequencyMarkers from "./lib/FrequencyMarkers.svelte";

  import { eventBus } from "./eventBus";

  import { quintOut } from "svelte/easing";

  import { pinch, pan } from "./lib/hammeractions.js";
  import { availableColormaps } from "./lib/colormaps";
  import {
    init,
    audio,
    waterfall,
    events,
    FFTOffsetToFrequency,
    frequencyToFFTOffset,
    frequencyToWaterfallOffset,
    getMaximumBandwidth,
    waterfallOffsetToFrequency,
    sendUserID,
  } from "./lib/backend.js";
  import {
    constructLink,
    parseLink,
    storeInLocalStorage,
  } from "./lib/storage.js";

  // Added to create the Site Information area //
  import {
    siteSysop,
    siteSysopEmailAddress,
    siteInformation,
    siteGridSquare,
    siteCity,
    siteHardware,
    siteSoftware,
    siteReceiver,
    siteAntenna,
    siteNote,
    siteIP,
    siteStats,
    siteSDRBaseFrequency,
    siteSDRBandwidth,
    siteRegion,
    siteChatEnabled,
  } from "../site_information.json";
  // End of Information Area import //

  // Import to detect mobile devices //
  import Device from "svelte-device-info";

  import VersionSelector from "./lib/VersionSelector.svelte";
  import Spectrogram from "./lib/Spectrogram.svelte";

  let isRecording = false;
  let canDownload = false;

  let waterfallCanvas;
  let waterfallReverse = false;
  let eventBusUnsubscribers = [];
  let dxVisibilityChangeHandler = null;

  function loadWaterfallDirection() {
    try {
      waterfallReverse = JSON.parse(localStorage.getItem("waterfallReverse") || "false");
    } catch (e) {
      waterfallReverse = false;
    }
  }

  function toggleWaterfallDirection() {
    waterfallReverse = !waterfallReverse;
    try {
      localStorage.setItem("waterfallReverse", JSON.stringify(waterfallReverse));
    } catch (e) {}
  }


function drawTopFrequencyBar() {
  if (!topGraduationCanvas || !graduationCanvas) return;
  const src = graduationCanvas;
  const dst = topGraduationCanvas;
  if (dst.width !== src.width) dst.width = src.width;
  if (dst.height !== src.height) dst.height = src.height;
  const ctx = dst.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
}

function stopTopFrequencyBarSync() {
  if (topGraduationRaf !== null) {
    cancelAnimationFrame(topGraduationRaf);
    topGraduationRaf = null;
  }
}

function startTopFrequencyBarSync() {
  stopTopFrequencyBarSync();
  const loop = () => {
    if (waterfallDisplay) {
      drawTopFrequencyBar();
    }
    topGraduationRaf = requestAnimationFrame(loop);
  };
  tick().then(drawTopFrequencyBar);
  topGraduationRaf = requestAnimationFrame(loop);
}

  $: if (waterfallDisplay) {
    tick().then(drawTopFrequencyBar);
  }

  let waterfallHighlightCanvas;
  let waterfallHighlightInner;
  let spectrumCanvas;
  let graduationCanvas;
  let topGraduationCanvas;
  let topGraduationRaf = null;
  let clientsCanvas;
  let myDisplayId = "";
  let _myId = null;

  function idToSixDigits(id) {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0
    }
    return String(h % 900000 + 100000)
  }
  let showClients = true;
  let bandPlanCanvas;
  let tempCanvas;

  let frequencyInputComponent;

  let frequency;

  let passbandTunerComponent;

  // Spectrogram variables
  let spectrogramComponent;
  let spectrogramEnabled = false;
  let spectrogramHeight = 200;
  let spectrogramGain = 1.0;
  let spectrogramColorScheme = 'rainbow';

  let autoAdjust; // added after C&P of the original App.svelte //

  let link;
  var chatContentDiv;

  // Added to allow the user to toggle the waterfall on and off //
  function handleWaterfallChange() {
    waterfallDisplay = !waterfallDisplay;
  }
  // End of waterfall toggle addition //

  // Declarations for the store and restore of the waterfall settings //
  // when Auto Adjust is enabled. //
  let previous_min_waterfall;
  let previous_max_waterfall;
  let previous_brightness;
  let storeWaterfallSettings = false;
  // End of store and restore variables //

  // Adaptive Auto-Adjust Configuration
  // The waterfall now automatically adjusts based on real-time noise levels!
  let autoAdjustConfig = {
    noiseFloorPercentile: 10,     // 5-15: Lower = darker background
    signalCeilingPercentile: 99,  // Top 1% for strong signals
    noiseSuppressionFactor: 0.15, // 0.1-0.25: Higher = darker background
    brightnessFactor: 0.3,        // 0.25-0.4: Higher = brighter weak signals
    smoothingFrames: 8,           // 6-15: Higher = smoother but slower response
    // ADAPTIVE parameters - monitors noise in real-time
    adaptiveEnabled: true,        // Enable automatic adaptation to noise levels
    adaptationSpeed: 0.3,         // 0.1-0.5: How fast to adapt to changes
    adaptationInterval: 1000      // Check noise level every X milliseconds
  };
  
  // Preset configurations for different scenarios
  const autoAdjustPresets = {
    default: {
      noiseFloorPercentile: 10,
      noiseSuppressionFactor: 0.15,
      brightnessFactor: 0.3,
      smoothingFrames: 8,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3
    },
    darkBackground: {
      noiseFloorPercentile: 5,      // Very aggressive noise suppression
      noiseSuppressionFactor: 0.2,  // Push noise down more
      brightnessFactor: 0.25,
      smoothingFrames: 10,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3
    },
    weakSignals: {
      noiseFloorPercentile: 15,     // Gentler on noise
      noiseSuppressionFactor: 0.1,
      brightnessFactor: 0.35,       // Boost weak signals more
      smoothingFrames: 6,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3
    },
    highContrast: {
      noiseFloorPercentile: 3,      // Maximum noise suppression
      noiseSuppressionFactor: 0.25,
      brightnessFactor: 0.2,
      smoothingFrames: 12,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3
    },
    static: {
      noiseFloorPercentile: 10,
      noiseSuppressionFactor: 0.15,
      brightnessFactor: 0.3,
      smoothingFrames: 8,
      adaptiveEnabled: false,      // No adaptation, static settings
      adaptationSpeed: 0
    }
  };
  
  let currentAutoAdjustPreset = 'default';
  let adaptiveStatus = { condition: "WAITING", avgSNR: "0.0" };

  // Definitions for handleBandChange function //
  // To show the proper band upon startup, you must set //
  // currentBand to the integer of the band starting at 0 //
  // uup to that band. I am publishing several bands, so //
  // the integer for 80m is 7. //
  let bandArray = waterfall.bands;
  //  let currentBand = 34; // 40m

  // This changed by sv2amk. //
  // It's done by the initBandButton function that autodetects //
  // and show the proper band upon startup. It is called from //
  // the display subsection inside the svelte section //
  // near the middle of this file and it's triggered //
  // by the -2 value below. //
  let currentBand = -2;
  let bandName;

  // CATsync loop-prevention / idempotency guards
  let __catsync_last_applied_hz = null;
  let __catsync_last_applied_mode = null;

  // Begin Wheel Tuning Steps declarations
  let defaultStep,
    currentTuneStep = 1000; // Default step value / Track current step
  let tuningsteps = ["10", "50", "100", "500", "1000", "5000", "9000", "10000"];

  // buttons = true for Buttons for Waterfall controls //
  // buttons = false for toggle switches for Waterfall controls //
  let buttons = true;

  // Added to create a fineTune function to use //
  // buttons to click on for mobile users //
  let fineTuneAmount = 0;

  // Set default AGC (0 = Off) //
  let currentAGC = 0;

  // This function was added to enable AGC to the client //
  function handleAGCChange(newAGC) {
    currentAGC = newAGC;
    switch (newAGC) {
      case 0:
        audio.setAGC(0);
        break;
      case 1:
        audio.setAGC(1);
        break;
      case 2:
        audio.setAGC(2);
        break;
      case 3:
        audio.setAGC(3);
        break;
    }
  }

  // Added to allow an adjustment of the dynamic audio //
  // buffer function inside audio.js //
  let audioBufferDelayEnabled = false;
  let audioBufferDelay = 1;

  // by sv2amkzoom
  // Added to allow adjustment of the zoom //
  // with a button and a slider in mobile version //
  // in function handleZoomStepMove //
  let zoomStepEnabled = false;
  let zoomStep = 1;

  // The zoom factor for the handleZoomStepMove //
  // and the handleZoomStepMagnify functions for //
  // the zoom slider //
  let zwaterfallSpan;

  // Waterfall Auto Control //
  let AutoAdjustEnabled = false;

  // Used to track bandwidth as to make sure the //
  // static bandwidth buttons can be enabled and returened //
  // to the default bandwidth for thr chosen mode //
  let currentBandwidth = 0;
  let staticBandwidthEnabled = false;

  // Getting The Current Date & Time And Setting It
  let currentDateTime = new Date();

  // SMeter Clock
  // Spectrogram functions
  // Initialize spectrogram
  async function initSpectrogram() {
    if (spectrogramComponent) {
      try {
        await spectrogramComponent.initialize(audio.audioOutputSps || 12000);
        
        // Set up callback to feed PCM data from audio.js
        audio.setSpectrogramCallback((pcmData) => {
          if (spectrogramEnabled && spectrogramComponent) {
            spectrogramComponent.feedPCMData(pcmData);
          }
        });
        
        spectrogramComponent.start();
        audio.setSpectrogramEnabled(true); // Enable after callback is registered
        console.log('Spectrogram initialized successfully');
      } catch (error) {
        console.error('Failed to initialize spectrogram:', error);
      }
    }
  }

  // Toggle spectrogram on/off
  async function toggleSpectrogram() {
    spectrogramEnabled = !spectrogramEnabled;
    
    if (spectrogramEnabled) {
      // ENABLING - wait for component to be created by Svelte
      await tick(); // Wait for DOM to update
      
      // CRITICAL FIX: Wait a bit more for canvas to be visible and sized
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (spectrogramComponent && !spectrogramComponent.audioContext) {
        // First time - need to initialize
        await initSpectrogram();
      } else if (spectrogramComponent) {
        // Already initialized - just start it
        spectrogramComponent.start();
        audio.setSpectrogramEnabled(true);
      } else {
        console.error('Spectrogram component not available after tick() - check if component is in DOM');
      }
    } else {
      // DISABLING
      if (spectrogramComponent) {
        spectrogramComponent.stop();
      }
      audio.setSpectrogramEnabled(false);
    }
  }

  // Update spectrogram frequency range - Fixed 0-8 kHz for all modes
  function updateSpectrogramRange() {
    if (!spectrogramComponent || !spectrogramEnabled) return;
    
    // Fixed range: 0-8000 Hz for all modes
    const minFreq = 50;
    const maxFreq = 8000;
    
    spectrogramComponent.setFrequencyRange(minFreq, maxFreq);
    console.log(`Spectrogram range: ${minFreq}-${maxFreq} Hz (fixed for all modes)`);
  }

  onMount(() => {
    // Initial update
    updateTime();

    // Set up the interval (using 5000ms as in the original code)
    intervalId = setInterval(updateTime, 5000);

    // Clean up on component destruction
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  let time = "";
  let intervalId;

  function updateTime() {
    const Digital = new Date();

    // UTC time
    let hours = Digital.getUTCHours();
    let minutes = Digital.getUTCMinutes();
    let seconds = Digital.getUTCSeconds();

    // Reset hours if it's 24 or greater
    if (hours >= 24) {
      hours = 0;
    }

    // Add leading zeros
    hours = hours <= 9 ? `0${hours}` : hours;
    minutes = minutes <= 9 ? `0${minutes}` : minutes;

    // Local time
    let localHours = Digital.getHours();
    let localMinutes = Digital.getMinutes();

    // Reset local hours if it's 24 or greater
    if (localHours >= 24) {
      localHours = 0;
    }

    // Add leading zeros for local time
    localHours = localHours <= 9 ? `0${localHours}` : localHours;
    localMinutes = localMinutes <= 9 ? `0${localMinutes}` : localMinutes;

    // Update the time string
    time = `${hours}:${minutes} (UTC) • ${localHours}:${localMinutes} (Local)`;
  }

  // Function added to toggle the Additional Info menu //
  function toggleMenu() {
    const menu = document.getElementById("collapsible-menu");
    const label = document.getElementById("menu-toggle-label");

    if (menu.classList.contains("hidden")) {
      menu.classList.remove("hidden");
      label.innerText = "Close Additional Info";
    } else {
      menu.classList.add("hidden");
      label.innerText = "Open Additional Info";
    }
  }
  // End of Site Information addition //

  function toggleRecording() {
    if (!isRecording) {
      audio.startRecording();
      isRecording = true;
      canDownload = false;
    } else {
      audio.stopRecording();
      isRecording = false;
      canDownload = true;
    }
  }

  function downloadRecording() {
    audio.downloadRecording();
  }

  function generateUniqueId() {
    return (
      Math.random().toString(36).substr(2, 10) +
      Math.random().toString(36).substr(2, 10)
    );
  }

  let userId; // Global variable to store the user's unique ID
  let autoAdjustEnabled = false;

  // Updates the passband display
  function updatePassband(passband) {
  passband = passband || audio.getAudioRange();
  const frequencies = passband.map(FFTOffsetToFrequency);
  bandwidth = ((frequencies[2] - frequencies[0]) / 1000).toFixed(2);
  const offsets = frequencies.map(frequencyToWaterfallOffset);
  passbandTunerComponent.changePassband(offsets);
  // important:
  drawWaterfallHighlight(passband);
  }

  function drawWaterfallHighlight(passband) {
  try {
    if (!waterfallHighlightCanvas || !waterfallHighlightInner || !waterfallDisplay) return;

    // Waterfall range is in FFT-offset units
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const span = waterfallR - waterfallL;
    if (!span || !Number.isFinite(span)) {
      waterfallHighlightInner.style.display = "none";
      return;
    }

    // Passband is in FFT offsets, same space as audio.getAudioRange()
    passband = passband || (audio.getAudioRange ? audio.getAudioRange() : null);
    if (!passband || passband.length < 3) {
      waterfallHighlightInner.style.display = "none";
      return;
    }

    const [l, , r] = passband;

    // Map offsets to percentage across the waterfall (0–100%)
    const x1 = ((l - waterfallL) / span) * 100;
    const x2 = ((r - waterfallL) / span) * 100;

    if (!Number.isFinite(x1) || !Number.isFinite(x2)) {
      waterfallHighlightInner.style.display = "none";
      return;
    }

    const leftPercent = Math.max(0, Math.min(100, Math.min(x1, x2)));
    const rightPercent = Math.max(0, Math.min(100, Math.max(x1, x2)));
    const widthPercent = Math.max(0.2, rightPercent - leftPercent);

    waterfallHighlightInner.style.display = "block";
    waterfallHighlightInner.style.left = leftPercent + "%";
    waterfallHighlightInner.style.width = widthPercent + "%";

    // Light yellow fill (no horizontal lines)
    waterfallHighlightInner.style.background = "rgba(255,255,180,0.15)";
    // Vertical borders only (smooth)
    waterfallHighlightInner.style.borderLeft = "2px solid rgba(255,255,200,0.20)";
    waterfallHighlightInner.style.borderRight = "2px solid rgba(255,255,200,0.20)";

    // Remove any shadows that create horizontal glow
    waterfallHighlightInner.style.boxShadow = "none";

  } catch (err) {
    console.warn("drawWaterfallHighlight error", err);
  }
}

  /*
  // Wheel zooming, update passband and markers
  function handleWaterfallWheel(e) {
    waterfall.canvasWheel(e);
    passbandTunerComponent.updatePassbandLimits();
    updatePassband();
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
  }
  */

  // begin change frequency with arrows
  // Keep decimals tidy when stepping by 0.01 kHz
  const roundKHz = (v) => Math.round(v * 100) / 100;

  function applyStep(deltaKHz) {
    const next = roundKHz((Number(frequency) || 0) + deltaKHz);
    frequency = next;

    const hz = Math.round(next * 1e3);
    try { if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(hz); } catch (e) {}
    handleFrequencyChange({ detail: hz });
  }

  function cancelBrowser(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function onKey(e) {

    // If ArrowLeft/ArrowRight are pressed inside the chat input textarea,
    // let them move the caret instead of tuning.
    try {
      const t = e.target;

      if (t instanceof HTMLElement) {
        // Adjust these selectors to match your chat & bookmark textarea
        const inTextInput =
          t.id === "textInput" ||                  // e.g. <textarea id="textInput">
          (t.closest ? t.closest('[data-role="chat-input"]') : null); // or wrapper with data-role

        if (
          inTextInput &&
          (e.code === "ArrowLeft" || e.code === "ArrowRight")
        ) {
          return; // allow native cursor movement only in chat input
        }
      }
    } catch (e) {}

    // --- Right-Ctrl = snap to .00 kHz ---
    if (e.code === "ControlRight") {
      cancelBrowser(e);

      const base = Math.floor(Number(frequency) || 0);
      frequency = base;

      const hz = Math.round(base * 1e3);
      try { if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(hz); } catch (e) {}
      handleFrequencyChange({ detail: hz });

      return;
    }

    // Only arrows
    const c = e.code;
    if (!c || !c.startsWith("Arrow")) return;

    const shift = e.shiftKey;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const isUpDown = c === "ArrowUp" || c === "ArrowDown";
    const isLeftRight = c === "ArrowLeft" || c === "ArrowRight";

    let stepKHz = 0;
    let sign = 0;

    if (isUpDown) {
      if (shift && ctrlOrMeta)      stepKHz = 1000;
      else if (ctrlOrMeta)          stepKHz = 100;
      else if (shift)               stepKHz = 1;
      else                          stepKHz = 0.01;
      sign = c === "ArrowUp" ? +1 : -1;

    } else if (isLeftRight) {
      if (shift && ctrlOrMeta)      stepKHz = 10000;
      else if (ctrlOrMeta)          stepKHz = 500;
      else if (shift)               stepKHz = 10;
      else                          stepKHz = 0.10;
      sign = c === "ArrowRight" ? +1 : -1;
    }

    if (!stepKHz) return;

    cancelBrowser(e);
    applyStep(sign * stepKHz);
}

  onMount(() => {
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
  });
  onDestroy(() => {
    window.removeEventListener("keydown", onKey, { capture: true });
  });
// end change frequency with arrows

// Window for shortcuts
  let showShortcuts = false;
  let closeBtnEl;

  function openShortcuts() {
    showShortcuts = true;
    tick().then(() => closeBtnEl && closeBtnEl.focus());
  }

  function closeShortcuts() {
    showShortcuts = false;
  }

  function onGlobalKey(e) {
    // Close shortcuts dialog on Escape when open
    if (showShortcuts && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeShortcuts();
      return;
    }

    // --- Mode shortcuts: l/u/a/q/f ---
    // Ignore if user is typing in an input/textarea or editable element
    try {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
    } catch (e) {}

    if (e.repeat) return;

    const k = (e.key || "").toLowerCase();
    if (k === "l") { e.preventDefault(); SetMode("LSB"); return; }
    if (k === "u") { e.preventDefault(); SetMode("USB"); return; }
    if (k === "a") { e.preventDefault(); SetMode("AM");  return; }
    if (k === "q") { e.preventDefault(); SetMode("QUAM"); return; }
    if (k === "f") { e.preventDefault(); SetMode("FM");  return; }
    if (k === "w") { e.preventDefault(); toggleWaterfallDirection(); return; }
}

  onMount(() => window.addEventListener("keydown", onGlobalKey, { capture: true }));
  onDestroy(() => window.removeEventListener("keydown", onGlobalKey, { capture: true }));
  // End of the popup window

  // Window for system stats
  let showSystemStats = false;
  let systemStatsCloseBtnEl;
  let systemStatsInterval;

  // System stats data - will be fetched from server
  let systemStats = {
    cpu: { usage: 0, cores: 0, temperature: null, topProcesses: [] },
    memory: { used: 0, total: 0, percent: 0 },
    disk: { used: 0, total: 0, percent: 0 }
  };

  // Fetch system stats from the server
  async function fetchSystemStats() {
    try {
      const response = await fetch(`${siteStats}/api/system-stats`);
      if (response.ok) {
        systemStats = await response.json();
      } else {
        console.error('Failed to fetch system stats:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  }

  function openSystemStats() {
    showSystemStats = true;
    tick().then(() => systemStatsCloseBtnEl && systemStatsCloseBtnEl.focus());
    
    // Fetch stats immediately when opening
    fetchSystemStats();
    
    // Update stats every 5 seconds while the modal is open
    systemStatsInterval = setInterval(fetchSystemStats, 5000);
  }

  function closeSystemStats() {
    showSystemStats = false;
    
    // Stop updating when modal is closed
    if (systemStatsInterval) {
      clearInterval(systemStatsInterval);
      systemStatsInterval = null;
    }
  }

  function onSystemStatsKey(e) {
    if (showSystemStats && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeSystemStats();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onSystemStatsKey, { capture: true });
    // Optionally fetch stats on initial load
    fetchSystemStats();
  });
  
  onDestroy(() => {
    window.removeEventListener("keydown", onSystemStatsKey, { capture: true });
    if (systemStatsInterval) {
      clearInterval(systemStatsInterval);
    }
  });
  // End of system stats popup window

  // Wheel zooming, update passband and markers
  function handleWaterfallWheel(e) {
    const ctrlPressed = e.ctrlKey || e.metaKey; // metaKey for Mac Command key
    const shiftPressed = e.shiftKey;
    const shiftCtrlPressed = ctrlPressed && shiftPressed; // Both pressed together

    // If Ctrl, Shift, or Shift+Ctrl is pressed, adjust frequency instead of zooming
    if (ctrlPressed || shiftPressed || shiftCtrlPressed) {
      e.preventDefault(); // Prevent default scroll behavior
    if (shiftCtrlPressed) {e.preventDefault();
        // Snap to .000 kHz (coarse step)
        const base = Math.floor(Number(frequency) || 0);
        frequency = base;  // keep in kHz
        // Convert back to Hz for the tuner
        const hz = Math.round(base * 1000);
        frequencyInputComponent.setFrequency(hz);
        handleFrequencyChange({ detail: hz });

      return; // do NOT apply wheel delta further
    }

      // Determine step size based on which modifier key is pressed
      let stepSize;
      if (shiftPressed) {
        stepSize = 100; // Shift alone = 100 Hz
      } else if (ctrlPressed) {
        stepSize = 10;  // Ctrl alone = 10 Hz
    }

      // Determine frequency change direction based on wheel delta
      const delta = e.deltaY > 0 ? -stepSize : stepSize;

      // Get current center frequency in Hz
      let currentFreqHz = frequencyInputComponent.getFrequency();

      // Update frequency
      currentFreqHz += delta;

      // Ensure frequency is not negative
      currentFreqHz = Math.max(0, currentFreqHz);

      // Apply the new frequency
      frequencyInputComponent.setFrequency(currentFreqHz);
      handleFrequencyChange({ detail: currentFreqHz });

      // Update the display variable (convert Hz to kHz with 2 decimals)
      frequency = (currentFreqHz / 1e3).toFixed(2);
    } else {
      // Normal zoom behavior when no modifier keys are pressed
      waterfall.canvasWheel(e);
      passbandTunerComponent.updatePassbandLimits();
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  function handleBandPlanClick(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // First, check if a marker was clicked
    const markerClicked = waterfall.handleMarkerClick(x);

    // If no marker was clicked, handle the passband click
    if (!markerClicked) {
      passbandTunerComponent.handlePassbandClick(event);
    }
  }

  function handleBandPlanMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (waterfall.handleMarkerHover(x, y)) {
      event.target.style.cursor = "pointer";
    } else {
      event.target.style.cursor = "default";
      waterfall.updateBandPlan(); // Clear previous hover effects
    }
  }

  function handleGraduationClick(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top)  * (canvas.height / rect.height);
    const freqHz = waterfall.checkClientClick(canvasX, canvasY);
    if (freqHz !== null) {
      handleFrequencyChange({ detail: freqHz });
      frequency = Math.max(0, freqHz / 1e3).toFixed(2);
      frequencyInputComponent.setFrequency(freqHz);
    } else {
      passbandTunerComponent.handlePassbandClick(event);
    }
  }

  function handleClientsMouseMove(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top)  * (canvas.height / rect.height);
    canvas.style.cursor = waterfall.checkClientClick(x, y) !== null ? "pointer" : "default";
  }

  // ── Unified decoder toggle / dropdown ──────────────────────────────────
  let decoderOn       = false;   // Off/On master toggle
  let selectedDecoder = 'none';  // value from the <select> dropdown

  // internal per-decoder state (driven by activateSelectedDecoder)
  let ft8Enabled = false;
  let ft4Enabled = false;
  let cwEnabled   = false;
  let wsprEnabled = false;
  let wsprMessages = [];  // reactive list for Svelte WSPR panel
  let wsprSlotPos  = 0;   // 0–119 s position within current 2-min slot
  let wsprPhase    = 'waiting'; // 'waiting' | 'collecting' | 'decoding'
  let _wsprTimer   = null;

  function _wsprTickStart() {
    if (_wsprTimer) return;
    _wsprTimer = setInterval(() => {
      const now = new Date();
      wsprSlotPos = (now.getUTCMinutes() % 2) * 60 + now.getUTCSeconds();
      wsprPhase = wsprSlotPos >= 116 ? 'decoding'
                : wsprSlotPos >= 0   ? 'collecting'
                : 'waiting';
    }, 500);
  }
  function _wsprTickStop() {
    if (_wsprTimer) { clearInterval(_wsprTimer); _wsprTimer = null; }
    wsprSlotPos = 0; wsprPhase = 'waiting';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HF FAX / WEFAX decoder state
  // ─────────────────────────────────────────────────────────────────────────

  const FAX_STATIONS = [
    // ── Europe ────────────────────────────────────────────────────────────
    { name: 'GYA — UK Northwood',              freqs: [2618.5, 4610,   8040,   11086.5],                 lpm: 120, ioc: 576 },
    { name: 'DDH3/DDK6 — Germany Hamburg',     freqs: [3855,   7880,   13882.5],                         lpm: 120, ioc: 576 },
    { name: 'SVJ4 — Greece Athens',            freqs: [4482.9, 8106.9],                                  lpm: 120, ioc: 576 },
    // ── Russia ────────────────────────────────────────────────────────────
    { name: 'UDK2 — Russia Murmansk',          freqs: [6328.5, 8444.0],                                  lpm: 120, ioc: 576 },
    // ── Asia ──────────────────────────────────────────────────────────────
    { name: 'HLL2 — South Korea Seoul',        freqs: [3585,   5857.5, 7433.5, 9165,   13570],           lpm: 120, ioc: 576 },
    { name: 'JMH — Japan Tokyo',               freqs: [3622.5, 7795,   13988.5],                         lpm: 120, ioc: 576 },
    { name: 'JFX — Japan Kagoshima',           freqs: [4274,   8658,   13074,  16907.5, 22559.6],        lpm: 120, ioc: 576 },
    { name: 'XSG — China Shanghai',            freqs: [4170,   8302,   12382,  16559],                   lpm: 120, ioc: 576 },
    { name: 'XSQ — China Guangzhou',           freqs: [4199.8, 8412.5, 12629.3, 16826.3],               lpm: 120, ioc: 576 },
    // ── Pacific ───────────────────────────────────────────────────────────
    { name: 'VMC — Australia Charleville',     freqs: [2628,   5100,   11030,  13920,  20469],           lpm: 120, ioc: 576 },
    { name: 'VMW — Australia Wiluna',          freqs: [5755,   7535,   10555,  15615,  18060],           lpm: 120, ioc: 576 },
    { name: 'ZLM — New Zealand Wellington',    freqs: [3247.4, 5807,   13550.5, 16340],                  lpm: 120, ioc: 576 },
    // ── Americas ──────────────────────────────────────────────────────────
    { name: 'KVM70 — USA Honolulu HI',         freqs: [9982.5, 11090,  16135],                           lpm: 120, ioc: 576 },
    { name: 'NMC — USA Point Reyes CA',        freqs: [4346,   8682,   12786,  17151.2, 22527],          lpm: 120, ioc: 576 },
    { name: 'NMG — USA New Orleans LA',        freqs: [4317.9, 8503.9, 12789.9, 17146.4],               lpm: 120, ioc: 576 },
    { name: 'NMF — USA Boston MA',             freqs: [4235,   6340.5, 9110,   12750],                   lpm: 120, ioc: 576 },
    { name: 'NOJ — USA Kodiak AK',             freqs: [4298,   8459,   12412.5],                         lpm: 120, ioc: 576 },
    { name: 'VCO — Canada Sydney NS',          freqs: [4416,   6915.1],                                  lpm: 120, ioc: 576 },
    { name: 'CBV — Chile Valparaiso',          freqs: [4228,   8677,   17146.4],                         lpm: 120, ioc: 576 },
  ];

  let faxEnabled         = false;

  let faxLPM             = 120;
  let faxIOC             = 576;
  let faxShift           = 800;
  let faxAutoAlign       = true;
  let faxInvert          = false;
  let faxLineCount       = 0;
  let faxPhasing         = false;
  let faxStopTone        = false;
  let faxSelectedStation = '';
  let faxSelectedFreqIdx = 0;
  let faxStationObj      = null;

  const FAX_CANVAS_W = 910;
  const FAX_CANVAS_H = 540;
  let faxCanvas;
  let faxCtx = null;

  function _faxInitCanvas() {
    if (!faxCanvas) return;
    faxCtx = faxCanvas.getContext('2d', { willReadFrequently: true });
    faxCtx.fillStyle = '#000';
    faxCtx.fillRect(0, 0, FAX_CANVAS_W, FAX_CANVAS_H);
  }

  function _faxDrawLine(pixels) {
    if (!faxCtx) return;
    const W   = FAX_CANVAS_W;
    const H   = FAX_CANVAS_H;
    const PPL = pixels.length;
    const img = faxCtx.getImageData(0, 0, W, H);
    const d   = img.data;

    // Bottom-up streaming mode:
    // 1) move the existing image one line upward
    // 2) draw the newest line at the bottom
    d.copyWithin(0, W * 4, H * W * 4);

    const rowStart = (H - 1) * W * 4;
    for (let x = 0; x < W; x++) {
      const srcX = Math.min(PPL - 1, Math.floor(x * PPL / W));
      let g = (pixels[srcX] !== undefined ? pixels[srcX] : 0);
      if (faxInvert) g = 255 - g;
      const i = rowStart + x * 4;
      d[i]     = g;
      d[i + 1] = g;
      d[i + 2] = g;
      d[i + 3] = 255;
    }

    faxCtx.putImageData(img, 0, 0);
  }

  function _faxLineCallback(event) {
    if (event.type !== 'line') return;
    faxLineCount = event.lineNum;
    faxPhasing   = event.phasing;
    faxStopTone  = event.stopTone;
    _faxDrawLine(event.pixels);
  }

  function _faxDeactivate() {
    if (!faxEnabled) return;
    faxEnabled = false;
    audio.setFAXDecoding(false);
    audio.setFAXCallback(null);
    _faxCountdownStop();
    const m = _bandDefaultMode();
    if (m !== demodulation) { demodulation = m; handleDemodulationChange(null, true); }
    if (audio && typeof audio.updateFilters === 'function') audio.updateFilters();
  }

  function _faxActivate() {
    tick().then(() => {
      _faxInitCanvas();
      faxLineCount = 0;
      faxPhasing   = false;
      faxStopTone  = false;
      audio.setFAXParams(faxLPM, faxIOC, faxShift);
      audio.setFAXAutoAlign(faxAutoAlign);
      audio.setFAXCallback(_faxLineCallback);
      audio.setFAXDecoding(true);
      // FAX is always received USB
      if (demodulation !== 'USB') {
        demodulation = 'USB';
        handleDemodulationChange(null, true);
      }
    });
    _faxCountdownStart();
  }

  function _faxUpdateParams() {
    if (!faxEnabled) return;
    audio.setFAXParams(faxLPM, faxIOC, faxShift);
    audio.setFAXAutoAlign(faxAutoAlign);
  }

  function faxRefresh() {
    faxLineCount = 0;
    faxPhasing   = false;
    faxStopTone  = false;
    if (faxCtx) {
      faxCtx.fillStyle = '#000';
      faxCtx.fillRect(0, 0, FAX_CANVAS_W, FAX_CANVAS_H);
    }
    if (faxEnabled) {
      audio.setFAXDecoding(false);
      audio.setFAXDecoding(true);
      audio.setFAXParams(faxLPM, faxIOC, faxShift);
      audio.setFAXAutoAlign(faxAutoAlign);
      audio.setFAXCallback(_faxLineCallback);
    }
  }

  function faxSaveImage() {
    if (!faxCanvas) return;
    const a  = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace(':', '-');
    a.download = `hffax_${ts}.png`;
    a.href     = faxCanvas.toDataURL('image/png');
    a.click();
  }

  function faxApplyStation() {
    const st = FAX_STATIONS.find(s => s.name === faxSelectedStation);
    if (!st) return;
    faxStationObj = st;
    faxLPM = st.lpm;
    faxIOC = st.ioc;
    const freqKhz = st.freqs[faxSelectedFreqIdx] || st.freqs[0];
    // WEFAX stations are published as the centre frequency of the signal.
    // In USB mode the dial must be set 1900 Hz BELOW that centre so that
    // the black tone (1500 Hz) and white tone (2300 Hz) both fall inside
    // the passband.  e.g. 13882.5 kHz centre → dial 13880.6 kHz USB.
    const FAX_USB_OFFSET_HZ = 1900;
    const hz = Math.round(freqKhz * 1000) - FAX_USB_OFFSET_HZ;
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(2);
    } catch(e) { console.warn('[FAX] tune error', e); }
    demodulation = 'USB';
    handleDemodulationChange(null, true);
    _faxUpdateParams();
  }

  function faxToggleAutoAlign() {
    faxAutoAlign = !faxAutoAlign;
    if (faxEnabled) audio.setFAXAutoAlign(faxAutoAlign);
  }

  function faxToggleInvert() {
    faxInvert = !faxInvert;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SSTV desktop + mobile panel state
  // ─────────────────────────────────────────────────────────────────────────

  let sstvEnabled = false;
  let sstvRunning = false;
  let sstvCanvas;
  let sstvCtx = null;
  let sstvModeChoice = 'auto';
  let sstvDetectedMode = '';
  let sstvStatusText = '';
  let sstvLineCount = 0;
  let sstvSoftSync = false;
  const SSTV_CANVAS_W = 320;
  const SSTV_CANVAS_H = 256;

  function _sstvInitCanvas() {
    if (!sstvCanvas) return;
    sstvCanvas.width = SSTV_CANVAS_W;
    sstvCanvas.height = SSTV_CANVAS_H;
    sstvCtx = sstvCanvas.getContext('2d', { willReadFrequently: true });
    sstvCtx.fillStyle = '#000';
    sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, SSTV_CANVAS_H);
  }

  async function sstvRefresh() {
    // Reset must stop, clean and restart the decoder.
    const wasRunning = !!sstvRunning;

    sstvRunning = false;
    sstvLineCount = 0;
    sstvSoftSync = false;
    sstvDetectedMode = '';
    sstvStatusText = 'Resetting SSTV decoder';

    if (sstvCtx) {
      sstvCtx.fillStyle = '#000';
      sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, SSTV_CANVAS_H);
    }

    audio.setSSTVDecoding(false);
    audio.setSSTVCallback(null);

    if (audio && typeof audio.resetSSTVDecoder === 'function') {
      audio.resetSSTVDecoder(sstvModeChoice);
    }

    await tick();
    await new Promise((resolve) => setTimeout(resolve, 90));

    if (sstvEnabled && wasRunning) {
      sstvStatusText = 'Waiting for VIS / AUTO lock';
      audio.setSSTVMode(sstvModeChoice);

      if (audio && typeof audio.resetSSTVDecoder === 'function') {
        audio.resetSSTVDecoder(sstvModeChoice);
      }

      audio.setSSTVCallback(_sstvCallback);
      audio.setSSTVDecoding(true);
      sstvRunning = true;
    } else {
      sstvStatusText = 'SSTV stopped';
    }
  }

  function sstvSaveImage() {
    if (!sstvCanvas) return;
    const a  = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 16).replace(':', '-');
    a.download = `sstv_${ts}.png`;
    a.href     = sstvCanvas.toDataURL('image/png');
    a.click();
  }

  function _sstvDrawLine(event) {
    if (!sstvCtx || !event?.pixels) return;
    const y = Math.max(0, Math.min(SSTV_CANVAS_H - 1, event.lineNum || 0));
    const row = new ImageData(event.pixels, event.width || SSTV_CANVAS_W, 1);
    sstvCtx.putImageData(row, 0, y);
  }

  function _sstvCallback(event) {
    if (!event) return;
    if (event.type === 'mode') {
      sstvDetectedMode = event.mode || '';
    } else if (event.type === 'status') {
      sstvStatusText = event.text || '';
    } else if (event.type === 'line') {
      sstvLineCount = (event.lineNum || 0) + 1;
      sstvSoftSync = !!event.soft;
      if (event.mode) sstvDetectedMode = event.mode;
      _sstvDrawLine(event);
    }
  }

  function _sstvStop() {
    sstvRunning = false;
    sstvSoftSync = false;
    sstvLineCount = 0;
    sstvDetectedMode = '';
    sstvStatusText = 'SSTV stopped';

    audio.setSSTVDecoding(false);
    audio.setSSTVCallback(null);

    if (audio && typeof audio.resetSSTVDecoder === 'function') {
      audio.resetSSTVDecoder(sstvModeChoice);
    }

    if (sstvCtx) {
      sstvCtx.fillStyle = '#000';
      sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, SSTV_CANVAS_H);
    }
  }

  function _sstvDeactivate() {
    if (!sstvEnabled) return;
    sstvEnabled = false;
    _sstvStop();
    const m = _bandDefaultMode();
    if (m !== demodulation) { demodulation = m; handleDemodulationChange(null, true); }
    if (audio && typeof audio.updateFilters === 'function') audio.updateFilters();
  }

  function _sstvStart() {
    tick().then(async () => {
      _sstvInitCanvas();
      sstvRunning = true;
      sstvLineCount = 0;
      sstvDetectedMode = '';
      sstvSoftSync = false;
      sstvStatusText = 'Waiting for VIS / AUTO lock';

      audio.setSSTVDecoding(false);
      audio.setSSTVCallback(null);
      if (audio && typeof audio.resetSSTVDecoder === 'function') {
        audio.resetSSTVDecoder(sstvModeChoice);
      }

      await tick();
      await new Promise((resolve) => setTimeout(resolve, 60));

      audio.setSSTVMode(sstvModeChoice);
      if (audio && typeof audio.resetSSTVDecoder === 'function') {
        audio.resetSSTVDecoder(sstvModeChoice);
      }
      audio.setSSTVCallback(_sstvCallback);
      audio.setSSTVDecoding(true);

      if (demodulation !== 'USB') {
        demodulation = 'USB';
        handleDemodulationChange(null, true);
      }
    });
  }

  function _sstvActivate() {
    _sstvStart();
  }

  function sstvModeChanged() {
    if (sstvEnabled) {
      audio.setSSTVMode(sstvModeChoice);
      if (sstvRunning) sstvRefresh();
    }
  }

  // ── END SSTV state ──────────────────────────────────────────────────────

  // ── END FAX state ─────────────────────────────────────────────────────────


  /**
   * Look up the correct default demodulation mode for the current frequency
   * using the same bands-config data that updateBandButton uses.
   * Falls back to 'USB' if no match found.
   */
  function _bandDefaultMode() {
    const freqHz = frequency * 1000;
    for (let i = 0; i < bandArray.length; i++) {
      const b = bandArray[i];
      if (freqHz >= b.startFreq && freqHz <= b.endFreq &&
          (b.ITU === siteRegion || b.ITU === 123)) {
        if (b.modes && b.modes.length > 0) {
          let segMode = b.modes[0].mode;
          for (let j = 0; j < b.modes.length; j++) {
            if (freqHz >= b.modes[j].startFreq && freqHz <= b.modes[j].endFreq) {
              segMode = b.modes[j].mode;
              break;
            }
          }
          return segMode;
        }
        break;
      }
    }
    return 'USB';
  }

  // HF FAX broadcast schedule — session start times per station
  // Source: weatherfax.com, DWD, NOAA rfax.pdf (March 2025)
  const FAX_SCHEDULE = {
    'GYA — UK Northwood':              [ {hh:0,mm:0,label:'Surface Analysis (18Z)'},{hh:3,mm:0,label:'Surface Analysis (00Z)'},{hh:4,mm:0,label:'Surface Analysis (00Z)'},{hh:5,mm:0,label:'Surface Analysis (00Z)'},{hh:6,mm:12,label:'Surface Analysis (00Z)'},{hh:9,mm:0,label:'Surface Analysis (06Z)'},{hh:10,mm:0,label:'Surface Analysis (06Z)'},{hh:11,mm:0,label:'Surface Analysis (06Z)'},{hh:12,mm:0,label:'Surface Analysis (06Z)'},{hh:14,mm:36,label:'Surface Analysis (12Z)'},{hh:15,mm:0,label:'Surface Analysis (12Z)'},{hh:16,mm:0,label:'Surface Analysis (12Z)'},{hh:17,mm:0,label:'Surface Analysis (12Z)'},{hh:18,mm:0,label:'Surface Analysis (12Z)'},{hh:21,mm:0,label:'Surface Analysis (18Z)'},{hh:22,mm:0,label:'Surface Analysis (18Z)'},{hh:23,mm:0,label:'Surface Analysis (18Z)'} ],
    'DDH3/DDK6 — Germany Hamburg':     [ {hh:4,mm:30,label:'Surface Analysis N Atlantic/Europe'},{hh:5,mm:25,label:'Surface Pressure Analysis'},{hh:10,mm:50,label:'Surface Analysis N Atlantic/Europe'},{hh:16,mm:36,label:'Surface Analysis N Atlantic/Europe'},{hh:18,mm:0,label:'Surface Pressure Analysis'},{hh:22,mm:0,label:'Surface Analysis N Atlantic/Europe'} ],
    'SVJ4 — Greece Athens':            [ {hh:8,mm:45,label:'Surface Analysis Mediterranean'},{hh:10,mm:9,label:'30hr Wave Height Forecast'},{hh:10,mm:21,label:'36hr Wave Height Forecast'},{hh:10,mm:33,label:'42hr Wave Height Forecast'},{hh:10,mm:45,label:'48hr Wave Height Forecast'} ],
    'UDK2 — Russia Murmansk':          [ {hh:0,mm:0,label:'Surface Analysis Arctic/N Atlantic'},{hh:12,mm:0,label:'Surface Analysis Arctic/N Atlantic'} ],
    'JMH — Japan Tokyo':               [ {hh:0,mm:0,label:'Surface Analysis N Pacific'},{hh:2,mm:40,label:'Surface Analysis N Pacific'},{hh:6,mm:0,label:'Surface Analysis N Pacific'},{hh:12,mm:0,label:'Surface Analysis N Pacific'},{hh:18,mm:0,label:'Surface Analysis N Pacific'} ],
    'JFX — Japan Kagoshima':           [ {hh:0,mm:0,label:'Pacific Fisheries Chart'},{hh:6,mm:0,label:'Pacific Fisheries Chart'},{hh:12,mm:0,label:'Pacific Fisheries Chart'},{hh:18,mm:0,label:'Pacific Fisheries Chart'} ],
    'XSG — China Shanghai':            [ {hh:0,mm:0,label:'Surface Analysis W Pacific'},{hh:6,mm:0,label:'Surface Analysis W Pacific'},{hh:12,mm:0,label:'Surface Analysis W Pacific'},{hh:18,mm:0,label:'Surface Analysis W Pacific'} ],
    'VMC — Australia Charleville':     [ {hh:0,mm:0,label:'Surface Analysis Indian/S Pacific'},{hh:6,mm:0,label:'Surface Analysis Indian/S Pacific'},{hh:12,mm:0,label:'Surface Analysis Indian/S Pacific'},{hh:18,mm:0,label:'Surface Analysis Indian/S Pacific'} ],
    'VMW — Australia Wiluna':          [ {hh:0,mm:0,label:'Surface Analysis Indian Ocean'},{hh:6,mm:0,label:'Surface Analysis Indian Ocean'},{hh:12,mm:0,label:'Surface Analysis Indian Ocean'},{hh:18,mm:0,label:'Surface Analysis Indian Ocean'} ],
    'KVM70 — USA Honolulu HI':         [ {hh:0,mm:0,label:'Surface Analysis Central Pacific'},{hh:6,mm:0,label:'Surface Analysis Central Pacific'},{hh:12,mm:0,label:'Surface Analysis Central Pacific'},{hh:18,mm:0,label:'Surface Analysis Central Pacific'} ],
    'NMC — USA Point Reyes CA':        [ {hh:0,mm:0,label:'Surface Analysis N Pacific'},{hh:6,mm:0,label:'Surface Analysis N Pacific'},{hh:12,mm:0,label:'Surface Analysis N Pacific'},{hh:18,mm:0,label:'Surface Analysis N Pacific'} ],
    'NMF — USA Boston MA':             [ {hh:0,mm:0,label:'Surface Analysis N Atlantic'},{hh:6,mm:0,label:'Surface Analysis N Atlantic'},{hh:12,mm:0,label:'Surface Analysis N Atlantic'},{hh:18,mm:0,label:'Surface Analysis N Atlantic'} ],
    'NMG — USA New Orleans LA':        [ {hh:0,mm:0,label:'Surface Analysis Gulf/Caribbean'},{hh:6,mm:0,label:'Surface Analysis Gulf/Caribbean'},{hh:12,mm:0,label:'Surface Analysis Gulf/Caribbean'},{hh:18,mm:0,label:'Surface Analysis Gulf/Caribbean'} ],
    'NOJ — USA Kodiak AK':             [ {hh:0,mm:0,label:'Surface Analysis N Pacific'},{hh:6,mm:0,label:'Surface Analysis N Pacific'},{hh:12,mm:0,label:'Surface Analysis N Pacific'},{hh:18,mm:0,label:'Surface Analysis N Pacific'} ],
    'VCO — Canada Sydney NS':          [ {hh:2,mm:0,label:'Surface Analysis N Atlantic'},{hh:14,mm:0,label:'Surface Analysis N Atlantic'} ],
    'CBV — Chile Valparaiso':          [ {hh:0,mm:0,label:'Surface Analysis SE Pacific'},{hh:12,mm:0,label:'Surface Analysis SE Pacific'} ],
  };

  let faxScheduleRows   = [];
  let faxCountdownTimer = null;

  function _faxTickCountdown() {
    const sched = FAX_SCHEDULE[faxSelectedStation];
    if (!sched || !sched.length) { faxScheduleRows = []; return; }
    const now    = new Date();
    const nowSec = now.getUTCHours()*3600 + now.getUTCMinutes()*60 + now.getUTCSeconds();
    faxScheduleRows = sched.map(({hh,mm,label}) => {
      const slotSec = hh*3600 + mm*60;
      let wait = slotSec - nowSec; if (wait <= 0) wait += 86400;
      const h = Math.floor(wait/3600), m = Math.floor((wait%3600)/60), s = wait%60;
      return {
        utc: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`,
        label, secUntil: wait,
        countdown: h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`,
        urgent: wait <= 180, imminent: wait <= 30,
      };
    }).sort((a,b) => a.secUntil - b.secUntil).slice(0,4);
  }

  function _faxCountdownStart() {
    _faxTickCountdown();
    faxCountdownTimer = setInterval(_faxTickCountdown, 1000);
  }
  function _faxCountdownStop() {
    if (faxCountdownTimer) { clearInterval(faxCountdownTimer); faxCountdownTimer = null; }
    faxScheduleRows = [];
  }

  // ── NAVTEX / SITOR-B decoder state ───────────────────────────────────────

  const NAVTEX_STATIONS = [
    { name: 'International — 518 kHz',   freqKhz: 518     },
    { name: 'Domestic — 490 kHz',        freqKhz: 490     },
    { name: 'HF — 4209.5 kHz',          freqKhz: 4209.5  },
    { name: 'HF — 6314 kHz',            freqKhz: 6314    },
    { name: 'HF — 8416.5 kHz',          freqKhz: 8416.5  },
    { name: 'HF — 12579 kHz',           freqKhz: 12579   },
    { name: 'HF — 16806.5 kHz',         freqKhz: 16806.5 },
  ];


  // UTC broadcast schedule per channel (source: HNHS / ITU)
  // Slot is deterministic: (B1_letter - 'A') × 10 min, repeating every 4 h
  const NAVTEX_DB = [
    { id:'A', freq:518,    area:'I',    flag:'🇫🇷', name:'Cross Corsen'              },
    { id:'B', freq:518,    area:'I',    flag:'🇳🇴', name:'Bodø'                      },
    { id:'C', freq:518,    area:'I',    flag:'🇳🇴', name:'Vardø'                     },
    { id:'D', freq:518,    area:'I',    flag:'🇫🇴', name:'Torshavn'                  },
    { id:'E', freq:518,    area:'I',    flag:'🇬🇧', name:'Niton'                     },
    { id:'G', freq:518,    area:'I',    flag:'🇬🇧', name:'Cullercoats'               },
    { id:'H', freq:518,    area:'I',    flag:'🇸🇪', name:'Stockholm (Bjuröklubb)'    },
    { id:'J', freq:518,    area:'I',    flag:'🇸🇪', name:'Stockholm (Gislövshammar)' },
    { id:'K', freq:518,    area:'I',    flag:'🇫🇮', name:'Helsinki'                  },
    { id:'M', freq:518,    area:'I',    flag:'🇧🇪', name:'Oostende (Thames)'         },
    { id:'N', freq:518,    area:'I',    flag:'🇳🇴', name:'Ørlandet'                  },
    { id:'O', freq:518,    area:'I',    flag:'🇬🇧', name:'Portpatrick'               },
    { id:'Q', freq:518,    area:'I',    flag:'🇮🇪', name:'Malin Head'                },
    { id:'R', freq:518,    area:'I',    flag:'🇳🇴', name:'Rogaland'                  },
    { id:'S', freq:518,    area:'I',    flag:'🇩🇪', name:'Hamburg (Pinneberg)'       },
    { id:'T', freq:518,    area:'I',    flag:'🇧🇪', name:'Oostende'                  },
    { id:'U', freq:518,    area:'I',    flag:'🇪🇪', name:'Tallinn'                   },
    { id:'W', freq:518,    area:'I',    flag:'🇮🇪', name:'Valentia'                  },
    { id:'X', freq:518,    area:'I',    flag:'🇮🇸', name:'Grindavík'                 },
    { id:'K', freq:518,    area:'XIX',  flag:'🇷🇺', name:'Murmansk'                  },
    { id:'L', freq:518,    area:'XIX',  flag:'🇷🇺', name:'Arkhangelsk'               },
    { id:'A', freq:518,    area:'XX',   flag:'🇳🇴', name:'Svalbard'                  },
    { id:'D', freq:518,    area:'II',   flag:'🇪🇸', name:'La Coruña'                 },
    { id:'F', freq:518,    area:'II',   flag:'🇵🇹', name:'Horta (Azores)'            },
    { id:'I', freq:518,    area:'II',   flag:'🇪🇸', name:'Las Palmas (Canaries)'     },
    { id:'P', freq:518,    area:'II',   flag:'🇵🇹', name:'Porto Santo (Madeira)'     },
    { id:'R', freq:518,    area:'II',   flag:'🇵🇹', name:'Monsanto (Lisboa)'         },
    { id:'B', freq:518,    area:'III',  flag:'🇩🇿', name:'Aïn Taya'                  },
    { id:'G', freq:518,    area:'III',  flag:'🇪🇸', name:'Tarifa'                    },
    { id:'H', freq:518,    area:'III',  flag:'🇬🇷', name:'Heraklion'                 },
    { id:'K', freq:518,    area:'III',  flag:'🇬🇷', name:'Kerkyra'                   },
    { id:'L', freq:518,    area:'III',  flag:'🇬🇷', name:'Limnos'                    },
    { id:'N', freq:518,    area:'III',  flag:'🇹🇷', name:'Samsun'                    },
    { id:'R', freq:518,    area:'III',  flag:'🇮🇹', name:'La Maddalena'              },
    { id:'W', freq:518,    area:'III',  flag:'🇫🇷', name:'La Garde'                  },
    { id:'X', freq:518,    area:'III',  flag:'🇪🇸', name:'Cabo la Nao'               },
    { id:'F', freq:518,    area:'IV',   flag:'🇺🇸', name:'Boston (Cape Cod)'         },
    { id:'N', freq:518,    area:'IV',   flag:'🇺🇸', name:'Chesapeake'                },
    { id:'W', freq:518,    area:'IV',   flag:'🇺🇸', name:'Miami'                     },
    { id:'R', freq:518,    area:'IV',   flag:'🇺🇸', name:'New Orleans'               },
    { id:'A', freq:518,    area:'IV',   flag:'🇺🇸', name:'Kodiak'                    },
    { id:'A', freq:490,    area:'I',    flag:'🇮🇪', name:'Malin Head'                },
    { id:'B', freq:490,    area:'I',    flag:'🇧🇪', name:'Oostende'                  },
    { id:'C', freq:490,    area:'I',    flag:'🇬🇧', name:'Portpatrick'               },
    { id:'E', freq:490,    area:'II',   flag:'🇫🇷', name:'Ouessant'                  },
    { id:'G', freq:490,    area:'II',   flag:'🇵🇹', name:'Monsanto (Lisboa)'         },
    { id:'J', freq:490,    area:'II',   flag:'🇵🇹', name:'Horta (Azores)'            },
    { id:'K', freq:490,    area:'I',    flag:'🇮🇸', name:'Grindavík'                 },
    { id:'L', freq:490,    area:'I',    flag:'🇩🇪', name:'Hamburg'                   },
    { id:'M', freq:490,    area:'II',   flag:'🇵🇹', name:'Porto Santo (Madeira)'     },
    { id:'N', freq:490,    area:'III',  flag:'🇮🇹', name:'Piombino'                  },
    { id:'P', freq:490,    area:'III',  flag:'🇬🇷', name:'Kerkyra'                   },
    { id:'Q', freq:490,    area:'III',  flag:'🇬🇷', name:'Heraklion'                 },
    { id:'R', freq:490,    area:'III',  flag:'🇬🇷', name:'Limnos'                    },
    { id:'S', freq:490,    area:'III',  flag:'🇫🇷', name:'La Garde'                  },
    { id:'T', freq:490,    area:'I',    flag:'🇬🇧', name:'Niton (French forecast)'   },
    { id:'T', freq:490,    area:'III',  flag:'🇪🇸', name:'Tarifa'                    },
    { id:'U', freq:490,    area:'I',    flag:'🇬🇧', name:'Cullercoats'               },
    { id:'W', freq:490,    area:'II',   flag:'🇪🇸', name:'La Coruña'                 },
    { id:'S', freq:4209.5, area:'III',  flag:'🇬🇷', name:'Heraklion'                 },
  ];

  function _nvTimes(id) {
    const slot = (id.toUpperCase().charCodeAt(0) - 65) * 600;
    return [0,1,2,3,4,5].map(i => (slot + i * 14400) % 86400);
  }

  let navtexScheduleRows   = [];
  let navtexCountdownTimer = null;

  function _navtexTickCountdown() {
    const sel   = NAVTEX_STATIONS.find(s => s.name === navtexSelectedStation);
    const freq  = sel ? sel.freqKhz : null;
    const stats = freq ? NAVTEX_DB.filter(s => s.freq === freq) : [];
    if (!stats.length) { navtexScheduleRows = []; return; }
    const now    = new Date();
    const nowSec = now.getUTCHours()*3600 + now.getUTCMinutes()*60 + now.getUTCSeconds();
    navtexScheduleRows = stats.map(st => {
      const times = _nvTimes(st.id);
      let minWait = Infinity, nextSec = 0;
      for (const t of times) {
        let w = t - nowSec; if (w <= 0) w += 86400;
        if (w < minWait) { minWait = w; nextSec = t; }
      }
      const hh = Math.floor(minWait/3600);
      const mm = Math.floor((minWait%3600)/60);
      const ss = minWait%60;
      const nUh = Math.floor(nextSec/3600)%24;
      const nUm = Math.floor((nextSec%3600)/60);
      return {
        id: st.id, flag: st.flag, name: st.name, area: st.area,
        secUntil: minWait,
        nextUTC: `${String(nUh).padStart(2,'0')}:${String(nUm).padStart(2,'0')}`,
        label: hh > 0
          ? `${hh}h ${String(mm).padStart(2,'0')}m ${String(ss).padStart(2,'0')}s`
          : `${String(mm).padStart(2,'0')}m ${String(ss).padStart(2,'0')}s`,
        urgent:   minWait <= 120,
        imminent: minWait <= 30,
      };
    }).sort((a,b) => a.secUntil - b.secUntil);
  }

  function _navtexCountdownStart() {
    _navtexTickCountdown();
    navtexCountdownTimer = setInterval(_navtexTickCountdown, 1000);
  }
  function _navtexCountdownStop() {
    if (navtexCountdownTimer) { clearInterval(navtexCountdownTimer); navtexCountdownTimer = null; }
    navtexScheduleRows = [];
  }

  let navtexEnabled         = false;
  let navtexSelectedStation = NAVTEX_STATIONS[0].name;
  let navtexMessages        = [];
  let navtexCurrentLine     = '';
  let navtexScrollEl;
  let navtexStatusText      = '';

  // ── RADE v1 state ─────────────────────────────────────────────────────────
  let radeEnabled   = false;
  let radeConnected = false;
  let radeSynced    = false;
  let radeSnr       = null;

  function _radeDeactivate() {
    if (!radeEnabled) return;
    radeEnabled = false; radeConnected = false; radeSynced = false; radeSnr = null;
    audio.setRADEDecoding(false);
    audio.setRADECallback(null);
    demodulation = _bandDefaultMode();
    handleDemodulationChange(null, true);
    if (audio && typeof audio.updateFilters === 'function') audio.updateFilters();
  }

  function _navtexDeactivate() {
    if (!navtexEnabled) return;
    navtexEnabled = false;
    audio.setNAVTEXDecoding(false);
    audio.setNAVTEXCallback(null);
    _navtexCountdownStop();
    demodulation = _bandDefaultMode();
    handleDemodulationChange(null, true);
    if (audio && typeof audio.updateFilters === 'function') audio.updateFilters();
  }

  function _navtexActivate() {
    navtexMessages    = [];
    navtexCurrentLine = '';
    navtexStatusText  = '';
    _navtexCountdownStart();
    audio.setNAVTEXDecoding(true);
    audio.setNAVTEXCallback((event) => {
      if (event.type === 'char') {
        const ch = event.char;
        if (ch === '\r') return;
        if (ch === '\n') {
          if (navtexCurrentLine.trim()) {
            navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
            navtexCurrentLine = '';
          }
          return;
        }
        navtexCurrentLine += ch;
        if (navtexCurrentLine.length >= 72) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = '';
        }
      } else if (event.type === 'navstart') {
        if (navtexCurrentLine.trim()) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = '';
        }
        navtexMessages = [...navtexMessages,
          `━━ ZCZC ${event.station}${event.subject}${event.seq} ━━`
        ].slice(-300);
      } else if (event.type === 'navend') {
        if (navtexCurrentLine.trim()) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = '';
        }
        navtexMessages = [...navtexMessages, '━━ NNNN ━━', ''].slice(-300);
      } else if (event.type === 'status') {
        navtexStatusText = event.text;
      }
      navtexMessages    = navtexMessages;
      navtexCurrentLine = navtexCurrentLine;
    });
  }

  function navtexApplyStation() {
    const st = NAVTEX_STATIONS.find(s => s.name === navtexSelectedStation);
    if (!st) return;
    const NAVTEX_USB_OFFSET_HZ = 500;
    const hz = Math.round(st.freqKhz * 1000) - NAVTEX_USB_OFFSET_HZ;
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(2);
    } catch(e) { console.warn('[NAVTEX] tune error', e); }
    demodulation = 'USB';
    handleDemodulationChange(null, true);
        // Narrow IF to 350–650 Hz audio (300 Hz passband centred on 500 Hz)
    const navL = hz + 350;   // was 375
    const navM = hz;
    const navR = hz + 650;   // was 625
    const audioParameters       = [navL, navM, navR].map(frequencyToFFTOffset);
    const audioParametersOffset = [navL - 200, navM - 750, navR - 200].map(frequencyToFFTOffset);
        audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    if (typeof updatePassband === 'function') updatePassband();
    if (typeof updateLink === 'function') updateLink();
  }

  function navtexClear() {
    navtexMessages    = [];
    navtexCurrentLine = '';
    navtexStatusText  = '';
  }

  afterUpdate(() => {
    if (navtexScrollEl) navtexScrollEl.scrollTop = navtexScrollEl.scrollHeight;
  });

  // ── END NAVTEX state ──────────────────────────────────────────────────────

  // ── FSK / RTTY decoder state ─────────────────────────────────────────────
  const FSK_VARIANT_PRESETS = {
    maritime: { center: 500, shift: 170, baud: 100, framing: '7N1', encoding: 'ccir476' },
    weather:  { center: 1000, shift: 450, baud: 50, framing: '5N1.5', encoding: 'ita2' },
    ham:      { center: 1000, shift: 170, baud: 45.45, framing: '5N1.5', encoding: 'ita2' },
  };

  const FSK_KNOWN_FREQUENCIES = {
    maritime: [
      { label: '518.00 kHz — International NAVTEX', khz: 518.0 },
      { label: '490.00 kHz — National NAVTEX', khz: 490.0 },
      { label: '4209.50 kHz — HF SITOR', khz: 4209.5 },
      { label: '6314.00 kHz — HF SITOR', khz: 6314.0 },
      { label: '8416.50 kHz — HF SITOR', khz: 8416.5 },
      { label: '12579.00 kHz — HF SITOR', khz: 12579.0 },
      { label: '16806.50 kHz — HF SITOR', khz: 16806.5 },
      { label: '22376.00 kHz — HF SITOR', khz: 22376.0 },
    ],
    weather: [
      // DWD Programme 1 (English — North Sea, Baltic, N Atlantic, Mediterranean 5-day)
      { label: '4583.00 kHz — DWD Prog.1 DDK2',  khz: 4583.0 },
      { label: '7646.00 kHz — DWD Prog.1 DDH7',  khz: 7646.0 },
      { label: '10100.80 kHz — DWD Prog.1 DDK9', khz: 10100.8 },
      // DWD Programme 2 (German — North Sea, Baltic coast, Mediterranean)
      { label: '11039.00 kHz — DWD Prog.2 DDH9', khz: 11039.0 },
      { label: '14467.30 kHz — DWD Prog.2 DDK8', khz: 14467.3 },
    ],
    ham: [
      { label: '3590.00 kHz — 80m RTTY', khz: 3590.0 },
      { label: '7043.00 kHz — 40m RTTY', khz: 7043.0 },
      { label: '10143.00 kHz — 30m RTTY', khz: 10143.0 },
      { label: '14083.00 kHz — 20m RTTY', khz: 14083.0 },
      { label: '21083.00 kHz — 15m RTTY', khz: 21083.0 },
      { label: '28083.00 kHz — 10m RTTY', khz: 28083.0 },
    ]
  };

  let fskEnabled = false;
  let fskVariant = 'maritime';
  let fskKnownFrequency = '';
  let fskTextLines = [];
  let fskCurrentLine = '';
  let fskScrollEl;
  let fskStatusText = '';
  let fskShift = 170;
  let fskCenter = 500;
  let fskBaud = 100;
  let fskFraming = '7N1';
  let fskEncoding = 'ccir476';
  let fskInvert = false;
  let fskAutoShift = true;
  let fskMetrics = { snrDb: 0, lockQuality: 0, markHz: 585, spaceHz: 415, timingLocked: false };

  let _fskControlBackup = null;

  function _applyFskVariantDefaults(v) {
    const p = FSK_VARIANT_PRESETS[v] || FSK_VARIANT_PRESETS.maritime;
    fskCenter = p.center;
    fskShift = p.shift;
    fskBaud = p.baud;
    fskFraming = p.framing;
    fskEncoding = p.encoding;
    if (v === 'maritime') fskKnownFrequency = '518.0';
  }

  function _fskEffectiveConfig() {
    return {
      center: Number(fskCenter) || 1000,
      shift: Number(fskShift) || 170,
      baud: Number(fskBaud) || 45.45,
      framing: fskFraming,
      encoding: fskEncoding,
      inverted: !!fskInvert,
    };
  }

  function _fskRememberReceiverControl() {
    if (_fskControlBackup) return;
    _fskControlBackup = {
      demodulation,
      audioRange: audio.getAudioRange ? [...audio.getAudioRange()] : null,
    };
  }

  function _fskRestoreReceiverControl() {
    if (!_fskControlBackup) return;
    try {
      const currentHz = Number(frequencyInputComponent && frequencyInputComponent.getFrequency ? frequencyInputComponent.getFrequency() : 0) || Math.round((Number(frequency) || 0) * 1000);
      const restoreMode = _bandDefaultMode();

      // Restore exactly the same way as the other decoders: return to the
      // band-default mode/passband, then re-assert the current dial frequency
      // so the tuned marker/cursor becomes visible again immediately.
      if (restoreMode !== demodulation) {
        demodulation = restoreMode;
        handleDemodulationChange(null, true);
      } else {
        passbandTunerComponent.setMode(demodulation);
        const dm = demodulationDefaults[demodulation];
        if (demodulation === 'WBFM') {
          audio.setFmDeemph(50e-6);
        } else {
          audio.setFmDeemph(0);
        }
        if (dm) audio.setAudioDemodulation(dm.type);
        const defaults = dm ? dm.offsets : undefined;
        if (defaults && defaults.length >= 2) {
          const l = currentHz - defaults[0];
          const m = currentHz + (dm.bfo || 0);
          const r = currentHz + defaults[1];
          const lOffset = l - 200;
          const mOffset = m - 750;
          const rOffset = r - 200;
          const audioParameters = [l, m, r].map(frequencyToFFTOffset);
          const audioParametersOffset = [lOffset, mOffset, rOffset].map(frequencyToFFTOffset);
          audio.setAudioRange(...audioParameters, ...audioParametersOffset);
          if (typeof updatePassband === 'function') updatePassband();
          if (typeof updateLink === 'function') updateLink();
        }
      }

      if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(currentHz);
      handleFrequencyChange({ detail: currentHz, markerclick: true });
      frequency = (currentHz / 1e3).toFixed(2);
      if (audio && typeof audio.updateFilters === 'function') audio.updateFilters();
    } catch (e) {
      console.warn('[FSK] restore receiver control failed', e);
    }
    _fskControlBackup = null;
  }

  function fskApplyBandpass() {
    const cfg = _fskEffectiveConfig();
    const hz = Math.round((Number(frequency) || 0) * 1000);
    const low = hz + Math.round(cfg.center - cfg.shift / 2 - 120);
    const mid = hz;
    const high = hz + Math.round(cfg.center + cfg.shift / 2 + 120);
    const audioParameters = [low, mid, high].map(frequencyToFFTOffset);
    const audioParametersOffset = [low - 200, mid - 750, high - 200].map(frequencyToFFTOffset);
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    if (typeof updatePassband === 'function') updatePassband();
    if (typeof updateLink === 'function') updateLink();
  }

  function _fskTakeReceiverControl() {
    _fskRememberReceiverControl();
    demodulation = 'USB';
    // Do NOT call handleDemodulationChange — it runs BFO compensation that
    // shifts the center frequency and moves the cursor.  Just switch the
    // audio engine to USB; fskApplyBandpass() sets the correct passband.
    passbandTunerComponent.setMode('USB');
    audio.setFmDeemph(0);
    audio.setAudioDemodulation('USB');
    fskApplyBandpass();
  }

  function _fskPushLine(line) {
    fskTextLines = [...fskTextLines, line].slice(-300);
    tick().then(() => { if (fskScrollEl) fskScrollEl.scrollTop = fskScrollEl.scrollHeight; });
  }

  function _fskActivate() {
    fskEnabled = true;
    fskTextLines = [];
    fskCurrentLine = '';
    fskStatusText = '';
    fskMetrics = { snrDb: 0, lockQuality: 0, markHz: 0, spaceHz: 0, timingLocked: false };
    _fskTakeReceiverControl();

    const cfg = _fskEffectiveConfig();
    audio.setFSKVariant(fskVariant);
    audio.setFSKConfig(cfg);
    if (audio.setFSKAutoShift) audio.setFSKAutoShift(!!fskAutoShift);
    audio.setFSKCallback((event) => {
      if (!event || !event.type) return;
      if (event.type === 'char') {
        const ch = event.char;
        if (!ch || ch === '\r') return;
        if (ch === '\n') {
          if (fskCurrentLine.trim()) {
            _fskPushLine(fskCurrentLine);
            fskCurrentLine = '';
          }
          return;
        }
        fskCurrentLine += ch;
        if (fskCurrentLine.length >= 80) {
          _fskPushLine(fskCurrentLine);
          fskCurrentLine = '';
        }
      } else if (event.type === 'status') {
        fskStatusText = event.text || '';
      } else if (event.type === 'metrics') {
        fskMetrics = event;
        if (event.shiftHz && Math.abs((Number(fskShift) || 0) - event.shiftHz) >= 20) fskShift = Math.round(event.shiftHz);
        if (event.centerHz && Math.abs((Number(fskCenter) || 0) - event.centerHz) >= 10) fskCenter = Math.round(event.centerHz);
      } else if (event.type === 'parity-error' || event.type === 'framing-error') {
        fskStatusText = event.type === 'parity-error' ? 'Parity error' : 'Framing error';
      }
      fskTextLines = fskTextLines;
      fskCurrentLine = fskCurrentLine;
    });
    audio.setFSKDecoding(true, fskVariant);
  }

  function fskClear() {
    fskTextLines = [];
    fskCurrentLine = '';
  }


  function _saveDecoderTextFile(filenameBase, lines, currentLine = '', ext = 'txt') {
    const allLines = [...(Array.isArray(lines) ? lines : [])];
    const tail = String(currentLine || '');
    if (tail.trim()) allLines.push(tail);
    const text = allLines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameBase}-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function saveNavtexText() {
    _saveDecoderTextFile('navtex-session', navtexMessages, navtexCurrentLine);
  }

  function saveFskText() {
    const mode = (fskVariant === 'weather') ? 'weather-rtty'
              : (fskVariant === 'ham') ? 'amateur-rtty'
              : 'maritime-fsk';
    _saveDecoderTextFile(mode, fskTextLines, fskCurrentLine);
  }

  function fskApplySettings(takeControl = true) {
    const cfg = _fskEffectiveConfig();
    audio.setFSKVariant(fskVariant);
    audio.setFSKConfig(cfg);
    if (audio.setFSKAutoShift) audio.setFSKAutoShift(!!fskAutoShift);
    if (takeControl) _fskTakeReceiverControl();
  }

  function fskVariantChanged() {
    _applyFskVariantDefaults(fskVariant);
    fskApplySettings(true);
  }

  function fskApplyKnownFrequency() {
    const khz = Number(fskKnownFrequency);
    if (!Number.isFinite(khz) || khz <= 0) return;
    const cfg = _fskEffectiveConfig();
    const hz = Math.round(khz * 1000 - cfg.center);
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency) frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(2);
      _fskTakeReceiverControl();
    } catch (e) {
      console.warn('[FSK] tune error', e);
    }
  }

  _applyFskVariantDefaults(fskVariant);
  // ── END FSK state ─────────────────────────────────────────────────────────


  // CW text output
  let cwMessages    = [];
  let cwCurrentLine = '';
  let cwDetectedHz  = 0;
  let cwDetectedWpm = 0;
  let cwScrollEl;

  // ── Digital mode decoder state ───────────────────────────────────────────

  // Shared text output for digital decoders
  let digiMessages    = [];
  let digiCurrentLine = '';
  let digiMode        = '';
  let digiScrollEl;

  // Auto-scroll decoder windows when messages update
  afterUpdate(() => {
    if (cwScrollEl)   cwScrollEl.scrollTop   = cwScrollEl.scrollHeight;
  });

  // Handling dragging the waterfall left or right
  let waterfallDragging = false;
  let waterfallDragTotal = 0;
  let waterfallBeginX = 0;
  let cursorFrequency = null;
  let cursorX = 0;
  let cursorY = 0;
  let showCursorFreq = false;

  function handleWaterfallMouseDown(e) {
    waterfallDragTotal = 0;
    waterfallDragging = true;
    waterfallBeginX = e.clientX;
  }

  function handleWindowMouseMove(e) {
    if (waterfallDragging) {
      waterfallDragTotal += Math.abs(e.movementX) + Math.abs(e.movementY);
      waterfall.mouseMove(e);
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  // Format frequency as MHz.kHz.Hz
  function formatFrequency(freqHz) {
    const totalHz = Math.round(freqHz);
    const mhz = Math.floor(totalHz / 1000000);
    const khz = Math.floor((totalHz % 1000000) / 1000);
    const hz = totalHz % 1000;
    
    // Pad kHz and Hz with leading zeros
    const khzStr = String(khz).padStart(3, '0');
    const hzStr = String(hz).padStart(3, '0');
    
    return `${mhz}.${khzStr}.${hzStr}`;
  }

  function handleSpectrumMouseMove(e) {
    if (!spectrumCanvas) return;
    const rect = spectrumCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = rect.width;
    
    // Get the current waterfall range (in FFT offsets)
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const waterfallSpan = waterfallR - waterfallL;
    
    // Calculate the FFT offset based on mouse position
    const offset = waterfallL + (x / canvasWidth) * waterfallSpan;
    
    // Convert FFT offset to frequency in Hz
    const freq = FFTOffsetToFrequency(offset);
    
    cursorFrequency = freq;
    cursorX = e.clientX;
    cursorY = e.clientY;
    showCursorFreq = true;
  }

  function handleSpectrumMouseLeave() {
    showCursorFreq = false;
  }

  function handleWaterfallMouseMove(e) {
    if (!waterfallCanvas) return;
    const rect = waterfallCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = rect.width;
    
    // Get the current waterfall range (in FFT offsets)
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const waterfallSpan = waterfallR - waterfallL;
    
    // Calculate the FFT offset based on mouse position
    const offset = waterfallL + (x / canvasWidth) * waterfallSpan;
    
    // Convert FFT offset to frequency in Hz
    const freq = FFTOffsetToFrequency(offset);
    
    cursorFrequency = freq;
    cursorX = e.clientX;
    cursorY = e.clientY;
    showCursorFreq = true;
  }

  function handleWaterfallMouseLeave() {
    showCursorFreq = false;
  }

  function handleWindowMouseUp(e) {
    if (waterfallDragging) {
      // If mouseup without moving, handle as click
      if (waterfallDragTotal < 2) {
        passbandTunerComponent.handlePassbandClick(e);
      }
      waterfallDragging = false;
    }
  }

  // bysv2amkMobile

  // Sidebar controls for waterfall and spectrum analyzer
  let waterfallDisplay = true;
  let spectrumDisplay = true;
  let biggerWaterfall = false;

  function handleSpectrumChange() {
    spectrumDisplay = !spectrumDisplay;
    waterfall.setSpectrum(spectrumDisplay, Device.isMobile);
  }

  function handleWaterfallSizeChange() {
    biggerWaterfall = !biggerWaterfall;
    waterfall.setWaterfallBig(biggerWaterfall, Device.isMobile);
  }

  // bysv2amkMobile end

  // Declaration for the VFO A/B system //
  let vfo = "VFO A";
  let vfoModeA = true;
  let vfoAFrequency = siteSDRBaseFrequency;
  let vfoBFrequency = siteSDRBaseFrequency;
  let initialVFOB = true;
  let vfoAMode = "LSB";
  let vfoBMode = "LSB";
  let vfoAStep = 50;
  let vfoBStep = 50;
  let vfoAwaterfallL = 0;
  let vfoAwaterfallR = 0;
  let vfoBwaterfallL = 0;
  let vfoBwaterfallR = 0;

  // declaration for function handlePassbandChange(passband) //
  let bandwidth;

  // Waterfall drawing
  let currentColormap = "custom"; //select any of "turbo, gqrx, twente, twentev2, SpectraVU, custom"
  let alpha = 0.5;
  let brightness = 130;
  let min_waterfall = -30;
  let max_waterfall = 110;
  function initializeColormap() {
    // Check if a colormap is saved in local storage
    const savedColormap = localStorage.getItem("selectedColormap");
    if (savedColormap) {
      currentColormap = savedColormap;
    }
    waterfall.setColormap(currentColormap);
  }

  function handleWaterfallColormapSelect(event) {
    currentColormap = event.target.value;
    waterfall.setColormap(currentColormap);

    // Save the selected colormap to local storage
    localStorage.setItem("selectedColormap", currentColormap);
  }

  // Waterfall slider controls
  function handleAlphaMove() {
    waterfall.setAlpha(1 - alpha);
  }
  function handleBrightnessMove() {
    waterfall.setOffset(brightness);
  }
  function handleMinMove() {
    waterfall.setMinOffset(min_waterfall);
  }
  function handleMaxMove() {
    waterfall.setMaxOffset(max_waterfall);
  }

  function handleAutoAdjust() {
    // Toggle state
    autoAdjustEnabled = !autoAdjustEnabled;
    waterfall.autoAdjust = autoAdjustEnabled;

    if (autoAdjustEnabled) {
      // Store current manual settings only once
      if (!storeWaterfallSettings) {
        previous_min_waterfall = min_waterfall;
        previous_max_waterfall = max_waterfall;
        previous_brightness   = brightness;
        storeWaterfallSettings = true;
      }

      // Configure the waterfall backend with adaptive auto-adjust parameters
      if (typeof waterfall.setAutoAdjustConfig === "function") {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }

      // Enable adaptive auto-adjust
      if (typeof waterfall.enableAutoAdjust === "function") {
        waterfall.enableAutoAdjust(autoAdjustConfig);
      }

      // Start monitoring adaptive status
      startStatusMonitoring();
      
      console.log('🎯 ADAPTIVE AUTO-ADJUST ENABLED');
      console.log('   Watch console for real-time adaptation messages');
      
    } else {
      // Stop monitoring
      stopStatusMonitoring();
      
      // Restore manual settings when leaving auto mode
      if (storeWaterfallSettings) {
        min_waterfall = (previous_min_waterfall !== null && previous_min_waterfall !== undefined) ? previous_min_waterfall : min_waterfall;
        max_waterfall = (previous_max_waterfall !== null && previous_max_waterfall !== undefined) ? previous_max_waterfall : max_waterfall;
        brightness    = (previous_brightness !== null && previous_brightness !== undefined) ? previous_brightness : brightness;
        storeWaterfallSettings = false;
      }

      // Apply restored manual settings to the waterfall
      handleMinMove();
      handleMaxMove();
      handleBrightnessMove();
    }

    // Optional: reflect state in a UI toggle if present
    const btn = document.getElementById("autoAdjustBtn");
    if (btn) btn.classList.toggle("active", autoAdjustEnabled);
  }

  // Helper function to change auto-adjust preset on the fly
  function setAutoAdjustPreset(presetName) {
    if (autoAdjustPresets[presetName]) {
      currentAutoAdjustPreset = presetName;
      autoAdjustConfig = { ...autoAdjustPresets[presetName] };
      
      // If auto-adjust is currently enabled, reapply with new config
      if (autoAdjustEnabled && typeof waterfall.setAutoAdjustConfig === "function") {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }
      
      console.log(`Auto-adjust preset changed to: ${presetName}`, autoAdjustConfig);
    }
  }

  // Helper function to update individual auto-adjust parameters
  function updateAutoAdjustParameter(paramName, value) {
    if (autoAdjustConfig.hasOwnProperty(paramName)) {
      autoAdjustConfig[paramName] = value;
      
      // If auto-adjust is currently enabled, reapply
      if (autoAdjustEnabled && typeof waterfall.setAutoAdjustConfig === "function") {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }
      
      console.log(`Auto-adjust ${paramName} updated to: ${value}`);
    }
  }

  // Toggle adaptive mode on/off
  function toggleAdaptiveMode() {
    autoAdjustConfig.adaptiveEnabled = !autoAdjustConfig.adaptiveEnabled;
    
    if (autoAdjustEnabled && typeof waterfall.setAutoAdjustConfig === "function") {
      waterfall.setAutoAdjustConfig(autoAdjustConfig);
    }
    
    console.log(`Adaptive mode: ${autoAdjustConfig.adaptiveEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Get current adaptive status
  function getAdaptiveStatus() {
    if (typeof waterfall.getAutoAdjustStatus === "function") {
      const status = waterfall.getAutoAdjustStatus();
      if (status) {
        adaptiveStatus = status;
        return status;
      }
    }
    return { condition: "UNKNOWN", avgSNR: "0.0" };
  }

  // Update status periodically
  let statusInterval;
  function startStatusMonitoring() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(() => {
      if (autoAdjustEnabled) {
        getAdaptiveStatus();
      }
    }, 2000); // Update every 2 seconds
  }

  function stopStatusMonitoring() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  function checkColor(color) {
    console.log("C = " + color);
  }

  // This function checks the region inside waterfall.js and compares //
  // it to the siteRegion and then approves the proper button to be //
  // printed to the screen. //
  function verifyRegion(region) {
    switch (region) {
      case 123:
        return true;
        break;
      case 1:
        if (region === 1 && siteRegion === 1) {
          return true;
        }
        break;
      case 2:
        if (region === 2 && siteRegion === 2) {
          return true;
        }
        break;
      case 3:
        if (region === 3 && siteRegion === 3) {
          return true;
        }
        break;
    }
    return false;
  }

  // This function checks the siteSDRBasebandFrequency siteSDRBandwidth and //
  // compares it to the startFreq & endFreq from waterfall.js and if all that //
  // passes, then a Band Button is printed to the SDR interface. //
  function printBandButton(startFreq, endFreq, publish) {
    let sdrStartFreq = siteSDRBaseFrequency;
    let sdrBandwidth = siteSDRBandwidth;
    if (publish) {
      return endFreq >= sdrStartFreq && endFreq <= sdrStartFreq + sdrBandwidth;
    } else {
      return false;
    }
  }

  // Audio demodulation selection
  let demodulators = ["USB", "LSB", "CW", "CW-L", "AM", "QUAM", "FM"];
  const demodulationDefaults = {
    USB:    { type: "USB",  offsets: [0, 2700] },
    LSB:    { type: "LSB",  offsets: [2700, 0] },
    CW:     { type: "CW",   offsets: [250, 250] }, // DSB centered on carrier, ±250 Hz
    "CW-L": { type: "CWL",  offsets: [250, 250] }, // CW lower sideband tone, ±250 Hz
    AM:     { type: "AM",   offsets: [4500, 4500] }, // 9 kHz for AM
    QUAM:   { type: "QUAM", offsets: [5000, 5000] }, // C-QUAM AM-stereo
    FM:     { type: "FM",   offsets: [5000, 5000] },
    WBFM:   { type: "FM",   offsets: [80000, 80000] },
    RADEL: { type: 'LSB', offsets: [2200, -700] }, // RADE v1 Lower sideband — 700 Hz to 2200 Hz from carrier
    RADEU: { type: 'USB', offsets: [-700, 2200] }, // RADE v1 Upper sideband — 700 Hz to 2200 Hz from carrier
  };

  let demodulation = "USB";
  function roundAudioOffsets(offsets) {
    const [l, m, r] = offsets;
    return [Math.floor(l), m, Math.floor(r)];
  }

  // CATsync: notify external tools (e.g. CATsync) when frequency/mode changes
  function catsyncNotify(changed) {
    if (typeof window !== "undefined" && typeof window.injection_environment_changed === "function") {
      try {
        window.injection_environment_changed(changed);
      } catch (e) {
        // swallow — injection must not crash the UI
      }
    }
  }

  function SetMode(mode) {
    if (mode == "CW-U") {
      mode = "CW";
    }
    console.log("Setting mode to", mode);
    demodulation = mode;

    handleDemodulationChange(null, true);
    updateLink();
  }

  function setModePopup(mode) {
    if (mode == "CW-U") {
      mode = "CW";
    }
    console.log("Setting mode to", mode);
    demodulation = mode;

    handleDemodulationChange(null, true);
    updateLink();
    setTimeout(function () {
      toggleModePopup();
    }, 300);
  }

  // Demodulation controls
  function handleDemodulationChange(e, changed) {
    passbandTunerComponent.setMode(demodulation);
    const demodulationDefault = demodulationDefaults[demodulation];
    if (changed) {
      if (demodulation === "WBFM") {
        audio.setFmDeemph(50e-6);
      } else {
        audio.setFmDeemph(0);
      }
      audio.setAudioDemodulation(demodulationDefault.type);
    }
    let prevBFO = frequencyInputComponent.getBFO();
    let newBFO = demodulationDefault.bfo || 0;
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
    m = m + newBFO - prevBFO;
    l = m - demodulationDefault.offsets[0];
    r = m + demodulationDefault.offsets[1];

    frequencyInputComponent.setBFO(newBFO);
    frequencyInputComponent.setFrequency();

    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(2);

    // CW
    const lOffset = l - 200;
    const mOffset = m - 750;
    const rOffset = r - 200;
    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );
    const audioParameters = [l, m, r].map(frequencyToFFTOffset);

    // Set audio range with both normal and offset values
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);

    updatePassband();
    updateLink();
  }

  // ── Decoder helpers ───────────────────────────────────────────────────────

  /** Stop every decoder and reset all flags */
  function _deactivateAll() {
    if (ft8Enabled) { ft8Enabled = false; audio.setFT8Decoding(false); }
    if (ft4Enabled) { ft4Enabled = false; audio.setFT4Decoding(false); }
    if (cwEnabled)   { cwEnabled = false; audio.setCWDecoding(false); audio.setCWCallback(null); cwDetectedHz = 0; cwDetectedWpm = 0; }
    if (wsprEnabled) { wsprEnabled = false; audio.setWSPRDecoding(false); wsprMessages = []; _wsprTickStop(); }
    if (faxEnabled)  { _faxDeactivate(); }
    if (navtexEnabled) { _navtexDeactivate(); }
    if (fskEnabled)    { fskEnabled = false; audio.setFSKDecoding(false); audio.setFSKCallback(null); _fskRestoreReceiverControl(); }
    // RADE v1
    if (radeEnabled) { _radeDeactivate(); }
  }

  /** Build a callback that feeds the shared digi text window */
  function _makeDigiCallback(modeName) {
    digiMessages    = [];
    digiCurrentLine = '';
    digiMode        = modeName;
    return (event) => {
      if (event.type === 'char') {
        const ch = event.char;
        if (ch === '\r') return;
        if (ch === '\n') {
          if (digiCurrentLine.trim()) { digiMessages = [...digiMessages, digiCurrentLine].slice(-200); digiCurrentLine = ''; }
          return;
        }
        digiCurrentLine += ch;
        if (digiCurrentLine.length >= 80) { digiMessages = [...digiMessages, digiCurrentLine].slice(-200); digiCurrentLine = ''; }
      } else if (event.type === 'navstart') {
        digiMessages = [...digiMessages, `── ZCZC ${event.station}${event.subject}${event.seq} ──`].slice(-200);
        digiCurrentLine = '';
      } else if (event.type === 'navend') {
        if (digiCurrentLine.trim()) { digiMessages = [...digiMessages, digiCurrentLine].slice(-200); digiCurrentLine = ''; }
        digiMessages = [...digiMessages, '── NNNN ──'].slice(-200);
      } else if (event.type === 'frame') {
        const via  = event.via && event.via.length ? ` via ${event.via.join(',')}` : '';
        digiMessages = [...digiMessages, `${event.from}→${event.to}${via}: ${event.payload}`].slice(-200);
        digiCurrentLine = '';
      } else if (event.type === 'dsc') {
        digiMessages = [...digiMessages, `[${event.format}] MMSI:${event.mmsi} ${event.category} ${event.msgType}`].slice(-200);
        digiCurrentLine = '';
      }
      digiMessages    = digiMessages;
      digiCurrentLine = digiCurrentLine;
    };
  }

  /** Activate the decoder named by selectedDecoder */
  function activateSelectedDecoder() {
    _deactivateAll();
    const d = selectedDecoder;

    if (d === 'ft8') {
      ft8Enabled = true;
      audio.setFT8Decoding(true);
      const list = document.getElementById('ft8MessagesList');
      if (list) list.innerHTML = '';

    } else if (d === 'ft4') {
      ft4Enabled = true;
      audio.setFT4Decoding(true);
      const list = document.getElementById('ft8MessagesList');
      if (list) list.innerHTML = '';

    } else if (d === 'cw') {
      cwEnabled = true;
      cwMessages = []; cwCurrentLine = ''; cwDetectedHz = 0; cwDetectedWpm = 0;
      audio.setCWDecoding(true);
      audio.setCWCallback((event) => {
        if (event.type === 'char') {
          cwCurrentLine += event.char;
          if (cwCurrentLine.length >= 60) { cwMessages = [...cwMessages, cwCurrentLine].slice(-100); cwCurrentLine = ''; }
        } else if (event.type === 'word') {
          if (cwCurrentLine.length >= 45) { cwMessages = [...cwMessages, cwCurrentLine].slice(-100); cwCurrentLine = ''; }
          else if (cwCurrentLine.length > 0) cwCurrentLine += ' ';
        } else if (event.type === 'freq') {
          cwDetectedHz = event.hz; cwDetectedWpm = event.wpm || 0;
        } else if (event.type === 'silence') {
          if (cwCurrentLine.trim()) { cwMessages = [...cwMessages, cwCurrentLine].slice(-100); cwCurrentLine = ''; }
          cwMessages = [...cwMessages, '───'].slice(-100);
          cwDetectedHz = 0; cwDetectedWpm = 0;
        }
        cwMessages = cwMessages; cwCurrentLine = cwCurrentLine;
      });

    } else if (d === 'wspr') {
      wsprEnabled  = true;
      wsprMessages = [];
      const wsprList = document.getElementById('wsprMessagesList');
      if (wsprList) wsprList.innerHTML = '';
      audio.setWSPRDecoding(true);
      _wsprTickStart();
      if (audio && typeof audio.setWSPRDialFreq === 'function') {
        const dialHz = typeof frequency !== 'undefined' ? frequency * 1000 : 0;
        audio.setWSPRDialFreq(dialHz);
      }

    } else if (d === 'hffax') {
      faxEnabled = true;
      _faxActivate();
    } else if (d === 'sstv') {
      sstvEnabled = true;
      _sstvActivate();
    } else if (d === 'navtex') {
      navtexEnabled = true;
      _navtexActivate();

    } else if (d === 'fsk') {
      _fskActivate();

    } else if (d === 'radel' || d === 'radeu') {
      radeEnabled = true;
      const sideband = d === 'radel' ? 'LSB' : 'USB';
      demodulation = d === 'radel' ? 'RADEL' : 'RADEU';
      // NOTE: handleDemodulationChange is intentionally deferred — do NOT call
      // it here. It runs inside the callback below, only after the sidecar
      // socket confirms open. Calling it eagerly would fire demodulation/window
      // commands to spectrumserver on every failed connection attempt (e.g. when
      // rade_helper.py is not yet running), causing rapid-fire server messages
      // that can trigger connection-teardown race conditions in spectrumserver.
      audio.setRADECallback((event) => {
        if (event.type === 'status') {
          if (event.connected) { handleDemodulationChange(null, true); }
          radeConnected = event.connected; radeConnected = radeConnected;
        } else if (event.type === 'snr') {
          radeSynced = event.synced; radeSnr = event.snr;
          radeSynced = radeSynced; radeSnr = radeSnr;
        } else if (event.type === 'error') {
          radeConnected = false; radeConnected = radeConnected;
        }
      });
      audio.setRADEDecoding(true, sideband);
    }
  }

  /** Master Off/On toggle */
  function toggleDecoder() {
    decoderOn = !decoderOn;
    if (decoderOn) {
      activateSelectedDecoder();
    } else {
      _deactivateAll();
      selectedDecoder = 'none';
    }
  }

  /** Called when the dropdown changes while decoder is ON */
  function handleDecoderChange() {
    if (decoderOn) activateSelectedDecoder();
  }

  // Legacy shims — keep for any remaining call sites in the file
  function handleFt8Decoder(e, value) { selectedDecoder = 'ft8'; decoderOn = !!value; if (decoderOn) activateSelectedDecoder(); else _deactivateAll(); }
  function handleFt4Decoder(e, value) { selectedDecoder = 'ft4'; decoderOn = !!value; if (decoderOn) activateSelectedDecoder(); else _deactivateAll(); }
  function handleCwDecoder(e, value)  { selectedDecoder = 'cw';  decoderOn = !!value; if (decoderOn) activateSelectedDecoder(); else _deactivateAll(); }

  // Normalizes dB values to a 0-100 scale for visualization
  function normalizeDb(dbValue) {
    const minDb = -100; // Minimum expected dB value
    const maxDb = 0; // Maximum dB value (best signal)
    return ((dbValue - minDb) / (maxDb - minDb)) * 100;
  }

  function handlePassbandChange(passband) {
  let [l, m, r] = passband.detail.map(waterfallOffsetToFrequency);
  
  let bfo = frequencyInputComponent.getBFO();

  l += bfo;
  m += bfo;
  r += bfo;

  const demodulationDefault = demodulationDefaults[demodulation];
  
  // Get current displayed frequency
  const currentFreq = frequencyInputComponent.getFrequency();
  const frequencyChange = Math.abs(m - currentFreq);
  
  // If m is close to current frequency (< 1000 Hz), it's wheel - don't recalculate!
  // If m is far from current frequency (> 1000 Hz), it's click - recalculate!
  const isWheel = frequencyChange < 1000;
  
  if (!isWheel) {
    // CLICK - recalculate
    const clickedFreq = (l + r) / 2;
       
    if (demodulation === "USB") {
      l = clickedFreq;
      m = clickedFreq;
      r = clickedFreq + demodulationDefault.offsets[1];
    } else if (demodulation === "LSB") {
      l = clickedFreq - demodulationDefault.offsets[0];
      m = clickedFreq;
      r = clickedFreq;
    } else if (demodulation === "CW" || demodulation === "CW-L") {
      l = clickedFreq - demodulationDefault.offsets[0];
      m = clickedFreq;
      r = clickedFreq + demodulationDefault.offsets[1];
    } else {
      l = clickedFreq - demodulationDefault.offsets[0];
      m = clickedFreq;
      r = clickedFreq + demodulationDefault.offsets[1];
    }
  } else {   
  }
  
  // CW offsets
  const lOffset = l - 200;
  const mOffset = m - 750;
  const rOffset = r - 200;

  bandwidth = ((r - l) / 1000).toFixed(2);
  frequencyInputComponent.setFrequency(m);
  frequency = (m / 1e3).toFixed(2);

  const audioParameters = [l, m, r].map(frequencyToFFTOffset);
  const audioParametersOffset = [lOffset, mOffset, rOffset].map(
    frequencyToFFTOffset,
  );

  audio.setAudioRange(...audioParameters, ...audioParametersOffset);

  updateLink();
  updatePassband(audioParameters);
  waterfall.checkBandAndSetMode(m);
  updateBandButton();
}

  // Entering new frequency into the textbox
  function handleFrequencyChange(event) {
    const frequency = event.detail;
    const audioRange = audio.getAudioRange();

    const [l, m, r] = audioRange.map(FFTOffsetToFrequency);

    // Preserve current bandwidth settings
    let audioParameters = [
      frequency - (m - l),
      frequency,
      frequency + (r - m),
    ].map(frequencyToFFTOffset);
    const newm = audioParameters[1];

    const lOffset = frequency - (m - l) - 200;
    const mOffset = frequency - 750;
    const rOffset = frequency + (r - m) - 200;

    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );

    // If the ranges are not within limit, shift it back
    let [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    if (newm < waterfallL || newm >= waterfallR) {
      const limits = Math.floor((waterfallR - waterfallL) / 2);
      let offset;
      if (audioRange[1] >= waterfallL && audioRange[1] < waterfallR) {
        offset = audioRange[1] - waterfallL;
      } else {
        offset = limits;
      }
      const newMid = Math.min(
        waterfall.waterfallMaxSize - limits,
        Math.max(limits, newm - offset + limits),
      );

      waterfallL = Math.floor(newMid - limits);
      waterfallR = Math.floor(newMid + limits);
      waterfall.setWaterfallRange(waterfallL, waterfallR);
    }
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    updatePassband();
    updateLink();
    if (!event.markerclick) {
      waterfall.checkBandAndSetMode(frequency);
    }
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updateBandButton();

    // --- CATsync: update shared state mirror and notify external tools ---
    window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
    window.__catsync_state.hz = event.detail;
    // Only fire the hook when the tune came from the user, not from CATsync itself
    if (!event.__catsync_remote) {
      catsyncNotify({ freq: 1 });
    }
  }

  // Waterfall magnification controls
  function handleWaterfallMagnify(e, type) {
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    switch (type) {
      case "max":
        m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
        l = Math.floor(m - 512);
        r = Math.ceil(m + 512);
        break;
      case "+":
        e.coords = { x: offset };
        e.scale = -1;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "go":
        e.coords = { x: offset };
        e.scale = -100;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "-":
        e.coords = { x: offset };
        e.scale = 1;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "min":
        l = 0;
        r = waterfall.waterfallMaxSize;
        min_waterfall = -30;
        max_waterfall = 110;
        handleMinMove(-30);
        handleMaxMove(110);
        break;
    }
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();

    updatePassband();
  }

  let mute = false;
  let volume = 50;
  let squelchEnable;
  let squelch = -50;
  let power = 0;
  let powerPeak = 0;
  const numberOfDots = 35;
  const s9Index = 17;
  const accumulator = RollingMax(10);

  // Function to draw the S-meter
  function drawSMeter(value) {
    const canvas = document.getElementById("sMeter");
    const ctx = canvas.getContext("2d");

    canvas.width = 300;
    canvas.height = 40;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const segmentWidth = 6;
    const segmentGap = 3;
    const segmentHeight = 8;
    const lineY = 15;
    const labelY = 25;
    const tickHeight = 5;
    const longTickHeight = 5;

    const s9Position = width / 2;

    ctx.strokeStyle = "#a7e6fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(s9Position, lineY);
    ctx.stroke();

    ctx.strokeStyle = "#ed1c24";
    ctx.beginPath();
    ctx.moveTo(s9Position, lineY);
    ctx.lineTo(268, lineY);
    ctx.stroke();

    for (let i = 0; i < 30; i++) {
      const x = i * (segmentWidth + segmentGap);
      if (i < value) {
        ctx.fillStyle = i < 17 ? "#a3eced" : "#d9191c";
      } else {
        ctx.fillStyle = i < 17 ? "#003333" : "#330000";
      }
      ctx.fillRect(x, 0, segmentWidth, segmentHeight);
    }

    ctx.font = "11px monospace";
    ctx.textAlign = "center";

    const labels = ["S1", "3", "5", "7", "9", "+20", "+40", "+60dB"];

    for (let i = 0; i <= 16; i++) {
      const x = i * 16.6970588235;
      ctx.fillStyle = x <= s9Position ? "#a3eced" : "#d9191c";

      if (i % 2 === 1) {
        ctx.fillRect(x, lineY, 1, longTickHeight + 2);
        if ((i - 1) / 2 < labels.length) {
          ctx.fillText(labels[(i - 1) / 2], x, labelY + 8);
        }
      } else {
        ctx.fillRect(x, lineY, 1, tickHeight);
      }
    }
  }

  function setSignalStrength(db) {
    db = Math.min(Math.max(db, -100), 0);

    const DIGITAL_BAR_TRIM = 0; // 👉 Trimm bars in digital smeter
    const activeSegments = Math.max(
      0,
      Math.min(numberOfDots, Math.round(((db + 100) * numberOfDots) / 100) + DIGITAL_BAR_TRIM)
    );

    drawSMeter(activeSegments);
  }

  function handleWheel(node) {
    function onWheel(event) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      const isShiftPressed = event.shiftKey;
      const isAltPressed = event.altKey;

      // Convert frequency to Hz for calculations
      let frequencyHz = Math.round(parseFloat(frequency) * 1e3);

      function adjustFrequency(freq, direction, shiftPressed, altPressed) {
        const step =
          currentTuneStep ||
          (altPressed ? 10000 : shiftPressed ? 1000 : defaultStep);
        const lastDigits = freq % step;

        if (lastDigits === 0) {
          return freq + direction * step;
        } else if (direction > 0) {
          return Math.ceil(freq / step) * step;
        } else {
          return Math.floor(freq / step) * step;
        }
      }

      frequencyHz = adjustFrequency(
        frequencyHz,
        delta,
        isShiftPressed,
        isAltPressed,
      );

      // Convert back to kHz and ensure 2 decimal places
      frequency = (frequencyHz / 1e3).toFixed(2);

      // Ensure frequency is not negative
      frequency = Math.max(0, parseFloat(frequency));

      frequencyInputComponent.setFrequency(frequencyHz);
      handleFrequencyChange({ detail: frequencyHz });
    }

    node.addEventListener("wheel", onWheel);

    return {
      destroy() {
        node.removeEventListener("wheel", onWheel);
      },
    };
  }


  // Auto-focus helper action used by the frequency manual input
  function focusOnMount(node) {
    node.focus();
    node.select();
    return { destroy: function() {} };
  }

  // ── Digit-by-digit frequency tuning ─────────────────────────────────────
  // Each entry is the step size in Hz for that digit position (left→right).
  // Display: [d0][d1][d2],[d3][d4][d5].[d6][d7] kHz
  //           100M 10M  1M  100k 10k  1k   100  10 Hz
  var DIGIT_POWERS_HZ = [100000000, 10000000, 1000000, 100000, 10000, 1000, 100, 10];

  var selectedDigitIdx = -1; // -1 = none selected yet

  // FIX [5]: support up to 10 digits (covers up to 9,999 MHz / ~10 GHz)
  // tenHz has up to 10 digits; pad to 10, show right-most 8 in display,
  // but keep full precision in frequency variable.
  var DIGIT_COUNT = 8;

  $: freqDigitChars = (function() {
    var f = parseFloat(frequency) || 0;
    var tenHz = Math.round(f * 100); // units of 10 Hz
    var s = String(tenHz);
    while (s.length < DIGIT_COUNT) { s = "0" + s; }
    // If overflow beyond DIGIT_COUNT, clamp display to leading digits
    if (s.length > DIGIT_COUNT) { s = s.slice(0, DIGIT_COUNT); }
    var firstNZ = 0;
    while (firstNZ < DIGIT_COUNT - 1 && s[firstNZ] === "0") { firstNZ++; }
    return s.split("").map(function(ch, i) {
      return { ch: ch, idx: i, dim: i < firstNZ };
    });
  })();

  function handleDigitClick(idx) {
    selectedDigitIdx = idx;
  }

  var showFreqInput = false;
  var freqInputValue = "";
  var _commitBusy = false; // FIX [3]: guard against double-fire on Enter+blur

  function handleDigitContextMenu(e) {
    e.preventDefault();
    freqInputValue = (parseFloat(frequency) || 0).toFixed(2);
    _commitBusy = false;
    showFreqInput = true;
  }

  function commitFreqInput() {
    // Guard against double-fire: Enter keydown → commitFreqInput → showFreqInput=false
    // → blur fires again. The flag blocks the second call.
    if (_commitBusy) { return; }
    _commitBusy = true;
    var val = parseFloat(freqInputValue);
    if (!isNaN(val) && val >= 0) {
      var hz = Math.round(val * 1e3);
      frequency = (hz / 1e3).toFixed(2);
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
    }
    showFreqInput = false;
    // FIX [9]: reset after a tick so the blur-triggered second call is still blocked,
    // but subsequent right-clicks are never permanently locked out.
    setTimeout(function() { _commitBusy = false; }, 100);
  }

  function cancelFreqInput() {
    // FIX [6]: also deselect digit so cyan highlight doesn't linger
    showFreqInput = false;
    selectedDigitIdx = -1;
    _commitBusy = false;
  }

  function handleFreqInputKey(e) {
    if (e.key === "Enter") { commitFreqInput(); }
    else if (e.key === "Escape") { cancelFreqInput(); }
  }

  // FIX [1+2]: debounced server dispatch — UI updates instantly, server
  // notified only after 50 ms of inactivity to prevent WebSocket flooding.
  var _digitDispatchTimer = null;
  function dispatchFrequencyDebounced(hz) {
    if (_digitDispatchTimer !== null) { clearTimeout(_digitDispatchTimer); }
    _digitDispatchTimer = setTimeout(function() {
      _digitDispatchTimer = null;
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
    }, 50);
  }

  function handleDigitKeydown(e) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedDigitIdx < 0) { return; }
      var delta = e.key === "ArrowUp" ? 1 : -1;
      var step = DIGIT_POWERS_HZ[selectedDigitIdx];
      var frequencyHz = Math.round((parseFloat(frequency) || 0) * 1e3);
      frequencyHz = Math.max(0, frequencyHz + delta * step);
      frequency = (frequencyHz / 1e3).toFixed(2);
      dispatchFrequencyDebounced(frequencyHz); // FIX [2]
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (selectedDigitIdx > 0) { selectedDigitIdx = selectedDigitIdx - 1; }
      else { selectedDigitIdx = 0; }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (selectedDigitIdx < 7) { selectedDigitIdx = selectedDigitIdx + 1; }
      else { selectedDigitIdx = 7; }
    } else if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      if (selectedDigitIdx < 0) { return; }
      var tenHz = Math.round((parseFloat(frequency) || 0) * 100);
      var s = String(tenHz);
      while (s.length < DIGIT_COUNT) { s = "0" + s; }
      if (s.length > DIGIT_COUNT) { s = s.slice(0, DIGIT_COUNT); }
      s = s.slice(0, selectedDigitIdx) + e.key + s.slice(selectedDigitIdx + 1);
      var newHz = parseInt(s, 10) * 10;
      newHz = Math.max(0, newHz);
      frequency = (newHz / 1e3).toFixed(2);
      dispatchFrequencyDebounced(newHz); // FIX [2]
      if (selectedDigitIdx < 7) { selectedDigitIdx = selectedDigitIdx + 1; }
    }
  }

  function handleDigitWheel(node) {
    function onWheel(event) {
      event.preventDefault();
      var delta = event.deltaY > 0 ? -1 : 1;
      var isShiftPressed = event.shiftKey;
      var isAltPressed = event.altKey;
      var frequencyHz = Math.round(parseFloat(frequency) * 1e3);
      var step; // FIX [4]: declare once, assign in branches

      if (selectedDigitIdx >= 0) {
        // Digit-specific tuning
        step = DIGIT_POWERS_HZ[selectedDigitIdx];
        frequencyHz = frequencyHz + delta * step;
      } else {
        // No digit selected — fall back to default step tuning
        step = currentTuneStep || (isAltPressed ? 10000 : isShiftPressed ? 1000 : defaultStep);
        var lastDigits = frequencyHz % step;
        if (lastDigits === 0) {
          frequencyHz = frequencyHz + delta * step;
        } else if (delta > 0) {
          frequencyHz = Math.ceil(frequencyHz / step) * step;
        } else {
          frequencyHz = Math.floor(frequencyHz / step) * step;
        }
      }

      frequencyHz = Math.max(0, frequencyHz);
      frequency = (frequencyHz / 1e3).toFixed(2);
      dispatchFrequencyDebounced(frequencyHz); // FIX [1]
    }

    // FIX [7]: clicking outside deselects digit AND closes any open popup
    function onDocClick(e) {
      if (!node.contains(e.target)) {
        selectedDigitIdx = -1;
        if (showFreqInput) {
          showFreqInput = false;
          _commitBusy = false;
        }
      }
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("click", onDocClick);
    return {
      destroy: function() {
        node.removeEventListener("wheel", onWheel);
        document.removeEventListener("click", onDocClick);
        if (_digitDispatchTimer !== null) {
          clearTimeout(_digitDispatchTimer);
          _digitDispatchTimer = null;
        }
      }
    };
  }
  // ── End digit tuning ─────────────────────────────────────────────────────

  // Bandwidth offset controls
  let bandwithoffsets = ["-1000", "-500", "-200", "-100", "+100", "+200", "+500", "+1000"];
  function handleBandwidthOffsetClick(bandwidthoffset) {
    bandwidthoffset = parseFloat(bandwidthoffset);
    const demodulationDefault = demodulationDefaults[demodulation].type;
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
    if (demodulationDefault === "USB") {
      r = Math.max(m, Math.min(m + getMaximumBandwidth(), r + bandwidthoffset));
    } else if (demodulationDefault === "LSB") {
      l = Math.max(m - getMaximumBandwidth(), Math.min(m, l - bandwidthoffset));
    } else {
      r = Math.max(0, Math.min(m + getMaximumBandwidth() / 2, r + bandwidthoffset / 2));
      l = Math.max(m - getMaximumBandwidth() / 2, Math.min(m, l - bandwidthoffset / 2));
    }
    let audioParameters = [l, m, r].map(frequencyToFFTOffset);
    const lOffset = l - 200;
    const mOffset = m - 750;
    const rOffset = r - 200;
    const audioParametersOffset = [lOffset, mOffset, rOffset].map(frequencyToFFTOffset);

    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    updatePassband();
  }

  // Toggle buttons and slides for audio
  function handleMuteChange() {
    mute = !mute;
    audio.setMute(mute);
  }

  function handleVolumeChange() {
    audio.setGain(Math.pow(10, (volume - 50) / 50 + 2.6));
  }

  function handleSquelchChange() {
    squelchEnable = !squelchEnable;
    audio.setSquelch(squelchEnable);
    squelch = Math.round(audio.getPowerDb()) + 2;
    audio.setSquelchThreshold(squelch);
  }

  function handleSquelchMove() {
    audio.setSquelchThreshold(squelch);
  }

  function handleEnterKey(event) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the default action
      sendMessage();
    }
  }

  let NREnabled = false;
  let NBEnabled = false;
  let ANEnabled = false;
  let CTCSSSupressEnabled = false;
  
  // Backend Noise Gate Control
  let noiseGatePreset = 'balanced';
  let backendNoiseGateEnabled = false;
  let lastAppliedNoiseGatePreset = null;

  function applyNoiseGatePreset() {
    if (!audio || !audio.decoder) return;
    if (noiseGatePreset === lastAppliedNoiseGatePreset) return;
    
    // Use backend control methods from audio_corrected.js
    if (typeof audio.decoder.set_noise_gate_preset === 'function') {
      audio.decoder.set_noise_gate_preset(noiseGatePreset);
      lastAppliedNoiseGatePreset = noiseGatePreset;
    }
  }
  
  function toggleBackendNoiseGate() {
    backendNoiseGateEnabled = !backendNoiseGateEnabled;
    
    if (audio && audio.decoder && typeof audio.decoder.set_noise_gate_enable === 'function') {
      audio.decoder.set_noise_gate_enable(backendNoiseGateEnabled);
      
      // Apply current preset when enabling
      if (backendNoiseGateEnabled) {
        setTimeout(() => applyNoiseGatePreset(), 100);
      }
    }
  }

  function handleNRChange() {
    NREnabled = !NREnabled;
    if (audio) {
      // Wire NR toggle to client-side audio.js and server-side decoder
      audio.nrEnabled = NREnabled;
      if (audio.decoder && typeof audio.decoder.set_nr === "function") {
        audio.decoder.set_nr(NREnabled);
      }
    }
  }

  function handleNBChange() {
    NBEnabled = !NBEnabled;
    if (audio) {
      // Wire NB toggle to client-side impulsive blanker in audio.js
      audio.nbBlankerEnabled = NBEnabled;
      // Keep legacy nbEnabled for compatibility (no-op in new path)
      audio.nbEnabled = NBEnabled;

      // If the current decoder also supports a server-side NB flag,
      if (audio.decoder && typeof audio.decoder.set_nb === "function") {
        audio.decoder.set_nb(NBEnabled);
      }
    }
  }

  function handleANChange() {
    ANEnabled = !ANEnabled;
    if (audio && audio.decoder && typeof audio.decoder.set_an === 'function') {
      audio.decoder.set_an(ANEnabled);
    }
  }

  function handleCTCSSChange() {
    CTCSSSupressEnabled = !CTCSSSupressEnabled;
    audio.setCTCSSFilter(CTCSSSupressEnabled);
    console.log("mD = " + Device.isMobile);
  }

  function handleNoiseGatePresetChange(event) {
    noiseGatePreset = event.target.value;
    applyNoiseGatePreset();
    console.log('Noise gate preset changed to:', noiseGatePreset);
  }

  // This function was added by sv2amk to autodetect //
  // and show the proper band upon startup. It is called from //
  // the display subsection inside the svelte section //
  // near the middle of this file and it's triggered //
  // by the -2 value. //

 function initBandButton(Kcps) {
 frequency = Kcps;
 if (currentBand == -2)
  {  for (var i = 0; i < bandArray.length; i++) {
      if (
        frequency >= bandArray[i].startFreq / 1000 &&
        frequency <= bandArray[i].endFreq / 1000 &&
        (bandArray[i].ITU === siteRegion || bandArray[i].ITU === 123)
      )
        {
          currentBand = i;
	  bandName = bandArray[i].name;
        }
     }
  }
 }

// amkamk


  // This function was added to track band changes //
  // and makes the band buttons track along with frequency //
  // adjustments. //
  let prevBand,
    stepi = 0;
  function updateBandButton() {
    currentBand = -1;
    for (var i = 0; i < bandArray.length; i++) {
      if (
        frequency >= bandArray[i].startFreq / 1000 &&
        frequency <= bandArray[i].endFreq / 1000 &&
        (bandArray[i].ITU === siteRegion || bandArray[i].ITU === 123)
      ) {
        currentBand = i;
        newStaticBandwidth = 0; // To reset the IF Filter button //
        /* if (bandArray[i].max < 256) {
          min_waterfall = bandArray[i].min;
          max_waterfall = bandArray[i].max;
          handleMinMove();
          handleMaxMove();
        }*/
        if (prevBand != currentBand) {
          currentTuneStep = bandArray[i].stepi;
        }
	bandName = bandArray[i].name;
      }
    }
    prevBand = currentBand;
  }

  // Regular updating UI elements:
  // Other user tuning displays
  //
  let updateInterval;
  let lastUpdated = 0;
  let _smeterRaf = null;

  function _smeterTick() {
    power = (audio.getPowerDb() / 150) * 100 + audio.smeter_offset;
    powerPeak = (accumulator(power) / 150) * 100 + audio.smeter_offset;
    setSignalStrength(power);
    _smeterRaf = requestAnimationFrame(_smeterTick);
  }

  function updateTick() {
    if (events.getLastModified() > lastUpdated) {
      const myRange = audio.getAudioRange();
      const clients = events.getSignalClients();
      // Don't show our own tuning
      // Find the id that is closest to myRange[i]
      const clientKeys = Object.keys(clients);
      let myId = null;
      if (clientKeys.length > 0) {
        myId = clientKeys.reduce((a, b) => {
          const aDiff = Math.abs(clients[a][1] - myRange[1]);
          const bDiff = Math.abs(clients[b][1] - myRange[1]);
          return aDiff < bDiff ? a : b;
        });
      }
      _myId = myId;
      if (myId) myDisplayId = idToSixDigits(myId);
      waterfall.setClients(clients, myId, username);
      requestAnimationFrame(() => {
        waterfall.updateGraduation();
        waterfall.drawClients();
      });
      lastUpdated = events.getLastModified();
    }
  }

  // Tune to the frequency when clicked
  let frequencyMarkerComponent;
  function handleFrequencyMarkerClick(event) {
    handleFrequencyChange({
      detail: event.detail.frequency,
      markerclick: true,
    });

    // Convert back to kHz and ensure 2 decimal places
    frequency = (event.detail.frequency / 1e3).toFixed(2);

    // Ensure frequency is not negative
    frequency = Math.max(0, parseFloat(frequency));

    frequencyInputComponent.setFrequency(event.detail.frequency);

    SetMode(event.detail.modulation);
    //demodulation = event.detail.modulation;
    //handleDemodulationChange();
  }

  // Permalink handling
  function updateLink() {
    const linkObj = {
      frequency: frequencyInputComponent.getFrequency().toFixed(0),
      modulation: demodulation,
    };
    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(2);
    const linkQuery = constructLink(linkObj);
    link = `${location.origin}${location.pathname}?${linkQuery}`;
    storeInLocalStorage(linkObj);
  }
  function handleLinkCopyClick() {
    copy(link);
  }

  let bookmarks = writable([]);
  let newBookmarkName = "";
  let newBookmarkLabel = "";

  let messages = writable([]);
  let newMessage = "";
  let socket;

  let username = `user${Math.floor(Math.random() * 10000)}`;
  let showUsernameInput = false;

  function saveUsername() {
    localStorage.setItem("chatusername", username);
    showUsernameInput = false;
    sendUserID(username);
    if (_myId) waterfall.setClients(waterfall.clients, _myId, username);
    requestAnimationFrame(() => waterfall.drawClients());
  }

  function editUsername() {
    showUsernameInput = true;
  }

  const formatMessage = (text) => {
    const now = new Date();
    return `${username}: ${text.substring(0, 500)}`; // Ensure message is capped at 25 chars
  };

  function addBookmark() {
    const [currentWaterfallL, currentWaterfallR] =
      waterfall.getWaterfallRange();

    const bookmark = {
      name: newBookmarkName,
      link: link,
      frequency: frequencyInputComponent.getFrequency(),
      demodulation: demodulation,
      // This section was added to store more settings in the bookmark //
      volume: volume,
      squelch: squelch,
      squelchEnable: squelchEnable,
      audioBufferDelay: audioBufferDelay,
      audioBufferDelayEnabled: audioBufferDelayEnabled,
      NREnabled: NREnabled,
      ANEnabled: ANEnabled,
      NBEnabled: NBEnabled,
      CTCSSSupressEnabled: CTCSSSupressEnabled,
      currentTuneStep: currentTuneStep,
      min_waterfall: min_waterfall,
      max_waterfall: max_waterfall,
      brightness: brightness,
      currentWaterfallR: currentWaterfallR,
      currentWaterfallL: currentWaterfallL,
      currentColormap: currentColormap,
      waterfallDisplay: waterfallDisplay,
      spectrumDisplay: spectrumDisplay,
      currentBandwidth: currentBandwidth,
      staticBandwidthEnabled: staticBandwidthEnabled,
    };

    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(2);
    bookmarks.update((currentBookmarks) => {
      const updatedBookmarks = [...currentBookmarks, bookmark];
      localStorage.setItem("bookmarks", JSON.stringify(updatedBookmarks));
      return updatedBookmarks;
    });
    newBookmarkName = "";
    newBookmarkLabel = "";
  }

  function goToBookmark(bookmark) {
    // Set frequency
    frequencyInputComponent.setFrequency(bookmark.frequency);
    handleFrequencyChange({ detail: bookmark.frequency });

    // Set demodulation
    demodulation = bookmark.demodulation;
    handleDemodulationChange(null, true);

    // This next section was added to restore more //
    // settings in a bookmark.

    // Set Volume
    volume = bookmark.volume;
    handleVolumeChange();

    // Set Squelch
    audio.setSquelch(false);
    squelch = bookmark.squelch;
    squelchEnable = bookmark.squelchEnable;
    audio.setSquelch(squelchEnable);
    audio.setSquelchThreshold(squelch);

    // Begin code to store and restore additional //
    // WebSDR settings.
    // Set Audio Buffer
    audioBufferDelayEnabled = false;
    if (bookmark.audioBufferDelayEnabled) {
      audioBufferDelay = bookmark.audioBufferDelay;
      audioBufferDelayEnabled = bookmark.audioBufferDelayEnabled;
    }

    // Set Noise Reduction
    if (audio && audio.decoder && typeof audio.decoder.set_nr === 'function') audio.decoder.set_nr(false);
    NREnabled = bookmark.NREnabled;
    if (audio) {
      audio.nrEnabled = NREnabled;
    }
    if (audio && audio.decoder && typeof audio.decoder.set_nr === 'function') audio.decoder.set_nr(NREnabled);

    // Set Noise Blanker
    if (audio && audio.decoder && typeof audio.decoder.set_nb === 'function') audio.decoder.set_nb(false);
    NBEnabled = bookmark.NBEnabled;
    if (audio) {
      audio.nbBlankerEnabled = NBEnabled;
      audio.nbEnabled = NBEnabled;
    }
    if (audio && audio.decoder && typeof audio.decoder.set_nb === 'function') audio.decoder.set_nb(NBEnabled);

    // Set Auto Notch
    if (audio && audio.decoder && typeof audio.decoder.set_an === 'function') audio.decoder.set_an(false);
    ANEnabled = bookmark.ANEnabled;
    if (audio && audio.decoder && typeof audio.decoder.set_an === 'function') audio.decoder.set_an(ANEnabled);

    // Set CTCSS
    CTCSSSupressEnabled = false;
    audio.setCTCSSFilter(CTCSSSupressEnabled);
    CTCSSSupressEnabled = bookmark.CTCSSSupressEnabled;
    audio.setCTCSSFilter(CTCSSSupressEnabled);

    // Set bandwidth
    if (bookmark.staticBandwidthEnabled) {
      handleBandwidthChange(bookmark.currentBandwidth);
      staticBandwidthEnabled = bookmark.staticBandwidthEnabled;
      currentBandwidth = bookmark.currentBandwidth;
    }

    // Set Tuning Step
    currentTuneStep = bookmark.currentTuneStep;
    handleTuningStep(currentTuneStep);
    // Set Waterfall brightness
    min_waterfall = bookmark.min_waterfall;
    max_waterfall = bookmark.max_waterfall;
    brightness = bookmark.brightness;
    handleMinMove();
    handleMaxMove();
    handleBrightnessMove();

    // Set Waterfall Display
    waterfallDisplay = !bookmark.waterfallDisplay;
    handleWaterfallChange();

    // Set Spectrum Display
    spectrumDisplay = !bookmark.spectrumDisplay;
    handleSpectrumChange();

    // Set Waterfall Size
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = bookmark.currentWaterfallL;
    r = bookmark.currentWaterfallR;
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();

    // Set Waterfall Colormap
    currentColormap = bookmark.currentColormap;
    waterfall.setColormap(currentColormap);

    // Update the link
    updateLink();
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text).then(() => {
        console.log("Text copied to clipboard!");
      });
    } catch (err) {
      console.error("Clipboard write failed", err);
    }
  }

  function deleteBookmark(index) {
    bookmarks.update((currentBookmarks) => {
      const updatedBookmarks = currentBookmarks.filter((_, i) => i !== index);
      saveBookmarks(updatedBookmarks);
      return updatedBookmarks;
    });
  }

  function saveBookmarks(bookmarksToSave) {
    localStorage.setItem("bookmarks", JSON.stringify(bookmarksToSave));
  }

  // amkbookmarks

  // UPLOAD BOOKMARKS

  let file;
  let fileInput;

  // Function to handle the reading of the JSON or CSV file
  function uploadBookmarks() {
    const file = fileInput.files[0]; // Get the selected file
    if (!file) {
      alert("Please select a file.");
      return;
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension === "json") {
      // If the file is a JSON
      processJSON(file);
    } else if (fileExtension === "csv") {
      // If the file is a CSV
      processCSV(file);
    } else {
      alert("Please select a JSON or CSV file.");
    }
  }

  // Function to process JSON files
  function processJSON(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const uploadedBookmarks = JSON.parse(event.target.result);
        console.log("Uploaded JSON Bookmarks:", uploadedBookmarks);

        const defaultLink = link || "http://default-server.com"; // Example
        const url = new URL(defaultLink);
        const extractedLink = url.hostname;
        const extractedPort = url.port || "9003"; // Example

        console.log("Extracted Link:", extractedLink);
        console.log("Extracted Port:", extractedPort);

        const updatedBookmarks = uploadedBookmarks.map(bookmark => {
          if (bookmark.link) {
            const bookmarkUrl = new URL(bookmark.link);
            const link_to_be_checked = bookmarkUrl.hostname;
            if (extractedLink !== link_to_be_checked) {
              bookmarkUrl.hostname = extractedLink;
              bookmarkUrl.port = extractedPort;
              bookmark.link = bookmarkUrl.toString();

              bookmark.currentWaterfallR = waterfall.waterfallMaxSize.toString();
              bookmark.currentWaterfallL = "1".toString();
            }
          }

          return bookmark;
        });

        let existingBookmarks = [];
        try {
          existingBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
        } catch (e) {
          existingBookmarks = [];
        }
        const finalBookmarks = [...existingBookmarks, ...updatedBookmarks];
        localStorage.setItem("bookmarks", JSON.stringify(finalBookmarks));

        console.log("Final Updated Bookmarks:", finalBookmarks);
        //alert("The Bookmarks have been uploaded and saved successfully. Please reload the webpage!");
      } catch (error) {
        alert("Error reading the file.");
      }
    };

    reader.readAsText(file);
  }

 // Function to process CSV files
  function processCSV(file) {
    const rightEdge = waterfall.waterfallMaxSize;
    const reader = new FileReader();
    const defaultLink = link || "http://default-server.com"; // Example
    const url = new URL(defaultLink);
    const extractedLink = url.hostname;
    const extractedPort = url.port || "9003"; // Example

    reader.onload = (event) => {
      try {
        const csvData = event.target.result;
        // Split by LF (Line Feed) to separate rows in the CSV
        const rows = csvData.split('\n').filter(row => row.trim() !== ''); // Split by LF
        console.log("Raw CSV data after splitting by LF:", rows);
        // Skip the header row manually, as it's the first line
        rows.shift();
        console.log("Raw CSV data after stripping the header:", rows);

        const bookmarksFromCSV = rows.map((row) => {
          const columns = row.split(","); // Split by comma for columns
          //        console.log("Column CSV data after splitting by commas:", columns);

          // Extract necessary fields (freq, mode, label)
          const frequency = parseFloat(columns[0].trim() * 1000);
          const mode = columns[2].trim();
          const name = columns[3].trim(); // Using label as name
          //        console.log("name:", name);
          return {
            name: name || frequency, // Default name if label is empty
            link: `http://${extractedLink}:${extractedPort}/?frequency=${frequency}&modulation=${mode}`,
            frequency: frequency,
            demodulation: mode,
            volume: 50, // default
            squelch: -50, // default
            audioBufferDelay: 1, // default
            audioBufferDelayEnabled: false, // default
            NREnabled: false, // default
            ANEnabled: false, // default
            NBEnabled: false, // default
            CTCSSSupressEnabled: false, // default
            currentTuneStep: 9000, // default
            min_waterfall: -30, // default
            max_waterfall: 110, // default
            brightness: 130, // default
            currentWaterfallR: rightEdge, // default
            currentWaterfallL: 1, // default
            currentColormap: "custom", // default
            waterfallDisplay: true, // default
            spectrumDisplay: false, // default
            currentBandwidth: 0, // default
            staticBandwidthEnabled: false // default

          };
        });
        console.log("bookmarksFromCSV:", bookmarksFromCSV);
        // Merge the bookmarks from the CSV with existing ones
        let existingBookmarks = [];
        try {
          existingBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
        } catch (e) {
          existingBookmarks = [];
        }
        const finalBookmarks = [...existingBookmarks, ...bookmarksFromCSV];
        localStorage.setItem("bookmarks", JSON.stringify(finalBookmarks));

        console.log("Final Updated Bookmarks from CSV:", finalBookmarks);
        //alert("The Bookmarks from CSV have been uploaded and saved successfully. Please reload the webpage!");
      } catch (error) {
        alert("Error reading the CSV file.");
      }
    };

    reader.readAsText(file);
  }

  // END OF UPLOAD BOOKMARKS

  // DOWNLOADLOAD BOOKMARKS

  function downloadBookmarks() {
    const storedBookmarks = localStorage.getItem("bookmarks");
    const jsonFile = storedBookmarks;

    // Create a timestamp for the bookmark file to be saved //
    const bookmarkDate = new Date();
    const bookmarkYear = bookmarkDate.getFullYear();
    const bookmarkMonth = bookmarkDate.getMonth() + 1;
    const bookmarkDay = bookmarkDate.getDate();
    //
    const bookmarkHour = bookmarkDate.getHours();
    const bookmarkMinute = bookmarkDate.getMinutes();
    const bookmarkSeconds = bookmarkDate.getSeconds();
    //
    const bookmarkFullDate =
      bookmarkYear + "-" + bookmarkDay + "-" + bookmarkMonth;
    const bookmarkTime =
      bookmarkHour + "-" + bookmarkMinute + "-" + bookmarkSeconds;
    const timeStamp = bookmarkFullDate + "_" + bookmarkTime;
    // Create download link
    const url = URL.createObjectURL(
      new Blob([jsonFile], { type: "JSON/json" }),
    );
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = "bookmarks_" + timeStamp + "_.json";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // END OF DOWNLOADLOAD BOOKMARKS

  //end of amkbookmarks


  let showBookmarkPopup,
    showModePopup,
    showBandPopup,
    showIFPopup = false;

  function toggleBookmarkPopup() {
    showBookmarkPopup = !showBookmarkPopup;
  }

  function toggleModePopup() {
    showModePopup = !showModePopup;
  }

  function toggleBandPopup() {
    showBandPopup = !showBandPopup;
  }

  function toggleIFPopup() {
    showIFPopup = !showIFPopup;
  }

  function toggleVFO() {
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    if (initialVFOB) {
      initialVFOB = false;
      vfoBMode = demodulation;
      vfoBwaterfallL = waterfallL;
      vfoBwaterfallR = waterfallR;
      vfoBStep = currentTuneStep;
      vfoBFrequency = frequencyInputComponent.getFrequency();
    }
    if (vfoModeA) {
      vfo = "VFO B";
      vfoAFrequency = frequency * 1000;
      vfoAMode = demodulation;
      vfoAwaterfallL = waterfallL;
      vfoAwaterfallR = waterfallR;
      vfoAStep = currentTuneStep;
      SetMode(vfoBMode);
      waterfall.setWaterfallRange(vfoBwaterfallL, vfoBwaterfallR);
      frequencyInputComponent.setFrequency(vfoBFrequency);
      handleFrequencyChange({ detail: vfoBFrequency });
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
//      handleBandChangePopup(currentBand)
      min_waterfall = parseInt(bandArray[currentBand].min);
      max_waterfall = parseInt(bandArray[currentBand].max);
      handleMinMove();
      handleMaxMove();
////      updateBandButton();

    }
    if (!vfoModeA) {
      vfo = "VFO A";
      vfoBFrequency = frequency * 1000;
      vfoBMode = demodulation;
      vfoBwaterfallL = waterfallL;
      vfoBwaterfallR = waterfallR;
      vfoBStep = currentTuneStep;
      handleTuningStep(vfoAStep);
      SetMode(vfoAMode);
      waterfall.setWaterfallRange(vfoAwaterfallL, vfoAwaterfallR);
      frequencyInputComponent.setFrequency(vfoAFrequency);
      handleFrequencyChange({ detail: vfoAFrequency });
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
//      handleBandChangePopup(currentBand)
      min_waterfall = parseInt(bandArray[currentBand].min);
      max_waterfall = parseInt(bandArray[currentBand].max);
      handleMinMove();
      handleMaxMove();
    }
    vfoModeA = !vfoModeA;
    handleFineTuningStep(0); // Needed for a waterfall bug //
  }
  
  let backendPromise;
  onMount(async () => {
    loadWaterfallDirection();
    startTopFrequencyBarSync();
    waterfall.initCanvas({
      canvasElem: waterfallCanvas,
      spectrumCanvasElem: spectrumCanvas,
      graduationCanvasElem: graduationCanvas,
      bandPlanCanvasElem: bandPlanCanvas,
      clientsCanvasElem: clientsCanvas,
      tempCanvasElem: tempCanvas,
    });

    // Load username before init so server gets it on first connection
    username = localStorage.getItem("chatusername") || "";
    if (!username) username = "user" + Math.floor(Math.random() * 10000);
    sendUserID(username);
    backendPromise = init(username);

    await backendPromise;

    waterfall.setFrequencyMarkerComponent(frequencyMarkerComponent);

    // Apply client-side DSP settings after audio is ready
    applyNoiseGatePreset();
    waterfall.setFrequencyMarkerComponent(frequencyMarkerComponent);

    // Enable after connection established
    [
      ...document.getElementsByTagName("button"),
      ...document.getElementsByTagName("input"),
    ].forEach((element) => {
      element.disabled = false;
    });

    // Enable WBFM option if bandwidth is wide enough
    if (audio.trueAudioSps > 170000) {
      demodulators.push("WBFM");
      demodulators = demodulators;
      bandwithoffsets.unshift("-100000");
      bandwithoffsets.push("+100000");
      bandwithoffsets = bandwithoffsets;
    }

    frequencyInputComponent.setFrequency(
      FFTOffsetToFrequency(audio.getAudioRange()[1]),
    );
    frequencyInputComponent.updateFrequencyLimits(
      audio.baseFreq,
      audio.baseFreq + audio.totalBandwidth,
    );

    showUsernameInput = !username;

    demodulation = audio.settings.defaults.modulation;

    const updateParameters = (linkParameters) => {
      frequencyInputComponent.setFrequency(linkParameters.frequency);
      if (frequencyInputComponent.getFrequency() === linkParameters.frequency) {
        handleFrequencyChange({ detail: linkParameters.frequency });
      }
      if (demodulators.indexOf(linkParameters.modulation) !== -1) {
        demodulation = linkParameters.modulation;
        handleDemodulationChange({}, true);
      }
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    };

    /* const storageParameters = loadFromLocalStorage()
    updateParameters(storageParameters) */
    const linkParameters = parseLink(location.search.slice(1));
    updateParameters(linkParameters);

    // Refresh all the controls to the initial value
    updatePassband();
    passbandTunerComponent.updatePassbandLimits();
    //handleWaterfallColormapSelect();
    initializeColormap();
    handleDemodulationChange({}, true);
    handleSpectrumChange();
    handleVolumeChange();
    updateLink();
    userId = generateUniqueId();
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);

    const storedBookmarks = localStorage.getItem("bookmarks");
    if (storedBookmarks) {
      try {
        bookmarks.set(JSON.parse(storedBookmarks));
      } catch (e) {
        bookmarks.set([]);
      }
    }

    updateInterval = setInterval(() => requestAnimationFrame(updateTick), 200);
    _smeterTick()

    window["spectrumAudio"] = audio;
    window["spectrumWaterfall"] = waterfall;

    socket = new WebSocket(
      window.location.origin.replace(/^http/, "ws") + "/chat",
    );

    chatContentDiv = document.getElementById("chat_content");

    socket.onmessage = (event) => {
      if (event.data.startsWith("Chat history:")) {
        const history = event.data.replace("Chat history:\n", "").trim();
        if (history) {
          const historyMessages = history.split("\n").map((line, index) => ({
            id: Date.now() + index,
            text: line.trim(),
            isCurrentUser: line.startsWith(userId),
            timestamp: Date.now() - (history.length - index) * 1000, // Approximate timestamp
          }));
          messages.set(historyMessages);
        }
      } else {
        const receivedMessageObject = {
          id: Date.now(),
          text: event.data.trim(),
          isCurrentUser: event.data.startsWith(userId),
          timestamp: Date.now(),
        };
        messages.update((currentMessages) => [
          ...currentMessages,
          receivedMessageObject,
        ]);
      }
      scrollToBottom();
    };

    const middleColumn = document.getElementById("middle-column");
    const chatBox = document.getElementById("chat-box");

    function setWidth() {
      if (!middleColumn) return;
      const width = middleColumn.offsetWidth;
      if (!Number.isFinite(width) || width <= 0) return;
      document.documentElement.style.setProperty(
        "--middle-column-width",
        `1372px`,
      );
    }

    setWidth();
    window.addEventListener("resize", setWidth);

    const unsubscribeFrequencyClick = eventBus.subscribe("frequencyClick", ({ frequency, mode }) => {
      handleFrequencyClick(frequency, mode);
    });

    const unsubscribeFrequencyChange = eventBus.subscribe("frequencyChange", (event) => {
      frequencyInputComponent.setFrequency(event.detail);
      frequency = (event.detail / 1e3).toFixed(2);
      handleFrequencyChange(event);
    });

    const unsubscribeSetMode = eventBus.subscribe("setMode", (mode) => {
      SetMode(mode);
    });

    eventBusUnsubscribers = [
      unsubscribeFrequencyClick,
      unsubscribeFrequencyChange,
      unsubscribeSetMode,
    ].filter((fn) => typeof fn === "function");

    return () => {
      window.removeEventListener("resize", setWidth);
      eventBusUnsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {}
      });
      eventBusUnsubscribers = [];
    };

    // =========================================================
    // CATsync API — installed after backend is ready
    // =========================================================

    // Public getters/setters (clean API for external tools)
    window.catsync_getFrequency = function () {
      if (!frequencyInputComponent || !frequencyInputComponent.getFrequency) return null;
      return frequencyInputComponent.getFrequency();   // Hz
    };

    window.catsync_getMode = function () {
      return demodulation || null;
    };

    window.catsync_setFrequency = function (hz) {
      var f = Number(hz);
      if (!isFinite(f)) return false;
      if (!frequencyInputComponent || !frequencyInputComponent.setFrequency) return false;
      frequencyInputComponent.setFrequency(Math.round(f));
      handleFrequencyChange({ detail: Math.round(f) });
      catsyncNotify({ freq: 1 });
      return true;
    };

    window.catsync_setMode = function (mode) {
      if (!mode) return false;
      var m = String(mode).toUpperCase().trim();
      SetMode(m);
      catsyncNotify({ mode: 1 });
      return true;
    };

    window.catsync_ready = true;

    // Twente WebSDR / KiwiSDR compatibility layer
    window.nominalfreq = function () {
      if (!frequencyInputComponent || !frequencyInputComponent.getFrequency) return null;
      return frequencyInputComponent.getFrequency() / 1000;   // kHz
    };

    window.setfreq = function (f) {
      var x = Number(f);
      if (!isFinite(x)) return false;
      var hz = (x < 1e6) ? Math.round(x * 1000) : Math.round(x);
      if (!frequencyInputComponent || !frequencyInputComponent.setFrequency) return false;
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      catsyncNotify({ freq: 1 });
      return true;
    };

    window.set_mode = function (m) {
      var mode = String(m || "").toUpperCase().trim();
      SetMode(mode);
      catsyncNotify({ mode: 1 });
      return true;
    };

    // Internal implementations called by the early index.html shim
    window.__catsync_setfreq_impl = function (hz) {
      if (!frequencyInputComponent || !frequencyInputComponent.setFrequency) return false;
      if (__catsync_last_applied_hz === hz) return true;
      __catsync_last_applied_hz = hz;
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz, __catsync_remote: true });
      window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
      window.__catsync_state.hz = hz;
      return true;
    };

    window.__catsync_setmode_impl = function (mode) {
      if (__catsync_last_applied_mode === mode) return true;
      __catsync_last_applied_mode = mode;
      SetMode(mode);
      window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
      window.__catsync_state.mode = mode;
      return true;
    };

    // Flush any commands that arrived before Svelte finished loading
    var __catsync_q_snapshot = window.__catsync_q || [];
    while (__catsync_q_snapshot.length) {
      var __catsync_cmd = __catsync_q_snapshot.shift();
      if (__catsync_cmd.t === "freq") window.__catsync_setfreq_impl(__catsync_cmd.hz);
      if (__catsync_cmd.t === "mode") window.__catsync_setmode_impl(__catsync_cmd.mode);
    }

  });

  function sendMessage() {
    if (newMessage.trim() && username.trim()) {
      const messageObject = {
        cmd: "chat",
        message: newMessage.trim(),
        username: username,
      };
    socket.send(JSON.stringify(messageObject));
    newMessage = "";
    scrollToBottom();
      }
    }

  function stripText(s) {
    let badStrings = ['777', 'chmod', '.sh', 'chown', 'tftp'];
    let fixedStrings = new RegExp('\\b(' + badStrings.join('|') + ')\\b', 'g');
    return (s || '').replace(fixedStrings, '').replace(/[ ]{2,}/, ' ');
  }

  function pasteFrequency() {
    const frequency = frequencyInputComponent.getFrequency();
    const currentDemodulation = demodulation;
    const frequencyText = `[FREQ:${Math.round(frequency)}:${currentDemodulation}]`;
    newMessage = newMessage + " " + frequencyText; // Append the frequency to the current message
  }

  function shareFrequency() {
    const frequency = frequencyInputComponent.getFrequency();
    const currentDemodulation = demodulation;
    const shareMessage = `[FREQ:${Math.round(frequency)}:${currentDemodulation}] Check out this frequency!`;
    const messageObject = {
      cmd: "chat",
      message: shareMessage,
      userid: userId,
    };
    socket.send(JSON.stringify(messageObject));
    scrollToBottom();
  }

  let chatMessages;

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  $: {
    if ($messages) {
      setTimeout(scrollToBottom, 100);
    }
  }


  // Helper function to apply band settings for a frequency
  function applyBandSettingsForFrequency(frequencyHz) {
    // Find which band this frequency belongs to
    let targetBand = -1;
    const frequencyKhz = frequencyHz / 1000;
    
    for (let i = 0; i < bandArray.length; i++) {
      const band = bandArray[i];
      if (
        frequencyKhz >= band.startFreq / 1000 &&
        frequencyKhz <= band.endFreq / 1000 &&
        (band.ITU === siteRegion || band.ITU === 123)
      ) {
        targetBand = i;
        break;
      }
    }
    
    // If no band found, exit early
    if (targetBand < 0) {
      console.log(`No band settings found for ${frequencyHz} Hz`);
      return;
    }
    
    const band = bandArray[targetBand];
    console.log(`Applying settings for ${band.name}: min=${band.min}, max=${band.max}`);
    
    // Disable auto-adjust if enabled (it will override manual settings)
    if (autoAdjustEnabled) {
      autoAdjustEnabled = false;
      waterfall.autoAdjust = false;
      storeWaterfallSettings = false;
    }
    
    // Set brightness values from band
    min_waterfall = parseInt(band.min);
    max_waterfall = parseInt(band.max);
    
    // Calculate zoom span for this band
    let waterfallEndSpan = parseFloat(
      band.endFreq / (waterfall.sps / waterfall.fftSize)
    );
    let waterfallStartSpan = parseFloat(
      band.startFreq / (waterfall.sps / waterfall.fftSize)
    );
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 1% margin
    
    // Get current audio parameters
    let [l, m, r] = audio.getAudioRange();
    
    // Center the view
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);
    
    // Apply brightness settings
    handleMinMove();
    handleMaxMove();
    
    // Apply zoom with band span
    l -= waterfallSpan;
    r += waterfallSpan;
    
    // Set the waterfall range (this actually changes the zoom)
    waterfall.setWaterfallRange(l, r);
    
    // Update UI elements
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
    
    // Update tracking variables
    currentBand = targetBand;
    bandName = band.name;
    currentTuneStep = band.stepi;
    
    console.log(`✓ Band settings applied: zoom ${l}-${r}, brightness ${min_waterfall}/${max_waterfall}`);
  }

  // Function to handle clicking on a shared frequency
  function handleFrequencyClick(frequency, mode) {
    const numericFrequency = parseInt(frequency, 10);
    if (isNaN(numericFrequency)) {
      console.error("Invalid frequency:", frequency);
      return;
    }
    
    console.log(`Frequency link: ${numericFrequency} Hz, mode: ${mode}`);
    
    // Set the frequency
    frequencyInputComponent.setFrequency(numericFrequency);
    handleFrequencyChange({ detail: numericFrequency });
    
    // Apply band-specific settings (brightness, zoom, etc.)
    applyBandSettingsForFrequency(numericFrequency);
    
    // Set mode AFTER band settings to override any auto-detection
    if (mode && mode !== "") {
      demodulation = mode;
      handleDemodulationChange(null, true);
      console.log(`✓ Mode set to ${mode}`);
    }
    
    // Update the link in the URL
    updateLink();
  }

  function sanitizeHtml(html) {
    const div = document.createElement("div");
    div.textContent = html;
    return div.innerHTML;
  }

  function formatFrequencyMessage(text) {
    const regex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (.+?): (.+)$/;
    const match = text.match(regex);
    if (match) {
      const [_, timestamp, username, message] = match;
      const freqRegex = /\[FREQ:(\d+):([\w-]+)\]/;
      const freqMatch = message.match(freqRegex);
      if (freqMatch) {
        const [fullMatch, frequency, demodulation] = freqMatch;
        const [beforeFreq, afterFreq] = message
          .split(fullMatch)
          .map((part) => formatLinks(sanitizeHtml(part)));
        return {
          isFormatted: true,
          timestamp: sanitizeHtml(timestamp),
          username: sanitizeHtml(username),
          frequency: parseInt(frequency, 10),
          demodulation: sanitizeHtml(demodulation),
          beforeFreq,
          afterFreq,
        };
      }
      return {
        isFormatted: false,
        timestamp: sanitizeHtml(timestamp),
        username: sanitizeHtml(username),
        parts: formatLinks(sanitizeHtml(message)),
      };
    }
    return {
      isFormatted: false,
      parts: formatLinks(sanitizeHtml(text)),
    };
  }

  function formatLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }
      parts.push({ type: "link", content: match[0], url: match[0] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts;
  }

  function renderParts(parts) {
    return parts
      .map((part) => {
        if (part.type === "link") {
          return `<a href="${sanitizeHtml(part.url)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${sanitizeHtml(part.content)}</a>`;
        }
        return part.content;
      })
      .join("");
  }

  onDestroy(() => {
    // FIX: window.removeEventListener("resize", setWidth) was previously only
    // inside the `return () => {...}` at the end of the async onMount block.
    // Async onMount functions return a Promise (not the cleanup fn), so Svelte
    // never calls that inner return — the resize listener leaked on every mount.
    window.removeEventListener("resize", setWidth);
    // Stop everything
    clearInterval(updateInterval);
    if (_smeterRaf) cancelAnimationFrame(_smeterRaf);
    stopTopFrequencyBarSync();
    try {
      if (audio && audio.stop) audio.stop();
    } catch (e) {}
    try {
      if (waterfall && waterfall.stop) waterfall.stop();
    } catch (e) {}
    try {
      if (socket && socket.close) socket.close();
    } catch (e) {}
    // Stop DX cluster auto-refresh
    if (dxRefreshInterval) clearInterval(dxRefreshInterval);
    dxRefreshInterval = null;
    if (dxVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', dxVisibilityChangeHandler);
      dxVisibilityChangeHandler = null;
    }
    eventBusUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (e) {}
    });
    eventBusUnsubscribers = [];
  });

  // Start DX cluster widget after DOM is ready
  onMount(() => startDXCluster());

  // Added to allow the user to adjust the dynamic audio //
  // buffer limits in the playAudio(pcmArray) function inside //
  // audio.js - the variables inside audio.js to allow this adjustment //
  // are bufferLimit = 0.5 and bufferThreshold = 0.1 //
  function handleAudioBufferDelayMove(newAudioBufferDelay) {
  if (newAudioBufferDelay > 5) {
    newAudioBufferDelay = 1;
  }
  
  audioBufferDelay = newAudioBufferDelay;
  
  switch (audioBufferDelay) {
    case 1:
      // Default/Off: Tight latency (100ms target)
      audioBufferDelayEnabled = false;
      audio.setAudioBufferDelay(0.5, 0.1);
      break;
    case 2:
      // Low: Good for fast connections (200ms target)
      audioBufferDelayEnabled = true;
      audio.setAudioBufferDelay(1.0, 0.2);
      break;
    case 3:
      // Medium: Balanced (300ms target)
      audioBufferDelayEnabled = true;
      audio.setAudioBufferDelay(1.5, 0.3);
      break;
    case 4:
      // High: Poor connections (400ms target)
      audioBufferDelayEnabled = true;
      audio.setAudioBufferDelay(2.0, 0.4);
      break;
    case 5:
      // Maximum: Very unstable connections (500ms target)
      audioBufferDelayEnabled = true;
      audio.setAudioBufferDelay(2.5, 0.5);
      break;
    default:
      // Fallback to default
      audioBufferDelayEnabled = false;
      audio.setAudioBufferDelay(0.5, 0.1);
  }
}


// by sv2amkzoom 
  // Added by sv2amk to allow the user to adjust the zoom //
  // with a button and a slider but in mobile version only //

  function handleZoomStepMove(e,newZoomStep) {
    if (newZoomStep > 8) {
      newZoomStep = 1;
    }
    zoomStep = newZoomStep;
    if (zoomStep === 1) {
      zoomStepEnabled = false;
    } else {
      zoomStepEnabled = true;
    }
    switch (zoomStep) {
      case 1:
	handleWaterfallMagnify(e, "min");
        break;
      case 2:
        zwaterfallSpan = 16384;
        handleZoomStepMagnify();
        break;
      case 3:
        zwaterfallSpan = 8192;
        handleZoomStepMagnify();
        break;
      case 4:
        zwaterfallSpan = 4096;
        handleZoomStepMagnify();
        break;
      case 5:
        zwaterfallSpan = 2048;
        handleZoomStepMagnify();
        break;
      case 6:
        zwaterfallSpan = 1024;
        handleZoomStepMagnify();
        break;
      case 7:
        zwaterfallSpan = 512;
        handleZoomStepMagnify();
        break;
      case 8:
        zwaterfallSpan = 256;
        handleZoomStepMagnify();
        break;
      case 9:
	handleWaterfallMagnify(e, "min");
	 for (var i = 0; i <= 5*zoomStep; i++) {
	  handleWaterfallMagnify(e, "+");
	 }
        break;
    }
  }
  
  // by sv2amkzoom 
  // This Band Selection function handles band changes sent from the Band Selection section of the main page //
  // The 7.15255 float below is (total_watefall_span / maximum_frequency_sampled) //
  function handleBandChangePopup(newBand) {
    let centerFreq = parseFloat(
      (bandArray[newBand].endFreq - bandArray[newBand].startFreq) / 2 +
        bandArray[newBand].startFreq,
    );
    let initFreq = parseFloat(bandArray[newBand].initFreq);
    min_waterfall = parseInt(bandArray[newBand].min);
    max_waterfall = parseInt(bandArray[newBand].max);

    let waterfallEndSpan = parseFloat(bandArray[newBand].endFreq / (waterfall.sps/waterfall.fftSize));
    let waterfallStartSpan = parseFloat(bandArray[newBand].startFreq / (waterfall.sps/waterfall.fftSize));
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 10% above band edge
    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    updatePassband();
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);
    // Below sets the waterfall brightness //
    //  min_waterfall = -30;
    //  max_waterfall = 110;
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    l -= waterfallSpan;
    r += waterfallSpan;

    if (initFreq) { centerFreq = initFreq; }

    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
    currentBand = newBand;
    setTimeout(function () {
      toggleBandPopup();
    }, 300);
  }
  // End of Band Selection Function //

  // by sv2amkzoom 
  // This Band Selection function handles band changes sent from the Band Selection section of the main page //
  // The 7.15255 float below is (total_watefall_span / maximum_frequency_sampled) //
  function handleBandChange(newBand) {
    let centerFreq = parseFloat(
      (bandArray[newBand].endFreq - bandArray[newBand].startFreq) / 2 +
        bandArray[newBand].startFreq,
    );
    let initFreq = parseFloat(bandArray[newBand].initFreq);
    min_waterfall = parseInt(bandArray[newBand].min);
    max_waterfall = parseInt(bandArray[newBand].max);

    let waterfallEndSpan = parseFloat(bandArray[newBand].endFreq / (waterfall.sps/waterfall.fftSize));
    let waterfallStartSpan = parseFloat(bandArray[newBand].startFreq / (waterfall.sps/waterfall.fftSize));
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 10% above band edge
    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    updatePassband();
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);
    // Below sets the waterfall brightness //
    //  min_waterfall = -30;
    //  max_waterfall = 110;
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    l -= waterfallSpan;
    r += waterfallSpan;

    if (initFreq) { centerFreq = initFreq; }

    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
    currentBand = newBand;    
  }
  // End of Band Selection Function //


  // This function by sv2amk handles the magnification of the waterfall //
  // according to the magnification factor -zwaterfallSpan- comming from the  //
  // handleZoomStepMove function -zoom slider-. It also handles brightness //
  // according to the currentBand. //

  function handleZoomStepMagnify() {

    min_waterfall = parseInt(bandArray[currentBand].min);
    max_waterfall = parseInt(bandArray[currentBand].max);
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - zwaterfallSpan);
    r = Math.ceil(m + zwaterfallSpan);
    // Below sets the waterfall brightness //
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
  }

 // End of zoom slider magnification  Function by sv2amk//


  // Function to publish bandwidth buttons //
  let newBandwidth = [
    "500",
    "1800",
    "2400",
    "2700",
    "3000",
    "3500",
    "4000",
    "4500",
    "5000",
    "6000",
    "10000",
    "12000",
  ];
  let newStaticBandwidth = 0;
  function handleSetStaticBandwidth(newstaticbandwidth) {
    let bwDiff = 0;
    currentBandwidth = bandwidth * 1000;
    if (newstaticbandwidth > currentBandwidth) {
      bwDiff = newstaticbandwidth - currentBandwidth;
    } else if (newstaticbandwidth < currentBandwidth) {
      bwDiff = newstaticbandwidth - currentBandwidth;
    } else {
      bwDiff = 0;
    }
    handleBandwidthOffsetClick(bwDiff);
    newStaticBandwidth = newstaticbandwidth; // This will update the IF Filter button //
    setTimeout(function () {
      toggleIFPopup();
    }, 300);
  }

  // Begin Fine Tuning Steps Function
  //Function created to create a fine tune button and modified by sv2amk //
  // for mobile users first Column top //
  let mobiletopfinetuningsteps = ["-1", "-0.1", "-0.01", "0", "+0.01", "+0.1", "+1"];
  // For desktop users
  let finetuningsteps = [
    "-5",
    "-1",
    "-0.5",
    "-0.1",
    "-0.01",
    "0",
    "+0.01",
    "+0.1",
    "+0.5",
    "+1",
    "+5",
  ];

  function handleFineTuningStep(finetuningstep) {
    finetuningstep = parseFloat(finetuningstep) * 1e3;
    if (finetuningstep == 0) {
      frequency = Math.round(frequency);
    }
    frequencyInputComponent.setFrequency(frequency * 1e3 + finetuningstep);
    handleFrequencyChange({ detail: frequency * 1e3 + finetuningstep });
    updatePassband();
  }
  // End Fine Tuning Steps Function //

  // Begin Tuning Steps Function
  function handleTuningStep(tuningstep) {
    //parseFloat(tuningstep);
    currentTuneStep = tuningstep;
  }
  // End Tuning Steps Function //

  // Mobile gestures
  // Pinch = Mousewheel = Zoom
  let pinchX = 0;
  function handleWaterfallPinchStart(e) {
    pinchX = 0;
  }
  function handleWaterfallPinchMove(e) {
    const diff = e.detail.scale - pinchX;
    pinchX = e.detail.scale;
    const scale =
      1 -
      Math.abs(e.detail.srcEvent.movementX) /
        waterfallCanvas.getBoundingClientRect().width;
    const evt = e.detail.srcEvent;
    evt.coords = { x: e.detail.center.x };
    evt.deltaY = -Math.sign(diff);
    evt.scaleAmount = scale;
    waterfall.canvasWheel(evt);
    updatePassband();
    // Prevent mouseup event from firing
    waterfallDragTotal += 2;
  }
  // Pan = Mousewheel = waterfall dragging
  function handleWaterfallPanMove(e) {
    if (e.detail.srcEvent.pointerType === "touch") {
      waterfall.mouseMove(e.detail.srcEvent);
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  // ── DX Cluster Widget ────────────────────────────────────────────────────
  let dxSpots = [];
  let dxBandFilter = 'ALL';
  let dxLoading = false;
  let dxError = null;
  let dxRefreshInterval = null;

  const DX_BAND_LIST = ['ALL','160','80','60','40','30','20','17','15','12','10','6'];

  const DX_BAND_FREQ = {
    '160': '1.8MHz', '80': '3.5MHz', '60': '5MHz',  '40': '7MHz',
    '30': '10MHz',   '20': '14MHz',  '17': '18MHz', '15': '21MHz',
    '12': '24MHz',   '10': '28MHz',  '6':  '50MHz',
  };

  
  // DX spots come from the local backend endpoint to avoid public CORS proxies.
  // The backend normalizes upstream data into a JSON array.
  function buildDXUrl() {
    const band = dxBandFilter === 'ALL' ? '' : `&band=${encodeURIComponent(dxBandFilter)}`;
    return `/api/dxspots?limit=30${band}&_t=${Date.now()}`;
  }

  function freqToBand(f) {
    if (f >= 1800  && f <= 2000)   return '160m';
    if (f >= 3500  && f <= 4000)   return '80m';
    if (f >= 5300  && f <= 5410)   return '60m';
    if (f >= 7000  && f <= 7300)   return '40m';
    if (f >= 10100 && f <= 10150)  return '30m';
    if (f >= 14000 && f <= 14350)  return '20m';
    if (f >= 18068 && f <= 18168)  return '17m';
    if (f >= 21000 && f <= 21450)  return '15m';
    if (f >= 24890 && f <= 24990)  return '12m';
    if (f >= 28000 && f <= 29700)  return '10m';
    if (f >= 50000 && f <= 54000)  return '6m';
    return '';
  }

  function detectMode(info) {
    if (!info) return '';
    const modes = ['FT8','FT4','CW','SSB','AM','FM','RTTY','PSK31','BPSK31','JS8','WSPR','JT65','JT9','MSK144'];
    const upper = info.toUpperCase();
    for (const m of modes) {
      if (upper === m || upper.startsWith(m + ' ') || upper.startsWith(m + ',')) return m;
    }
    return '';
  }

  function parseDXJSON(data) {
    return (Array.isArray(data) ? data : [])
      .filter(s => s && s.dx_call && Number(s.frequency) > 0 && Number(s.frequency) < 60000)
      .map(s => ({
        dx:      String(s.dx_call  || '').trim(),
        spotter: String(s.de_call  || '').trim().replace(/-@$/, ''),
        freq:    String(s.frequency),
        time:    s.time || '',
        comment: s.info || '',
        mode:    detectMode(s.info),
        band:    freqToBand(Number(s.frequency)),
        country: s.dx_country || '',
      }));
  }

  async function tryFetch(url) {
    var _dxAbort = new AbortController();
    var _dxTimer = setTimeout(function() { _dxAbort.abort(); }, 10000);
    try {
      const res = await fetch(url, {
        signal: _dxAbort.signal,
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(_dxTimer);
    }
  }

  async function fetchDXSpots() {
    dxLoading = true;
    dxError = null;
    const url = buildDXUrl();
    try {
      const data = await tryFetch(url);
      const spots = parseDXJSON(data);
      dxSpots = spots;
      dxError = spots.length ? null : 'No spots returned by backend.';
    } catch (e) {
      dxError = 'Could not load spots from local backend (' + (e && e.message ? e.message : 'unknown') + ').';
      dxSpots = [];
    } finally {
      dxLoading = false;
    }
  }


  // Tune waterfall to a DX spot frequency (kHz → Hz),
  // zoom into the band and apply the band's brightness settings.
  function tuneToDXFrequency(freqKhz) {
    const hz = parseFloat(freqKhz) * 1000;
    if (isNaN(hz) || hz <= 0) return;
    try {
      // 1. Tune frequency display + audio passband
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      updatePassband();

      // 2. Find the matching band
      const freqKHz = hz / 1000;
      let bandIdx = -1;
      for (let i = 0; i < bandArray.length; i++) {
        const b = bandArray[i];
        if (freqKHz >= b.startFreq / 1000 &&
            freqKHz <= b.endFreq   / 1000 &&
            (b.ITU === siteRegion || b.ITU === 123)) {
          bandIdx = i;
          break;
        }
      }
      if (bandIdx < 0) return;

      const band = bandArray[bandIdx];

      // 3. Disable auto-adjust so it cannot override the band brightness
      if (autoAdjustEnabled) {
        autoAdjustEnabled = false;
        waterfall.autoAdjust = false;
        storeWaterfallSettings = false;
      }
      // Also disable legacy AutoAdjust if active
      if (typeof AutoAdjustEnabled !== 'undefined' && AutoAdjustEnabled) {
        AutoAdjustEnabled = false;
      }

      // 4. Apply the band's brightness from bands-config.js
      min_waterfall = parseInt(band.min);
      max_waterfall = parseInt(band.max);
      handleMinMove();
      handleMaxMove();

      // 5. Compute waterfall zoom span from band edge frequencies
      const hzPerBin = waterfall.sps / waterfall.fftSize;
      const spanEnd   = band.endFreq   / hzPerBin;
      const spanStart = band.startFreq / hzPerBin;
      let bandSpan = (spanEnd - spanStart) / 2;
      bandSpan += bandSpan * 0.01; // 1% margin

      // 6. Centre the zoom window on the spot frequency
      let m = frequencyToFFTOffset(hz);
      m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
      const l = Math.floor(m - 512) - bandSpan;
      const r = Math.ceil (m + 512) + bandSpan;
      waterfall.setWaterfallRange(l, r);

      // 7. Update UI markers / tracking
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
      currentBand     = bandIdx;
      bandName        = band.name;
      currentTuneStep = band.stepi;
    } catch (e) {
      console.warn('DX tune error:', e);
    }
  }

  function dxSelectBand(band) {
    dxBandFilter = band;
    fetchDXSpots();
  }

  function formatDXTime(t) {
    if (!t) return '';
    try {
      // DX Summit ISO format: "2026-03-08T10:55:08" (UTC)
      const d = new Date(t.includes('Z') ? t : t + 'Z');
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}${m}Z`;
    } catch(e) { return String(t).slice(11, 16) + 'Z'; }
  }


  function startDXCluster() {
    fetchDXSpots();
    // Refresh every 20s — fast enough to catch short DX openings,
    // safe enough not to trigger CORS proxy rate limits.
    if (dxRefreshInterval) clearInterval(dxRefreshInterval);
    dxRefreshInterval = setInterval(fetchDXSpots, 20000);
    // Pause polling when the tab is hidden, resume when visible again.
    if (dxVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', dxVisibilityChangeHandler);
    }
    dxVisibilityChangeHandler = () => {
      if (document.hidden) {
        if (dxRefreshInterval) clearInterval(dxRefreshInterval);
        dxRefreshInterval = null;
      } else {
        fetchDXSpots();          // immediate refresh on tab focus
        if (dxRefreshInterval) clearInterval(dxRefreshInterval);
        dxRefreshInterval = setInterval(fetchDXSpots, 20000);
      }
    };
    document.addEventListener('visibilitychange', dxVisibilityChangeHandler);
  }

</script>

<svelte:window
  on:mousemove={handleWindowMouseMove}
  on:mouseup={handleWindowMouseUp}
/>

<main class="custom-scrollbar">
<!-- comment the following 3 lines if you don't want the other versions to be shown -->
  {#if !Device.isMobile}
    <VersionSelector />
  {/if}
  
  <div class="h-screen overflow-hidden flex flex-col min-h-screen">
    {#if !Device.isMobile}
      <div
        class="w-full sm:h-screen overflow-y-scroll sm:w-1/2 xl:w-1/3 lg:w-1/4 sm:transition-all sm:ease-linear sm:duration-100"
        style="width:100%;"
      >
        <div
          class="min-h-screen bg-custom-dark text-gray-200"
          style="padding-top: 5px;"
        >
          <div class="max-w-screen-lg mx-auto">
            <div class="xl:pt-1"></div>

            <!--Titel Box with Admin Infos, to be personalized-->
            <div
              class="flex flex-col rounded p-2 justify-center"
              id="chat-column"
            >
              <div
                class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-8"
                id="chat-box"
                style="opacity: 0.85;"
              >
                <!-- Header -->

                <h4
                  class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                >
                  WebSDR <a
                    href="https://www.qrz.com/db/{siteSysop}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">{siteSysop}</a
                  >, located in
                  <a
                    href="http://k7fry.com/grid/?qth={siteGridSquare}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)"
                    >{siteCity}, {siteGridSquare}</a
                  >
                </h4>

                <!-- Details -->
                <span class="text-white text-sm sm:text-sm mr-4 mb-2 sm:mb-0">
                  {siteSysop}:
                  <a
                    href="mailto:{siteSysopEmailAddress}?subject=WebSDR"
                    style="color:rgba(0, 225, 255, 0.993)">email</a>

                   &nbsp - &nbsp

                   &nbsp - &nbsp

              <!-- Shortcuts trigger + popup -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                      on:click={openShortcuts}
                      title="Keyboard Shortcuts"
                      aria-haspopup="dialog"
                      aria-expanded={showShortcuts}
                      aria-controls="shortcuts-dialog"
                      style="color:rgba(0, 225, 255, 0.993)"
                    >
                      ⌨️ Keyboard Shortcuts                      
                    </button>

                  &nbsp-&nbsp Other:&nbsp;
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="Other servers"
                    onClick="window.open('https://sdr-list.xyz');"
                  >
                    <span class="icon">Servers</span>
                  </button>                

                <div class="flex justify-center w-full">
                
                  <!-- Frequency & QRZ Lookup -->

                  Frequency Lookup :&nbsp;
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="Find the MW you are hearing"
                    onClick="window.open('http://www.mwlist.org/mwlist_quick_and_easy.php?area=1&amp;kHz='+{Math.round(
                      frequency,
                    )},'websdrstationinfo','');"
                  >
                    <span class="icon">MW List</span>
                  </button>
                  &nbsp;&nbsp;&nbsp;
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="Find the SW you are hearing"
                    onClick="window.open('http://www.short-wave.info/index.php?freq='+{Math.round(
                      frequency,
                    )}+'&amp;timbus=NOW&amp;ip=179&amp;porm=4','websdrstationinfo','')"
                  >
                    <span class="icon">SW List</span>
                  </button>
                  &nbsp - &nbsp
                  <form
                    method="get"
                    target="_blank"
                    action="https://www.qrzcq.com"
                  >
                    Callsign lookup: &nbsp;&nbsp;&nbsp;
                    <input
                      type="text"
                      name="q"
                      value=""
                      size="6"
                      style=" background-color: #2D3B4F; color: rgb(0, 255, 255); border-style: groove; border-color: grey; text-align:center; font-size: 84%;"
                      on:click={() => this.form.q.select().focus()}
                    />&nbsp;&nbsp;&nbsp;
                    <input type="hidden" name="action" value="search" />
                    <input
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                      type="submit"
                      name="page"
                      value="Search"
                      style="color:rgba(0, 225, 255, 0.993)"
                    />
                  </form>

                  </div>
                <div>
                
                {#if showShortcuts}
                  <div class="modal-backdrop" on:click={closeShortcuts}></div>

                  <div 
                    id="shortcuts-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shortcuts-title"
                    class="modal-right"
                    on:click|stopPropagation
                  >
                    <div class="modal-header">
                      <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                      <button
                        class="close-btn"
                        on:click={closeShortcuts}
                        bind:this={closeBtnEl}
                        title="Close window"
                        aria-label="Close"
                      >×</button>
                    </div>
                    
                    <div class="modal-body">
                      <table class="shortcuts-table">
                        <tbody>
                          <tr><td>l, u, a, q, f</td><td>LSB, USB, AM, QUAM, FM mode</td></tr>
                          <tr><td>w</td><td>reverse waterfall</td></tr>
                          <tr><td>ControlRight</td><td>.00 KHz </td></tr>                         
                          <tr><td>↑ / ↓</td><td>±0.01 kHz</td></tr>
                          <tr><td>← / →</td><td>∓0.10 kHz</td></tr>
                          <tr><td>Shift + ↑ / ↓</td><td>±1 kHz</td></tr>
                          <tr><td>Shift + ← / →</td><td>∓10 kHz</td></tr>
                          <tr><td>Ctrl + ↑ / ↓</td><td>±100 kHz</td></tr>
                          <tr><td>Ctrl + ← / →</td><td>∓500 kHz</td></tr>
                          <tr><td>Shift + Ctrl + ↑ / ↓</td><td>±1 MHz</td></tr>
                          <tr><td>Shift + Ctrl + ← / →</td><td>∓10 MHz</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div class="modal-header">
                      <h2 id="shortcuts-title">Keyboard Shortcuts inside Waterfall</h2>
                    </div>

                    <div class="modal-body">
                      <table class="shortcuts-table">
                        <tbody>
                          <tr><td>Wheel up/down</td><td>Zoom in/out</td></tr>                          
                          <tr><td>Shift + Wheel up/down</td><td>Tune ±100 Hz</td></tr>
                          <tr><td>Ctrl + Wheel up/down</td><td>Tune ±10 Hz</td></tr>
                          <tr><td>Ctrl + Shift + Wheel</td><td>Snap to .00 kHz</td></tr>
                         </tbody>
                       </table>
                       <br>
                    <p class="hint">Press <kbd>Esc</kbd> or click <b>×</b> to close.</p>
                          </div>
                        </div>
                    {/if}
                  </div>
                
                <!-- End Frequency & QRZ Lookupp -->
              

              <!-- Collapsible Menu -->
              <div>
                    <!-- Toggle Button -->
                    <center>

                      <button class="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors ring-2 ring-blue-500 s-XsEmFtvddWTw" on:click={() => toggleMenu()} style="margin-top: 15px;">
                      <span id="menu-toggle-label">Open Additional Info</span>
                      </button>

                    </center>
                      
               <!-- Collapsible Content -->
               <div id="collapsible-menu" class="hidden mt-3 bg-gray-700 p-3 rounded">
                <div class="columns">
                  <div class="first-column">
                    <ul style="font-size: 0.91rem; text-align: left;">
                    <b>Setup &amp; Configuration:</b>
                      <img
                        src="https://img.shields.io/badge/version- 3.1.0-cyan?logo=github"
                        alt="Version"
                        class="inline-block align-middle ml-2"
                      />
                     with <a href="https://catsyncsdr.wordpress.com/" target="new" style="color:rgba(0, 225, 255, 0.993)">CAT sync ®</a>
                    <br>
                    <span style="/*text-decoration: line-through*/">PC: {siteHardware} {siteSoftware}</span>
                    
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>

                    <!-- System Stats Modal -->
                    {#if showSystemStats}
                      <div class="modal-backdrop" on:click={closeSystemStats}>
                        <div 
                          id="system-stats-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="system-stats-title"
                          class="modal-right"
                          on:click|stopPropagation
                        >
                        <div class="modal-header">
                          <h2 id="system-stats-title">System Resources</h2>
                          <button
                            class="close-btn"
                            on:click={closeSystemStats}
                            bind:this={systemStatsCloseBtnEl}
                            title="Close window"
                            aria-label="Close"
                          >×</button>
                        </div>
                        
                        <div class="modal-body">
                          <div style="font-size: 0.9rem;">
                            <!-- CPU Stats -->
                            <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                              <h3 style="margin: 0 0 0.5rem 0; color: rgba(0, 225, 255, 0.993); font-size: 1rem;">🖥️ CPU</h3>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Usage:</span>
                                <span style="color: #4ade80;">{systemStats.cpu.usage}%</span>
                              </div>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Cores:</span>
                                <span>{systemStats.cpu.cores}</span>
                              </div>
                              {#if systemStats.cpu.temperature !== null}
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Temperature:</span>
                                <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
                              </div>
                              {/if}
                              
                              {#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
                              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
                                {#each systemStats.cpu.topProcesses as process}
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
                                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
                                  <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
                                </div>
                                {/each}
                              </div>
                              {/if}
                            </div>

                            <!-- Memory Stats -->
                            <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                              <h3 style="margin: 0 0 0.5rem 0; color: rgba(0, 225, 255, 0.993); font-size: 1rem;">💾 Memory</h3>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Used:</span>
                                <span>{systemStats.memory.used} GB / {systemStats.memory.total} GB</span>
                              </div>
                              <div style="display: flex; justify-content: space-between;">
                                <span>Usage:</span>
                                <span style="color: {systemStats.memory.percent > 80 ? '#ef4444' : '#4ade80'};">{systemStats.memory.percent}%</span>
                              </div>
                            </div>

                            <!-- Disk Stats -->
                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                              <h3 style="margin: 0 0 0.5rem 0; color: rgba(0, 225, 255, 0.993); font-size: 1rem;">💿 Disk</h3>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Used:</span>
                                <span>{systemStats.disk.used} GB / {systemStats.disk.total} GB</span>
                              </div>
                              <div style="display: flex; justify-content: space-between;">
                                <span>Usage:</span>
                                <span style="color: {systemStats.disk.percent > 80 ? '#ef4444' : '#4ade80'};">{systemStats.disk.percent}%</span>
                              </div>
                            </div>
                          </div>

                          <br>
                          <p class="hint" style="font-size: 0.75rem;">Press <kbd>Esc</kbd> or click <b>×</b> to close.</p>
                        </div>
                      </div>
                    </div>
                    {/if}
                    <!-- End System Stats Modal -->
                    <br> <br>
                    <b>SDR Receivers &amp; Antenna</b>
                    <br>
                    <span style="/*text-decoration: line-through*/">Receiver: {siteReceiver}</span>
                    <br>                    
                    <span style="/*text-decoration: line-through*/">Antenna: {siteAntenna}</span> <br>
                    <span>Github: <a href="https://github.com/sv1btl/PhantomSDR-Plus" target="new" style="color:rgba(0, 225, 255, 0.993)"> {siteInformation} </a></span>
                    <br><br>

                     <b>Note:</b> <br> 
                     <span style="/*text-decoration: line-through*/">{siteNote} <br>

                     <!-- Any other information here --> 
                     
                     <br>
                             
                  <div style="font-weight: bold;">Current band propagation for Europe and statistics:</div>
                  <div style="display: flex; align-items: center; margin-top: 10px;">
                     <img src="https://images.lightningmaps.org/blitzortung/europe/index.php?map=5&amp;t=5092072" alt="Lightning Map" style="margin-right: 10px;" />
                     <a href="https://www.hamqsl.com/solar.html" title="Click for more information">
                     <img alt="Solar propagation" src="https://www.hamqsl.com/solar101vhf.php" /> </a><br>
                   </div>
                </div>
                   
                <div class="second-column"> 
                 <!-- ── Native DX Cluster Widget ─────────────────────────────────────── -->
                 <!-- Replaces the cross-origin <embed> so frequency clicks can directly  -->
                 <!-- tune the waterfall via frequencyInputComponent.setFrequency()        -->
                 <div style="
                   margin-left:10px;
                   width:660px;
                   background:#0d1117;
                   border:1px solid #30363d;
                   border-radius:6px;
                   font-family:monospace;
                   font-size:12px;
                   color:#c9d1d9;
                   overflow:hidden;
                 ">
                   <!-- Header bar -->
                   <div style="
                     background:#161b22;
                     border-bottom:1px solid #30363d;
                     padding:6px 10px;
                     display:flex;
                     align-items:center;
                     justify-content:space-between;
                     gap:6px;
                     flex-wrap:wrap;
                   ">
                     <span style="color:#58a6ff;font-weight:bold;font-size:13px;">📡 DX Cluster</span>
                     <!-- Band filter buttons -->
                     <div style="display:flex;flex-wrap:wrap;gap:3px;">
                       {#each DX_BAND_LIST as band}
                         <button
                           on:click={() => dxSelectBand(band)}
                           style="
                             padding:2px 6px;
                             border-radius:4px;
                             border:1px solid {dxBandFilter===band ? '#58a6ff' : '#30363d'};
                             background:{dxBandFilter===band ? 'rgba(88,166,255,0.2)' : 'transparent'};
                             color:{dxBandFilter===band ? '#58a6ff' : '#8b949e'};
                             cursor:pointer;
                             font-size:11px;
                             font-family:monospace;
                             transition:all 0.15s;
                           "
                         >{band==='ALL' ? 'All' : band+'m'}</button>
                       {/each}
                     </div>
                     <!-- Refresh button -->
                     <button
                       on:click={fetchDXSpots}
                       title="Refresh spots"
                       style="
                         padding:2px 8px;
                         border-radius:4px;
                         border:1px solid #30363d;
                         background:transparent;
                         color:#8b949e;
                         cursor:pointer;
                         font-size:11px;
                         font-family:monospace;
                       "
                     >{dxLoading ? '⟳ …' : '⟳ Refresh'}</button>
                   </div>

                   <!-- Table area -->
                   <div style="height:430px;overflow-y:auto;">
                     {#if dxError}
                       <div style="padding:16px;color:#f85149;text-align:center;line-height:1.6;">
                         ⚠ Could not load spots<br>
                         <small style="color:#8b949e;">{dxError}</small><br><br>
                         <small style="color:#6e7681;">
                           All three CORS proxies failed.<br>
                           Possible causes: network/firewall blocks outbound HTTPS,<br>
                           or all proxy services are temporarily unavailable.<br>
                           Try clicking Refresh in a moment.
                         </small>
                       </div>
                     {:else if dxLoading && dxSpots.length === 0}
                       <div style="padding:16px;color:#8b949e;text-align:center;">Loading spots…</div>
                     {:else if dxSpots.length === 0}
                       <div style="padding:16px;color:#8b949e;text-align:center;">No spots found.</div>
                     {:else}
                       <table style="width:100%;border-collapse:collapse;">
                         <thead>
                           <tr style="background:#161b22;position:sticky;top:0;z-index:1;">
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;white-space:nowrap;">UTC</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Spotter</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">DX Call</th>
                             <th style="padding:4px 6px;text-align:right;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Freq (kHz)</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Band</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Mode</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Comment</th>
                           </tr>
                         </thead>
                         <tbody>
                           {#each dxSpots as spot, i}
                             <tr style="background:{i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
                               <td style="padding:3px 6px;color:#8b949e;white-space:nowrap;">{formatDXTime(spot.time)}</td>
                               <td style="padding:3px 6px;white-space:nowrap;">
                                 <a
                                   href="https://www.qrzcq.com/call/{(spot.spotter || '').trim()}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Look up {(spot.spotter || '').trim()} on QRZCQ"
                                   style="
                                     color:#79c0ff;
                                     font-weight:bold;
                                     text-decoration:none;
                                     border-bottom:1px dotted rgba(121,192,255,0.5);
                                     transition:color 0.15s;
                                   "
                                   on:mouseover={e => e.target.style.color='#a5d6ff'}
                                   on:mouseout={e => e.target.style.color='#79c0ff'}
                                 >{spot.spotter || ''}</a>
                               </td>
                               <td style="padding:3px 6px;white-space:nowrap;">
                                 <a
                                   href="https://www.qrzcq.com/call/{(spot.dx || '').trim()}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Look up {(spot.dx || '').trim()} on QRZCQ"
                                   style="
                                     color:#ffa657;
                                     font-weight:bold;
                                     text-decoration:none;
                                     border-bottom:1px dotted rgba(255,166,87,0.5);
                                     transition:color 0.15s;
                                   "
                                   on:mouseover={e => e.target.style.color='#ffcc99'}
                                   on:mouseout={e => e.target.style.color='#ffa657'}
                                 >{spot.dx || ''}</a>
                               </td>
                               <!-- ★ Clickable frequency – tunes the waterfall -->
                               <td style="padding:3px 6px;text-align:right;">
                                 <button
                                   on:click={() => tuneToDXFrequency(spot.freq)}
                                   title="Click to tune waterfall to {spot.freq} kHz"
                                   style="
                                     background:transparent;
                                     border:none;
                                     color:#3fb950;
                                     cursor:pointer;
                                     font-family:monospace;
                                     font-size:12px;
                                     font-weight:bold;
                                     padding:0;
                                     text-decoration:underline dotted;
                                     white-space:nowrap;
                                   "
                                 >{spot.freq}</button>
                               </td>
                               <td style="padding:3px 6px;color:#8b949e;white-space:nowrap;">{spot.band || ''}</td>
                               <td style="padding:3px 6px;color:#d2a8ff;white-space:nowrap;">{spot.mode || ''}</td>
                               <td style="padding:3px 6px;color:#c9d1d9;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title={spot.comment || ''}>{spot.comment || ''}</td>
                             </tr>
                           {/each}
                         </tbody>
                       </table>
                     {/if}
                   </div>

                   <!-- Footer -->
                   <div style="padding:4px 10px;background:#161b22;border-top:1px solid #30363d;color:#484f58;font-size:10px;display:flex;justify-content:space-between;">
                     <span>Data: local backend /api/dxspots • auto-refresh 20 s</span>
                     <span>{dxSpots.length} spot{dxSpots.length===1?'':'s'}</span>
                   </div>
                 </div>
                 <!-- ── End DX Cluster Widget ──────────────────────────────────────────── -->
              </div>     
            </div>
           </div>
         </div>
        </div>

      <style>
      .hidden {
          display: none;
        }

      /* Setting the container width to 100% enabling overflow auto to clear the float */
      .columns {
          width: 100%;
          overflow: auto; /* To clear the float */}

      /* Styling for the left column */.first-column {
          float: left; /* Float left to place it on the left side */    width: 47%; /* Taking 47% of the container width */}

      /* Styling for the right column */.second-column {
          float: right; /* Float right to place it on the right side */    width: 53%; /* Taking 53% of the container width */}
      </style>
                
      <!--End of Titel Box -->

              <!--Beginn of Waterfall -->
              <div class="flex justify-center w-full">
                <div class="w-full" id="outer-waterfall-container">
                  <div
                    style="image-rendering:pixelated;"
                    class="w-full xl:rounded-lg peer overflow-hidden"
                    id="waterfall"
                  >
                    <canvas
                      class="w-full bg-black peer {spectrumDisplay
                        ? 'max-h-40'
                        : 'max-h-0'}"
                      bind:this={spectrumCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousemove={handleSpectrumMouseMove}
                      on:mouseleave={handleSpectrumMouseLeave}
                      width="1024"
                      height="128"
                    ></canvas>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={topGraduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <div class="relative w-full">
                      <canvas
                        class="w-full bg-black {waterfallDisplay
                          ? 'block'
                          : 'hidden'}"
                        bind:this={waterfallCanvas}
                        style:transform={waterfallReverse ? "scaleY(-1)" : "scaleY(1)"}
                        style:transform-origin={"center center"}
use:pinch
                        on:pinchstart={handleWaterfallPinchStart}
                        on:pinchmove={handleWaterfallPinchMove}
                        use:pan
                        on:panmove={handleWaterfallPanMove}
                        on:wheel={handleWaterfallWheel}
                        on:mousedown={handleWaterfallMouseDown}
                        on:mousemove={handleWaterfallMouseMove}
                        on:mouseleave={handleWaterfallMouseLeave}
                        width="1024"
                        title="Wheel = Zoom
Shift + Wheel = 0.1 KHz
Ctrl + Wheel = 0.01 KHz
Shift + Ctrl + Wheel = snap to .00 KHz"
                      ></canvas>
                      
                      <!-- Cursor Frequency Display -->
                      {#if showCursorFreq && cursorFrequency !== null}
                        <div
                          class="cursor-frequency-tooltip"
                          style="position: fixed; left: {cursorX + 15}px; top: {cursorY - 30}px; pointer-events: none; z-index: 10000;"
                        >
                          {formatFrequency(cursorFrequency)}
                        </div>
                      {/if}
                      
                      <div
                        class="pointer-events-none absolute inset-0 z-[9999] {waterfallDisplay
                          ? 'block'
                          : 'hidden'}"
                        bind:this={waterfallHighlightCanvas}
                        style:transform={waterfallReverse ? "scaleY(-1)" : "scaleY(1)"}
                        style:transform-origin={"center center"}
                      >
                        <div
                          bind:this={waterfallHighlightInner}
                          class="absolute top-0 bottom-0 bg-yellow-300/10 border-l border-r border-yellow-300/60"
                          style="pointer-events: none;"
                        ></div>
                      </div>
                    </div>
                    <canvas
                      class="hidden"
                      bind:this={tempCanvas}
                      width="1024"
                      height="1024"
                    ></canvas>
                    <FrequencyInput
                      bind:this={frequencyInputComponent}
                      on:change={handleFrequencyChange}
                    ></FrequencyInput>

                    <FrequencyMarkers
                      bind:this={frequencyMarkerComponent}
                      bookmarks={$bookmarks}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:wheel={handleWaterfallWheel}
                      on:markerclick={handleFrequencyMarkerClick}
                    ></FrequencyMarkers>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={graduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <PassbandTuner
                      on:change={handlePassbandChange}
                      on:wheel={handleWaterfallWheel}
                      bind:this={passbandTunerComponent}
                    ></PassbandTuner>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={bandPlanCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    >
                    </canvas>
                    <div class="relative w-full" style="min-height:14px">
                      <button
                        class="absolute top-0 right-0 z-10 text-xs px-1 leading-none rounded"
                        style="background:rgba(0,0,0,0.6);color:{showClients ? '#4ade80' : '#ef4444'};border:1px solid {showClients ? '#4ade80' : '#ef4444'};"
                        on:click={() => showClients = !showClients}
                        title="{showClients ? 'Hide' : 'Show'} user labels"
                      >{showClients ? "●" : "○"}</button>
                      <canvas
                        class="w-full bg-black peer"
                        style="display:{showClients ? 'block' : 'none'}"
                        bind:this={clientsCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:click={handleGraduationClick}
                        on:mousemove={handleClientsMouseMove}
                        on:mousedown={(e) =>
                          passbandTunerComponent.handleMoveStart(e, 1)}
                        on:touchstart={passbandTunerComponent.handleTouchStart}
                        on:touchmove={passbandTunerComponent.handleTouchMove}
                        on:touchend={passbandTunerComponent.handleTouchEnd}
                        width="1024"
                        height="20"
                      ></canvas>
                    </div>

                <!-- Spectrogram Display -->
                <div class="mt-2 w-full" style="display: {spectrogramEnabled ? 'block' : 'none'}">
                  <Spectrogram
                    bind:this={spectrogramComponent}
                    minHz={50}
                    maxHzLimit={10000}
                    fftSize={4096}
                    displayGain={spectrogramGain}
                    colorScheme={spectrogramColorScheme}
                    showLabels={true}
                    height={spectrogramHeight}
                    enabled={spectrogramEnabled}
                    on:initialized={initSpectrogram}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            class="absolute inset-0 z-20 bg-black bg-opacity-40 backdrop-filter backdrop-blur-sm transition-opacity duration-300 ease-in-out cursor-pointer flex justify-center items-center"
            id="startaudio"
          >
            <div class="text-center p-4 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 mx-auto mb-2 text-white opacity-80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
              <p class="text-white text-lg font-medium">Tap to enable audio</p>
            </div>
          </div>


              <!-- Audio Begins -->

              <!-- First Column -->

              <div
                class="flex flex-col xl:flex-row rounded p-5 justify-center rounded y-7"
                id="middle-column"
              >

                <div
                  class="p-5 flex flex-col items-center bg-gray-800 lg:border lg:border-gray-700 rounded-none rounded-t-lg lg:rounded-none lg:rounded-l-lg"
                >

              <!-- Begin Band Selection -->
                  <h3 class="text-white text-base font-semibold mb-2">
                    Band selector
                  </h3>
                  <div class="w-full grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {#each bandArray as bandData, index}
                      {#if verifyRegion(bandData.ITU)}
                        {#if bandData.publishBand == 1}
                          {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                            <button
                              id="band-selector"
                              class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                              index
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => handleBandChange(index)}
                              title={bandData.name}
                              >{bandData.name}
                            </button>
                          {/if}
                        {/if}
                      {:else}{/if}
                    {/each}
                  </div>
                  <div><hr class="border-gray-600 my-2" /></div>
                  <div class="w-full grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {#each bandArray as bandData, index}
                      {#if verifyRegion(bandData.ITU)}
                        {#if bandData.publishBand == 2}
                          {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                            <button
                              id="band-selector"
                              class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                              index
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => handleBandChange(index)}
                              title={bandData.name}
                              >{bandData.name}
                            </button>
                          {/if}
                        {/if}
                      {:else}{/if}
                    {/each}
                  </div>
                  <!-- End Band Selection -->

                  <div><hr class="border-gray-600 my-2" /></div>

                  <!-- Begin Modes Selection -->
                  <h3 class="text-white text-base font-semibold mb-2">
                    Modes selector
                  </h3>
                  <div
                    id="demodulationModes"
                    class="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md"
                  >
                    {#each ["USB", "LSB", "CW", "AM", "QUAM", "FM"] as mode}
                      <button
                        on:click={() => SetMode(mode)}
                        class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                        mode
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                      >
                        {mode}
                      </button>
                    {/each}
                  </div>
                  <!-- End of Mode Content -->
                   
                   <div style="margin-bottom: 5px; margin-top: 5px;">&nbsp;&nbsp;&nbsp;</div>
                   
                  <h3 class="text-base font-semibold text-gray-100 mb-6">
                    Audio & Buffer
                  </h3>
                  <div class="control-group" id="volume-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {mute
                        ? 'rgba(255, 0, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleMuteChange}
                      title="Click to mute audio"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="w-5 h-5"
                      >
                        {#if mute}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06L19.5 10.94l-1.72-1.72z"
                          />
                        {:else}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z"
                          />
                        {/if}
                      </svg>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={volume}
                        on:input={handleVolumeChange}
                        class="glass-slider"
                        disabled={mute}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-gray-300 ml-4"
                      >{volume}%</span
                    >
                  </div>

                  <div class="control-group mt-4" id="squelch-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {squelchEnable
                        ? 'rgba(255, 100, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleSquelchChange}
                      title="Auto Squelch
Click first to noise-free frequency
to measure noise
Click again to de-activate"
                    >
                      <span class="text-xs font-semibold">SQ</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={squelch}
                        on:input={handleSquelchMove}
                        class="glass-slider"
                        min="-150"
                        max="0"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-gray-300 ml-4"
                      >{squelch}db</span
                    >
                  </div>

                  <!-- Audio Buffer Slider -->
                  <div class="control-group mt-4" id="audio-buffer-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {audioBufferDelayEnabled
                        ? 'rgba(30, 255, 0, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={() =>
                        handleAudioBufferDelayMove((audioBufferDelay += 1))}
                      title="Increase buffer to avoid slow internet issues"
                    >
                      <span class="text-white text-xs font-semibold"
                        ><svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M6 9a6 6 0 1 0 12 0a6 6 0 0 0 -12 0" />
                          <path
                            d="M12 3c1.333 .333 2 2.333 2 6s-.667 5.667 -2 6"
                          />
                          <path
                            d="M12 3c-1.333 .333 -2 2.333 -2 6s.667 5.667 2 6"
                          />
                          <path d="M6 9h12" />
                          <path d="M3 20h7" />
                          <path d="M14 20h7" />
                          <path d="M10 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                          <path d="M12 15v3" />
                        </svg>
                      </span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={audioBufferDelay}
                        on:input={handleAudioBufferDelayMove(audioBufferDelay)}
                        class="glass-slider"
                        min="1"
                        max="5"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-gray-300 ml-4"
                      >×{audioBufferDelay}</span
                    >
                    <hr class="border-gray-600 my-2" />
                  </div>
                  <!-- End of Buffer -->

                  <div><hr class="border-gray-600 my-2" /></div>

                  <!-- AGC Selection in Desktop -->
                  <h3 class="text-white text-base font-semibold mb-2">AGC</h3>
                  <div class="w-full mb-6">
                    <div id="moreoptions" class="grid grid-cols-4 gap-2">
                      <script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script>
                        let AGCbutton = false;
                      </script>
                      {#each [{ option: "Auto", AGCbutton: 0 }, { option: "Fast", AGCbutton: 1 }, { option: "Mid", AGCbutton: 2 }, { option: "Slow", AGCbutton: 3 }] as { option, AGCbutton }}
                        <button
                          class="retro-button h-8 text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {AGCbutton ==
                          currentAGC
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={() => {
                            if (option === "Auto") handleAGCChange(0);
                            else if (option === "Fast") handleAGCChange(1);
                            else if (option === "Mid") handleAGCChange(2);
                            else if (option === "Slow") handleAGCChange(3);
                          }}
                        >
                          <span>{option}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                  <!-- End AGC Section in Desktop -->

                  <!-- Begin Filter Selection -->
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-white text-base font-semibold">
                      Filters  &nbsp;  &nbsp;  &nbsp;  &nbsp; 
                    </h3>
                    <div class="flex items-center gap-2">
                      <!-- Backend Noise Gate Toggle Button -->
                      <button
                        class="text-xs px-3 py-1 rounded-md font-semibold transition-all duration-200 {backendNoiseGateEnabled
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                        on:click={toggleBackendNoiseGate}
                        title="Enable/disable backend noise gate"
                      >
                        Gate: {backendNoiseGateEnabled ? 'ON' : 'OFF'}
                      </button>
                      
                      <!-- Preset Dropdown (only active when gate is ON) -->
                      <label for="noise-gate-preset" class="text-white text-sm">Preset:</label>
                      <select
                        id="noise-gate-preset"
                        bind:value={noiseGatePreset}
                        on:change={handleNoiseGatePresetChange}
                        disabled={!backendNoiseGateEnabled}
                        class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none {!backendNoiseGateEnabled ? 'opacity-50 cursor-not-allowed' : ''}"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="aggressive">Aggressive</option>
                        <option value="weak-signal">Weak Signal</option>
                        <option value="smooth">Smooth</option>
                        <option value="maximum">Maximum</option>
                        <option value="cw">CW/Digital</option>
                        <option value="am-fm">AM/FM</option>
                      </select>
                    </div>
                  </div>
                  <div class="w-full mb-6">
                    <div id="moreoptions" class="grid grid-cols-4 gap-2">
                      {#each [{ option: "NR", icon: "wave-square", enabled: NREnabled }, { option: "NB", icon: "zap", enabled: NBEnabled }, { option: "AN", icon: "shield", enabled: ANEnabled }, { option: "CTCSS", icon: "filter", enabled: CTCSSSupressEnabled }] as { option, icon, enabled }}
                        <button
                          class="retro-button h-8 text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {enabled
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={() => {
                            if (option === "NR") handleNRChange();
                            else if (option === "NB") handleNBChange();
                            else if (option === "AN") handleANChange();
                            else handleCTCSSChange();
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            {#if icon === "wave-square"}
                              <path
                                d="M0 15h3v-3h3v3h3v-3h3v3h3v-3h3v3h3v-3h3"
                              />
                            {:else if icon === "zap"}
                              <polygon
                                points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                              />
                            {:else if icon === "shield"}
                              <path
                                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                              />
                            {:else if icon === "filter"}
                              <polygon
                                points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                              />
                            {/if}
                          </svg>
                          <span>{option}</span>
                        </button>
                      {/each}
                    </div>
                    <!-- End Filter Selection -->
                  </div>                  
                </div>

              <!-- Audio Ends -->

            <!-- Second Column -->

            <div
              class="flex flex-col items-center bg-gray-800 p-6 border-l-0 border-r-0 border border-gray-700"
            >
              <div
                class="bg-black rounded-lg p-8 min-w-80 lg:min-w-0 lg:p-4 mb-4 w-full"
                id="smeter-tut"
              >
                <div
                  class="flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div class="flex flex-col items-center">
<!--
                  Added by sv2amk to triger the initBandButton function
                  and show the proper band upon startup
-->
                   {#if currentBand ==-2} {initBandButton(frequency)} {/if}
                    <!-- Digit-by-digit frequency tuner -->
                    <div class="relative mb-2">
                      <div
                        class="flex items-center justify-center font-mono select-none rounded-lg px-2 py-1 bg-black border border-gray-700 cursor-default focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        use:handleDigitWheel
                        tabindex="0"
                        title="Click a digit then scroll / arrow-key to tune · Right-click to type"
                        on:keydown={handleDigitKeydown}
                        on:contextmenu={handleDigitContextMenu}
                      >
                        {#each freqDigitChars as d}
                          <span
                            class="text-4xl w-5 text-center rounded transition-colors duration-100 {selectedDigitIdx === d.idx ? 'bg-cyan-600 text-white' : d.dim ? 'text-gray-600 hover:text-gray-400' : 'text-cyan-300 hover:text-cyan-100'}"
                            on:click={() => handleDigitClick(d.idx)}
                          >{d.ch}</span>
                          {#if d.idx === 2}
                            <span class="text-gray-500 text-2xl w-3 text-center">,</span>
                          {/if}
                          {#if d.idx === 5}
                            <span class="text-gray-400 text-2xl w-3 text-center">.</span>
                          {/if}
                        {/each}
                      </div>
                      {#if showFreqInput}
                        <div class="absolute inset-0 flex items-center justify-center bg-black rounded-lg border border-cyan-500 z-50">
                          <input
                            class="w-full text-center bg-transparent text-cyan-300 text-2xl font-mono focus:outline-none px-2"
                            type="text"
                            inputmode="decimal"
                            bind:value={freqInputValue}
                            on:keydown={handleFreqInputKey}
                            on:blur={commitFreqInput}
                            use:focusOnMount
                          />
                        </div>
                      {/if}
                    </div>

                    <div class="flex items-center justify-center text-xs w-48">
                      <span class="text-cyan-400 px-1">Current Band:&nbsp;{bandName}</span>
                    </div>

                    <div class="flex items-center justify-center text-xs w-48">
                      <span class="text-yellow-400 px-1">{vfo}</span>
                      <span class="text-gray-400 px-1">|</span>
                      <span class="text-green-400 px-1">{demodulation}</span>
                      <span class="text-gray-400 px-1">|</span>
                      <span class="text-cyan-300 px-1">{bandwidth} kHz</span>
                    </div>
                  </div>
                  

                  <div class="flex flex-col items-center"> 
                    <div class="flex space-x-2 mb-1">
                      <span
                        class="date-time"
                        style="color:rgba(0, 225, 255, 0.993)"
                        >Time: {time}
                      </span>
                      </div>
                                      
                    <div class="flex space-x-1 mb-1">
                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {mute
                            ? 'text-red-500'
                            : 'text-red-500 opacity-20 relative z-10'}"
                          >MUTED</span
                        >
                      </div>

                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {squelchEnable
                            ? `text-orange-500`
                            : `text-orange-500 opacity-20 relative z-10`}"
                          >SQ</span
                        >
                      </div>

                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {NREnabled
                            ? `text-green-500`
                            : `text-green-500 opacity-20 relative z-10`}"
                          >NR</span
                        >
                      </div>

                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {NBEnabled
                            ? `text-green-500`
                            : `text-green-500 opacity-20 relative z-10`}"
                          >NB<span> </span></span
                        >
                      </div>

                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {ANEnabled
                            ? `text-green-500`
                            : `text-green-500 opacity-20 relative z-10`}"
                          >AN</span
                        >
                      </div>

                      <div
                        class="px-1 py-0.5 flex items-center justify-center w-10 h-5 relative overflow-hidden"
                      >
                        <span
                          class="text-xs font-mono {CTCSSSupressEnabled
                            ? `text-yellow-500`
                            : `text-yellow-500 opacity-20 relative z-10`}"
                          >CTCSS</span
                        >
                      </div>
                    </div>

                    <!-- SMeter -->
                    <canvas id="sMeter" width="250" height="40"></canvas>
                  </div>
                </div>
              </div>

              <div id="frequencyContainer" class="w-full mt-4">
                <div class="space-y-11">
                  <!-- Begin Fine Tuning Buttons -->

                  <div class="w-full mt-4">
                    <h3 class="text-white text-base font-semibold mb-2">
                      Fine Tuning (kHz)
                    </h3>
                    <div class="grid grid-cols-5 sm:grid-cols-11 gap-2">
                        {#each finetuningsteps as finetuningstep}
                          <button
                            id="fine-tuning-selector"
                            class="retro-button text-white font-bold h-7 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                            on:click={() =>
                              handleFineTuningStep(finetuningstep)}
                            title="{finetuningstep} kHz"
                          >
                            {finetuningstep}
                          </button>
                        {/each}

                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>

                  <!-- Phil -->
                  <!-- Begin Popup Buttons Menu -->
                  <div class="w-full mt-4">
                    <div class="grid grid-cols-4 sm:grid-cols-4 gap-2">
                      <button
                        id="vfo-ab-button"
                        class="glass-button h-8 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center w-full justify-center {toggleVFO ===
                        vfo
                          ? 'bg-green-600 pressed scale-95'
                          : 'bg-blue-700 hover:bg-gray-600'}"
                        on:click={() => toggleVFO(vfo)}
                        title="VFO Toggle"
                      >
                      <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                          />
                        </svg>
                        {vfo}
                      </button>

                      <button
                        id="mode-button"
                        class="glass-button h-8 text-white font-bold text-sm py-2 px-4 rounded-lg flex items-center w-full justify-center"
                        on:click={toggleModePopup}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                          />
                        </svg>
                        Modes
                      </button>
                      <!-- Mode Popup -->
                      {#if showModePopup}
                        <div
                          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                          on:click={toggleModePopup}
                        >
                          <div
                            class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                            on:click|stopPropagation
                          >
                            <div class="flex justify-between items-center mb-4">
                              <h2 class="text-base font-bold text-white">
                                Modes
                              </h2>
                              <button
                                class="text-gray-400 hover:text-white"
                                on:click={toggleModePopup}
                              >
                                <svg
                                  class="w-6 h-6"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  ></path>
                                </svg>

                              </button>
                            </div>
                                <!--Mode Content Begins -->
                                <div
                                  id="demodulationModes"
                                  class="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md"
                                >
                                  {#each ["USB", "LSB", "CW", "AM", "QUAM", "FM"] as mode}
                                    <button
                                      class="retro-button text-white font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                                      mode
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => setModePopup(mode)}
                                      >{mode}
                                    </button>
                                  {/each}
                                </div>
                                <!-- End of Mode Content -->
                          </div>
                        </div>
                      {/if}
                      <!-- End of Modes Popup Menu -->

                      <!-- Begin Bands Popup Menu -->
                      <button
                        id="band-popup-button"
                        class="glass-button h-8 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                        on:click={toggleBandPopup}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                          />
                        </svg>
                        Bands
                      </button>

                      <!-- Bands Popup -->
                      {#if showBandPopup}
                        <div
                          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                          on:click={toggleBandPopup}
                        >
                          <div
                            class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                            on:click|stopPropagation
                          >
                            <div class="flex justify-between items-center mb-4">
                              <h2 class="text-base font-bold text-white">
                                Bands
                              </h2>
                              <button
                                class="text-gray-400 hover:text-white"
                                on:click={toggleBandPopup}
                              >
                                <svg
                                  class="w-6 h-6"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  ></path>
                                </svg>
                              </button>
                            </div>
                            <!-- Content Starts -->

                            <div class="grid grid-cols-5 sm:grid-cols-5 gap-2">
                              {#each bandArray as bandData, index}
                                {#if verifyRegion(bandData.ITU)}
                                {#if bandData.publishBand == 1}
                                  {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                    <button
                                      id="band-selector"
                                      class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                      index
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() =>
                                        handleBandChangePopup(index)}
                                      title={bandData.name}
                                      >{bandData.name}
                                    </button>
                                      {/if}
                                    {/if}
                                  {:else}
                                {/if}
                              {/each}
                            </div>
                            <div><hr class="border-gray-600 my-2" /></div>
                            <div class="grid grid-cols-5 sm:grid-cols-5 gap-2">
                              {#each bandArray as bandData, index}
                                {#if verifyRegion(bandData.ITU)}
                                {#if bandData.publishBand == 2}
                                  {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                    <button
                                      id="band-selector"
                                      class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                      index
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() =>
                                        handleBandChangePopup(index)}
                                      title={bandData.name}
                                      >{bandData.name}
                                    </button>
                                      {/if}
                                    {/if}
                                  {:else}
                                {/if}
                              {/each}
                            </div>
                            <!-- Content Ends -->
                          </div>
                        </div>
                      {/if}
                      <!-- End Bands Popup Menu -->

                      <!-- Begin IF Filters Popup Menu -->
                      <button
                        id="if-filter-popup-button"
                        class="glass-button h-8 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                        on:click={toggleIFPopup}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                          />
                        </svg>
                        IF Filters
                      </button>

                      <!-- Static IF Popup -->
                      {#if showIFPopup}
                        <div
                          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                          on:click={toggleIFPopup}
                        >
                          <div
                            class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                            on:click|stopPropagation
                          >
                            <div class="flex justify-between items-center mb-4">
                              <h2 class="text-base font-bold text-white">
                                Static IF Filters
                              </h2>
                              <button
                                class="text-gray-400 hover:text-white"
                                on:click={toggleIFPopup}
                              >
                                <svg
                                  class="w-6 h-6"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  ></path>
                                </svg>
                              </button>
                            </div>

                            <!-- Content Starts -->

                            <div class="w-full mt-4">
                              <div
                                class="grid grid-cols-4 sm:grid-cols-6 gap-2"
                              >
                                {#each newBandwidth as newbandwidth}
                                  <button
                                    id="static-bandwidth-selector"
                                    class="retro-button text-sm text-white font-bold h-8 text-lg rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {newStaticBandwidth ==
                                    newbandwidth
                                      ? 'bg-blue-600 pressed scale-95'
                                      : 'bg-gray-700 hover:bg-gray-600'}"
                                    on:click={() =>
                                      handleSetStaticBandwidth(newbandwidth)}
                                        title={newbandwidth}
                                      >
                                        {#if newbandwidth == 500}500 Hz                                        
                                        {:else if newbandwidth == 1800}1.8 kHz
                                        {:else if newbandwidth == 2400}2.4 kHz
                                        {:else if newbandwidth == 2700}2.7 kHz
                                        {:else if newbandwidth == 3000}3.0 kHz
                                        {:else if newbandwidth == 3500}3.5 kHz
                                        {:else if newbandwidth == 4000}4.0 kHz
                                        {:else if newbandwidth == 4500}4.5 kHz
                                        {:else if newbandwidth == 5000}5.0 kHz
                                        {:else if newbandwidth == 6000}6.0 kHz
                                        {:else if newbandwidth == 10000}10.0 kHz
                                        {:else if newbandwidth == 12000}12.0 kHz
                                        {:else}{/if}
                                  </button>
                                {/each}
                              </div>
                            </div>
                            <!-- Content Ends -->
                          </div>
                        </div>
                      {/if}
                      <!-- End IF Filters Popup Menu -->
                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>
                  <!-- End of Popup Buttons Menu -->

                  <!-- Begin Bandwidth Selection Area -->
                  <div class="w-full mt-4">
                    <h3 class="text-white text-base font-semibold mb-2">Bandwidth</h3>
                    <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {#each bandwithoffsets as bandwidthoffset (bandwidthoffset)}
                      <button id="bandwidth-offset-selector" class="retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {bandwidth === bandwidthoffset
                  ? 'bg-blue-600 pressed scale-95'
                  : 'bg-gray-700 hover:bg-gray-600'}"
                      on:click={(e) => handleBandwidthOffsetClick(bandwidthoffset)}
                        title="{bandwidthoffset} kHz"
                    >
                    {bandwidthoffset}
                    </button>
                    {/each}
                  </div>
                  <hr class="border-gray-600 my-2" />
                  </div>
                  <!-- End of Bandwidth Selection Area --> 



                  <!-- Wheel Tuning Steps -->
                  <div class="w-full mt-4">
                    <h3 class="text-white text-base font-semibold mb-2">
                      Wheel Tuning Steps
                    </h3>
                    <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {#each tuningsteps as tuningstep (tuningstep)}
                        <button
                          id="tuning-step-selector"
                          class="text-sm retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentTuneStep ==
                          tuningstep
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={() => handleTuningStep(tuningstep)}
                          title="{tuningstep} Hz"
                        >
                          {#if tuningstep == 10}10 Hz
                          {:else if tuningstep == 50}50 Hz
                          {:else if tuningstep == 100}100 Hz
                          {:else if tuningstep == 500}500 Hz
                          {:else if tuningstep == 1000}1 kHz
                          {:else if tuningstep == 5000}5 kHz
                          {:else if tuningstep == 9000}9 kHz
                          {:else if tuningstep == 10000}10 kHz
                          {:else}
                            {tuningstep}
                          {/if}
                        </button>
                      {/each}
                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>

                  <!-- End of Tuning Step Selection Area -->


                </div>
              </div>
           

                  <div><hr class="border-gray-600 my-2" /></div>

                  <!-- Audio Spectrogram and Decoder Options Side by Side -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <!-- Audio Spectrogram Section -->
                    <div>
                      <h3 class="text-left text-white text-base font-semibold mb-2">
                        Audio Spectrogram
                      </h3>
                      <div class="flex items-center gap-3 flex-wrap">
                      <button
                        class="retro-button px-4 py-2 text-white text-sm rounded-md border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {spectrogramEnabled
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                        on:click={toggleSpectrogram}
                      >
                        {spectrogramEnabled ? '📊 Hide' : '📊 Show'}
                      </button>
                    
                    {#if spectrogramEnabled}
                      <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-300">Gain:</label>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          bind:value={spectrogramGain}
                          on:input={() => { if (spectrogramComponent && spectrogramComponent.setDisplayGain) spectrogramComponent.setDisplayGain(spectrogramGain); }}
                          class="w-24"
                        />
                        <span class="text-xs text-gray-400">{spectrogramGain.toFixed(1)}×</span>
                      </div>
                      
                      <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-300">Color:</label>
                        <select
                          bind:value={spectrogramColorScheme}
                          class="glass-select px-2 py-1 text-sm text-white"
                        >
                          <option value="rainbow">Rainbow</option>
                          <option value="blue">Blue</option>
                          <option value="green">Green</option>
                          <option value="white">Grayscale</option>
                        </select>
                      </div>
                    {/if}
                  </div>
                </div>

                    <!-- Decoder Options Section -->
                    <div>
                      <h3 class="text-white text-base font-semibold mb-2">
                        Decoder Options
                      </h3>
                      <div class="flex items-center gap-2">
                        <!-- Off/On toggle — mirrors Gate button style -->
                        <button
                          class="text-sm px-3 py-1 rounded-md font-semibold transition-all duration-200 {decoderOn
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                          on:click={toggleDecoder}
                          title="Enable/disable decoder"
                        >
                          Decoder: <br>{decoderOn ? 'ON' : 'OFF'}
                        </button>

                        <!-- Decoder selector dropdown -->
                        <select
                          bind:value={selectedDecoder}
                          on:change={handleDecoderChange}
                          disabled={!decoderOn}
                          class="glass-select text-white text-sm px-2 py-1 rounded-md cursor-pointer focus:outline-none {!decoderOn ? 'opacity-50 cursor-not-allowed' : ''}"
                        >
                          <option value="none">— Select decoder —</option>
                          <option value="ft8">FT8</option>
                          <option value="ft4">FT4</option>
                          <option value="cw">CW</option>
                          <option value="wspr">WSPR</option>
                          <option value="hffax">HF FAX / WEFAX</option>
                          <option value="sstv">SSTV</option>
                          <option value="navtex">NAVTEX</option>
                          <option value="fsk">FSK / RTTY</option>
                          <option value="radel">RADE v1 — RADEL (LSB)</option>
                          <option value="radeu">RADE v1 — RADEU (USB)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  
                  
             <!-- FT8 / FT4 Messages List -->
              {#if decoderOn && (ft8Enabled || ft4Enabled)}
                <div class="w-full bg-gray-700 rounded-lg p-6 mt-6">
                  <div class="w-full flex justify-between items-center mb-5 text-xs">
                    <h4 class="text-white font-semibold">{ft4Enabled ? 'FT4' : 'FT8'} Messages</h4>
                    <span class="text-gray-300 pl-4 lg:pl-0" id="farthest-distance">Farthest: 0 km</span>
                  </div>
                  <div class="w-full text-gray-300 overflow-auto max-h-40 custom-scrollbar pr-2">
                    <div id="ft8MessagesList">
                      <!-- Dynamic content populated here -->
                    </div>
                    <div><hr class="border-gray-600 my-2" /></div>
                  </div>
                </div>
              {/if}

                  <!-- CW Decoder Window -->
                  {#if decoderOn && cwEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="w-full flex justify-between items-center mb-3 text-xs">
                        <h4 class="text-white font-semibold flex items-center gap-2">
                          <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                          CW Decoder
                          {#if cwDetectedHz > 0}
                            <span class="text-amber-400 font-mono font-normal">≈ {cwDetectedHz} Hz</span>
                            {#if cwDetectedWpm > 0}
                              <span class="text-gray-400 font-mono font-normal text-xs">· {cwDetectedWpm} WPM</span>
                            {/if}
                          {:else}
                            <span class="text-gray-500 font-normal italic">scanning…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={() => { cwMessages = []; cwCurrentLine = ''; }}
                        >Clear</button>
                      </div>
                      <div
                        bind:this={cwScrollEl}
                        class="w-full font-mono text-sm text-amber-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-64 custom-scrollbar text-left"
                        style="letter-spacing:0.05em; word-break:break-all;"
                      >
                        {#each cwMessages as line}
                          <div class="break-words whitespace-pre-wrap">{line}</div>
                        {/each}
                        {#if cwCurrentLine}
                          <div class="text-amber-200">{cwCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if cwMessages.length === 0}
                          <div class="text-gray-500 italic">Listening for CW signal…</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- WSPR Decoder Window -->
                  {#if decoderOn && wsprEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="w-full flex justify-between items-center mb-3 text-xs">
                        <h4 class="text-white font-semibold flex items-center gap-2">
                          <span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                          WSPR-2 Decoder
                        </h4>
                        <!-- WSPR slot progress bar -->
                        <div class="w-full mt-1 mb-2 h-2 rounded-full bg-gray-600 overflow-hidden" title="WSPR slot progress">
                          {#if wsprPhase === 'collecting'}
                            <div class="h-full rounded-full bg-cyan-400 transition-all duration-500"
                                 style="width:{(wsprSlotPos / 116 * 100).toFixed(1)}%"></div>
                          {:else if wsprPhase === 'decoding'}
                            <div class="h-full rounded-full bg-amber-400 animate-pulse" style="width:100%"></div>
                          {:else}
                            <div class="h-full rounded-full bg-gray-500" style="width:0%"></div>
                          {/if}
                        </div>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={() => {
                            wsprMessages = [];
                            const el = document.getElementById('wsprMessagesList');
                            if (el) el.innerHTML = '';
                          }}
                        >Clear</button>
                      </div>
                      <!-- Header row -->
                      <div class="w-full font-mono text-xs text-gray-400 flex justify-between px-1 mb-1 border-b border-gray-600 pb-1">
                        <span class="w-18">UTC  Callsign</span>
                        <span class="w-6 text-left">Grid</span>
                        <span class="w-10 text-left">Power</span>
                        <span class="w-20 text-left">Freq</span>
                        <span class="w-14 text-center">SNR</span>
                      </div>
                      <div class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1">
                        <div id="wsprMessagesList" class="flex flex-col gap-0.5">
                          <!-- Rows injected by audio.js stopWSPRCollection() -->
                        </div>
                        {#if wsprMessages.length === 0}
                          <div class="text-gray-500 italic text-xs font-mono mt-2">Waiting for next even UTC minute slot…</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- HF FAX / WEFAX Decoder Panel -->
                  {#if decoderOn && faxEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">

                      <!-- Header -->
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          HF FAX / WEFAX Receiver
                          {#if faxPhasing}
                            <span class="text-xs text-cyan-400 font-mono">[PHASING]</span>
                          {/if}
                          {#if faxStopTone}
                            <span class="text-xs text-red-400 font-mono">[STOP]</span>
                          {/if}
                        </h4>
                        <span class="text-xs text-gray-400 font-mono">Lines: {faxLineCount}</span>
                      </div>

                      <!-- Station preset bar -->
                      <div class="flex flex-wrap gap-2 items-end mb-3">
                        <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label class="text-gray-400 text-xs">Station</label>
                          <select
                            bind:value={faxSelectedStation}
                            on:change={() => { faxStationObj = FAX_STATIONS.find(s => s.name === faxSelectedStation) || null; faxSelectedFreqIdx = 0; _faxTickCountdown(); }}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                          >
                            <option value="">— Select station —</option>
                            {#each FAX_STATIONS as st}
                              <option value={st.name}>{st.name}</option>
                            {/each}
                          </select>
                        </div>

                        {#if faxStationObj && faxStationObj.freqs.length > 1}
                          <div class="flex flex-col gap-1">
                            <label class="text-gray-400 text-xs">Frequency</label>
                            <select
                              bind:value={faxSelectedFreqIdx}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                            >
                              {#each faxStationObj.freqs as f, i}
                                <option value={i}>{f} kHz</option>
                              {/each}
                            </select>
                          </div>
                        {/if}

                        <button
                          class="glass-button text-white text-xs font-bold px-3 py-1.5 rounded-md h-7 flex items-center gap-1"
                          on:click={faxApplyStation}
                          title="Tune to this station"
                        >▶ Tune</button>
                      </div>


                      <!-- FAX broadcast schedule countdown -->
                      {#if faxScheduleRows.length > 0}
                        <div class="mb-3 rounded-md bg-gray-900 border border-gray-600 overflow-hidden text-xs">
                          <div class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800">
                            <svg class="w-3 h-3 text-green-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class="text-green-400 font-semibold tracking-wide uppercase">Next Transmissions · UTC</span>
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each faxScheduleRows as row, i}
                              <div class="flex items-center gap-2 px-2.5 py-1.5 {i === 0 ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'} transition-colors">
                                <span class="font-mono text-gray-300 shrink-0 w-10">{row.utc}</span>
                                <span class="text-gray-400 flex-1 truncate">{row.label}</span>
                                <span class="font-mono tabular-nums shrink-0
                                  {row.imminent ? 'text-red-400 font-bold'
                                   : row.urgent  ? 'text-amber-400 font-semibold'
                                   : i === 0      ? 'text-green-300'
                                                  : 'text-gray-500'}"
                                >{row.countdown}</span>
                                {#if row.imminent}
                                  <span class="text-red-400 animate-pulse shrink-0">●</span>
                                {:else if row.urgent}
                                  <span class="text-amber-400 animate-pulse shrink-0" title="Transmission starts soon">⚡</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Parameter bar -->
                      <div class="flex flex-wrap gap-3 items-end mb-3">

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">LPM</label>
                          <select bind:value={faxLPM} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={60}>60</option>
                            <option value={90}>90</option>
                            <option value={100}>100</option>
                            <option value={120}>120 ★</option>
                            <option value={240}>240</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">IOC</label>
                          <select bind:value={faxIOC} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={288}>288</option>
                            <option value={576}>576 ★</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">Shift</label>
                          <select bind:value={faxShift} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={400}>400 Hz</option>
                            <option value={800}>800 Hz ★</option>
                          </select>
                        </div>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxAutoAlign
                                   ? 'bg-cyan-700 border-cyan-500 text-cyan-200'
                                   : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleAutoAlign}
                          title="Automatic sync-pulse line alignment"
                        >⇔ Auto-align</button>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxInvert
                                   ? 'bg-amber-700 border-amber-500 text-amber-200'
                                   : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleInvert}
                          title="Swap black and white (use for LSB receive or inverted polarity)"
                        >⇅ Invert</button>

                      </div>

                      <!-- Signal status bar -->
                      <div class="flex items-center gap-3 mb-3 text-xs font-mono">
                        <span class="text-gray-400">Black: <span class="text-gray-200">{faxInvert ? (1500 + faxShift) : 1500} Hz</span></span>
                        <span class="text-gray-400">White: <span class="text-gray-200">{faxInvert ? 1500 : (1500 + faxShift)} Hz</span></span>
                        <span class="text-gray-400">{Math.round(Math.PI * faxIOC)} px/line</span>
                        <span class="text-gray-400">{(60 / faxLPM * 1000).toFixed(0)} ms/line</span>
                      </div>

                      <!-- FAX canvas (scrolling image) -->
                      <div class="w-full overflow-x-auto rounded border border-gray-600 bg-black">
                        <canvas
                          bind:this={faxCanvas}
                          width={FAX_CANVAS_W}
                          height={FAX_CANVAS_H}
                          class="block fax-flip"
                          style="image-rendering: pixelated; width: 100%; max-width: {FAX_CANVAS_W}px;"
                          title="HF FAX image — rotated 180°, newest lines build from bottom to top"
                        ></canvas>
                      </div>

                      <!-- Tone indicators + action buttons -->
                      <div class="flex items-center gap-2 mt-2 flex-wrap">
                        <div class="flex items-center gap-1 text-xs {faxPhasing ? 'text-cyan-300' : 'text-gray-600'}">
                          <span class="inline-block w-2 h-2 rounded-full {faxPhasing ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}"></span>
                          300 Hz phasing
                        </div>
                        <div class="flex items-center gap-1 text-xs {faxStopTone ? 'text-red-300' : 'text-gray-600'}">
                          <span class="inline-block w-2 h-2 rounded-full {faxStopTone ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}"></span>
                          450 Hz stop
                        </div>
                        <div class="flex-1"></div>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={faxRefresh}
                          title="Clear canvas and reset decoder — use between transmissions"
                        >↺ Reset</button>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={faxSaveImage}
                          title="Save current image as PNG"
                        >⤓ Save PNG</button>
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode must be <strong class="text-gray-300">USB</strong> ·
                        Standard: 1500 Hz black · 2300 Hz white · 120 LPM · IOC 576 ·
                        Image scrolls upward — newest lines at bottom ·
                        Use <em>↺ Refresh</em> between transmissions or when image tears - <a href="https://www.weather.gov/media/marine/rfax.pdf" target="_blank" rel="noopener noreferrer" style="color: cyan;">FAX transmission schedules</a>
                      </p>
                    </div>
                  {/if}
                  <!-- END HF FAX Panel -->



                  {#if decoderOn && sstvEnabled}
                    <div class="mt-3 rounded-xl border border-cyan-500/25 bg-black/35 p-3 shadow-inner">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-cyan-300">SSTV</span>
                          {#if sstvDetectedMode}
                            <span class="text-xs text-emerald-300 font-mono">[{sstvDetectedMode}]</span>
                          {/if}
                          <span class="text-xs {sstvSoftSync ? 'text-yellow-300' : 'text-gray-400'}">{sstvSoftSync ? 'soft sync hold' : 'hard sync lock'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <button class="decoder-btn-secondary" on:click={_sstvStart} disabled={sstvRunning}>▶ Start</button>
                          <button class="decoder-btn-secondary" on:click={_sstvStop} disabled={!sstvRunning}>■ Stop</button>
                          <button class="decoder-btn-secondary" on:click={sstvRefresh} disabled={!sstvRunning}>↺ Reset</button>
                          <button class="decoder-btn-secondary" on:click={sstvSaveImage}>💾 Save Image</button>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-3 mb-2 text-xs text-gray-300">
                        <label class="flex items-center gap-2">
                          <span>Mode</span>
                          <select bind:value={sstvModeChoice} on:change={sstvModeChanged} class="glass-select text-white text-xs px-2 py-1 rounded-md">
                            <option value="auto">Auto</option>
                            <option value="martin1">Martin M1</option>
                            <option value="martin2">Martin M2</option>
                            <option value="scottie1">Scottie S1</option>
                            <option value="scottie2">Scottie S2</option>
                          </select>
                        </label>
                        <span class="text-gray-400">Desktop + mobile · raw PCM before AGC/NR/mute</span>
                        <span class="{sstvRunning ? 'text-emerald-300' : 'text-red-300'}">{sstvRunning ? 'Running' : 'Stopped'}</span>
                        <span class="text-gray-400">Lines: <span class="text-gray-200">{sstvLineCount}</span>/256</span>
                      </div>
                      <div class="mb-2 text-xs font-mono {sstvStatusText?.includes('lock') ? 'text-cyan-300' : 'text-gray-400'}">{sstvStatusText}</div>
                      <div class="rounded-lg overflow-hidden border border-gray-700 bg-black inline-block w-full max-w-[340px] sm:max-w-full">
                        <canvas bind:this={sstvCanvas} width={SSTV_CANVAS_W} height={SSTV_CANVAS_H} class="block w-full h-auto"></canvas>
                      </div>
                    </div>
                  {/if}

                  <!-- ── NAVTEX / SITOR-B Decoder Panel ───────────────────── -->
                  {#if decoderOn && navtexEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">

                      <!-- Header -->
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                          NAVTEX Receiver
                          {#if navtexStatusText}
                            <span class="text-xs text-teal-300 font-mono font-normal">[{navtexStatusText}]</span>
                          {:else}
                            <span class="text-xs text-gray-500 font-normal italic">waiting for phasing…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={navtexClear}
                        >Clear</button>
                      </div>

                      <!-- Station selector + Tune button -->
                      <div class="flex flex-wrap items-center gap-2 mb-3">
                        <select
                          bind:value={navtexSelectedStation}
                          class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0"
                          on:change={_navtexTickCountdown}
                        >
                          {#each NAVTEX_STATIONS as st}
                            <option value={st.name}>{st.name}</option>
                          {/each}
                        </select>
                        <button
                          class="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={navtexApplyStation}
                        >⇒ Tune &amp; Set IF</button>
                      </div>


                      <!-- Broadcast schedule countdown -->
                      {#if navtexScheduleRows.length > 0}
                        <div class="mb-3 rounded-md bg-gray-900 border border-gray-600 overflow-hidden text-xs">
                          <div class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800">
                            <svg class="w-3 h-3 text-teal-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class="text-teal-400 font-semibold tracking-wide uppercase">Next Broadcasts · UTC</span>
                          </div>
                          <div class="overflow-y-auto max-h-40 custom-scrollbar divide-y divide-gray-800">
                            {#each navtexScheduleRows as row, i}
                              <div class="flex items-center gap-2 px-2.5 py-1 {i === 0 ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'} transition-colors">
                                <span class="shrink-0 text-sm leading-none">{row.flag}</span>
                                <span class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0
                                  {row.imminent ? 'bg-red-500 text-white animate-pulse'
                                   : row.urgent  ? 'bg-amber-500 text-gray-900'
                                   : i === 0      ? 'bg-teal-600 text-white'
                                                  : 'bg-gray-600 text-gray-300'}"
                                >{row.id}</span>
                                <span class="text-gray-200 flex-1 truncate">{row.name}</span>
                                <span class="text-gray-500 shrink-0 hidden sm:inline">{row.area}</span>
                                <span class="text-gray-400 font-mono shrink-0">{row.nextUTC}</span>
                                <span class="font-mono tabular-nums w-20 text-right shrink-0
                                  {row.imminent ? 'text-red-400 font-bold'
                                   : row.urgent  ? 'text-amber-400 font-semibold'
                                   : i === 0      ? 'text-teal-300'
                                                  : 'text-gray-500'}"
                                >{row.label}</span>
                                {#if row.imminent}
                                  <span class="text-red-400 animate-pulse shrink-0 font-semibold">●</span>
                                {:else if row.urgent}
                                  <span class="text-amber-400 animate-pulse shrink-0" title="Arm decoder now">⚡</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Text output -->
                      <div
                        bind:this={navtexScrollEl}
                        class="w-full font-mono text-sm text-teal-200 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left"
                        style="letter-spacing:0.04em; word-break:break-all; line-height:1.5; text-align:left;"
                      >
                        {#each navtexMessages as line}
                          <div class="{line.startsWith('━━') ? 'text-teal-400 font-semibold my-1' : ''}">{line}</div>
                        {/each}
                        {#if navtexCurrentLine}
                          <div class="text-teal-100">{navtexCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if navtexMessages.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            Listening for NAVTEX signal…<br>
                            Set mode to <strong class="text-gray-300">USB</strong> and use <em>⇒ Tune &amp; Set IF</em> to auto-tune.
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode: <strong class="text-gray-300">USB</strong> ·
                        100 Baud FSK · 170 Hz shift · SITOR-B FEC ·
                        Dial set 500 Hz below channel (signal centre at 500 Hz audio) ·
                        <a href="https://yachtlycrew.com/tools/navtex-stations" target="_blank" rel="noopener noreferrer" style="color:cyan;">NAVTEX Maps Stations</a>
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveNavtexText}
                        >Save Text</button>
                      </div>
                    </div>
                  {/if}
                  <!-- END NAVTEX Panel -->

                  <!-- ── RADE v1 Digital Voice Panel ──────────────────────── -->
                  {#if decoderOn && radeEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full {radeConnected ? (radeSynced ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse') : 'bg-red-500'}"></span>
                          RADE v1 &nbsp;·&nbsp; {demodulation === 'RADEL' ? 'RADEL (LSB)' : 'RADEU (USB)'}
                          <span class="text-xs font-mono font-normal {radeConnected ? (radeSynced ? 'text-green-300' : 'text-yellow-300') : 'text-red-400'}">
                            {#if !radeConnected}
                              Connecting to sidecar…
                            {:else if radeSynced}
                              Synced{radeSnr !== null ? ' · SNR ' + radeSnr.toFixed(1) + ' dB' : ''}
                            {:else}
                              Searching for signal…
                            {/if}
                          </span>
                        </h4>
                      </div>

                      <!-- Status row -->
                      <div class="flex items-center gap-3 mb-3 text-xs">
                        <span class="px-2 py-0.5 rounded font-semibold {radeConnected ? 'bg-green-800 text-green-200' : 'bg-gray-800 text-gray-400'}">
                          {radeConnected ? 'Sidecar OK' : 'No Sidecar'}
                        </span>
                        <span class="px-2 py-0.5 rounded font-semibold {radeSynced ? 'bg-blue-800 text-blue-200' : 'bg-gray-800 text-gray-500'}">
                          {radeSynced ? 'Frame Sync' : 'Acquiring…'}
                        </span>
                        <span class="text-gray-500 font-mono">1500 Hz BW · FARGAN vocoder</span>
                      </div>

                      <!-- Error banner -->
                      {#if !radeConnected}
                        <div class="rounded bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300 mb-3">
                          <strong>⚠ Sidecar not reachable.</strong> Start it on the server:<br>
                          <code class="text-red-200 font-mono">python3 rade_helper.py</code>
                          &nbsp;(listens on port 8074)
                        </div>
                      {/if}

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-2 leading-relaxed">
                        FreeDV RADE v1 · decoded server-side by
                        <code class="text-gray-400">rade_helper.py</code> →
                        <code class="text-gray-400">radae_rxe.py</code> →
                        <code class="text-gray-400">lpcnet_demo</code><br>
                        {demodulation === 'RADEL' ? 'LSB — use on 40 m / 80 m / 160 m.' : 'USB — use on 20 m / 17 m / 15 m / 10 m.'}
                        See <a href="https://freedv.org/radio-autoencoder/" target="_blank" rel="noopener noreferrer" style="color:cyan;">freedv.org/radio-autoencoder</a>.
                         - 
                         <a href="https://qso.freedv.org//" target="_blank" rel="noopener noreferrer" style="color:cyan;">FreeDV Reporter</a>.
                      </p>
                    </div>
                  {/if}
                  <!-- END RADE Panel -->


                  <!-- ── FSK / RTTY Decoder Panel ─────────────────────────── -->
                  {#if decoderOn && fskEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          FSK / RTTY Decoder
                          {#if fskStatusText}
                            <span class="text-xs text-green-300 font-mono font-normal">[{fskStatusText}]</span>
                          {:else}
                            <span class="text-xs text-gray-500 font-normal italic">waiting for lock…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={fskClear}
                        >Clear</button>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Variant</label>
                          <select bind:value={fskVariant} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={fskVariantChanged}>
                            <option value="maritime">Maritime FSK / SITOR</option>
                            <option value="weather">Weather RTTY</option>
                            <option value="ham">Amateur RTTY</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Known frequency</label>
                          <div class="flex gap-2">
                            <select bind:value={fskKnownFrequency} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full">
                              <option value="">— Select frequency —</option>
                              {#each (FSK_KNOWN_FREQUENCIES[fskVariant] || []) as item}
                                <option value={String(item.khz)}>{item.label}</option>
                              {/each}
                            </select>
                            <button class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap" on:click={fskApplyKnownFrequency}>Tune</button>
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Center audio (Hz)</label>
                          <input type="number" bind:value={fskCenter} class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(true)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Shift (Hz)</label>
                          <input type="number" bind:value={fskShift} class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(true)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Baud</label>
                          <input type="number" bind:value={fskBaud} step="0.01" class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(false)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Framing</label>
                          <select bind:value={fskFraming} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={() => fskApplySettings(false)}>
                            <option value="5N1">5N1</option>
                            <option value="5N1.5">5N1.5</option>
                            <option value="5N2">5N2</option>
                            <option value="7N1">7N1</option>
                            <option value="7E1">7E1</option>
                            <option value="7O1">7O1</option>
                            <option value="8N1">8N1</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Encoding</label>
                          <select bind:value={fskEncoding} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={() => fskApplySettings(false)}>
                            <option value="ccir476">CCIR-476</option>
                            <option value="ita2">ITA2 / Baudot</option>
                            <option value="ascii">ASCII</option>
                          </select>
                        </div>
                        <label class="flex items-center gap-2 text-xs text-gray-300 mt-5">
                          <input type="checkbox" bind:checked={fskInvert} on:change={() => fskApplySettings(false)} />
                          Invert mark / space
                        </label>
                        <label class="flex items-center gap-2 text-xs text-gray-300 mt-5">
                          <input type="checkbox" bind:checked={fskAutoShift} on:change={() => fskApplySettings(false)} />
                          Auto shift detect
                        </label>
                      </div>

                      <div class="flex flex-wrap items-center gap-2 mb-3 text-xs">
                        <button class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap" on:click={fskApplyBandpass}>⇒ Set IF Band-Pass</button>
                        <button class="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors whitespace-nowrap" on:click={() => { audio.setFSKAutoCenter(true); fskStatusText = 'Auto-tune scanning…'; }}>⟳ Auto-tune Center</button>
                        <span class="text-gray-300">Mark: <span class="text-green-300 font-mono">{Math.round(fskMetrics.markHz || 0)} Hz</span></span>
                        <span class="text-gray-300">Space: <span class="text-green-300 font-mono">{Math.round(fskMetrics.spaceHz || 0)} Hz</span></span>
                        <span class="text-gray-300">SNR: <span class="text-green-300 font-mono">{Number(fskMetrics.snrDb || 0).toFixed(1)} dB</span></span>
                        <span class="text-gray-300">Lock: <span class="text-green-300 font-mono">{fskMetrics.lockQuality || 0}%</span></span>
                        <span class="text-gray-300">Timing: <span class="{fskMetrics.timingLocked ? 'text-green-300' : 'text-gray-500'} font-mono">{fskMetrics.timingLocked ? 'LOCKED' : 'SEARCH'}</span></span>
                      </div>

                      <div
                        bind:this={fskScrollEl}
                        class="w-full font-mono text-sm text-green-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left"
                        style="letter-spacing:0.04em; word-break:break-word; overflow-wrap:anywhere; white-space:pre-wrap; line-height:1.5; text-align:left;"
                      >
                        {#each fskTextLines as line}
                          <div class="break-words whitespace-pre-wrap">{line}</div>
                        {/each}
                        {#if fskCurrentLine}
                          <div class="break-words whitespace-pre-wrap">{fskCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if fskTextLines.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            FSK / RTTY decoder has taken control of mode and IF while active.<br>
                            Use the known frequency list, then fine-tune until the text becomes stable.
                          </div>
                        {/if}
                        <div style="height:1.5em;" aria-hidden="true"></div>
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        <strong class="text-gray-300">Mode: USB. Please check "Invert mark / space" for RTTY (weather), 
                        <br> but leave it unchecked for maritime FSK and HAM RTTY</strong>.
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveFskText}
                        >Save Text</button>
                      </div>
                    </div>
                  {/if}
                  <!-- END FSK Panel -->


                </div>

            <!-- Third Column -->

            <!-- WF Begins -->
                <div
                  class="flex flex-col items-center bg-gray-800 p-6 lg:border lg:border-gray-700 rounded-none rounded-b-lg lg:rounded-none lg:rounded-r-lg"
                >
                  <div class="mb-4 flex items-center gap-3">
                    <h3 class="text-white text-base font-semibold">
                      Waterfall Controls
                    </h3>
                    <button
                      class="glass-button flex items-center gap-2 px-3 py-1 text-sm"
                      on:click={toggleWaterfallDirection}
                      title="Toggle waterfall direction (W)"
                    >
                      <span
                        class={`inline-block text-[1.45rem] leading-none transition-transform duration-300 ${waterfallReverse ? 'text-green-400' : 'text-cyan-400'}`}
                        style:transform={waterfallReverse ? "rotate(180deg)" : "rotate(0deg)"}
                      >⬆</span>
                      <span class={waterfallReverse ? "text-green-400" : "text-cyan-400"}>
                        {waterfallReverse ? "Reverse" : "Default"}
                      </span>
                    </button>
                  </div>

                  <div class="w-full mb-8 space-y-4">
                    <div
                      id="brightness-controls"
                      class="flex items-center justify-between mb-2"
                    >
                      <span class="text-gray-300 text-sm w-10">Min:</span>
                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={min_waterfall}
                          min="-100"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMinMove}
                          title="Brightness slider"
                         
                        />
                      </div>
                      <span class="text-gray-300 text-sm w-10 text-right"
                        >{min_waterfall}</span
                      >
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm w-10">Max:</span>
                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={max_waterfall}
                          min="0"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMaxMove}
                          title="Contrast slider"
                        />
                      </div>
                      <span class="text-gray-300 text-sm w-10 text-right"
                        >{max_waterfall}</span
                      >
                    </div>

                    <!-- Zoom Slider when Desktop -->
                    <div
                      class="flex items-center justify-between"
                      id="zoom-slider"
                    >
                      <button
                        class="glass-button text-white font-bold rounded-full w-6 h-6 flex items-center justify-center mr-4"
                        style="background: {zoomStepEnabled
                          ? 'rgba(0, 180, 255, 0.3)'
                          : 'rgba(255, 255, 255, 0.05)'}"
                        on:click={(e) => handleZoomStepMove(e, (zoomStep += 1))}
                        title="Enables manual zoom in steps"
                      >
                        <span class="text-white text-xs font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"
                            />
                            <path d="M21 21l-6 -6" />
                            <path d="M8 8l-2 2l2 2" />
                            <path d="M12 8l2 2l-2 2" />
                          </svg>
                        </span>
                      </button>

                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={zoomStep}
                          min="1"
                          max="8"
                          step="1"
                          class="glass-slider w-full"
                          on:input={(e) => handleZoomStepMove(e, zoomStep)}
                          title="Zoom slider"
                        />
                      </div>

                      <span class="text-gray-300 text-sm w-10 text-right"
                        >×{zoomStep}</span
                      >
                      <hr class="border-gray-600 my-2" />
                    </div>
                  </div>
                  <!-- End of Zoom Slider when Desktop -->

              <div class="w-full mb-6">
                <span><br></span>                
                <div id="colormap-select" class="relative">
                  <select
                    bind:value={currentColormap}
                    on:change={handleWaterfallColormapSelect}
                    class="glass-select block w-full pl-3 pr-10 py-2 text-sm rounded-lg text-gray-200 appearance-none focus:outline-none"
                  >
                    {#each availableColormaps as colormap}
                      <option value={colormap}>{colormap}</option>
                    {/each}
                  </select>
                  <div
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                  >
                    <svg
                      class="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      />
                    </svg>
                  </div>
                </div>
              </div>


              <div class="w-full mb-6">
                <h3 class="text-white text-base font-semibold mb-2">Zoom</h3>
                <div id="zoom-controls" class="grid grid-cols-4 gap-2">
                      {#each [{ action: "+", title: "Zoom in", icon: "zoom-in", text: "In" }, { action: "-", title: "Zoom out", icon: "zoom-out", text: "Out" }, { action: "max", title: "Zoom to max", icon: "maximize", text: "Max" }, { action: "min", title: "Zoom to min", icon: "minimize", text: "Min" }] as { action, title, icon, text }}
                    <button
                      class="retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                      on:click={(e) => handleWaterfallMagnify(e, action)}
                      {title}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 mr-2"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        {#if icon === "zoom-in"}
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="11" y1="8" x2="11" y2="14" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        {:else if icon === "zoom-out"}
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        {:else if icon === "maximize"}
                          <path
                            d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                          />
                        {:else if icon === "minimize"}
                          <path
                            d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                          />
                        {/if}
                      </svg>
                      <span>{text}</span>
                    </button>
                  {/each}
                </div>
                <hr class="border-gray-600 my-2" />
              </div>
              <div class="w-full mb-6">


                  <!-- START of waterfal control buttons when Desktop -->
                  <div class="w-full mb-6">
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div
                        id="waterfall-toggle"
                        class="flex flex-col items-center"
                      >
                        <span class="text-sm text-gray-300 mb-1 text-center"
                          >Waterfall</span
                        >
                        <label class="toggle-switch">
                          {#if waterfallDisplay}
                            <input
                              type="checkbox"
                              checked
                              on:change={handleWaterfallChange}
                            />
                          {:else}
                            <input
                              type="checkbox"
                              on:change={handleWaterfallChange}
                            />
                          {/if}
                          <span class="toggle-slider"></span>
                        </label>
                      </div>

                      <div
                        id="spectrum-toggle"
                        class="flex flex-col items-center"
                      >
                        <span class="text-sm text-gray-300 mb-1">Spectrum</span>
                        <label class="toggle-switch">
                          {#if spectrumDisplay}
                            <input
                              type="checkbox"
                              checked
                              on:change={handleSpectrumChange}
                            />
                          {:else}
                            <input
                              type="checkbox"
                              on:change={handleSpectrumChange}
                            />
                          {/if}
                          <span class="toggle-slider"></span>
                        </label>
                      </div>

                      <div id="auto-adjust" class="flex flex-col items-center">
                        <span class="text-sm text-gray-300 mb-1"
                          >Auto Adj.</span
                        >
                        <label class="toggle-switch">
                          <input
                            type="checkbox"
                            on:change={() => handleAutoAdjust()}
                          />
                          <span class="toggle-slider"></span>
                        </label>
                      </div>

                      <div
                        id="bigger-waterfall"
                        class="flex flex-col items-center"
                      >
                        <span class="text-sm text-gray-300 mb-1 text-center"
                          >Height (+)</span
                        >
                        <label class="toggle-switch">
                          <input
                            type="checkbox"
                            on:change={handleWaterfallSizeChange}
                          />
                          <span class="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                   <!-- <hr class="border-gray-600 my-2" /> -->
                  </div>
              </div>
            <!-- END of Waterfall Control Buttons when Desktop -->

              


<!-- Begin Bookmark Button Area -->
              <button
                id="bookmark-button"
                class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                on:click={toggleBookmarkPopup}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                Bookmarks
              </button>

              <div
                id="user_count_container"
                class="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-1"
              >
                <div
                  id="total_user_count"
                  class="bg-gray-800 rounded-md p-2 text-center flex justify-between items-center"
                >
                  <!-- Content will be populated by JavaScript -->
                </div>
              </div>

                <!-- Recording Options -->
             <div class="mt-6 w-full">
              <h3 class="text-white text-base font-semibold mb-2">Recording Options</h3>
              <div class="flex justify-center gap-4">
                <button class="bg-gray-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors {isRecording ? 'ring-2 ring-red-500' : ''}" on:click={toggleRecording}>
                  {#if isRecording}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" />
                    </svg>
                    Stop
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                    Record
		  {/if}
                </button>

                {#if canDownload}
                  <button class="bg-gray-700 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors" on:click={downloadRecording}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    Download
                  </button>
                {/if}
               </div>
              </div> 
            </div>
            <!-- Audio Ends -->

              <!-- Bookmark Popup -->
              {#if showBookmarkPopup}
                <div
                  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                  on:click={toggleBookmarkPopup}
                >
                  <div
                    class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                    on:click|stopPropagation
                  >
                    <div class="flex justify-between items-center mb-4">
                      <h2 class="text-xl font-bold text-white">Bookmarks</h2>
                      <button
                        class="text-gray-400 hover:text-white"
                        on:click={toggleBookmarkPopup}
                      >
                        <svg
                          class="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    </div>

                      <!-- Add Bookmark Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Add New Bookmark</label
                        >
                        <div class="flex items-center gap-2 w-full">
                          <input id="textInput"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-1 min-w-0"
                            bind:value={newBookmarkName}
                            placeholder="Bookmark name"
                          />
                          <input
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-1 min-w-0"
                            bind:value={newBookmarkLabel}
                            placeholder="Label"
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center whitespace-nowrap flex-shrink-0"
                            on:click={addBookmark}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>

                    <!-- Current Link Section -->
                    <div class="mb-6">
                      <label
                        class="block text-sm font-medium text-gray-300 mb-2"
                        >Current Link</label
                      >
                      <div class="flex items-center gap-2">
                        <input
                          type="text"
                          class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-grow"
                          value={link}
                          readonly
                        />
                        <button
                          class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                          on:click={handleLinkCopyClick}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                            />
                            <path
                              d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                            />
                          </svg>
                          Copy
                        </button>
                      </div>
                    </div>

                      <!-- amkbookmarks -->

                      <!-- upload bookmark section -->

                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Upload - Download Bookmarks. If you don't see them,
                          please refresh the webpage (or press F5)!
                        </label>
                        <div class="flex items-center gap-2">
                          <!-- Click button το file input -->

                          <!-- Descret input type file  -->
                          <input
                            type="file"
                            accept=".json, .csv, application/json"
                            style="display: none;"
                            on:change={uploadBookmarks}
                            bind:this={fileInput}
                          />

                          <!-- Button for activating file input  -->
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={() => fileInput.click()}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Upload Bookmarks
                          </button>

                          <!-- End of upload bookmark section -->

                          <!-- download bookmark Section -->

                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={downloadBookmarks}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Download Bookmarks
                          </button>
                        </div>
                      </div>

                      <!-- End off Download bookmark Section -->

                      <!-- end of amkbookmarks -->

                      <!-- Bookmarks List -->
                      <div class="overflow-y-auto flex-grow h-80">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Saved Bookmarks</label
                        >
                        {#each $bookmarks as bookmark, index}
                          <div
                            class="glass-panel rounded-lg p-3 flex items-center justify-between mb-2"
                          >
                            <div class="flex flex-col">
                              <span class="text-white text-sm"
                                >{bookmark.name}</span
                              >
                              {#if bookmark.label}
                                <span class="text-yellow-300 text-xs"
                                  >{bookmark.label}</span
                                >
                              {/if}
                              <span class="text-gray-400 text-xs"
                                >{(bookmark.frequency / 1000).toFixed(3)} kHz</span
                              >
                            </div>
                            <div class="flex gap-2">
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => goToBookmark(bookmark)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Go
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => copy(bookmark.link)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                  />
                                  <path
                                    d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                  />
                                </svg>
                                Copy
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => deleteBookmark(index)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            {#if siteChatEnabled}
              <!--Beginn of Chatbox -->
              <!--To disable Chatbox: Delte Code from here to .. -->

              <div
                class="flex flex-col rounded p-2 justify-center"
                id="chat-column"
              >
                <div
                  class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-8"
                  id="chat-box"
                >
                  <h2
                    class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                  >
                    Chat
                  </h2>

                  <!-- Username Display/Input -->
                  <div class="mb-2 sm:mb-4 flex flex-wrap items-center">
                    <span
                      class="text-white text-xs sm:text-sm mr-2 mb-2 sm:mb-0"
                      >Chatting as:</span
                    >
                    {#if showUsernameInput}
                      <input
                        class="glass-input text-white py-1 px-2 rounded-lg outline-none text-xs sm:text-sm flex-grow mr-2 mb-2 sm:mb-0"
                        bind:value={username}
                        placeholder="Enter your name/callsign"
                        on:keydown={(e) => e.key === "Enter" && saveUsername()}
                      />
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={saveUsername}
                      >
                        Save
                      </button>
                    {:else}
                      <span
                        class="glass-username text-white text-xs sm:text-sm px-3 py-1 rounded-lg mr-2 mb-2 sm:mb-0"
                      >
                        {username || myDisplayId || "Anonymous"}
                      </span>
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={editUsername}
                      >
                        Edit
                      </button>
                    {/if}
                  </div>

                  <!-- Chat Messages -->
                  <div
                    class="bg-gray-900 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 h-48 sm:h-64 overflow-y-auto custom-scrollbar"
                    bind:this={chatMessages}
                  >
                    {#each $messages as { id, text } (id)}
                      {@const formattedMessage = formatFrequencyMessage(text)}
                      <div
                        class="mb-2 sm:mb-3 text-left"
                        in:fly={{ y: 20, duration: 300, easing: quintOut }}
                      >
                        <div
                          class="inline-block bg-gray-800 rounded-lg p-2 max-w-full"
                        >
                          <p class="text-white text-xs sm:text-sm break-words">
                            <span class="font-semibold text-blue-300"
                              >{formattedMessage.username}</span
                            >
                            <span class="text-xs text-gray-400 ml-2"
                              >{formattedMessage.timestamp}</span
                            >
                          </p>
                          <p
                            class="text-white text-xs sm:text-sm break-words mt-1"
                          >
                            {#if formattedMessage.isFormatted}
                              {@html renderParts(formattedMessage.beforeFreq)}
                              <a
                                href="#"
                                class="text-blue-300 hover:underline"
                                on:click|preventDefault={() =>
                                  handleFrequencyClick(
                                    formattedMessage.frequency,
                                    formattedMessage.demodulation,
                                  )}
                              >
                                {(formattedMessage.frequency / 1000).toFixed(3)}
                                kHz ({formattedMessage.demodulation})
                              </a>
                              {@html renderParts(formattedMessage.afterFreq)}
                            {:else}
                              {@html renderParts(formattedMessage.parts)}
                            {/if}
                          </p>
                        </div>
                      </div>
                    {/each}
                  </div>

                  <!-- Message Input and Buttons -->
                  <div
                    class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"
                  >
                    <input id="textInput"
                      class="glass-input text-white py-2 px-3 rounded-lg outline-none text-xs sm:text-sm flex-grow"
                      bind:value={newMessage}
                      on:keydown={handleEnterKey}
                      placeholder="Type a message..."
                    />
                    <div class="flex space-x-2">
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={sendMessage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
                          />
                        </svg>
                        Send
                      </button>
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={pasteFrequency}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                          />
                          <path
                            d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                          />
                        </svg>
                        Paste Freq
                      </button>
                    </div>
                  </div>
                  <hr class="border-gray-600 my-2" />
                  <span class="text-xs text-gray-400"
                    >PhantomSDR+ | v{VERSION}</span
                  >
                </div>
              </div>
            {:else}{/if}
            <!--To disable Chatbox: Delte Code till above this here -->
          </div>
        </div>
        <footer class="mt-4 mb-4 text-center text-gray-400 text-sm">
          <!-- <span class="text-sm text-gray-400">PhantomSDR+ | v{VERSION}</span> -->
        </footer>
      </div>
    {:else}
      <!-- secondsvelte Mobile Version -->

      <div
        class="w-full sm:h-screen overflow-y-scroll sm:w-1/2 xl:w-1/3 lg:w-1/4 sm:transition-all sm:ease-linear sm:duration-100"
        style="width:100%;"
      >
        <div
          class="min-h-screen bg-custom-dark text-gray-200"
          style="padding-top: 5px;"
        >
          <div class="max-w-screen-lg mx-auto">
            <div class="xl:pt-1"></div>

            <!--Titel Box with Admin Infos, to be personalized-->
            <div
              class="flex flex-col rounded p-2 justify-center"
              id="chat-column"
            >
              <div
                class="p-3 sm:p-5 flex flex-col bg-gray-800 rounded-lg w-full mb-8"
                id="chat-box"
                style="opacity: 0.85;"
              >
                <!-- Header -->
                <div
                  class="text-xs sm:text-sm font-semibold text-gray-100 mb-2 sm:mb-4"
                >
                  <a
                    href="https://www.qrz.com/db/{siteSysop}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">{siteSysop}</a
                  >
                  PhantomSDR+ in
                  <a
                    href="http://k7fry.com/grid/?qth={siteGridSquare}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)"
                    >{siteCity}, {siteGridSquare}</a
                  >
                  <br />
                  Other &nbsp;
                  <a
                    href="https://sdr-list.xyz"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">Servers</a
                  >
                </div>
              </div>
              <!--End of Titel Box -->

              <!--Beginn of Waterfall -->
              <div class="flex justify-center w-full">
                <div class="w-full" id="outer-waterfall-container">
                  <div
                    style="image-rendering:pixelated;"
                    class="w-full xl:rounded-lg peer overflow-hidden"
                    id="waterfall"
                  >
                    <canvas
                      class="w-full bg-black peer {spectrumDisplay
                        ? 'max-h-40'
                        : 'max-h-0'}"
                      bind:this={spectrumCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      width="1024"
                      height="128"
                    ></canvas>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={topGraduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <canvas
                      class="w-full bg-black {waterfallDisplay
                        ? 'block'
                        : 'hidden'}"
                      bind:this={waterfallCanvas}
                      style:transform={waterfallReverse ? "scaleY(-1)" : "scaleY(1)"}
                      style:transform-origin={"center center"}
                      use:pinch
                      on:pinchstart={handleWaterfallPinchStart}
                      on:pinchmove={handleWaterfallPinchMove}
                      use:pan
                      on:panmove={handleWaterfallPanMove}
                      on:wheel={handleWaterfallWheel}
                      on:mousedown={handleWaterfallMouseDown}
                      width="1024"
                    ></canvas>
                    <canvas
                      class="hidden"
                      bind:this={tempCanvas}
                      width="1024"
                      height="1024"
                    ></canvas>
                    <FrequencyInput
                      bind:this={frequencyInputComponent}
                      on:change={handleFrequencyChange}
                    ></FrequencyInput>

                    <FrequencyMarkers
                      bind:this={frequencyMarkerComponent}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:wheel={handleWaterfallWheel}
                      on:markerclick={handleFrequencyMarkerClick}
                    ></FrequencyMarkers>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={graduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <PassbandTuner
                      on:change={handlePassbandChange}
                      on:wheel={handleWaterfallWheel}
                      bind:this={passbandTunerComponent}
                    ></PassbandTuner>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={bandPlanCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    >
                    </canvas>
                    <div class="relative w-full" style="min-height:14px">
                      <button
                        class="absolute top-0 right-0 z-10 text-xs px-1 leading-none rounded"
                        style="background:rgba(0,0,0,0.6);color:{showClients ? '#4ade80' : '#ef4444'};border:1px solid {showClients ? '#4ade80' : '#ef4444'};"
                        on:click={() => showClients = !showClients}
                        title="{showClients ? 'Hide' : 'Show'} user labels"
                      >{showClients ? "●" : "○"}</button>
                      <canvas
                        class="w-full bg-black peer"
                        style="display:{showClients ? 'block' : 'none'}"
                        bind:this={clientsCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:click={handleGraduationClick}
                        on:mousemove={handleClientsMouseMove}
                        on:mousedown={(e) =>
                          passbandTunerComponent.handleMoveStart(e, 1)}
                        on:touchstart={passbandTunerComponent.handleTouchStart}
                        on:touchmove={passbandTunerComponent.handleTouchMove}
                        on:touchend={passbandTunerComponent.handleTouchEnd}
                        width="1024"
                        height="20"
                      ></canvas>
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="absolute inset-0 z-20 bg-black bg-opacity-40 backdrop-filter backdrop-blur-sm transition-opacity duration-300 ease-in-out cursor-pointer flex justify-center items-center"
                id="startaudio"
              >
                <div class="text-center p-4 pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto mb-2 text-white opacity-80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                  <p class="text-white text-lg font-medium">
                    Tap to enable audio
                  </p>
                </div>
              </div>

              <!-- Audio Begins -->

              <!-- First Column -->

              <div
                class="flex flex-col xl:flex-row rounded p-5 justify-center rounded"
                id="middle-column"
              >
                <div
                  class="p-5 flex flex-col items-center bg-gray-800 lg:border lg:border-gray-700 rounded-none rounded-t-lg lg:rounded-none lg:rounded-l-lg"
                >
                  <div class="control-group" id="volume-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {mute
                        ? 'rgba(255, 0, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleMuteChange}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="w-4 h-6"
                      >
                        {#if mute}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06L19.5 10.94l-1.72-1.72z"
                          />
                        {:else}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z"
                          />
                        {/if}
                      </svg>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={volume}
                        on:input={handleVolumeChange}
                        class="glass-slider"
                        disabled={mute}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-sm text-gray-300 ml-4"
                      >{volume}%</span
                    >
                  </div>

                  <div class="control-group mt-4" id="squelch-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {squelchEnable
                        ? 'rgba(255, 100, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleSquelchChange}
                    >
                      <span class="text-xs font-semibold">SQ</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={squelch}
                        on:input={handleSquelchMove}
                        class="glass-slider"
                        min="-150"
                        max="0"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-sm text-gray-300 ml-4"
                      >{squelch}db</span
                    >
                  </div>

                  <!-- Zoom Slider  -->
                  <div class="control-group mt-4" id="zoom-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {zoomStepEnabled
                        ? 'rgba(0, 180, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={(e) => handleZoomStepMove(e, (zoomStep += 1))}
                    >
                      <span class="text-white text-xs font-semibold">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"
                          />
                          <path d="M21 21l-6 -6" />
                          <path d="M8 8l-2 2l2 2" />
                          <path d="M12 8l2 2l-2 2" />
                        </svg>
                      </span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={zoomStep}
                        on:input={(e) => handleZoomStepMove(e, zoomStep)}
                        class="glass-slider"
                        min="1"
                        max="8"
                        step="1"
                      />
                    </div>

                    <span class="value-display text-sm text-gray-300 ml-4"
                      >×{zoomStep}</span
                    >
                  </div>
                  <!-- End of Zoom Slider -->

                  <!-- Audio Ends -->
                  <span>&nbsp;</span>
                  <!-- Begin of TOP Fine Tuning Buttons by sv2amk -->
                  <div class="grid grid-cols-7 sm:grid-cols-7 gap-2">
                    {#each mobiletopfinetuningsteps as finetuningstep}
                      <button
                        id="mobile-fine-tuning-selector"
                        class="retro-button text-white font-bold h-5 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                        on:click={() => handleFineTuningStep(finetuningstep)}
                        title="{finetuningstep} kHz"
                      >
                        {finetuningstep}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Second Column -->

                <div
                  class="flex flex-col items-center bg-gray-800 p-6 border-l-0 border-r-0 border border-gray-700"
                >
                  <div
                    class="bg-black rounded-lg p-8 min-w-80 lg:min-w-0 lg:p-4 mb-4 w-full"
                    id="smeter-tut"
                  >
                    <div
                      class="flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                      <div class="flex flex-col items-center">
                        <!--
                  Added by sv2amk to triger the initBandButton function
                  and show the proper band upon startup
-->
                        {#if currentBand == -2}
                          {initBandButton(frequency)}
                        {/if}
                        <input
                          class="text-2xl h-6 w-48 text-center bg-black text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg mb-2"
                          type="number"
                          pattern="\d*"
                          min="0"
                          inputmode="numeric"
                          step="0.01"
                          bind:value={frequency}
                          size="3"
                          name="frequency"
                          on:keydown={(e) => {
                            if (e.key === "Enter") {
                              frequencyInputComponent.setFrequency(
                                frequency * 1e3,
                              );
                              handleFrequencyChange({
                                detail: frequency * 1e3,
                              });
                            }
                          }}
                        />

                        <!-- SMeter -->
                        <canvas id="sMeter" width="20" height="20"></canvas>

                        <div
                          class="flex items-center justify-center text-xs w-48"
                        >
                          <span class="text-cyan-400 px-1"
                            >Current Band:&nbsp;{bandName}</span
                          >
                        </div>
                        <div
                          class="flex items-center justify-center text-xs w-48"
                        >
                          <span class="text-yellow-400 px-1">{vfo}</span>
                          <span class="text-gray-400 px-1">|</span>
                          <span class="text-green-400 px-1">{demodulation}</span
                          >
                          <span class="text-gray-400 px-1">|</span>
                          <span class="text-cyan-300 px-1">{bandwidth} kHz</span
                          >
                        </div>

                        <div
                          class="flex items-center justify-center text-xs w-48"
                        >
                          <span
                            class="text-xs font-mono {mute
                              ? 'text-red-500'
                              : 'text-red-500 opacity-20 relative z-10'}"
                            >MUTED</span
                          >
                          &nbsp;&nbsp;&nbsp;&nbsp;
                          <span
                            class="text-xs font-mono {squelchEnable
                              ? `text-orange-500`
                              : `text-orange-500 opacity-20 relative z-10`}"
                            >SQ</span
                          >
                          &nbsp;&nbsp;&nbsp;&nbsp;
                          <span
                            class="text-xs font-mono {NREnabled
                              ? `text-green-500`
                              : `text-green-500 opacity-20 relative z-10`}"
                            >NR</span
                          >
                          &nbsp;&nbsp;&nbsp;&nbsp;
                          <span
                            class="text-xs font-mono {NBEnabled
                              ? `text-green-500`
                              : `text-green-500 opacity-20 relative z-10`}"
                            >NB<span> </span></span
                          >
                          &nbsp;&nbsp;&nbsp;&nbsp;
                          <span
                            class="text-xs font-mono {ANEnabled
                              ? `text-green-500`
                              : `text-green-500 opacity-20 relative z-10`}"
                            >AN</span
                          >
                          &nbsp;&nbsp;&nbsp;&nbsp;
                          <span
                            class="text-xs font-mono {CTCSSSupressEnabled
                              ? `text-yellow-500`
                              : `text-yellow-500 opacity-20 relative z-10`}"
                            >CTCSS</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>

                  <div id="frequencyContainer" class="w-full mt-4">
                    <div class="space-y-5">
                      <!-- Phil -->
                      <!-- Begin Popup Buttons Menu -->
                      <div class="w-full mt-4">
                        <div class="grid grid-cols-4 sm:grid-cols-4 gap-2">
                          <button
                            id="vfo-ab-button"
                            class="glass-button h-8 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center w-full justify-center {toggleVFO ===
                            vfo
                              ? 'bg-green-600 pressed scale-95'
                              : 'bg-blue-700 hover:bg-gray-600'}"
                            on:click={() => toggleVFO(vfo)}
                            title="VFO Toggle"
                          >
                            {vfo}
                          </button>

                          <button
                            id="mode-button"
                            class="glass-button h-8 text-white font-bold text-sm py-2 px-4 rounded-lg flex items-center w-full justify-center"
                            on:click={toggleModePopup}
                          >
                            Mode
                          </button>
                          <!-- Mode Popup -->
                          {#if showModePopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleModePopup}
                            >
                              <div
                                class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Modes
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleModePopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!--Mode Content Begins -->
                                <div
                                  id="demodulationModes"
                                  class="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md"
                                >
                                  {#each ["USB", "LSB", "CW", "AM", "QUAM", "FM"] as mode}
                                    <button
                                      class="retro-button text-white font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                                      mode
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => setModePopup(mode)}
                                      >{mode}
                                    </button>
                                  {/each}
                                </div>
                                <!-- End of Mode Content -->
                              </div>
                            </div>
                          {/if}
                          <!-- End of Modes Popup Menu -->

                          <!-- Begin Bands Popup Menu -->
                          <button
                            id="band-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                            on:click={toggleBandPopup}
                          >
                            Band
                          </button>

                          <!-- Bands Popup -->
                          {#if showBandPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleBandPopup}
                            >
                              <div
                                class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Bands
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleBandPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!-- Content Starts -->

                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 1}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <div><hr class="border-gray-600 my-2" /></div>
                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 2}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End Bands Popup Menu -->

                          <!-- Begin IF Filters Popup Menu -->
                          <button
                            id="if-filter-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                            on:click={toggleIFPopup}
                          >
                            IF
                          </button>

                          <!-- Static IF Popup -->
                          {#if showIFPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleIFPopup}
                            >
                              <div
                                class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Static IF Filters
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleIFPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>

                                <!-- Content Starts -->

                                <div class="w-full mt-4">
                                  <div
                                    class="grid grid-cols-4 sm:grid-cols-6 gap-2"
                                  >
                                    {#each newBandwidth as newbandwidth}
                                      <button
                                        id="static-bandwidth-selector"
                                        class="retro-button text-sm text-white font-bold h-8 text-lg rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {newStaticBandwidth ==
                                        newbandwidth
                                          ? 'bg-blue-600 pressed scale-95'
                                          : 'bg-gray-700 hover:bg-gray-600'}"
                                        on:click={() =>
                                          handleSetStaticBandwidth(
                                            newbandwidth,
                                          )}
                                        title={newbandwidth}
                                      >
                                        {#if newbandwidth == 500}500 Hz                                        
                                        {:else if newbandwidth == 1800}1.8 kHz
                                        {:else if newbandwidth == 2400}2.4 kHz
                                        {:else if newbandwidth == 2700}2.7 kHz
                                        {:else if newbandwidth == 3000}3.0 kHz
                                        {:else if newbandwidth == 3500}3.5 kHz
                                        {:else if newbandwidth == 4000}4.0 kHz
                                        {:else if newbandwidth == 4500}4.5 kHz
                                        {:else if newbandwidth == 5000}5.0 kHz
                                        {:else if newbandwidth == 6000}6.0 kHz
                                        {:else if newbandwidth == 10000}10.0 kHz
                                        {:else if newbandwidth == 12000}12.0 kHz
                                        {:else}{/if}
                                      </button>
                                    {/each}
                                  </div>
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End IF Filters Popup Menu -->
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End of Popup Buttons Menu -->

                      <!-- Begin Bandwidth Selection Area -->
                      <div class="w-full mt-4"></div>
                      <!-- End of Bandwidth Selection Area -->

                      <!-- Tuning Steps -->
                      <div class="w-full mt-4"></div>

                      <!-- End of Tuning Step Selection Area -->

                      <!-- AGC Selection in Mobile -->
                      <div class="w-full mb-6">
                        <h3 class="text-white text-base font-semibold mb-2">
                          AGC
                        </h3>
                        <div id="moreoptions" class="grid grid-cols-4 gap-2">
                          {#each [{ option: "Auto", AGCbutton: 0 }, { option: "Fast", AGCbutton: 1 }, { option: "Mid", AGCbutton: 2 }, { option: "Slow", AGCbutton: 3 }] as { option, AGCbutton }}
                            <button
                              class="retro-button h-8 text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {AGCbutton ==
                              currentAGC
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => {
                                if (option === "Auto") handleAGCChange(0);
                                else if (option === "Fast") handleAGCChange(1);
                                else if (option === "Mid") handleAGCChange(2);
                                else if (option === "Slow") handleAGCChange(3);
                              }}
                            >
                              <span>{option}</span>
                            </button>
                          {/each}
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End AGC Section in Mobile -->

                      <!-- Begin Filter Selection when mobile-->
                      <div class="w-full mb-6">
                        <div class="flex items-center justify-between mb-2">
                          <h3 class="text-white text-base font-semibold">
                            Filters &nbsp;  &nbsp;  &nbsp;  &nbsp; 
                          </h3>
                          <div class="flex items-center gap-2">
                            <!-- Backend Noise Gate Toggle Button -->
                            <button
                              class="text-sm px-3 py-1 rounded-md font-semibold transition-all duration-200 {backendNoiseGateEnabled
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                              on:click={toggleBackendNoiseGate}
                              title="Enable/disable backend noise gate"
                            >
                              Gate: {backendNoiseGateEnabled ? 'ON' : 'OFF'}
                            </button>
                            
                            <!-- Preset Dropdown (only active when gate is ON) -->
                            <label for="noise-gate-preset" class="text-white text-sm">Preset:</label>
                            <select
                              id="noise-gate-preset"
                              bind:value={noiseGatePreset}
                              on:change={handleNoiseGatePresetChange}
                              disabled={!backendNoiseGateEnabled}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none {!backendNoiseGateEnabled ? 'opacity-50 cursor-not-allowed' : ''}"
                            >
                              <option value="balanced">Balanced</option>
                              <option value="aggressive">Aggressive</option>
                              <option value="weak-signal">Weak Signal</option>
                              <option value="smooth">Smooth</option>
                              <option value="maximum">Maximum</option>
                              <option value="cw">CW/Digital</option>
                        <option value="wspr">WSPR</option>
                              <option value="am-fm">AM/FM</option>
                            </select>
                          </div>
                        </div>
                        <div
                          id="moreoptions"
                          class="grid grid-cols-4 gap-2 text-sm h-8 mb-3"
                        >
                          {#each [{ option: "NR", icon: "wave-square", enabled: NREnabled }, { option: "NB", icon: "zap", enabled: NBEnabled }, { option: "AN", icon: "shield", enabled: ANEnabled }, { option: "CTCSS", icon: "filter", enabled: CTCSSSupressEnabled }] as { option, icon, enabled }}
                            <button
                              class="retro-button text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {enabled
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => {
                                if (option === "NR") handleNRChange();
                                else if (option === "NB") handleNBChange();
                                else if (option === "AN") handleANChange();
                                else handleCTCSSChange();
                              }}
                            >
                              <span>{option}</span>
                            </button>
                          {/each}
                        </div>
                        <!-- End Filter Selection when mobile-->
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Third Column -->

                <!-- WF Begins -->
                <div
                  class="flex flex-col items-center bg-gray-800 p-6 lg:border lg:border-gray-700 rounded-none rounded-b-lg lg:rounded-none lg:rounded-r-lg"
                >
                  <div class="mb-4 flex items-center gap-3">
                    <h3 class="text-white text-base font-semibold">
                      Waterfall Controls
                    </h3>
                    <button
                      class="glass-button flex items-center gap-2 px-3 py-1 text-sm"
                      on:click={toggleWaterfallDirection}
                      title="Toggle waterfall direction (W)"
                    >
                      <span
                        class={`inline-block text-[1.45rem] leading-none transition-transform duration-300 ${waterfallReverse ? 'text-green-400' : 'text-cyan-400'}`}
                        style:transform={waterfallReverse ? "rotate(180deg)" : "rotate(0deg)"}
                      >⬆</span>
                      <span class={waterfallReverse ? "text-green-400" : "text-cyan-400"}>
                        {waterfallReverse ? "Reverse" : "Default"}
                      </span>
                    </button>
                  </div>

                  <div class="w-full mb-6 space-y-5">
                    <div
                      id="brightness-controls"
                      class="flex items-center justify-between mb-2"
                    >
                      <span class="text-gray-300 text-xs w-10">Min:</span>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={min_waterfall}
                          min="-100"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMinMove}
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >{min_waterfall}</span
                      >
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-xs w-10">Max:</span>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={max_waterfall}
                          min="0"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMaxMove}
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >{max_waterfall}</span
                      >
                    </div>

                    <!-- Audio Buffer Slider transfered by sv2amk -->
                    <div class="control-group mt-4" id="audio-buffer-slider">
                      <button
                        class="glass-button text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mr-4"
                        style="background: {audioBufferDelayEnabled
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)'}"
                        on:click={() =>
                          handleAudioBufferDelayMove((audioBufferDelay += 1))}
                      >
                        <span class="text-white text-xs font-normal"
                          >Buffer</span
                        >
                      </button>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={audioBufferDelay}
                          on:input={handleAudioBufferDelayMove(
                            audioBufferDelay,
                          )}
                          class="glass-slider"
                          min="1"
                          max="5"
                          step="1"
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >×{audioBufferDelay}</span
                      >
                      <hr class="border-gray-600 my-2" />
                    </div>
                  </div>
                  <!-- End of Buffer -->

                  <div class="w-full mb-6">
                    <span><br /></span>
                    <div id="colormap-select" class="relative">
                      <select
                        bind:value={currentColormap}
                        on:change={handleWaterfallColormapSelect}
                        class="glass-select block w-full pl-3 pr-10 py-2 text-sm rounded-lg text-gray-200 appearance-none focus:outline-none"
                      >
                        {#each availableColormaps as colormap}
                          <option value={colormap}>{colormap}</option>
                        {/each}
                      </select>
                      <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                      >
                        <svg
                          class="fill-current h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                        >
                          <path
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div class="w-full mb-6">
                    <h3 class="text-white text-base font-semibold mb-2">
                      Zoom
                    </h3>
                    <div id="zoom-controls" class="grid grid-cols-4 gap-2">
                      {#each [{ action: "+", title: "Zoom in", icon: "zoom-in", text: "In" }, { action: "-", title: "Zoom out", icon: "zoom-out", text: "Out" }, { action: "max", title: "Zoom to max", icon: "maximize", text: "Max" }, { action: "min", title: "Zoom to min", icon: "minimize", text: "Min" }] as { action, title, icon, text }}
                        <button
                          class="retro-button text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                          on:click={(e) => handleWaterfallMagnify(e, action)}
                          {title}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            {#if icon === "zoom-in"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="11" y1="8" x2="11" y2="14" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "zoom-out"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "maximize"}
                              <path
                                d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                              />
                            {:else if icon === "minimize"}
                              <path
                                d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                              />
                            {/if}
                          </svg>
                          <span>{text}</span>
                        </button>
                      {/each}
                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>

                  <!-- START of waterfal control buttons -->

                  <div class="w-full mb-6">
                    <div class="w-full mb-6">
                      <div class="grid grid-cols-4 gap-2">
                        <button
                          id="waterfall-toggle"
                          class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {waterfallDisplay ===
                          true
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={handleWaterfallChange}
                          title="Waterfall Toggle"
                        >
                          Waterf.
                        </button>

                        <button
                          id="spectrum-toggle"
                          class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {spectrumDisplay ===
                          true
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={handleSpectrumChange}
                          title="Spectrum Toggle"
                        >
                          Spectr.
                        </button>
                        <button
                          id="auto-adjust"
                          class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {autoAdjustEnabled ===
                          true
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={() => handleAutoAdjust()}
                          title="Auto Adjust"
                        >
                          Auto Adj.
                        </button>
                        <button
                          id="bigger-waterfall"
                          class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {biggerWaterfall ===
                          true
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={handleWaterfallSizeChange}
                          title="Height (+)"
                        >
                          Height (+)
                        </button>
                      </div>
                      <hr class="border-gray-600 my-2" />
                    </div>
                  </div>
                  <!-- END of Waterfall Control Buttons -->


                  <!-- Mobile Decoder Section (exact desktop copy) -->
                    <!-- Decoder Options Section -->
                    <div>
                      <h3 class="text-white text-base font-semibold mb-2">
                        Decoder Options
                      </h3>
                      <div class="flex items-center gap-2">
                        <!-- Off/On toggle — mirrors Gate button style -->
                        <button
                          class="text-sm px-3 py-1 rounded-md font-semibold transition-all duration-200 {decoderOn
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                          on:click={toggleDecoder}
                          title="Enable/disable decoder"
                        >
                          Decoder: <br>{decoderOn ? 'ON' : 'OFF'}
                        </button>

                        <!-- Decoder selector dropdown -->
                        <select
                          bind:value={selectedDecoder}
                          on:change={handleDecoderChange}
                          disabled={!decoderOn}
                          class="glass-select text-white text-sm px-2 py-1 rounded-md cursor-pointer focus:outline-none {!decoderOn ? 'opacity-50 cursor-not-allowed' : ''}"
                        >
                          <option value="none">— Select decoder —</option>
                          <option value="ft8">FT8</option>
                          <option value="ft4">FT4</option>
                          <option value="cw">CW</option>
                          <option value="wspr">WSPR</option>
                          <option value="hffax">HF FAX / WEFAX</option>
                          <option value="sstv">SSTV</option>
                          <option value="navtex">NAVTEX</option>
                          <option value="fsk">FSK / RTTY</option>
                          <option value="radel">RADE v1 — RADEL (LSB)</option>
                          <option value="radeu">RADE v1 — RADEU (USB)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  
                  
             <!-- FT8 / FT4 Messages List -->
              {#if decoderOn && (ft8Enabled || ft4Enabled)}
                <div class="w-full bg-gray-700 rounded-lg p-6 mt-6">
                  <div class="w-full flex justify-between items-center mb-5 text-xs">
                    <h4 class="text-white font-semibold">{ft4Enabled ? 'FT4' : 'FT8'} Messages</h4>
                    <span class="text-gray-300 pl-4 lg:pl-0" id="farthest-distance">Farthest: 0 km</span>
                  </div>
                  <div class="w-full text-gray-300 overflow-auto max-h-40 custom-scrollbar pr-2">
                    <div id="ft8MessagesList">
                      <!-- Dynamic content populated here -->
                    </div>
                    <div><hr class="border-gray-600 my-2" /></div>
                  </div>
                </div>
              {/if}

                  <!-- CW Decoder Window -->
                  {#if decoderOn && cwEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="w-full flex justify-between items-center mb-3 text-xs">
                        <h4 class="text-white font-semibold flex items-center gap-2">
                          <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                          CW Decoder
                          {#if cwDetectedHz > 0}
                            <span class="text-amber-400 font-mono font-normal">≈ {cwDetectedHz} Hz</span>
                            {#if cwDetectedWpm > 0}
                              <span class="text-gray-400 font-mono font-normal text-xs">· {cwDetectedWpm} WPM</span>
                            {/if}
                          {:else}
                            <span class="text-gray-500 font-normal italic">scanning…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={() => { cwMessages = []; cwCurrentLine = ''; }}
                        >Clear</button>
                      </div>
                      <div
                        bind:this={cwScrollEl}
                        class="w-full font-mono text-sm text-amber-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-64 custom-scrollbar text-left"
                        style="letter-spacing:0.05em; word-break:break-all;"
                      >
                        {#each cwMessages as line}
                          <div class="break-words whitespace-pre-wrap">{line}</div>
                        {/each}
                        {#if cwCurrentLine}
                          <div class="text-amber-200">{cwCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if cwMessages.length === 0}
                          <div class="text-gray-500 italic">Listening for CW signal…</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- WSPR Decoder Window -->
                  {#if decoderOn && wsprEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="w-full flex justify-between items-center mb-3 text-xs">
                        <h4 class="text-white font-semibold flex items-center gap-2">
                          <span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                          WSPR-2 Decoder
                        </h4>
                        <!-- WSPR slot progress bar -->
                        <div class="w-full mt-1 mb-2 h-2 rounded-full bg-gray-600 overflow-hidden" title="WSPR slot progress">
                          {#if wsprPhase === 'collecting'}
                            <div class="h-full rounded-full bg-cyan-400 transition-all duration-500"
                                 style="width:{(wsprSlotPos / 116 * 100).toFixed(1)}%"></div>
                          {:else if wsprPhase === 'decoding'}
                            <div class="h-full rounded-full bg-amber-400 animate-pulse" style="width:100%"></div>
                          {:else}
                            <div class="h-full rounded-full bg-gray-500" style="width:0%"></div>
                          {/if}
                        </div>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={() => {
                            wsprMessages = [];
                            const el = document.getElementById('wsprMessagesList');
                            if (el) el.innerHTML = '';
                          }}
                        >Clear</button>
                      </div>
                      <!-- Header row -->
                      <div class="w-full font-mono text-xs text-gray-400 flex justify-between px-1 mb-1 border-b border-gray-600 pb-1">
                        <span class="w-18">UTC  Callsign</span>
                        <span class="w-6 text-left">Grid</span>
                        <span class="w-10 text-left">Power</span>
                        <span class="w-20 text-left">Freq</span>
                        <span class="w-14 text-center">SNR</span>
                      </div>
                      <div class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1">
                        <div id="wsprMessagesList" class="flex flex-col gap-0.5">
                          <!-- Rows injected by audio.js stopWSPRCollection() -->
                        </div>
                        {#if wsprMessages.length === 0}
                          <div class="text-gray-500 italic text-xs font-mono mt-2">Waiting for next even UTC minute slot…</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- HF FAX / WEFAX Decoder Panel -->
                  {#if decoderOn && faxEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">

                      <!-- Header -->
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          HF FAX / WEFAX Receiver
                          {#if faxPhasing}
                            <span class="text-xs text-cyan-400 font-mono">[PHASING]</span>
                          {/if}
                          {#if faxStopTone}
                            <span class="text-xs text-red-400 font-mono">[STOP]</span>
                          {/if}
                        </h4>
                        <span class="text-xs text-gray-400 font-mono">Lines: {faxLineCount}</span>
                      </div>

                      <!-- Station preset bar -->
                      <div class="flex flex-wrap gap-2 items-end mb-3">
                        <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label class="text-gray-400 text-xs">Station</label>
                          <select
                            bind:value={faxSelectedStation}
                            on:change={() => { faxStationObj = FAX_STATIONS.find(s => s.name === faxSelectedStation) || null; faxSelectedFreqIdx = 0; _faxTickCountdown(); }}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                          >
                            <option value="">— Select station —</option>
                            {#each FAX_STATIONS as st}
                              <option value={st.name}>{st.name}</option>
                            {/each}
                          </select>
                        </div>

                        {#if faxStationObj && faxStationObj.freqs.length > 1}
                          <div class="flex flex-col gap-1">
                            <label class="text-gray-400 text-xs">Frequency</label>
                            <select
                              bind:value={faxSelectedFreqIdx}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                            >
                              {#each faxStationObj.freqs as f, i}
                                <option value={i}>{f} kHz</option>
                              {/each}
                            </select>
                          </div>
                        {/if}

                        <button
                          class="glass-button text-white text-xs font-bold px-3 py-1.5 rounded-md h-7 flex items-center gap-1"
                          on:click={faxApplyStation}
                          title="Tune to this station"
                        >▶ Tune</button>
                      </div>


                      <!-- FAX broadcast schedule countdown -->
                      {#if faxScheduleRows.length > 0}
                        <div class="mb-3 rounded-md bg-gray-900 border border-gray-600 overflow-hidden text-xs">
                          <div class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800">
                            <svg class="w-3 h-3 text-green-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class="text-green-400 font-semibold tracking-wide uppercase">Next Transmissions · UTC</span>
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each faxScheduleRows as row, i}
                              <div class="flex items-center gap-2 px-2.5 py-1.5 {i === 0 ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'} transition-colors">
                                <span class="font-mono text-gray-300 shrink-0 w-10">{row.utc}</span>
                                <span class="text-gray-400 flex-1 truncate">{row.label}</span>
                                <span class="font-mono tabular-nums shrink-0
                                  {row.imminent ? 'text-red-400 font-bold'
                                   : row.urgent  ? 'text-amber-400 font-semibold'
                                   : i === 0      ? 'text-green-300'
                                                  : 'text-gray-500'}"
                                >{row.countdown}</span>
                                {#if row.imminent}
                                  <span class="text-red-400 animate-pulse shrink-0">●</span>
                                {:else if row.urgent}
                                  <span class="text-amber-400 animate-pulse shrink-0" title="Transmission starts soon">⚡</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Parameter bar -->
                      <div class="flex flex-wrap gap-3 items-end mb-3">

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">LPM</label>
                          <select bind:value={faxLPM} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={60}>60</option>
                            <option value={90}>90</option>
                            <option value={100}>100</option>
                            <option value={120}>120 ★</option>
                            <option value={240}>240</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">IOC</label>
                          <select bind:value={faxIOC} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={288}>288</option>
                            <option value={576}>576 ★</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">Shift</label>
                          <select bind:value={faxShift} on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600">
                            <option value={400}>400 Hz</option>
                            <option value={800}>800 Hz ★</option>
                          </select>
                        </div>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxAutoAlign
                                   ? 'bg-cyan-700 border-cyan-500 text-cyan-200'
                                   : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleAutoAlign}
                          title="Automatic sync-pulse line alignment"
                        >⇔ Auto-align</button>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxInvert
                                   ? 'bg-amber-700 border-amber-500 text-amber-200'
                                   : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleInvert}
                          title="Swap black and white (use for LSB receive or inverted polarity)"
                        >⇅ Invert</button>

                      </div>

                      <!-- Signal status bar -->
                      <div class="flex items-center gap-3 mb-3 text-xs font-mono">
                        <span class="text-gray-400">Black: <span class="text-gray-200">{faxInvert ? (1500 + faxShift) : 1500} Hz</span></span>
                        <span class="text-gray-400">White: <span class="text-gray-200">{faxInvert ? 1500 : (1500 + faxShift)} Hz</span></span>
                        <span class="text-gray-400">{Math.round(Math.PI * faxIOC)} px/line</span>
                        <span class="text-gray-400">{(60 / faxLPM * 1000).toFixed(0)} ms/line</span>
                      </div>

                      <!-- FAX canvas (scrolling image) -->
                      <div class="w-full overflow-x-auto rounded border border-gray-600 bg-black">
                        <canvas
                          bind:this={faxCanvas}
                          width={FAX_CANVAS_W}
                          height={FAX_CANVAS_H}
                          class="block fax-flip"
                          style="image-rendering: pixelated; width: 100%; max-width: {FAX_CANVAS_W}px;"
                          title="HF FAX image — rotated 180°, newest lines build from bottom to top"
                        ></canvas>
                      </div>

                      <!-- Tone indicators + action buttons -->
                      <div class="flex items-center gap-2 mt-2 flex-wrap">
                        <div class="flex items-center gap-1 text-xs {faxPhasing ? 'text-cyan-300' : 'text-gray-600'}">
                          <span class="inline-block w-2 h-2 rounded-full {faxPhasing ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}"></span>
                          300 Hz phasing
                        </div>
                        <div class="flex items-center gap-1 text-xs {faxStopTone ? 'text-red-300' : 'text-gray-600'}">
                          <span class="inline-block w-2 h-2 rounded-full {faxStopTone ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}"></span>
                          450 Hz stop
                        </div>
                        <div class="flex-1"></div>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={faxRefresh}
                          title="Clear canvas and reset decoder — use between transmissions"
                        >↺ Reset</button>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={faxSaveImage}
                          title="Save current image as PNG"
                        >⤓ Save PNG</button>
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode must be <strong class="text-gray-300">USB</strong> ·
                        Standard: 1500 Hz black · 2300 Hz white · 120 LPM · IOC 576 ·
                        Image scrolls upward — newest lines at bottom ·
                        Use <em>↺ Refresh</em> between transmissions or when image tears - <a href="https://www.weather.gov/media/marine/rfax.pdf" target="_blank" rel="noopener noreferrer" style="color: cyan;">FAX transmission schedules</a>
                      </p>
                    </div>
                  {/if}
                  <!-- END HF FAX Panel -->



                  {#if decoderOn && sstvEnabled}
                    <div class="mt-3 rounded-xl border border-cyan-500/25 bg-black/35 p-3 shadow-inner">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-cyan-300">SSTV</span>
                          {#if sstvDetectedMode}
                            <span class="text-xs text-emerald-300 font-mono">[{sstvDetectedMode}]</span>
                          {/if}
                          <span class="text-xs {sstvSoftSync ? 'text-yellow-300' : 'text-gray-400'}">{sstvSoftSync ? 'soft sync hold' : 'hard sync lock'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <button class="decoder-btn-secondary" on:click={_sstvStart} disabled={sstvRunning}>▶ Start</button>
                          <button class="decoder-btn-secondary" on:click={_sstvStop} disabled={!sstvRunning}>■ Stop</button>
                          <button class="decoder-btn-secondary" on:click={sstvRefresh} disabled={!sstvRunning}>↺ Reset</button>
                          <button class="decoder-btn-secondary" on:click={sstvSaveImage}>💾 Save Image</button>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-3 mb-2 text-xs text-gray-300">
                        <label class="flex items-center gap-2">
                          <span>Mode</span>
                          <select bind:value={sstvModeChoice} on:change={sstvModeChanged} class="glass-select text-white text-xs px-2 py-1 rounded-md">
                            <option value="auto">Auto</option>
                            <option value="martin1">Martin M1</option>
                            <option value="martin2">Martin M2</option>
                            <option value="scottie1">Scottie S1</option>
                            <option value="scottie2">Scottie S2</option>
                          </select>
                        </label>
                        <span class="text-gray-400">Desktop + mobile · raw PCM before AGC/NR/mute</span>
                        <span class="{sstvRunning ? 'text-emerald-300' : 'text-red-300'}">{sstvRunning ? 'Running' : 'Stopped'}</span>
                        <span class="text-gray-400">Lines: <span class="text-gray-200">{sstvLineCount}</span>/256</span>
                      </div>
                      <div class="mb-2 text-xs font-mono {sstvStatusText?.includes('lock') ? 'text-cyan-300' : 'text-gray-400'}">{sstvStatusText}</div>
                      <div class="rounded-lg overflow-hidden border border-gray-700 bg-black inline-block w-full max-w-[340px] sm:max-w-full">
                        <canvas bind:this={sstvCanvas} width={SSTV_CANVAS_W} height={SSTV_CANVAS_H} class="block w-full h-auto"></canvas>
                      </div>
                    </div>
                  {/if}

                  <!-- ── NAVTEX / SITOR-B Decoder Panel ───────────────────── -->
                  {#if decoderOn && navtexEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">

                      <!-- Header -->
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                          NAVTEX Receiver
                          {#if navtexStatusText}
                            <span class="text-xs text-teal-300 font-mono font-normal">[{navtexStatusText}]</span>
                          {:else}
                            <span class="text-xs text-gray-500 font-normal italic">waiting for phasing…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={navtexClear}
                        >Clear</button>
                      </div>

                      <!-- Station selector + Tune button -->
                      <div class="flex flex-wrap items-center gap-2 mb-3">
                        <select
                          bind:value={navtexSelectedStation}
                          class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0"
                          on:change={_navtexTickCountdown}
                        >
                          {#each NAVTEX_STATIONS as st}
                            <option value={st.name}>{st.name}</option>
                          {/each}
                        </select>
                        <button
                          class="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={navtexApplyStation}
                        >⇒ Tune &amp; Set IF</button>
                      </div>


                      <!-- Broadcast schedule countdown -->
                      {#if navtexScheduleRows.length > 0}
                        <div class="mb-3 rounded-md bg-gray-900 border border-gray-600 overflow-hidden text-xs">
                          <div class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800">
                            <svg class="w-3 h-3 text-teal-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class="text-teal-400 font-semibold tracking-wide uppercase">Next Broadcasts · UTC</span>
                          </div>
                          <div class="overflow-y-auto max-h-40 custom-scrollbar divide-y divide-gray-800">
                            {#each navtexScheduleRows as row, i}
                              <div class="flex items-center gap-2 px-2.5 py-1 {i === 0 ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'} transition-colors">
                                <span class="shrink-0 text-sm leading-none">{row.flag}</span>
                                <span class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0
                                  {row.imminent ? 'bg-red-500 text-white animate-pulse'
                                   : row.urgent  ? 'bg-amber-500 text-gray-900'
                                   : i === 0      ? 'bg-teal-600 text-white'
                                                  : 'bg-gray-600 text-gray-300'}"
                                >{row.id}</span>
                                <span class="text-gray-200 flex-1 truncate">{row.name}</span>
                                <span class="text-gray-500 shrink-0 hidden sm:inline">{row.area}</span>
                                <span class="text-gray-400 font-mono shrink-0">{row.nextUTC}</span>
                                <span class="font-mono tabular-nums w-20 text-right shrink-0
                                  {row.imminent ? 'text-red-400 font-bold'
                                   : row.urgent  ? 'text-amber-400 font-semibold'
                                   : i === 0      ? 'text-teal-300'
                                                  : 'text-gray-500'}"
                                >{row.label}</span>
                                {#if row.imminent}
                                  <span class="text-red-400 animate-pulse shrink-0 font-semibold">●</span>
                                {:else if row.urgent}
                                  <span class="text-amber-400 animate-pulse shrink-0" title="Arm decoder now">⚡</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Text output -->
                      <div
                        bind:this={navtexScrollEl}
                        class="w-full font-mono text-sm text-teal-200 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left"
                        style="letter-spacing:0.04em; word-break:break-all; line-height:1.5; text-align:left;"
                      >
                        {#each navtexMessages as line}
                          <div class="{line.startsWith('━━') ? 'text-teal-400 font-semibold my-1' : ''}">{line}</div>
                        {/each}
                        {#if navtexCurrentLine}
                          <div class="text-teal-100">{navtexCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if navtexMessages.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            Listening for NAVTEX signal…<br>
                            Set mode to <strong class="text-gray-300">USB</strong> and use <em>⇒ Tune &amp; Set IF</em> to auto-tune.
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode: <strong class="text-gray-300">USB</strong> ·
                        100 Baud FSK · 170 Hz shift · SITOR-B FEC ·
                        Dial set 500 Hz below channel (signal centre at 500 Hz audio) ·
                        <a href="https://yachtlycrew.com/tools/navtex-stations" target="_blank" rel="noopener noreferrer" style="color:cyan;">NAVTEX Maps Stations</a>
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveNavtexText}
                        >Save Text</button>
                      </div>
                    </div>
                  {/if}
                  <!-- END NAVTEX Panel -->

                  <!-- ── RADE v1 Digital Voice Panel ──────────────────────── -->
                  {#if decoderOn && radeEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full {radeConnected ? (radeSynced ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse') : 'bg-red-500'}"></span>
                          RADE v1 &nbsp;·&nbsp; {demodulation === 'RADEL' ? 'RADEL (LSB)' : 'RADEU (USB)'}
                          <span class="text-xs font-mono font-normal {radeConnected ? (radeSynced ? 'text-green-300' : 'text-yellow-300') : 'text-red-400'}">
                            {#if !radeConnected}
                              Connecting to sidecar…
                            {:else if radeSynced}
                              Synced{radeSnr !== null ? ' · SNR ' + radeSnr.toFixed(1) + ' dB' : ''}
                            {:else}
                              Searching for signal…
                            {/if}
                          </span>
                        </h4>
                      </div>

                      <!-- Status row -->
                      <div class="flex items-center gap-3 mb-3 text-xs">
                        <span class="px-2 py-0.5 rounded font-semibold {radeConnected ? 'bg-green-800 text-green-200' : 'bg-gray-800 text-gray-400'}">
                          {radeConnected ? 'Sidecar OK' : 'No Sidecar'}
                        </span>
                        <span class="px-2 py-0.5 rounded font-semibold {radeSynced ? 'bg-blue-800 text-blue-200' : 'bg-gray-800 text-gray-500'}">
                          {radeSynced ? 'Frame Sync' : 'Acquiring…'}
                        </span>
                        <span class="text-gray-500 font-mono">1500 Hz BW · FARGAN vocoder</span>
                      </div>

                      <!-- Error banner -->
                      {#if !radeConnected}
                        <div class="rounded bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300 mb-3">
                          <strong>⚠ Sidecar not reachable.</strong> Start it on the server:<br>
                          <code class="text-red-200 font-mono">python3 rade_helper.py</code>
                          &nbsp;(listens on port 8074)
                        </div>
                      {/if}

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-2 leading-relaxed">
                        FreeDV RADE v1 · decoded server-side by
                        <code class="text-gray-400">rade_helper.py</code> →
                        <code class="text-gray-400">radae_rxe.py</code> →
                        <code class="text-gray-400">lpcnet_demo</code><br>
                        {demodulation === 'RADEL' ? 'LSB — use on 40 m / 80 m / 160 m.' : 'USB — use on 20 m / 17 m / 15 m / 10 m.'}
                        See <a href="https://freedv.org/radio-autoencoder/" target="_blank" rel="noopener noreferrer" style="color:cyan;">freedv.org/radio-autoencoder</a>.
                         - 
                         <a href="https://qso.freedv.org//" target="_blank" rel="noopener noreferrer" style="color:cyan;">FreeDV Reporter</a>.
                      </p>
                    </div>
                  {/if}
                  <!-- END RADE Panel -->


                  <!-- ── FSK / RTTY Decoder Panel ─────────────────────────── -->
                  {#if decoderOn && fskEnabled}
                    <div class="w-full bg-gray-700 rounded-lg p-4 mt-6 text-left">
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h4 class="text-white font-semibold flex items-center gap-2 text-sm">
                          <span class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          FSK / RTTY Decoder
                          {#if fskStatusText}
                            <span class="text-xs text-green-300 font-mono font-normal">[{fskStatusText}]</span>
                          {:else}
                            <span class="text-xs text-gray-500 font-normal italic">waiting for lock…</span>
                          {/if}
                        </h4>
                        <button
                          class="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                          on:click={fskClear}
                        >Clear</button>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Variant</label>
                          <select bind:value={fskVariant} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={fskVariantChanged}>
                            <option value="maritime">Maritime FSK / SITOR</option>
                            <option value="weather">Weather RTTY</option>
                            <option value="ham">Amateur RTTY</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Known frequency</label>
                          <div class="flex gap-2">
                            <select bind:value={fskKnownFrequency} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full">
                              <option value="">— Select frequency —</option>
                              {#each (FSK_KNOWN_FREQUENCIES[fskVariant] || []) as item}
                                <option value={String(item.khz)}>{item.label}</option>
                              {/each}
                            </select>
                            <button class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap" on:click={fskApplyKnownFrequency}>Tune</button>
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Center audio (Hz)</label>
                          <input type="number" bind:value={fskCenter} class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(true)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Shift (Hz)</label>
                          <input type="number" bind:value={fskShift} class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(true)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Baud</label>
                          <input type="number" bind:value={fskBaud} step="0.01" class="w-full bg-gray-900 text-green-300 text-xs px-2 py-1 rounded" on:change={() => fskApplySettings(false)} />
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Framing</label>
                          <select bind:value={fskFraming} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={() => fskApplySettings(false)}>
                            <option value="5N1">5N1</option>
                            <option value="5N1.5">5N1.5</option>
                            <option value="5N2">5N2</option>
                            <option value="7N1">7N1</option>
                            <option value="7E1">7E1</option>
                            <option value="7O1">7O1</option>
                            <option value="8N1">8N1</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1">Encoding</label>
                          <select bind:value={fskEncoding} class="glass-select text-white text-xs px-2 py-1 rounded-md w-full" on:change={() => fskApplySettings(false)}>
                            <option value="ccir476">CCIR-476</option>
                            <option value="ita2">ITA2 / Baudot</option>
                            <option value="ascii">ASCII</option>
                          </select>
                        </div>
                        <label class="flex items-center gap-2 text-xs text-gray-300 mt-5">
                          <input type="checkbox" bind:checked={fskInvert} on:change={() => fskApplySettings(false)} />
                          Invert mark / space
                        </label>
                        <label class="flex items-center gap-2 text-xs text-gray-300 mt-5">
                          <input type="checkbox" bind:checked={fskAutoShift} on:change={() => fskApplySettings(false)} />
                          Auto shift detect
                        </label>
                      </div>

                      <div class="flex flex-wrap items-center gap-2 mb-3 text-xs">
                        <button class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap" on:click={fskApplyBandpass}>⇒ Set IF Band-Pass</button>
                        <button class="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors whitespace-nowrap" on:click={() => { audio.setFSKAutoCenter(true); fskStatusText = 'Auto-tune scanning…'; }}>⟳ Auto-tune Center</button>
                        <span class="text-gray-300">Mark: <span class="text-green-300 font-mono">{Math.round(fskMetrics.markHz || 0)} Hz</span></span>
                        <span class="text-gray-300">Space: <span class="text-green-300 font-mono">{Math.round(fskMetrics.spaceHz || 0)} Hz</span></span>
                        <span class="text-gray-300">SNR: <span class="text-green-300 font-mono">{Number(fskMetrics.snrDb || 0).toFixed(1)} dB</span></span>
                        <span class="text-gray-300">Lock: <span class="text-green-300 font-mono">{fskMetrics.lockQuality || 0}%</span></span>
                        <span class="text-gray-300">Timing: <span class="{fskMetrics.timingLocked ? 'text-green-300' : 'text-gray-500'} font-mono">{fskMetrics.timingLocked ? 'LOCKED' : 'SEARCH'}</span></span>
                      </div>

                      <div
                        bind:this={fskScrollEl}
                        class="w-full font-mono text-sm text-green-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left"
                        style="letter-spacing:0.04em; word-break:break-word; overflow-wrap:anywhere; white-space:pre-wrap; line-height:1.5; text-align:left;"
                      >
                        {#each fskTextLines as line}
                          <div class="break-words whitespace-pre-wrap">{line}</div>
                        {/each}
                        {#if fskCurrentLine}
                          <div class="break-words whitespace-pre-wrap">{fskCurrentLine}<span class="animate-pulse">▋</span></div>
                        {:else if fskTextLines.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            FSK / RTTY decoder has taken control of mode and IF while active.<br>
                            Use the known frequency list, then fine-tune until the text becomes stable.
                          </div>
                        {/if}
                        <div style="height:1.5em;" aria-hidden="true"></div>
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        <strong class="text-gray-300">Mode: USB. Please check "Invert mark / space" for RTTY (weather), 
                        <br> but leave it unchecked for maritime FSK and HAM RTTY</strong>.
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveFskText}
                        >Save Text</button>
                      </div>
                    </div>
                  {/if}
                  <!-- END FSK Panel -->

                  <!-- Begin Bookmark Button Area -->
                  <button
                    id="bookmark-button"
                    class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                    on:click={toggleBookmarkPopup}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                      />
                    </svg>
                    Bookmarks
                  </button>

                  <div
                    id="user_count_container"
                    class="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-1"
                  >
                    <div
                      id="total_user_count"
                      class="bg-gray-800 rounded-md p-2 text-center flex justify-between items-center"
                    >
                      <!-- Content will be populated by JavaScript -->
                    </div>
                  </div>

                  <!-- Bookmark Popup -->
                  {#if showBookmarkPopup}
                    <div
                      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                      on:click={toggleBookmarkPopup}
                    >
                      <div
                        class="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
                        on:click|stopPropagation
                      >
                        <div class="flex justify-between items-center mb-4">
                          <h2 class="text-xl font-bold text-white">
                            Bookmarks
                          </h2>
                          <button
                            class="text-gray-400 hover:text-white"
                            on:click={toggleBookmarkPopup}
                          >
                            <svg
                              class="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          </button>
                        </div>

                      <!-- Add Bookmark Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Add New Bookmark</label
                        >
                        <div class="flex flex-col gap-2">
                          <input id="textInput"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2"
                            bind:value={newBookmarkName}
                            placeholder="Bookmark name"
                          />
                          <input
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2"
                            bind:value={newBookmarkLabel}
                            placeholder="Label (optional)"
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"
                            on:click={addBookmark}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>

                        <!-- Current Link Section -->
                        <div class="mb-6">
                          <label
                            class="block text-sm font-medium text-gray-300 mb-2"
                            >Current Link</label
                          >
                          <div class="flex items-center gap-2">
                            <input
                              type="text"
                              class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-grow"
                              value={link}
                              readonly
                            />
                            <button
                              class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                              on:click={handleLinkCopyClick}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 mr-2"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                />
                                <path
                                  d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                />
                              </svg>
                              Copy
                            </button>
                          </div>
                        </div>

                        <!-- amkbookmarks -->

                        <!-- upload bookmark section -->

                        <div class="mb-6">
                          <label
                            class="block text-sm font-medium text-gray-300 mb-2"
                            >Up-Down/load Bookmarks. REFRESH the webpage (F5) to
                            see them!
                          </label>
                          <div class="flex items-center gap-2">
                            <!-- Click button το file input -->

                            <!-- Descret input type file  -->
                            <input
                              type="file"
                              accept=".json, .csv, application/json"
                              style="display: none;"
                              on:change={uploadBookmarks}
                              bind:this={fileInput}
                            />

                            <!-- Button for activating file input  -->
                            <button
                              class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                              on:click={() => fileInput.click()}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 mr-2"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                />
                                <path
                                  d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                />
                              </svg>
                              Upload Bookmarks
                            </button>

                            <!-- End of upload bookmark section -->

                            <!-- download bookmark Section -->

                            <button
                              class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                              on:click={downloadBookmarks}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 mr-2"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                />
                                <path
                                  d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                />
                              </svg>
                              Download Bookmarks
                            </button>
                          </div>
                        </div>

                        <!-- End off Download bookmark Section -->

                        <!-- end of amkbookmarks -->

                        <!-- Bookmarks List -->
                        <div class="overflow-y-auto flex-grow h-80">
                          <label
                            class="block text-sm font-medium text-gray-300 mb-2"
                            >Saved Bookmarks</label
                          >
                          {#each $bookmarks as bookmark, index}
                            <div
                              class="glass-panel rounded-lg p-3 flex items-center justify-between mb-2"
                            >
                              <div class="flex flex-col">
                                <span class="text-white text-sm"
                                  >{bookmark.name}</span
                                >
                                <span class="text-gray-400 text-xs"
                                  >{(bookmark.frequency / 1000).toFixed(3)} kHz</span
                                >
                              </div>
                              <div class="flex gap-2">
                                <button
                                  class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                  on:click={() => goToBookmark(bookmark)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4 mr-1"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  Go
                                </button>
                                <button
                                  class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                  on:click={() => copy(bookmark.link)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4 mr-1"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                    />
                                    <path
                                      d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                    />
                                  </svg>
                                  Copy
                                </button>
                                <button
                                  class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                  on:click={() => deleteBookmark(index)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-4 w-4 mr-1"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fill-rule="evenodd"
                                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                      clip-rule="evenodd"
                                    />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>

              {#if siteChatEnabled}
                <!--Beginn of Chatbox -->
                <!--To disable Chatbox: Delte Code from here to .. -->

                <div
                  class="flex flex-col rounded p-2 justify-center"
                  id="chat-column"
                >
                  <div
                    class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-8"
                    id="chat-box"
                  >
                    <h2
                      class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                    >
                      Chat
                    </h2>

                    <!-- Username Display/Input -->
                    <div class="mb-2 sm:mb-4 flex flex-wrap items-center">
                      <span
                        class="text-white text-xs sm:text-sm mr-2 mb-2 sm:mb-0"
                        >Chatting as:</span
                      >
                      {#if showUsernameInput}
                        <input
                          class="glass-input text-white py-1 px-2 rounded-lg outline-none text-xs sm:text-sm flex-grow mr-2 mb-2 sm:mb-0"
                          bind:value={username}
                          placeholder="Enter your name/callsign"
                          on:keydown={(e) =>
                            e.key === "Enter" && saveUsername()}
                        />
                        <button
                          class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                          on:click={saveUsername}
                        >
                          Save
                        </button>
                      {:else}
                        <span
                          class="glass-username text-white text-xs sm:text-sm px-3 py-1 rounded-lg mr-2 mb-2 sm:mb-0"
                        >
                          {username || myDisplayId || "Anonymous"}
                        </span>
                        <button
                          class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                          on:click={editUsername}
                        >
                          Edit
                        </button>
                      {/if}
                    </div>

                    <!-- Chat Messages -->
                    <div
                      class="bg-gray-900 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 h-48 sm:h-64 overflow-y-auto custom-scrollbar"
                      bind:this={chatMessages}
                    >
                      {#each $messages as { id, text } (id)}
                        {@const formattedMessage = formatFrequencyMessage(text)}
                        <div
                          class="mb-2 sm:mb-3 text-left"
                          in:fly={{ y: 20, duration: 300, easing: quintOut }}
                        >
                          <div
                            class="inline-block bg-gray-800 rounded-lg p-2 max-w-full"
                          >
                            <p
                              class="text-white text-xs sm:text-sm break-words"
                            >
                              <span class="font-semibold text-blue-300"
                                >{formattedMessage.username}</span
                              >
                              <span class="text-xs text-gray-400 ml-2"
                                >{formattedMessage.timestamp}</span
                              >
                            </p>
                            <p
                              class="text-white text-xs sm:text-sm break-words mt-1"
                            >
                              {#if formattedMessage.isFormatted}
                                {@html renderParts(formattedMessage.beforeFreq)}
                                <a
                                  href="#"
                                  class="text-blue-300 hover:underline"
                                  on:click|preventDefault={() =>
                                    handleFrequencyClick(
                                      formattedMessage.frequency,
                                      formattedMessage.demodulation,
                                    )}
                                >
                                  {(formattedMessage.frequency / 1000).toFixed(
                                    3,
                                  )} kHz ({formattedMessage.demodulation})
                                </a>
                                {@html renderParts(formattedMessage.afterFreq)}
                              {:else}
                                {@html renderParts(formattedMessage.parts)}
                              {/if}
                            </p>
                          </div>
                        </div>
                      {/each}
                    </div>

                    <!-- Message Input and Buttons -->
                    <div
                      class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"
                    >
                      <input
                        class="glass-input text-white py-2 px-3 rounded-lg outline-none text-xs sm:text-sm flex-grow"
                        bind:value={newMessage}
                        on:keydown={handleEnterKey}
                        placeholder="Type a message..."
                      />
                      <div class="flex space-x-2">
                        <button
                          class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                          on:click={sendMessage}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
                            />
                          </svg>
                          Send
                        </button>
                        <button
                          class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                          on:click={pasteFrequency}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                            />
                            <path
                              d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                            />
                          </svg>
                          Paste Freq
                        </button>
                      </div>
                    </div>
                    <hr class="border-gray-600 my-2" />
                    <span class="text-xs text-gray-400"
                      >PhantomSDR+ | v{VERSION}</span
                    >
                  </div>
                </div>
              {:else}{/if}
              <!--To disable Chatbox: Delte Code till above this here -->
            </div>
          </div>
          <footer class="mt-4 mb-4 text-center text-gray-400 text-sm">
            <!--  <span class="text-xs text-gray-400">PhantomSDR+ | v{VERSION}</span> -->
          </footer>
        </div>
    {/if}
  </div>
</main>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<style global lang="postcss">
  body {
    font-family: "Inter", sans-serif;
    background-color: #f0f0f0;
    color: #333;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  #hero {
    background-color: #2c3e50;
    color: #ecf0f1;
    padding: 100px 0;
    text-align: center;
  }

  #tagline {
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  .btn {
    display: inline-block;
    padding: 12px 24px;
    background-color: #e74c3c;
    color: #fff;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 700;
    transition: background-color 0.3s ease;
  }

  .btn:hover {
    background-color: #c0392b;
  }

  :root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }

  @media (min-width: 1372px) {
    #chat-box {
      min-width: var(--middle-column-width);
    }
    #chat-column {
      align-items: center;
    }
  }

  .full-screen-container {
    display: flex;
    flex-direction: row;
    height: 100vh;
  }

  .side-nav {
    flex-basis: 250px;
    overflow-y: auto;
    background-color: #333;
    color: #fff;
  }

  .main-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 1372px;
    margin: auto;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }

  .cursor-frequency-tooltip {
    background-color: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    border: 1px solid #00ff00;
    box-shadow: 0 2px 8px rgba(0, 255, 0, 0.3);
    white-space: nowrap;
  }

  :global(body.light-mode) {
    background-color: #a9a9a9;
    transition: background-color 0.3s;
  }
  :global(body) {
    background-color: #212121;
  }

  main {
    text-align: center;
    margin: 0 auto;
  }
  .thick-line-through {
    text-decoration-thickness: 2px;
  }

  .basic-button {
    @apply text-blue-500 border border-blue-500 font-bold uppercase transition-all duration-100 text-center text-xs px-2 py-1
            peer-checked:bg-blue-600 peer-checked:text-white;
  }
  .basic-button:hover {
    @apply border-blue-400 text-white;
  }

  .click-button {
    @apply text-blue-500 border border-blue-500 font-bold uppercase transition-all duration-100 text-center text-xs px-2 py-1;
  }
  .click-button:active {
    @apply bg-blue-600 text-white;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 12px;
    background-color: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin: 5px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    border: 3px solid rgba(0, 0, 0, 0.2);
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  }

  .scrollbar-container {
    padding-right: 12px;
    box-sizing: content-box;
  }

  /* Here you can Change the Background of WebSDR, Picture must be in assets folder*/
  .bg-custom-dark {
    /* background-color: #1c1c1c; /* Original: A very dark gray with a tiny hint of warmth */
    background: url("./assets/background.jpg") no-repeat center center fixed;
    background-size: cover;
  }

  .glass-username {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    display: inline-block;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .glass-button {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  }

  .glass-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .glass-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 10px;
    background: transparent;
    outline: none;
    border-radius: 999px;
    cursor: pointer;
  }

  .glass-slider::-webkit-slider-runnable-track {
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(180deg, #5c5c5c 0%, #2e2e2e 45%, #171717 100%);
    border: 1px solid #0d0d0d;
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.12),
      inset 0 -3px 5px rgba(0, 0, 0, 0.78),
      0 1px 1px rgba(255, 255, 255, 0.06),
      0 3px 8px rgba(0, 0, 0, 0.55);
  }

  .glass-slider::-moz-range-track {
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(180deg, #5c5c5c 0%, #2e2e2e 45%, #171717 100%);
    border: 1px solid #0d0d0d;
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.12),
      inset 0 -3px 5px rgba(0, 0, 0, 0.78),
      0 1px 1px rgba(255, 255, 255, 0.06),
      0 3px 8px rgba(0, 0, 0, 0.55);
  }



  .glass-slider:hover::-webkit-slider-thumb {
    box-shadow:
      inset 0 2px 3px rgba(255, 255, 255, 0.95),
      inset 0 -2px 3px rgba(0, 0, 0, 0.38),
      0 3px 6px rgba(0, 0, 0, 0.95),
      0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .glass-slider:hover::-moz-range-thumb {
    box-shadow:
      inset 0 2px 3px rgba(255, 255, 255, 0.95),
      inset 0 -2px 3px rgba(0, 0, 0, 0.38),
      0 3px 6px rgba(0, 0, 0, 0.95),
      0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .glass-slider:active::-webkit-slider-thumb {
    transform: translateY(2px) scale(0.98);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.65),
      inset 0 -1px 2px rgba(0, 0, 0, 0.45),
      0 1px 2px rgba(0, 0, 0, 0.95);
  }

  .glass-slider:active::-moz-range-thumb {
    transform: translateY(2px) scale(0.98);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.65),
      inset 0 -1px 2px rgba(0, 0, 0, 0.45),
      0 1px 2px rgba(0, 0, 0, 0.95);
  }

  .glass-slider:focus-visible::-webkit-slider-thumb {
    box-shadow:
      inset 0 2px 3px rgba(255, 255, 255, 0.95),
      inset 0 -2px 3px rgba(0, 0, 0, 0.38),
      0 0 0 2px rgba(255, 255, 255, 0.16),
      0 3px 6px rgba(0, 0, 0, 0.95);
  }

  .glass-slider:focus-visible::-moz-range-thumb {
    box-shadow:
      inset 0 2px 3px rgba(255, 255, 255, 0.95),
      inset 0 -2px 3px rgba(0, 0, 0, 0.38),
      0 0 0 2px rgba(255, 255, 255, 0.16),
      0 3px 6px rgba(0, 0, 0, 0.95);
  }

  .glass-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 50%;
  }

  #sMeter {
    width: 300px;
    height: 40px;
    background-color: transparent;
    display: block;
    margin-left: 30px;
    margin-top: 5px;
  }

  .smeter-container {
    background-color: black;
    padding: 10px;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 310px;
    padding: 15px;
    background: #111;
    border-radius: 5px;
    position: relative;
    margin: 0 auto;
    box-shadow: 0 0 10px rgb(83 83 83 / 30%);
    font-family: "VT323", monospace;
  }

  .glass-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 50%;
  }

  .glass-message {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: background-color 0.3s;
  }

  .glass-message:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .glass-panel:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .control-group {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    max-width: 400px;
  }

  .slider-container {
    flex-grow: 1;
    margin: 0 15px;
    width: 200px;
  }

  .value-display {
    width: 50px;
    text-align: right;
  }

  .glass-button.active {
    background: linear-gradient(
      135deg,
      rgba(50, 50, 80, 0.8),
      rgba(60, 50, 80, 0.8)
    );
    border-color: rgba(120, 100, 180, 0.4);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(150, 130, 200, 0.1);
  }

  .glass-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.03)),
      linear-gradient(180deg, rgba(58, 61, 78, 0.96), rgba(26, 28, 38, 0.98));
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      inset 0 -2px 3px rgba(0, 0, 0, 0.45),
      0 3px 0 rgba(0, 0, 0, 0.55),
      0 6px 12px rgba(0, 0, 0, 0.28);
    transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .glass-select:hover {
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -2px 3px rgba(0, 0, 0, 0.48),
      0 4px 0 rgba(0, 0, 0, 0.6),
      0 8px 14px rgba(0, 0, 0, 0.32);
  }

  .glass-select:focus {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05)),
      linear-gradient(180deg, rgba(66, 69, 88, 0.98), rgba(30, 32, 44, 1));
    border-color: rgba(99, 102, 241, 0.45);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 3px rgba(0, 0, 0, 0.48),
      0 2px 0 rgba(0, 0, 0, 0.62),
      0 0 0 2px rgba(99, 102, 241, 0.2),
      0 8px 16px rgba(0, 0, 0, 0.3);
    outline: none;
  }

  .glass-select:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 2px rgba(255, 255, 255, 0.08),
      inset 0 -3px 4px rgba(0, 0, 0, 0.52),
      0 2px 0 rgba(0, 0, 0, 0.58),
      0 4px 8px rgba(0, 0, 0, 0.26);
  }

  .glass-select option {
    background-color: #2a2c3e;
  }

  .glass-toggle-button {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    min-width: 48px;
  }

  .glass-toggle-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .glass-toggle-button.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .slide-transition {
    transition: max-height 300ms cubic-bezier(0.23, 1, 0.32, 1);
    overflow: hidden;
  }

  .chat-input {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: rgba(255, 255, 255, 0.1) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
  }

  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .chat-button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: rgba(255, 255, 255, 0.1) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    font-size: 14px;
  }

  @supports (-webkit-touch-callout: none) {
    .chat-input,
    .chat-button {
      background-color: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
  }


  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    border-radius: 999px;
    background: linear-gradient(180deg, #595959 0%, #373737 52%, #1d1d1d 100%);
    border: 1px solid #111;
    box-shadow:
      inset 0 2px 6px rgba(0,0,0,0.95),
      inset 0 -1px 1px rgba(255,255,255,0.05),
      0 3px 6px rgba(0,0,0,0.80);
    transition:
      background 0.12s ease,
      box-shadow 0.12s ease,
      transform 0.12s ease,
      filter 0.12s ease;
    overflow: hidden;
  }

  .toggle-slider::after {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 3px;
    height: 35%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.02));
    pointer-events: none;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    width: 18px;
    height: 18px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background: linear-gradient(180deg, #f0f0f0 0%, #cdcdcd 48%, #8f8f8f 100%);
    border: 1px solid rgba(0,0,0,0.38);
    box-shadow:
      inset 0 1px 2px rgba(255,255,255,0.88),
      inset 0 -2px 3px rgba(0,0,0,0.18),
      0 2px 4px rgba(0,0,0,0.90);
    transition:
      transform 0.12s ease,
      top 0.12s ease,
      box-shadow 0.12s ease;
    z-index: 1;
  }

  .toggle-switch:hover .toggle-slider {
    filter: brightness(1.03);
    box-shadow:
      inset 0 2px 6px rgba(0,0,0,0.98),
      inset 0 -1px 1px rgba(255,255,255,0.06),
      0 4px 7px rgba(0,0,0,0.84);
  }

  .toggle-switch:active .toggle-slider {
    transform: translateY(3px);
    box-shadow:
      inset 0 3px 8px rgba(0,0,0,1),
      0 1px 2px rgba(0,0,0,0.82);
  }

  .toggle-switch:active .toggle-slider:before {
    top: 3px;
    box-shadow:
      inset 0 1px 2px rgba(255,255,255,0.72),
      inset 0 -2px 4px rgba(0,0,0,0.24),
      0 1px 2px rgba(0,0,0,0.90);
  }

  input:checked + .toggle-slider {
    background: linear-gradient(180deg, #4bb7ff 0%, #2196f3 50%, #0f6fbd 100%);
    box-shadow:
      inset 0 3px 8px rgba(0,0,0,1),
      inset 0 1px 2px rgba(255,255,255,0.08),
      0 1px 2px rgba(0,0,0,0.80),
      0 0 8px rgba(33,150,243,0.20);
    transform: translateY(2px);
  }

  input:focus + .toggle-slider {
    box-shadow:
      inset 0 2px 6px rgba(0,0,0,0.95),
      inset 0 -1px 1px rgba(255,255,255,0.05),
      0 3px 6px rgba(0,0,0,0.80),
      0 0 0 2px rgba(33,150,243,0.22);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(20px) translateY(1px);
    top: 2px;
    box-shadow:
      inset 0 1px 2px rgba(255,255,255,0.62),
      inset 0 -2px 4px rgba(0,0,0,0.24),
      0 1px 2px rgba(0,0,0,0.90);
  }


  @media screen and (min-width: 1372px) {
    #outer-waterfall-container {
      min-width: 1372px;
    }
 
  /* --- Modal Header and close --- */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 0.9rem;
    background: #111827;
    border-bottom: 2px solid #1e293b;
    margin: auto;
    width: 50%;
    border: 3px solid #111827;
    padding: 10px;
  }
  .close-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    transition: transform 0.15s ease, color 0.15s ease;
  }
  .close-btn:hover {
    color: #e5e7eb;
    transform: scale(1.2);
  }
  /* --- Modal Body --- */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.7rem; 
    background: #0f172a;
    font-size: 0.7rem;
    line-height: 1.2;
    margin: auto;
    width: 50%;
    border: 3px solid #111827;
    padding: 10px;
  }
  /* --- Table --- */
  .shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .shortcuts-table td {
    padding: 0.18rem 0.22rem;
    border-bottom: 1px solid #1f2a38;
    font-size: 0.7rem;
    line-height: 1.22;
    text-align: left;
  }
  .shortcuts-table tr:last-child td {
    border-bottom: none;
  }
  /* Left column: */
  .shortcuts-table td:first-child {
    width: 65%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
  }
  /* Right column */
  .shortcuts-table td:last-child {
    width: 35%;
  }
  /* Hint text */
  .hint {
    font-size: 0.8rem;
    color: #9ca3af;
    text-align: right;
  }
  /* kbd */
  kbd {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    padding: 0 0.25rem;
    font-size: 0.72rem;
  }

/*Hide Input Number Arrows*/
    /* Chrome, Safari, Edge, Opera */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    /* Firefox */
    input[type="number"] {
      -moz-appearance: textfield;
    }    
  }
  


  /* Global 3D button effect */
  button {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease,
      filter 0.12s ease;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 0 rgba(0, 0, 0, 0.38),
      0 6px 14px rgba(0, 0, 0, 0.28);
  }

  button::before {
    content: "";
    position: absolute;
    left: 1px;
    right: 1px;
    top: 1px;
    height: 46%;
    border-radius: calc(0.5rem - 1px);
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.02));
    pointer-events: none;
    opacity: 0.95;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.03);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.24),
      0 1px 0 rgba(255, 255, 255, 0.1),
      0 5px 0 rgba(0, 0, 0, 0.4),
      0 8px 16px rgba(0, 0, 0, 0.32);
  }

  button:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 1px 0 rgba(0, 0, 0, 0.45),
      0 2px 6px rgba(0, 0, 0, 0.28);
  }

  button:focus-visible {
    outline: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.22),
      0 4px 0 rgba(0, 0, 0, 0.38),
      0 6px 14px rgba(0, 0, 0, 0.28),
      0 0 0 2px rgba(255, 255, 255, 0.12),
      0 0 0 4px rgba(59, 130, 246, 0.45);
  }

  button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -1px 0 rgba(0, 0, 0, 0.16),
      0 2px 0 rgba(0, 0, 0, 0.28),
      0 4px 8px rgba(0, 0, 0, 0.16);
  }

</style>