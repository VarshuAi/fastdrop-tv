/**
 * FastDrop TV Client Application Logic
 * Optimized for Samsung Tizen OS and TV Remote Control Navigation
 */

// App State Management
const State = {
  serverIp: '',
  port: '8080',
  currentPath: '', // Tracks current directory relative to shared folder
  history: [],     // Breadcrumbs stack for folder navigation
  files: [],       // Current file list fetched from server
  currentScreen: 'splash-screen',
  focusedIndex: 0,
  focusableElements: [],
  osdTimer: null,
  isOsdVisible: false,
  currentVideoItem: null,
  lastGridFocusedIndex: 0,
  audioItems: [],
  currentAudioIndex: -1,
  imageItems: [],
  currentImageIndex: -1,
  slideshowTimer: null,
  isSlideshowActive: false,
  subSize: localStorage.getItem('fastdrop_sub_size') || 'medium',
  subColor: localStorage.getItem('fastdrop_sub_color') || 'white',
  isVideoSettingsActive: false,
  isAudioMinimized: false,
  isShuffle: false,
  repeatMode: 'none', // 'none' | 'one' | 'all'
  currentPdfDoc: null,
  currentPdfPage: 1,
  totalPdfPages: 1,
  currentFilter: 'all', // 'all' | 'video' | 'audio' | 'image' | 'pdf'
  
  // Casting properties
  appMode: 'receiver', // 'receiver' | 'remote'
  lastCastCommandTimestamp: 0,
  castStatusInterval: null,
  isScrubbing: false,
  remoteState: null
};

// DOM Cache
const DOM = {
  app: document.getElementById('app'),
  connectionScreen: document.getElementById('connection-screen'),
  browserScreen: document.getElementById('browser-screen'),
  videoScreen: document.getElementById('video-screen'),
  imageScreen: document.getElementById('image-screen'),
  audioScreen: document.getElementById('audio-screen'),
  
  // IP Inputs
  ipInput: document.getElementById('ip-input'),
  connectBtn: document.getElementById('connect-btn'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  
  // Browser elements
  fileGrid: document.getElementById('file-grid'),
  currentPathDisplay: document.getElementById('current-path-display'),
  serverStatus: document.getElementById('server-status-indicator'),
  emptyFolderMsg: document.getElementById('empty-folder-msg'),
  
  // Video Player Elements
  videoPlayer: document.getElementById('video-player'),
  videoOsd: document.getElementById('video-osd'),
  videoTitle: document.getElementById('video-title'),
  videoCurrentTime: document.getElementById('video-current-time'),
  videoDuration: document.getElementById('video-duration'),
  videoProgressBar: document.getElementById('video-progress-bar'),
  videoSubtitleTrack: document.getElementById('video-subtitle-track'),
  subSizeBtn: document.getElementById('sub-size-btn'),
  subColorBtn: document.getElementById('sub-color-btn'),
  
  // Image Viewer Elements
  imageViewer: document.getElementById('image-viewer'),
  imageTitle: document.getElementById('image-title'),
  slideshowIndicator: document.getElementById('slideshow-indicator'),
  
  // Audio Player Elements
  audioPlayer: document.getElementById('audio-player'),
  audioTitle: document.getElementById('audio-title'),
  audioCurrentTime: document.getElementById('audio-current-time'),
  audioDuration: document.getElementById('audio-duration'),
  audioProgressBar: document.getElementById('audio-progress-bar'),
  audioStatusText: document.getElementById('audio-status-text'),
  
  // Resume Dialog Elements
  resumeDialog: document.getElementById('resume-dialog'),
  resumeTimeLabel: document.getElementById('resume-time-label'),
  resumeYesBtn: document.getElementById('resume-yes-btn'),
  resumeNoBtn: document.getElementById('resume-no-btn'),
  
  // Toast Notification
  toast: document.getElementById('toast-notification'),
  toastMessage: document.getElementById('toast-message'),

  // PDF Screen Elements
  pdfScreen: document.getElementById('pdf-screen'),
  pdfCanvas: document.getElementById('pdf-canvas'),
  pdfPrevBtn: document.getElementById('pdf-prev-btn'),
  pdfNextBtn: document.getElementById('pdf-next-btn'),
  pdfPageNumDisplay: document.getElementById('pdf-page-num-display'),
  pdfLoading: document.getElementById('pdf-loading'),

  // Mini-Player Elements
  miniPlayer: document.getElementById('mini-player'),
  miniPlayerTitle: document.getElementById('mini-player-title'),
  miniPlayerProgressFill: document.getElementById('mini-player-progress-fill'),

  // Audio Buttons Cache
  audioPrevBtn: document.getElementById('audio-prev-btn'),
  audioPlayBtn: document.getElementById('audio-play-btn'),
  audioNextBtn: document.getElementById('audio-next-btn'),
  audioShuffleBtn: document.getElementById('audio-shuffle-btn'),
  audioRepeatBtn: document.getElementById('audio-repeat-btn'),

  // Mode Selection Buttons
  modeReceiverBtn: document.getElementById('mode-receiver-btn'),
  modeRemoteBtn: document.getElementById('mode-remote-btn'),

  // Remote Control Elements
  remoteScreen: document.getElementById('remote-screen'),
  remoteMediaTitle: document.getElementById('remote-media-title'),
  remoteStatusText: document.getElementById('remote-status-text'),
  remoteProgressSlider: document.getElementById('remote-progress-slider'),
  remoteCurrentTime: document.getElementById('remote-current-time'),
  remoteTotalDuration: document.getElementById('remote-total-duration'),
  remotePlayBtn: document.getElementById('remote-play-btn'),
  remoteRewBtn: document.getElementById('remote-rew-btn'),
  remoteFfBtn: document.getElementById('remote-ff-btn'),
  remoteAudioSelect: document.getElementById('remote-audio-select'),
  remoteStopBtn: document.getElementById('remote-stop-btn')
};

// ----------------------------------------------------
// TIZEN REMOTE KEY CODES
// ----------------------------------------------------
const Keys = {
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  ENTER: 13,
  BACKSPACE: 8,
  TIZEN_BACK: 10009, // Tizen TV return/back key code
  SPACE: 32,
  PLAY: 415,
  PAUSE: 19,
  PLAYPAUSE: 10252,
  STOP: 413
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  console.log("Initializing FastDrop TV Client...");
  
  // Register Tizen TV physical return key if available
  if (window.tizen && window.tizen.tvinputdevice) {
    try {
      tizen.tvinputdevice.registerKey("Return");
      console.log("Registered Return key with Tizen input manager");
    } catch (e) {
      console.warn("Could not register Return key with Tizen: ", e);
    }
  }

  // Retrieve last saved IP address from localStorage
  const savedIp = localStorage.getItem('fastdrop_server_ip');
  if (savedIp) {
    DOM.ipInput.value = savedIp;
    State.serverIp = savedIp;
  }

  // Set up event listeners
  DOM.connectBtn.addEventListener('click', connectToServer);
  if (DOM.fullscreenBtn) {
    DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  
  // Add direct keydown event listener to document
  document.addEventListener('keydown', handleKeyDown);
  
  // Set up media player listeners
  setupMediaPlayerListeners();
  
  // Set up subtitle OSD settings listeners
  setupSubtitleSettingsListeners();

  // Set up Audio Controls and PDF viewer buttons listeners
  setupAudioControlsListeners();
  setupPdfControlsListeners();
  setupFilterListeners();
  
  // Set up Receiver/Remote mode select buttons listeners
  if (DOM.modeReceiverBtn && DOM.modeRemoteBtn) {
    DOM.modeReceiverBtn.addEventListener('click', () => setAppMode('receiver'));
    DOM.modeRemoteBtn.addEventListener('click', () => setAppMode('remote'));
  }

  // Set up resume dialog button listeners
  if (DOM.resumeYesBtn && DOM.resumeNoBtn) {
    DOM.resumeYesBtn.addEventListener('click', () => {
      const time = parseFloat(DOM.resumeDialog.dataset.resumeTime || "0");
      closeResumeDialog();
      startVideoPlayback(time);
    });
    DOM.resumeNoBtn.addEventListener('click', () => {
      closeResumeDialog();
      if (State.currentVideoItem) {
        localStorage.removeItem('fastdrop_resume_' + State.currentVideoItem.relativePath);
      }
      startVideoPlayback(0);
    });
  }

  // Initialize focusable elements on the starting screen
  updateFocusableList();
  
  // Auto-transition from splash to connection screen after 2.5 seconds
  setTimeout(() => {
    switchScreen('connection-screen');
    focusElement(0); // Focus the IP Input field first
  }, 2500);
}

// ----------------------------------------------------
// FOCUS AND SPATIAL NAVIGATION SYSTEM (TV FRIENDLY)
// ----------------------------------------------------
function updateFocusableList() {
  // Find all elements marked 'focusable' inside the active screen
  const selector = `#${State.currentScreen} .focusable`;
  State.focusableElements = Array.from(document.querySelectorAll(selector));
  
  // Ensure focused index falls in range
  if (State.focusedIndex >= State.focusableElements.length) {
    State.focusedIndex = Math.max(0, State.focusableElements.length - 1);
  }
}

function focusElement(index) {
  if (State.focusableElements.length === 0) return;
  
  // Remove focus styling from all
  State.focusableElements.forEach(el => {
    el.classList.remove('focused');
  });
  
  State.focusedIndex = index;
  const targetElement = State.focusableElements[index];
  
  if (targetElement) {
    targetElement.classList.add('focused');
    
    // Auto-focus HTML inputs so physical keyboard can type
    if (targetElement.tagName === 'INPUT') {
      targetElement.focus();
    } else {
      // Blur inputs if we focus buttons/cards so virtual keyboard closes
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    }
    
    // Auto-scroll the focused element into view
    targetElement.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'nearest'
    });
  }
}

