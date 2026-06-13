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
  currentScreen: 'connection-screen',
  focusedIndex: 0,
  focusableElements: [],
  osdTimer: null,
  isOsdVisible: false,
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
  
  // Image Viewer Elements
  imageViewer: document.getElementById('image-viewer'),
  imageTitle: document.getElementById('image-title'),
  
  // Audio Player Elements
  audioPlayer: document.getElementById('audio-player'),
  audioTitle: document.getElementById('audio-title'),
  audioCurrentTime: document.getElementById('audio-current-time'),
  audioDuration: document.getElementById('audio-duration'),
  audioProgressBar: document.getElementById('audio-progress-bar'),
  audioStatusText: document.getElementById('audio-status-text'),
  
  // Toast Notification
  toast: document.getElementById('toast-notification'),
  toastMessage: document.getElementById('toast-message')
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
  
  // Add direct keydown event listener to document
  document.addEventListener('keydown', handleKeyDown);
  
  // Set up media player listeners
  setupMediaPlayerListeners();

  // Initialize focusable elements on the starting screen
  updateFocusableList();
  
  // Focus the IP Input field first
  focusElement(0);
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
      behavior: 'smooth',
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
    goBack();
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
  else if (State.currentScreen === 'browser-screen') {
    // Navigate up folder structure
    if (State.history.length > 0) {
      State.currentPath = State.history.pop();
      loadFiles();
    } else {
      // Exit browser to connection screen
      switchScreen('connection-screen');
      focusElement(0); // Focus IP input
    }
  } 
  else {
    // We are in a media player (video, audio, or image), close it and return to file browser
    stopAllMedia();
    switchScreen('browser-screen');
    // Restore focus back to the item that opened it
    updateFocusableList();
    focusElement(State.focusedIndex);
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

  // Toggle empty folder view if empty
  if (items.length === 0 && !State.currentPath) {
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
      <div class="item-icon-wrapper">↩️</div>
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
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grid-item focusable';
    card.setAttribute('data-path', item.relativePath);
    card.setAttribute('data-type', item.type);
    card.setAttribute('tabindex', '0');

    // Select icon based on item type
    let icon = '📄';
    if (item.type === 'folder') icon = '📁';
    else if (item.type === 'video') icon = '🎬';
    else if (item.type === 'audio') icon = '🎵';
    else if (item.type === 'image') icon = '🖼️';

    card.innerHTML = `
      <div class="item-icon-wrapper">${icon}</div>
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
    playVideo(item);
  } else if (item.type === 'image') {
    viewImage(item);
  } else if (item.type === 'audio') {
    playAudio(item);
  } else {
    showToast("Unsupported file type");
  }
}

// ----------------------------------------------------
// PLAYBACK: VIDEO PLAYER
// ----------------------------------------------------
function playVideo(item) {
  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  console.log(`Streaming Video from: ${streamUrl}`);
  
  DOM.videoTitle.innerText = item.name;
  DOM.videoPlayer.src = streamUrl;
  
  switchScreen('video-screen');
  
  DOM.videoPlayer.load();
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

function handleVideoControls(keyCode, e) {
  const video = DOM.videoPlayer;
  
  // Any button click reveals OSD temporarily
  showVideoOsd();

  if (keyCode === Keys.ENTER || keyCode === Keys.SPACE || keyCode === Keys.PLAYPAUSE) {
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
  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  
  DOM.imageTitle.innerText = item.name;
  DOM.imageViewer.src = streamUrl;
  
  switchScreen('image-screen');
}

function handleImageControls(keyCode, e) {
  // Arrow keys can trigger navigating next/previous images in future. 
  // For now, back button closes, handled globally.
  if (keyCode === Keys.ENTER) {
    e.preventDefault();
    goBack(); // Enter on full image goes back
  }
}

// ----------------------------------------------------
// PLAYBACK: AUDIO PLAYER
// ----------------------------------------------------
function playAudio(item) {
  const streamUrl = `http://${State.serverIp}:${State.port}/stream?path=${encodeURIComponent(item.relativePath)}`;
  
  DOM.audioTitle.innerText = item.name;
  DOM.audioPlayer.src = streamUrl;
  
  switchScreen('audio-screen');
  
  DOM.audioPlayer.load();
  DOM.audioPlayer.play()
    .then(() => {
      DOM.audioStatusText.innerText = "Playing";
    })
    .catch(err => {
      console.error("Audio playback error: ", err);
      showToast("Failed to play audio file.");
      goBack();
    });
}

function handleAudioControls(keyCode, e) {
  const audio = DOM.audioPlayer;
  
  if (keyCode === Keys.ENTER || keyCode === Keys.SPACE || keyCode === Keys.PLAYPAUSE) {
    e.preventDefault();
    if (audio.paused) {
      audio.play();
      DOM.audioStatusText.innerText = "Playing";
    } else {
      audio.pause();
      DOM.audioStatusText.innerText = "Paused";
    }
  }
  else if (keyCode === Keys.PLAY) {
    e.preventDefault();
    audio.play();
    DOM.audioStatusText.innerText = "Playing";
  }
  else if (keyCode === Keys.PAUSE) {
    e.preventDefault();
    audio.pause();
    DOM.audioStatusText.innerText = "Paused";
  }
  else if (keyCode === Keys.RIGHT) {
    e.preventDefault();
    audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0);
  }
  else if (keyCode === Keys.LEFT) {
    e.preventDefault();
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
  }
}

// ----------------------------------------------------
// MEDIA PLAYER MONITORS
// ----------------------------------------------------
function setupMediaPlayerListeners() {
  // Video Listeners
  DOM.videoPlayer.addEventListener('timeupdate', () => {
    const video = DOM.videoPlayer;
    if (video.duration) {
      const percentage = (video.currentTime / video.duration) * 100;
      DOM.videoProgressBar.style.width = `${percentage}%`;
      DOM.videoCurrentTime.innerText = formatTime(video.currentTime);
      DOM.videoDuration.innerText = formatTime(video.duration);
    }
  });

  DOM.videoPlayer.addEventListener('loadedmetadata', () => {
    DOM.videoDuration.innerText = formatTime(DOM.videoPlayer.duration);
  });

  DOM.videoPlayer.addEventListener('ended', () => {
    log("Video playback completed");
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
    }
  });

  DOM.audioPlayer.addEventListener('loadedmetadata', () => {
    DOM.audioDuration.innerText = formatTime(DOM.audioPlayer.duration);
  });

  DOM.audioPlayer.addEventListener('ended', () => {
    DOM.audioStatusText.innerText = "Completed";
    goBack();
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
  
  // Reset Video
  DOM.videoPlayer.pause();
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
