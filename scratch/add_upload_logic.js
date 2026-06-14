const fs = require('fs');
const path = require('path');

const appJsPath = 'c:/Users/Varshan/Downloads/projects/tieen/fastdrop-tv/tizen-tv-app/js/app.js';
const androidAppJsPath = 'c:/Users/Varshan/Downloads/projects/tieen/fastdrop-tv/android-server/app/src/main/assets/client/js/app.js';

let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Insert setupFileUploaderListeners() call in initApp()
content = content.replace(
  '// Initialize focusable elements on the starting screen\n  updateFocusableList();',
  '// Set up File Uploader listeners\n  setupFileUploaderListeners();\n\n  // Initialize focusable elements on the starting screen\n  updateFocusableList();'
);

// 2. Insert updateUploadVisibility() call in connectToServer()
content = content.replace(
  'switchScreen(\'browser-screen\');\n      renderFiles(data);\n      initCastingEngine();',
  'switchScreen(\'browser-screen\');\n      renderFiles(data);\n      updateUploadVisibility();\n      initCastingEngine();'
);

// 3. Insert updateUploadVisibility() call in setAppMode()
const oldSetModeEnd = `      DOM.modeRemoteBtn.classList.add('active-mode');
      showToast("Remote Mode Activated (Cast to your TV)", 1500);
    }
  }
}`;

const newSetModeEnd = `      DOM.modeRemoteBtn.classList.add('active-mode');
      showToast("Remote Mode Activated (Cast to your TV)", 1500);
    }
    updateUploadVisibility();
  }
}`;

content = content.replace(oldSetModeEnd, newSetModeEnd);

// 4. Append the uploader engine code to the end of the file
const uploaderEngine = `
// ----------------------------------------------------
// FILE UPLOADER ENGINE (MOBILE TO PC TRANSFER)
// ----------------------------------------------------
let activeUploadXhr = null;

function setupFileUploaderListeners() {
  const triggerBtn = document.getElementById('trigger-upload-btn');
  const uploader = document.getElementById('file-uploader');
  const cancelBtn = document.getElementById('cancel-upload-btn');

  if (triggerBtn && uploader) {
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploader.click();
    });
    uploader.addEventListener('change', handleFileUpload);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeUploadXhr) {
        activeUploadXhr.abort();
        activeUploadXhr = null;
        showToast("Upload cancelled");
      }
      closeUploadDialog();
    });
  }
}

function updateUploadVisibility() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const fab = document.getElementById('upload-fab');
  if (fab) {
    if (State.appMode === 'remote' || isMobile) {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }
  }
}

function handleFileUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  // Show upload dialog
  const dialog = document.getElementById('upload-dialog');
  if (dialog) {
    dialog.classList.remove('hidden');
    State.currentScreen = 'upload-dialog';
    updateFocusableList();
    focusElement(0); // Focus cancel button
  }

  uploadNextFile(files, 0);
}

function uploadNextFile(files, index) {
  if (index >= files.length) {
    // All uploads complete!
    closeUploadDialog();
    showToast(\`Successfully uploaded \${files.length} file(s)!\`);
    // Reset file input so same files can be uploaded again
    document.getElementById('file-uploader').value = '';
    // Reload files list to show newly uploaded files immediately
    loadFiles();
    return;
  }

  const file = files[index];
  const totalFiles = files.length;
  
  document.getElementById('upload-file-name').innerText = file.name;
  document.getElementById('upload-file-index').innerText = \`(\${index + 1} / \${totalFiles})\`;
  document.getElementById('upload-progress-fill').style.width = '0%';
  document.getElementById('upload-progress-percent').innerText = '0%';
  document.getElementById('upload-speed').innerText = '0.00 MB/s';

  const startTime = Date.now();
  const url = \`\${getBaseUrl()}/api/upload?name=\${encodeURIComponent(file.name)}&path=\${encodeURIComponent(State.currentPath)}\`;

  const xhr = new XMLHttpRequest();
  activeUploadXhr = xhr;

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/octet-stream');

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const percent = Math.floor((event.loaded / event.total) * 100);
      document.getElementById('upload-progress-fill').style.width = \`\${percent}%\`;
      document.getElementById('upload-progress-percent').innerText = \`\${percent}%\`;

      // Speed calculation
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const speed = elapsedSeconds > 0 ? (event.loaded / elapsedSeconds) : 0;
      let speedText = '0.00 KB/s';
      if (speed > 1024 * 1024) {
        speedText = \`\${(speed / (1024 * 1024)).toFixed(2)} MB/s\`;
      } else if (speed > 1024) {
        speedText = \`\${(speed / 1024).toFixed(2)} KB/s\`;
      } else {
        speedText = \`\${speed.toFixed(0)} B/s\`;
      }
      document.getElementById('upload-speed').innerText = speedText;
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      // Success, proceed to next file
      uploadNextFile(files, index + 1);
    } else {
      closeUploadDialog();
      showToast(\`Upload failed for \${file.name}: \${xhr.statusText || 'Server error'}\`);
    }
  });

  xhr.addEventListener('error', () => {
    closeUploadDialog();
    showToast(\`Network error uploading \${file.name}\`);
  });

  xhr.send(file);
}

function closeUploadDialog() {
  const dialog = document.getElementById('upload-dialog');
  if (dialog) {
    dialog.classList.add('hidden');
  }
  // Return to browser screen
  State.currentScreen = 'browser-screen';
  updateFocusableList();
  focusElement(State.lastGridFocusedIndex || 0);
}

// Call remote control listeners once on startup
setupRemoteControlsListeners();
`;

// Replace the old startup call to avoid double listeners execution
content = content.replace('// Call remote control listeners once on startup\nsetupRemoteControlsListeners();', uploaderEngine);

// Write to files
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Successfully updated tizen-tv-app/js/app.js with upload logic.');

fs.writeFileSync(androidAppJsPath, content, 'utf8');
console.log('Successfully updated android-server/app/src/main/assets/client/js/app.js with upload logic.');