function handleKeyDown(e) {
  const keyCode = e.keyCode || e.which;
  console.log(`Key pressed: ${keyCode} on screen: ${State.currentScreen}`);

  // Prevent default browser action for TV remote buttons
  if (keyCode === Keys.TIZEN_BACK || 
      (keyCode === Keys.BACKSPACE && State.currentScreen !== 'connection-screen' && document.activeElement.tagName !== 'INPUT')) {
    e.preventDefault();
    if (State.currentScreen === 'video-screen' && State.isVideoSettingsActive) {
      exitVideoSettings();
    } else if (State.isAudioMinimized) {
      maximizeAudioPlayer();
    } else if (State.currentScreen === 'remote-screen') {
      stopCasting();
    } else {
      goBack();
    }
    return;
  }

  // Handle keys depending on the current active screen
  switch (State.currentScreen) {
    case 'connection-screen':
      handleConnectionNavigation(keyCode, e);
      break;
    case 'browser-screen':
      handleBrowserNavigation(keyCode, e);
      break;
    case 'video-screen':
      handleVideoControls(keyCode, e);
      break;
    case 'audio-screen':
      handleAudioControls(keyCode, e);
      break;
    case 'image-screen':
      handleImageControls(keyCode, e);
      break;
    case 'pdf-screen':
      handlePdfControls(keyCode, e);
      break;
    case 'resume-dialog':
      handleResumeDialogNavigation(keyCode, e);
      break;
  }
}

// Connection screen navigation (Simple Up/Down)
function handleConnectionNavigation(keyCode, e) {
  const total = State.focusableElements.length;
  
  if (keyCode === Keys.UP || keyCode === Keys.LEFT) {
    e.preventDefault();
    const nextIndex = State.focusedIndex > 0 ? State.focusedIndex - 1 : total - 1;
    focusElement(nextIndex);
  } 
  else if (keyCode === Keys.DOWN || keyCode === Keys.RIGHT) {
    e.preventDefault();
    const nextIndex = State.focusedIndex < total - 1 ? State.focusedIndex + 1 : 0;
    focusElement(nextIndex);
  } 
  else if (keyCode === Keys.ENTER) {
    e.preventDefault();
    const target = State.focusableElements[State.focusedIndex];
    if (target === DOM.connectBtn) {
      connectToServer();
    } else if (target === DOM.ipInput) {
      // Toggle IP input activation
      DOM.ipInput.focus();
    }
  }
}

// File explorer navigation (5-Column Grid Layout)
function handleBrowserNavigation(keyCode, e) {
  const cols = 5;
  const total = State.focusableElements.length;
  if (total === 0) return;

  let nextIndex = State.focusedIndex;

  switch (keyCode) {
    case Keys.LEFT:
      e.preventDefault();
      nextIndex = State.focusedIndex > 0 ? State.focusedIndex - 1 : total - 1;
      break;
      
    case Keys.RIGHT:
      e.preventDefault();
      nextIndex = State.focusedIndex < total - 1 ? State.focusedIndex + 1 : 0;
      break;
      
    case Keys.UP:
      e.preventDefault();
      // Move up by 5 columns, wrap to bottom row if index becomes negative
      if (State.focusedIndex - cols >= 0) {
        nextIndex = State.focusedIndex - cols;
      } else {
        // Find matching column item in last row
        const rem = State.focusedIndex % cols;
        const lastRowStart = Math.floor((total - 1) / cols) * cols;
        nextIndex = lastRowStart + rem;
        if (nextIndex >= total) {
          nextIndex = total - 1;
        }
      }
      break;
      
    case Keys.DOWN:
      e.preventDefault();
      // Move down by 5 columns, wrap to top row if exceeding total
      if (State.focusedIndex + cols < total) {
        nextIndex = State.focusedIndex + cols;
      } else {
        nextIndex = State.focusedIndex % cols;
      }
      break;
      
    case Keys.ENTER:
      e.preventDefault();
      const target = State.focusableElements[State.focusedIndex];
      if (target) {
        target.click();
      }
      break;
  }

  if (nextIndex !== State.focusedIndex) {
    focusElement(nextIndex);
  }
}

// ----------------------------------------------------
// NAVIGATION BACK TRACKING
// ----------------------------------------------------
function goBack() {
  if (State.currentScreen === 'connection-screen') {
    // If on main screen, exit the app if on actual Tizen
    if (window.tizen && window.tizen.application) {
      try {
        tizen.application.getCurrentApplication().exit();
      } catch (err) {
        console.error("Exit failed: ", err);
      }
    }
  } 
  else if (State.currentScreen === 'resume-dialog') {
    closeResumeDialog();
    switchScreen('browser-screen');
    updateFocusableList();
    focusElement(State.lastGridFocusedIndex || 0);
  }
  else if (State.currentScreen === 'browser-screen') {
    // Navigate up folder structure
    if (State.history.length > 0) {
      State.currentPath = State.history.pop();
      loadFiles();
    } else {
      // Exit browser to connection screen
      if (State.castStatusInterval) {
        clearInterval(State.castStatusInterval);
        State.castStatusInterval = null;
      }
      switchScreen('connection-screen');
      focusElement(0); // Focus IP input
    }
  } 
  else if (State.currentScreen === 'audio-screen') {
    if (!DOM.audioPlayer.paused) {
      minimizeAudioPlayer();
    } else {
      stopAllMedia();
      switchScreen('browser-screen');
      updateFocusableList();
      focusElement(State.lastGridFocusedIndex || 0);
    }
  }
  else if (State.currentScreen === 'pdf-screen') {
    // Cleanup PDF resources to prevent memory leaks
    if (State.currentPdfDoc) {
      State.currentPdfDoc.destroy();
      State.currentPdfDoc = null;
    }
    switchScreen('browser-screen');
    updateFocusableList();
    focusElement(State.lastGridFocusedIndex || 0);
  }
  else {
    // We are in a media player (video or image), close it and return to file browser
    stopAllMedia();
    switchScreen('browser-screen');
    // Restore focus back to the item that opened it
    updateFocusableList();
    focusElement(State.lastGridFocusedIndex || 0);
  }
}

// Screen Transition Helper
function switchScreen(screenId) {
  // Hide active screen
  const active = document.querySelector('.screen.active');
  if (active) {
    active.classList.remove('active');
  }

  // Show new screen
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    State.currentScreen = screenId;
    updateFocusableList();
  }
}

// ----------------------------------------------------
// SERVER CONNECTION
// ----------------------------------------------------
function connectToServer() {
  const rawIp = DOM.ipInput.value.trim();
  
  if (!rawIp) {
    showToast("Please enter a valid IP address");
    return;
  }

  // Remove HTTP protocol or slashes if user typed them
  let ip = rawIp.replace(/^(https?:\/\/)?/, '').split('/')[0].split(':')[0];
  State.serverIp = ip;

  showToast("Connecting to local server...", 2000);

  // Attempt to fetch files from root directory of local server
  const testUrl = `http://${State.serverIp}:${State.port}/api/files`;
  
  // Set fetch timeout of 6 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  fetch(testUrl, { signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error("Server responded with error status");
      return response.json();
    })
    .then(data => {
      // Connection succeeded! Store IP and enter explorer
      localStorage.setItem('fastdrop_server_ip', State.serverIp);
      DOM.serverStatus.innerText = `Connected to ${State.serverIp}`;
      State.currentPath = '';
      State.history = [];
      
      switchScreen('browser-screen');
      renderFiles(data);
      initCastingEngine();
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error("Connection failed: ", error);
      showToast("Connection failed! Ensure server is running and IP is correct.");
    });
}

// ----------------------------------------------------
// LOAD & RENDER FILES
// ----------------------------------------------------
function loadFiles() {
  const url = `http://${State.serverIp}:${State.port}/api/files?path=${encodeURIComponent(State.currentPath)}`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Failed to fetch folder list");
      return response.json();
    })
    .then(data => {
      renderFiles(data);
    })
    .catch(error => {
      console.error("Failed to load files: ", error);
      showToast("Failed to load files from server.");
    });
}

function renderFiles(items) {
  DOM.fileGrid.innerHTML = '';
  State.files = items;

  // Breadcrumbs display updates
  DOM.currentPathDisplay.innerText = State.currentPath ? `Shared Folder / ${State.currentPath}` : 'Shared Folder /';

  // Apply media filter/sorting
  const filter = State.currentFilter || 'all';
  let filteredItems = items;
  if (filter !== 'all') {
    filteredItems = items.filter(item => item.type === 'folder' || item.type === filter);
  }

  // Toggle empty folder view if empty
  if (filteredItems.length === 0 && !State.currentPath) {
    DOM.emptyFolderMsg.classList.remove('hidden');
    updateFocusableList();
    return;
  } else {
    DOM.emptyFolderMsg.classList.add('hidden');
  }

  let elementCounter = 0;

  // Prepend visual Go Back item if in a subfolder
  if (State.currentPath) {
    const backCard = document.createElement('div');
    backCard.className = 'grid-item focusable back-item';
    backCard.setAttribute('tabindex', '0');
    backCard.innerHTML = `
      <div class="item-icon-wrapper"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></div>
      <div class="item-name">..</div>
      <div class="item-meta">
        <span>Parent Folder</span>
      </div>
    `;
    
    backCard.addEventListener('click', () => {
      // Pop history to navigate back
      State.currentPath = State.history.pop() || '';
      loadFiles();
    });
    
    DOM.fileGrid.appendChild(backCard);
    elementCounter++;
  }

  // Populate files/folders
  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grid-item focusable';
    card.setAttribute('data-path', item.relativePath);
    card.setAttribute('data-type', item.type);
    card.setAttribute('tabindex', '0');

    // Select icon or poster based on item type
    let iconHtml = '';
    if (item.type === 'video' && item.posterPath) {
      const posterUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.posterPath)}`;
      iconHtml = `<div class="item-poster-wrapper"><img src="${posterUrl}" class="item-poster" alt="${item.name} poster"></div>`;
    } else {
      let svgMarkup = '';
      if (item.type === 'folder') {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      } else if (item.type === 'video') {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 6 3 11l-.9-2.4 17.2-5z"/><path d="M4 22h16a2 2 0 0 0 2-2V10H2v10a2 2 0 0 0 2 2z"/><path d="M2 10 14.5 6.4"/><path d="m7 4 3 6"/><path d="m11 3 3 6"/><path d="m15 2 3 6"/></svg>`;
      } else if (item.type === 'audio') {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      } else if (item.type === 'image') {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      } else if (item.type === 'pdf') {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`;
      } else {
        svgMarkup = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      }
      iconHtml = `<div class="item-icon-wrapper">${svgMarkup}</div>`;
    }

    card.innerHTML = `
      ${iconHtml}
      <div class="item-name">${item.name}</div>
      <div class="item-meta">
        <span>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
        <span>${item.type === 'folder' ? '' : item.sizeFormatted}</span>
      </div>
    `;

    // Handle Selection click
    card.addEventListener('click', () => {
      handleItemSelection(item);
    });

    DOM.fileGrid.appendChild(card);
    elementCounter++;
  });

  // Re-index focusable items on browser screen
  updateFocusableList();
  
  // Reset focus index. Focus first item (usually parent directory button or first file)
  focusElement(0);
}

function handleItemSelection(item) {
  if (item.type === 'folder') {
    // Navigate into subdirectory
    State.history.push(State.currentPath);
    State.currentPath = item.relativePath;
    loadFiles();
  } else if (item.type === 'video') {
    if (State.appMode === 'remote') {
      castPlayVideo(item);
    } else {
      playVideo(item);
    }
  } else if (item.type === 'image') {
    viewImage(item);
  } else if (item.type === 'audio') {
    playAudio(item);
  } else if (item.type === 'pdf') {
    playPdf(item);
  } else {
    showToast("Unsupported file type");
  }
}

// ----------------------------------------------------
// PLAYBACK: VIDEO PLAYER
// ----------------------------------------------------
function playVideo(item) {
  State.currentVideoItem = item;
  State.lastGridFocusedIndex = State.focusedIndex;
  
  // Check if there is saved progress
  const savedTimeStr = localStorage.getItem('fastdrop_resume_' + item.relativePath);
  if (savedTimeStr) {
    const savedTime = parseFloat(savedTimeStr);
    if (savedTime > 5) {
      showResumeDialog(savedTime);
      return;
    }
  }
  
  startVideoPlayback(0);
}

function startVideoPlayback(startTime) {
  const item = State.currentVideoItem;
  if (!item) return;
  
  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  console.log(`Streaming Video from: ${streamUrl}`);
  
  DOM.videoTitle.innerText = item.name;
  DOM.videoPlayer.src = streamUrl;
  
  // Configure Subtitle Track
  const track = DOM.videoSubtitleTrack || document.getElementById('video-subtitle-track');
  if (track) {
    if (item.subtitlePath) {
      track.src = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.subtitlePath)}`;
      track.track.mode = 'showing';
    } else {
      track.removeAttribute('src');
      track.track.mode = 'disabled';
    }
  }
  
  switchScreen('video-screen');
  
  // Apply Subtitle size and color configurations
  applySubtitleStyles();
  
  // Auto-request fullscreen on TV browser for immersive experience
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    }
  } catch (e) {
    console.warn("Auto-fullscreen entry bypassed: ", e);
  }
  
  DOM.videoPlayer.load();
  
  if (startTime > 0) {
    DOM.videoPlayer.currentTime = startTime;
  }
  
  DOM.videoPlayer.play()
    .then(() => {
      showVideoOsd();
    })
    .catch(err => {
      console.error("Playback failed: ", err);
      showToast("Failed to initiate video playback.");
      goBack();
    });
}

function showResumeDialog(savedTime) {
  if (DOM.resumeTimeLabel && DOM.resumeDialog) {
    DOM.resumeTimeLabel.innerText = formatTime(savedTime);
    DOM.resumeDialog.classList.remove('hidden');
    DOM.resumeDialog.dataset.resumeTime = savedTime.toString();
    State.currentScreen = 'resume-dialog';
    updateFocusableList();
    focusElement(0); // Focus the "Resume" button
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .then(() => {
        showToast("Fullscreen mode enabled", 2000);
      })
      .catch(err => {
        console.error("Fullscreen entry failed: ", err);
        showToast("Fullscreen not supported or blocked by browser settings");
      });
  } else {
    document.exitFullscreen();
  }
}

function closeResumeDialog() {
  if (DOM.resumeDialog) {
    DOM.resumeDialog.classList.add('hidden');
  }
}

function handleResumeDialogNavigation(keyCode, e) {
  const total = State.focusableElements.length;
  if (total === 0) return;

  if (keyCode === Keys.LEFT || keyCode === Keys.UP) {
    e.preventDefault();
    const nextIndex = State.focusedIndex > 0 ? State.focusedIndex - 1 : total - 1;
    focusElement(nextIndex);
  } 
  else if (keyCode === Keys.RIGHT || keyCode === Keys.DOWN) {
    e.preventDefault();
    const nextIndex = State.focusedIndex < total - 1 ? State.focusedIndex + 1 : 0;
    focusElement(nextIndex);
  } 
  else if (keyCode === Keys.ENTER) {
    e.preventDefault();
    const target = State.focusableElements[State.focusedIndex];
    if (target) {
      target.click();
    }
  }
}

function handleVideoControls(keyCode, e) {
  const video = DOM.videoPlayer;
  
  // If settings are active, trap arrow keys to settings buttons
  if (State.isVideoSettingsActive) {
    const total = State.focusableElements.length;
    if (total > 0) {
      if (keyCode === Keys.LEFT) {
        e.preventDefault();
        const nextIndex = State.focusedIndex > 0 ? State.focusedIndex - 1 : total - 1;
        focusElement(nextIndex);
      }
      else if (keyCode === Keys.RIGHT) {
        e.preventDefault();
        const nextIndex = State.focusedIndex < total - 1 ? State.focusedIndex + 1 : 0;
        focusElement(nextIndex);
      }
      else if (keyCode === Keys.DOWN) {
        e.preventDefault();
        exitVideoSettings();
      }
      else if (keyCode === Keys.ENTER) {
        e.preventDefault();
        const target = State.focusableElements[State.focusedIndex];
        if (target) {
          target.click();
        }
      }
    }
    return;
  }

  // Any button click reveals OSD temporarily
  showVideoOsd();

  if (keyCode === Keys.UP) {
    e.preventDefault();
    enterVideoSettings();
  }
  else if (keyCode === Keys.ENTER || keyCode === Keys.SPACE || keyCode === Keys.PLAYPAUSE) {
    e.preventDefault();
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  } 
  else if (keyCode === Keys.PLAY) {
    e.preventDefault();
    video.play();
  } 
  else if (keyCode === Keys.PAUSE) {
    e.preventDefault();
    video.pause();
  }
  else if (keyCode === Keys.RIGHT) {
    e.preventDefault();
    // Fast forward 10s
    video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);
  } 
  else if (keyCode === Keys.LEFT) {
    e.preventDefault();
    // Rewind 10s
    video.currentTime = Math.max(video.currentTime - 10, 0);
  }
}

function showVideoOsd() {
  DOM.videoOsd.classList.add('active');
  State.isOsdVisible = true;
  
  // Clear any existing timers
  if (State.osdTimer) {
    clearTimeout(State.osdTimer);
  }
  
  // Auto-hide OSD after 3.5 seconds
  State.osdTimer = setTimeout(() => {
    DOM.videoOsd.classList.remove('active');
    State.isOsdVisible = false;
  }, 3500);
}

// ----------------------------------------------------
// PLAYBACK: IMAGE VIEWER
// ----------------------------------------------------
function viewImage(item) {
  // Populate imageItems playlist from current folder list
  State.imageItems = State.files.filter(f => f.type === 'image');
  State.currentImageIndex = State.imageItems.findIndex(f => f.relativePath === item.relativePath);
  
  // Reset slideshow state on entry
  stopSlideshow();
  
  displayImage(item);
}

function displayImage(item) {
  if (!item) return;
  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  
  DOM.imageTitle.innerText = item.name;
  DOM.imageViewer.src = streamUrl;
  
  switchScreen('image-screen');
}

function handleImageControls(keyCode, e) {
  if (keyCode === Keys.RIGHT) {
    e.preventDefault();
    stopSlideshow(); // Stop auto-play on manual navigate
    navigateImage(1);
  }
  else if (keyCode === Keys.LEFT) {
    e.preventDefault();
    stopSlideshow();
    navigateImage(-1);
  }
  else if (keyCode === Keys.ENTER || keyCode === Keys.SPACE || keyCode === Keys.PLAYPAUSE) {
    e.preventDefault();
    toggleSlideshow();
  }
}

function navigateImage(direction) {
  if (!State.imageItems || State.imageItems.length === 0) return;
  
  let nextIndex = State.currentImageIndex + direction;
  if (nextIndex >= State.imageItems.length) {
    nextIndex = 0; // Wrap around to start
  } else if (nextIndex < 0) {
    nextIndex = State.imageItems.length - 1; // Wrap around to end
  }
  
  State.currentImageIndex = nextIndex;
  displayImage(State.imageItems[nextIndex]);
}

function toggleSlideshow() {
  if (State.isSlideshowActive) {
    stopSlideshow();
    showToast("Slideshow Paused", 1500);
  } else {
    startSlideshow();
    showToast("Slideshow Started (5s interval)", 1500);
  }
}

function startSlideshow() {
  State.isSlideshowActive = true;
  if (DOM.slideshowIndicator) {
    DOM.slideshowIndicator.classList.remove('hidden');
  }
  
  if (State.slideshowTimer) {
    clearInterval(State.slideshowTimer);
  }
  
  State.slideshowTimer = setInterval(() => {
    navigateImage(1);
  }, 5000);
}

function stopSlideshow() {
  State.isSlideshowActive = false;
  if (DOM.slideshowIndicator) {
    DOM.slideshowIndicator.classList.add('hidden');
  }
  if (State.slideshowTimer) {
    clearInterval(State.slideshowTimer);
    State.slideshowTimer = null;
  }
}

// ----------------------------------------------------
// PLAYBACK: AUDIO PLAYER
// ----------------------------------------------------
function playAudio(item) {
  // Reset minimize status when entering full audio player
  State.isAudioMinimized = false;
  if (DOM.miniPlayer) DOM.miniPlayer.classList.add('hidden');

  // Populate audioItems playlist from current folder list
  State.audioItems = State.files.filter(f => f.type === 'audio');
  State.currentAudioIndex = State.audioItems.findIndex(f => f.relativePath === item.relativePath);

  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  
  DOM.audioTitle.innerText = item.name;
  DOM.audioPlayer.src = streamUrl;
  
  switchScreen('audio-screen');
  
  // Set up layout states
  updateAudioControlsState();
  updateFocusableList();
  focusElement(1); // Default focus on play/pause button (index 1)
  
  DOM.audioPlayer.load();
  DOM.audioPlayer.play()
    .then(() => {
      DOM.audioStatusText.innerText = "Playing";
      updateAudioControlsState();
    })
    .catch(err => {
      console.error("Audio playback error: ", err);
      showToast("Failed to play audio file.");
      goBack();
    });
}

function handleAudioControls(keyCode, e) {
  const audio = DOM.audioPlayer;
  const total = State.focusableElements.length;

  if (keyCode === Keys.LEFT) {
    e.preventDefault();
    const nextIndex = State.focusedIndex > 0 ? State.focusedIndex - 1 : total - 1;
    focusElement(nextIndex);
  }
  else if (keyCode === Keys.RIGHT) {
    e.preventDefault();
    const nextIndex = State.focusedIndex < total - 1 ? State.focusedIndex + 1 : 0;
    focusElement(nextIndex);
  }
  else if (keyCode === Keys.ENTER) {
    e.preventDefault();
    const target = State.focusableElements[State.focusedIndex];
    if (target) {
      target.click();
    }
  }
  else if (keyCode === Keys.UP || keyCode === Keys.DOWN) {
    e.preventDefault();
    // Allow up/down keys to seek (UP fast forward, DOWN rewind)
    if (keyCode === Keys.UP) {
      audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0);
    } else {
      audio.currentTime = Math.max(audio.currentTime - 10, 0);
    }
  }
  else if (keyCode === Keys.PLAY || keyCode === Keys.PLAYPAUSE) {
    e.preventDefault();
    toggleAudioPlayback();
  }
  else if (keyCode === Keys.PAUSE) {
    e.preventDefault();
    audio.pause();
    DOM.audioStatusText.innerText = "Paused";
    updateAudioControlsState();
  }
}

// ----------------------------------------------------
// MEDIA PLAYER MONITORS
// ----------------------------------------------------
function setupMediaPlayerListeners() {
  // Video Listeners
  let lastReportTime = 0;
  DOM.videoPlayer.addEventListener('timeupdate', () => {
    const video = DOM.videoPlayer;
    if (video.duration) {
      const percentage = (video.currentTime / video.duration) * 100;
      DOM.videoProgressBar.style.width = `${percentage}%`;
      DOM.videoCurrentTime.innerText = formatTime(video.currentTime);
      DOM.videoDuration.innerText = formatTime(video.duration);
      
      // Save playback progress every 5 seconds (only when watched > 5s and remaining > 15s)
      if (State.currentVideoItem) {
        const time = video.currentTime;
        if (time > 5 && (video.duration - time) > 15) {
          const lastSaved = parseFloat(video.dataset.lastSavedTime || "0");
          if (Math.abs(time - lastSaved) >= 5) {
            localStorage.setItem('fastdrop_resume_' + State.currentVideoItem.relativePath, time.toString());
            video.dataset.lastSavedTime = time.toString();
          }
        }
      }

      // Throttle casting status reporting to at most once per 1.5 seconds
      const now = Date.now();
      if (State.appMode === 'receiver' && now - lastReportTime >= 1500) {
        lastReportTime = now;
        reportReceiverStatus();
      }
    }
  });

  DOM.videoPlayer.addEventListener('loadedmetadata', () => {
    DOM.videoDuration.innerText = formatTime(DOM.videoPlayer.duration);
  });

  DOM.videoPlayer.addEventListener('ended', () => {
    console.log("Video playback completed");
    if (State.currentVideoItem) {
      localStorage.removeItem('fastdrop_resume_' + State.currentVideoItem.relativePath);
    }
    goBack();
  });

  DOM.videoPlayer.addEventListener('error', (e) => {
    console.error("Video element error: ", e);
    showToast("Unsupported format or video load error");
    goBack();
  });

  // Audio Listeners
  DOM.audioPlayer.addEventListener('timeupdate', () => {
    const audio = DOM.audioPlayer;
    if (audio.duration) {
      const percentage = (audio.currentTime / audio.duration) * 100;
      DOM.audioProgressBar.style.width = `${percentage}%`;
      DOM.audioCurrentTime.innerText = formatTime(audio.currentTime);
      DOM.audioDuration.innerText = formatTime(audio.duration);
      
      // Update mini player progress if minimized
      updateMiniPlayerProgress();
    }
  });

  DOM.audioPlayer.addEventListener('loadedmetadata', () => {
    DOM.audioDuration.innerText = formatTime(DOM.audioPlayer.duration);
  });

  DOM.audioPlayer.addEventListener('ended', () => {
    console.log("Audio track completed");
    
    if (State.repeatMode === 'one') {
      playAudio(State.audioItems[State.currentAudioIndex]);
    } else {
      let nextIndex = -1;
      if (State.isShuffle) {
        nextIndex = Math.floor(Math.random() * State.audioItems.length);
      } else {
        nextIndex = State.currentAudioIndex + 1;
      }
      
      if (nextIndex >= 0 && nextIndex < State.audioItems.length) {
        State.currentAudioIndex = nextIndex;
        playAudio(State.audioItems[nextIndex]);
      } else if (State.repeatMode === 'all' && State.audioItems.length > 0) {
        State.currentAudioIndex = 0;
        playAudio(State.audioItems[0]);
      } else {
        DOM.audioStatusText.innerText = "Completed";
        goBack();
      }
    }
  });

  DOM.audioPlayer.addEventListener('error', () => {
    showToast("Error loading audio track");
    goBack();
  });
}

function stopAllMedia() {
  // Clear OSD timer
  if (State.osdTimer) {
    clearTimeout(State.osdTimer);
  }
  // Reset Video Settings active state
  exitVideoSettings();
  
  // Reset Slideshow
  stopSlideshow();
  
  // Reset Mini-Player state
  State.isAudioMinimized = false;
  if (DOM.miniPlayer) DOM.miniPlayer.classList.add('hidden');
  
  // Clear Phone Remote status polling interval
  if (State.castStatusInterval) {
    clearInterval(State.castStatusInterval);
    State.castStatusInterval = null;
  }
  
  // Reset Video
  DOM.videoPlayer.pause();
  
  // Send stop report to server if TV Receiver was casting
  if (State.appMode === 'receiver' && State.currentScreen === 'video-screen') {
    const url = `http://${State.serverIp}:${State.port}/api/cast/report?currentTime=0&duration=0&isPlaying=false&audioTracks=Default&activeAudioTrack=0`;
    fetch(url).catch(err => console.warn("Failed to send stop report: ", err));
  }
  
  DOM.videoPlayer.removeAttribute('src'); // Completely unload source to free up TV RAM
  DOM.videoPlayer.load();
  DOM.videoProgressBar.style.width = '0%';
  
  // Reset Audio
  DOM.audioPlayer.pause();
  DOM.audioPlayer.removeAttribute('src');
  DOM.audioPlayer.load();
  DOM.audioProgressBar.style.width = '0%';
  
  // Reset Image
  DOM.imageViewer.removeAttribute('src');

  // Reset PDF
  if (State.currentPdfDoc) {
    State.currentPdfDoc.destroy();
    State.currentPdfDoc = null;
  }
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------
function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedMins = mins < 10 ? `0${mins}` : mins;
  const formattedSecs = secs < 10 ? `0${secs}` : secs;

  if (hrs > 0) {
    const formattedHrs = hrs < 10 ? `0${hrs}` : hrs;
    return `${formattedHrs}:${formattedMins}:${formattedSecs}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

// Toast helper
let toastTimer = null;
function showToast(msg, duration = 4000) {
  DOM.toastMessage.innerText = msg;
  DOM.toast.classList.remove('hidden');
  
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  
  toastTimer = setTimeout(() => {
    DOM.toast.classList.add('hidden');
  }, duration);
}

// Subtitle settings helper functions
function setupSubtitleSettingsListeners() {
  if (DOM.subSizeBtn) {
    DOM.subSizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleSubtitleSize();
    });
  }
  if (DOM.subColorBtn) {
    DOM.subColorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleSubtitleColor();
    });
  }
}

function enterVideoSettings() {
  State.isVideoSettingsActive = true;
  showVideoOsd();
  // Clear OSD auto-hide timer so OSD remains visible while navigating settings
  if (State.osdTimer) {
    clearTimeout(State.osdTimer);
    State.osdTimer = null;
  }
  updateFocusableList();
  focusElement(0); // Focus Size button
}

function exitVideoSettings() {
  State.isVideoSettingsActive = false;
  // Remove focused styling from any settings buttons
  State.focusableElements.forEach(el => el.classList.remove('focused'));
  // Reset focusable list
  State.focusableElements = [];
  State.focusedIndex = 0;
  // Start OSD auto-hide timer
  showVideoOsd();
}

function applySubtitleStyles() {
  const video = DOM.videoPlayer;
  if (!video) return;
  
  // Remove existing size classes
  video.classList.remove('sub-size-small', 'sub-size-medium', 'sub-size-large');
  // Remove existing color classes
  video.classList.remove('sub-color-white', 'sub-color-yellow', 'sub-color-cyan');
  
  // Add new classes
  video.classList.add(`sub-size-${State.subSize}`);
  video.classList.add(`sub-color-${State.subColor}`);
  
  // Update button texts
  if (DOM.subSizeBtn) {
    const sizeLabels = { 'small': 'Small', 'medium': 'Med', 'large': 'Large' };
    DOM.subSizeBtn.innerText = `Size: ${sizeLabels[State.subSize] || 'Med'}`;
  }
  if (DOM.subColorBtn) {
    const colorLabels = { 'white': 'White', 'yellow': 'Yellow', 'cyan': 'Cyan' };
    DOM.subColorBtn.innerText = `Color: ${colorLabels[State.subColor] || 'White'}`;
  }
}

function cycleSubtitleSize() {
  const sizes = ['small', 'medium', 'large'];
  let idx = sizes.indexOf(State.subSize);
  idx = (idx + 1) % sizes.length;
  State.subSize = sizes[idx];
  localStorage.setItem('fastdrop_sub_size', State.subSize);
  applySubtitleStyles();
  showToast(`Subtitle Size: ${State.subSize.toUpperCase()}`, 1500);
}

function cycleSubtitleColor() {
  const colors = ['white', 'yellow', 'cyan'];
  let idx = colors.indexOf(State.subColor);
  idx = (idx + 1) % colors.length;
  State.subColor = colors[idx];
  localStorage.setItem('fastdrop_sub_color', State.subColor);
  applySubtitleStyles();
  showToast(`Subtitle Color: ${State.subColor.toUpperCase()}`, 1500);
}

// Audio Controls row and PDF viewer helper functions
function setupAudioControlsListeners() {
  if (DOM.audioPrevBtn) {
    DOM.audioPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPreviousAudio();
    });
  }
  if (DOM.audioPlayBtn) {
    DOM.audioPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudioPlayback();
    });
  }
  if (DOM.audioNextBtn) {
    DOM.audioNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playNextAudio();
    });
  }
  if (DOM.audioShuffleBtn) {
    DOM.audioShuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleShuffle();
    });
  }
  if (DOM.audioRepeatBtn) {
    DOM.audioRepeatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleRepeatMode();
    });
  }
}

function setupPdfControlsListeners() {
  if (DOM.pdfPrevBtn) {
    DOM.pdfPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigatePdfPage(-1);
    });
  }
  if (DOM.pdfNextBtn) {
    DOM.pdfNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigatePdfPage(1);
    });
  }
}

function playPreviousAudio() {
  if (State.audioItems.length === 0) return;
  let prevIndex = State.currentAudioIndex - 1;
  if (prevIndex < 0) {
    prevIndex = State.audioItems.length - 1;
  }
  State.currentAudioIndex = prevIndex;
  playAudio(State.audioItems[prevIndex]);
}

function playNextAudio() {
  if (State.audioItems.length === 0) return;
  let nextIndex = State.currentAudioIndex + 1;
  if (nextIndex >= State.audioItems.length) {
    nextIndex = 0;
  }
  State.currentAudioIndex = nextIndex;
  playAudio(State.audioItems[nextIndex]);
}

function toggleShuffle() {
  State.isShuffle = !State.isShuffle;
  updateAudioControlsState();
  showToast(`Shuffle: ${State.isShuffle ? 'ON' : 'OFF'}`, 1500);
}

function cycleRepeatMode() {
  const modes = ['none', 'one', 'all'];
  let idx = modes.indexOf(State.repeatMode);
  idx = (idx + 1) % modes.length;
  State.repeatMode = modes[idx];
  updateAudioControlsState();
  
  const labels = { 'none': 'Off', 'one': 'Repeat One', 'all': 'Repeat All' };
  showToast(`Repeat Mode: ${labels[State.repeatMode]}`, 1500);
}

function toggleAudioPlayback() {
  const audio = DOM.audioPlayer;
  if (audio.paused) {
    audio.play()
      .then(() => {
        DOM.audioStatusText.innerText = "Playing";
        updateAudioControlsState();
      });
  } else {
    audio.pause();
    DOM.audioStatusText.innerText = "Paused";
    updateAudioControlsState();
  }
}

function updateAudioControlsState() {
  if (DOM.audioShuffleBtn) {
    if (State.isShuffle) {
      DOM.audioShuffleBtn.classList.add('active-mode');
      DOM.audioShuffleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>Shuffle: On`;
    } else {
      DOM.audioShuffleBtn.classList.remove('active-mode');
      DOM.audioShuffleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>Shuffle: Off`;
    }
  }
  
  if (DOM.audioRepeatBtn) {
    if (State.repeatMode !== 'none') {
      DOM.audioRepeatBtn.classList.add('active-mode');
    } else {
      DOM.audioRepeatBtn.classList.remove('active-mode');
    }
    
    const repeatLabels = { 'none': 'Off', 'one': 'One', 'all': 'All' };
    DOM.audioRepeatBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Repeat: ${repeatLabels[State.repeatMode]}`;
  }
  
  if (DOM.audioPlayBtn) {
    const isPlaying = !DOM.audioPlayer.paused;
    if (isPlaying) {
      DOM.audioPlayBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    } else {
      DOM.audioPlayBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
  }
}

function minimizeAudioPlayer() {
  State.isAudioMinimized = true;
  if (DOM.miniPlayer) {
    DOM.miniPlayer.classList.remove('hidden');
    DOM.miniPlayerTitle.innerText = State.audioItems[State.currentAudioIndex].name;
    updateMiniPlayerProgress();
  }
  
  switchScreen('browser-screen');
  updateFocusableList();
  focusElement(State.lastGridFocusedIndex || 0);
}

function maximizeAudioPlayer() {
  State.isAudioMinimized = false;
  if (DOM.miniPlayer) DOM.miniPlayer.classList.add('hidden');
  switchScreen('audio-screen');
  updateFocusableList();
  focusElement(1); // Play/Pause button
}

function updateMiniPlayerProgress() {
  const audio = DOM.audioPlayer;
  if (audio.duration && State.isAudioMinimized && DOM.miniPlayerProgressFill) {
    const percentage = (audio.currentTime / audio.duration) * 100;
    DOM.miniPlayerProgressFill.style.width = `${percentage}%`;
  }
}

// PDF.js Page-by-Page Rendering Engine
function playPdf(item) {
  State.lastGridFocusedIndex = State.focusedIndex;
  switchScreen('pdf-screen');
  showPdfLoading(true);
  
  const pdfUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js';
  
  pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
    State.currentPdfDoc = pdf;
    State.currentPdfPage = 1;
    State.totalPdfPages = pdf.numPages;
    if (DOM.pdfPageNumDisplay) {
      DOM.pdfPageNumDisplay.innerText = `Page 1 / ${pdf.numPages}`;
    }
    renderPdfPage(1);
  }).catch(err => {
    console.error("Failed to load PDF:", err);
    showToast("Failed to load PDF file");
    goBack();
  });
}

let pdfRenderTask = null;
function renderPdfPage(pageNum) {
  if (!State.currentPdfDoc) return;
  showPdfLoading(true);
  
  State.currentPdfDoc.getPage(pageNum).then(page => {
    const canvas = DOM.pdfCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Scale at 1.5 to balance 4K text readability and memory/lag limits
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    if (pdfRenderTask) {
      pdfRenderTask.cancel();
    }
    
    pdfRenderTask = page.render(renderContext);
    pdfRenderTask.promise.then(() => {
      showPdfLoading(false);
      if (DOM.pdfPageNumDisplay) {
        DOM.pdfPageNumDisplay.innerText = `Page ${pageNum} / ${State.totalPdfPages}`;
      }
      updateFocusableList();
      focusElement(0); // Focus Prev button
      page.cleanup(); // Clean up graphics resources immediately to prevent lag
    }).catch(err => {
      if (err.name !== 'RenderingCancelledException') {
        console.error("Page render failed:", err);
        showPdfLoading(false);
      }
    });
  });
}

function showPdfLoading(isLoading) {
  if (DOM.pdfLoading) {
    if (isLoading) DOM.pdfLoading.classList.remove('hidden');
    else DOM.pdfLoading.classList.add('hidden');
  }
}

function handlePdfControls(keyCode, e) {
  const total = State.focusableElements.length;
  if (keyCode === Keys.LEFT) {
    e.preventDefault();
    if (State.focusedIndex === 0) {
      navigatePdfPage(-1);
    } else {
      focusElement(0);
    }
  } else if (keyCode === Keys.RIGHT) {
    e.preventDefault();
    if (State.focusedIndex === 1) {
      navigatePdfPage(1);
    } else {
      focusElement(1);
    }
  } else if (keyCode === Keys.ENTER) {
    e.preventDefault();
    const target = State.focusableElements[State.focusedIndex];
    if (target) {
      target.click();
    }
  } else if (keyCode === Keys.UP || keyCode === Keys.DOWN) {
    e.preventDefault();
    // Scroll page view if scrollable
    const wrapper = document.querySelector('.pdf-viewer-container');
    if (wrapper) {
      const scrollAmt = keyCode === Keys.UP ? -60 : 60;
      wrapper.scrollTop += scrollAmt;
    }
  }
}

function navigatePdfPage(direction) {
  if (!State.currentPdfDoc) return;
  const newPage = State.currentPdfPage + direction;
  if (newPage >= 1 && newPage <= State.totalPdfPages) {
    State.currentPdfPage = newPage;
    renderPdfPage(newPage);
  }
}

// Media category filter/sorting functions
function setupFilterListeners() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filterVal = btn.getAttribute('data-filter');
      selectFilter(filterVal);
    });
  });
}

function selectFilter(filterValue) {
  State.currentFilter = filterValue;
  
  // Update UI active styling on filter buttons
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filterValue) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Re-render cached files with the active filter
  if (State.files) {
    renderFiles(State.files);
    // Keep focus on the active filter button so navigation is smooth
    // The filter buttons are the first 5 elements in the focusable list
    const filterBtnIndex = ['all', 'video', 'audio', 'image', 'pdf'].indexOf(filterValue);
    focusElement(filterBtnIndex);
  }
}

// App Mode Selector
function setAppMode(mode) {
  State.appMode = mode;
  if (DOM.modeReceiverBtn && DOM.modeRemoteBtn) {
    if (mode === 'receiver') {
      DOM.modeReceiverBtn.classList.add('active-mode');
      DOM.modeRemoteBtn.classList.remove('active-mode');
      showToast("Receiver Mode Activated (Play on this screen)", 1500);
    } else {
      DOM.modeReceiverBtn.classList.remove('active-mode');
      DOM.modeRemoteBtn.classList.add('active-mode');
      showToast("Remote Mode Activated (Cast to your TV)", 1500);
    }
  }
}

// Casting Engine Initializers
function initCastingEngine() {
  // Clear any existing casting intervals
  if (State.castStatusInterval) {
    clearInterval(State.castStatusInterval);
    State.castStatusInterval = null;
  }

  State.lastCastCommandTimestamp = Date.now(); // Ignore commands sent before connection

  if (State.appMode === 'receiver') {
    startReceiverPolling();
  }
}

// RECEIVER (TV) CAST LOGIC
function startReceiverPolling() {
  console.log("Starting Cast Receiver Command Poller...");
  State.castStatusInterval = setInterval(pollReceiverCommands, 1500);
}

function pollReceiverCommands() {
  if (State.appMode !== 'receiver') return;
  const url = `http://${State.serverIp}:${State.port}/api/cast/status`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.timestamp) return;
      
      // If a new command was received
      if (data.timestamp > State.lastCastCommandTimestamp) {
        State.lastCastCommandTimestamp = data.timestamp;
        console.log(`Received Cast Command: "${data.command}" for video: "${data.activeVideoPath}"`);
        
        switch (data.command) {
          case 'play':
            if (data.activeVideoPath) {
              const item = {
                relativePath: data.activeVideoPath,
                name: data.activeVideoPath.split('/').pop(),
                type: 'video'
              };
              
              // Only load and play if not already playing this exact video
              if (State.currentScreen !== 'video-screen' || !State.currentVideoItem || State.currentVideoItem.relativePath !== item.relativePath) {
                stopAllMedia();
                playVideo(item);
              } else if (DOM.videoPlayer.paused) {
                DOM.videoPlayer.play().catch(err => console.error("Play failed: ", err));
              }
            }
            break;
            
          case 'pause':
            if (State.currentScreen === 'video-screen' && !DOM.videoPlayer.paused) {
              DOM.videoPlayer.pause();
            }
            break;
            
          case 'seek':
            if (State.currentScreen === 'video-screen') {
              DOM.videoPlayer.currentTime = data.seekTime;
            }
            break;
            
          case 'change-audio':
            if (State.currentScreen === 'video-screen' && DOM.videoPlayer.audioTracks) {
              if (DOM.videoPlayer.audioTracks[data.audioTrackIndex]) {
                for (let i = 0; i < DOM.videoPlayer.audioTracks.length; i++) {
                  DOM.videoPlayer.audioTracks[i].enabled = (i === data.audioTrackIndex);
                }
                showToast(`Switched Audio Track: ${DOM.videoPlayer.audioTracks[data.audioTrackIndex].label || DOM.videoPlayer.audioTracks[data.audioTrackIndex].language || (data.audioTrackIndex + 1)}`, 2000);
              }
            }
            break;
            
          case 'stop':
            if (State.currentScreen === 'video-screen') {
              stopAllMedia();
              switchScreen('browser-screen');
            }
            break;
        }
      }
    })
    .catch(err => console.warn("Failed to poll receiver commands: ", err));
}

function reportReceiverStatus() {
  if (State.appMode !== 'receiver' || State.currentScreen !== 'video-screen') return;
  const video = DOM.videoPlayer;
  
  // Extract audio track languages
  const tracks = [];
  let activeIndex = 0;
  if (video.audioTracks && video.audioTracks.length > 0) {
    for (let i = 0; i < video.audioTracks.length; i++) {
      const t = video.audioTracks[i];
      tracks.push(t.label || t.language || `Track ${i + 1}`);
      if (t.enabled) activeIndex = i;
    }
  } else {
    tracks.push("Default");
  }

  const tracksStr = encodeURIComponent(tracks.join(','));
  const isPlaying = !video.paused;
  
  const url = `http://${State.serverIp}:${State.port}/api/cast/report?currentTime=${video.currentTime}&duration=${video.duration || 0}&isPlaying=${isPlaying}&audioTracks=${tracksStr}&activeAudioTrack=${activeIndex}`;
  
  fetch(url).catch(err => console.warn("Failed to report status: ", err));
}


// REMOTE CONTROLLER (PHONE) CAST LOGIC
function castPlayVideo(item) {
  State.lastGridFocusedIndex = State.focusedIndex;
  
  if (DOM.remoteMediaTitle) {
    DOM.remoteMediaTitle.innerText = item.name;
  }
  if (DOM.remoteStatusText) {
    DOM.remoteStatusText.innerText = "Casting media to TV...";
  }
  
  switchScreen('remote-screen');
  
  const url = `http://${State.serverIp}:${State.port}/api/cast/play?path=${encodeURIComponent(item.relativePath)}`;
  
  fetch(url)
    .then(res => res.json())
    .then(() => {
      startRemoteControllerPolling();
    })
    .catch(err => {
      console.error("Cast failed: ", err);
      showToast("Casting failed: " + (err.message || err));
      goBack();
    });
}

// Controller Status Poller
function startRemoteControllerPolling() {
  if (State.castStatusInterval) {
    clearInterval(State.castStatusInterval);
  }
  console.log("Starting Remote Controller Status Poller...");
  State.castStatusInterval = setInterval(pollRemoteControllerStatus, 1200);
}

function pollRemoteControllerStatus() {
  if (State.appMode !== 'remote' || State.currentScreen !== 'remote-screen') return;
  const url = `http://${State.serverIp}:${State.port}/api/cast/status`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data) return;
      State.remoteState = data;
      
      // Update play button styling based on TV state
      if (DOM.remotePlayBtn) {
        if (data.tvIsPlaying) {
          DOM.remotePlayBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        } else {
          DOM.remotePlayBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        }
      }
      
      if (DOM.remoteStatusText) {
        const diff = Date.now() - data.tvLastReported;
        if (diff > 5000) {
          DOM.remoteStatusText.innerText = "TV Player is offline / disconnected";
        } else {
          DOM.remoteStatusText.innerText = data.tvIsPlaying ? "Playing on TV" : "Paused on TV";
        }
      }
      
      // Update progress labels and slider
      if (DOM.remoteCurrentTime) DOM.remoteCurrentTime.innerText = formatTime(data.tvCurrentTime);
      if (DOM.remoteTotalDuration) DOM.remoteTotalDuration.innerText = formatTime(data.tvDuration);
      
      if (DOM.remoteProgressSlider && !State.isScrubbing) {
        DOM.remoteProgressSlider.max = Math.floor(data.tvDuration) || 100;
        DOM.remoteProgressSlider.value = Math.floor(data.tvCurrentTime) || 0;
      }
      
      // Update audio languages select dropdown
      if (DOM.remoteAudioSelect && data.tvAudioTracks && data.tvAudioTracks.length > 0) {
        // Only rebuild options if the list is different
        const currentCount = DOM.remoteAudioSelect.options.length;
        if (currentCount !== data.tvAudioTracks.length) {
          DOM.remoteAudioSelect.innerHTML = '';
          data.tvAudioTracks.forEach((track, idx) => {
            const opt = document.createElement('option');
            opt.value = idx.toString();
            opt.innerText = track;
            DOM.remoteAudioSelect.appendChild(opt);
          });
        }
        DOM.remoteAudioSelect.value = data.tvActiveAudioTrack.toString();
      }
    })
    .catch(err => console.warn("Failed to fetch TV cast status: ", err));
}

function setupRemoteControlsListeners() {
  if (DOM.remotePlayBtn) {
    DOM.remotePlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (State.remoteState) {
        const newCmd = State.remoteState.tvIsPlaying ? 'pause' : 'play';
        sendRemoteControlCommand(newCmd);
      }
    });
  }
  
  if (DOM.remoteRewBtn) {
    DOM.remoteRewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (State.remoteState) {
        const newTime = Math.max(State.remoteState.tvCurrentTime - 10, 0);
        sendRemoteSeekCommand(newTime);
      }
    });
  }
  
  if (DOM.remoteFfBtn) {
    DOM.remoteFfBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (State.remoteState) {
        const newTime = Math.min(State.remoteState.tvCurrentTime + 10, State.remoteState.tvDuration || 0);
        sendRemoteSeekCommand(newTime);
      }
    });
  }
  
  if (DOM.remoteProgressSlider) {
    DOM.remoteProgressSlider.addEventListener('mousedown', () => { State.isScrubbing = true; });
    DOM.remoteProgressSlider.addEventListener('touchstart', () => { State.isScrubbing = true; });
    
    DOM.remoteProgressSlider.addEventListener('change', (e) => {
      e.stopPropagation();
      State.isScrubbing = false;
      const targetTime = parseFloat(DOM.remoteProgressSlider.value);
      sendRemoteSeekCommand(targetTime);
    });
  }
  
  if (DOM.remoteAudioSelect) {
    DOM.remoteAudioSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      const index = parseInt(DOM.remoteAudioSelect.value, 10);
      sendRemoteAudioCommand(index);
    });
  }
  
  if (DOM.remoteStopBtn) {
    DOM.remoteStopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopCasting();
    });
  }
}

function sendRemoteControlCommand(command) {
  const url = `http://${State.serverIp}:${State.port}/api/cast/control?command=${command}`;
  fetch(url)
    .then(res => res.json())
    .catch(err => console.error("Control command failed: ", err));
}

function sendRemoteSeekCommand(time) {
  const url = `http://${State.serverIp}:${State.port}/api/cast/seek?time=${time}`;
  fetch(url)
    .then(res => res.json())
    .catch(err => console.error("Seek command failed: ", err));
}

function sendRemoteAudioCommand(trackIndex) {
  const url = `http://${State.serverIp}:${State.port}/api/cast/change-audio?index=${trackIndex}`;
  fetch(url)
    .then(res => res.json())
    .catch(err => console.error("Audio switch command failed: ", err));
}

function stopCasting() {
  showToast("Stopping playback cast...");
  sendRemoteControlCommand('stop');
  
  if (State.castStatusInterval) {
    clearInterval(State.castStatusInterval);
    State.castStatusInterval = null;
  }
  
  switchScreen('browser-screen');
  updateFocusableList();
  focusElement(State.lastGridFocusedIndex || 0);
}

// Call remote control listeners once on startup
setupRemoteControlsListeners();
