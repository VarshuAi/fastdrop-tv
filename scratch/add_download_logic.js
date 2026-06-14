const fs = require('fs');

const appJsPath = 'c:/Users/Varshan/Downloads/projects/tieen/fastdrop-tv/tizen-tv-app/js/app.js';
const androidAppJsPath = 'c:/Users/Varshan/Downloads/projects/tieen/fastdrop-tv/android-server/app/src/main/assets/client/js/app.js';

let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Insert download button rendering in renderFiles loop
const targetCardCreation = `  // Populate files/folders
  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grid-item focusable';
    card.setAttribute('data-path', item.relativePath);
    card.setAttribute('data-type', item.type);
    card.setAttribute('tabindex', '0');`;

const replacementCardCreation = `  // Populate files/folders
  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grid-item focusable';
    card.setAttribute('data-path', item.relativePath);
    card.setAttribute('data-type', item.type);
    card.setAttribute('tabindex', '0');

    let downloadBtnHtml = '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (item.type !== 'folder' && (State.appMode === 'remote' || isMobile)) {
      downloadBtnHtml = \`
        <button class="card-download-btn" title="Download File">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      \`;
    }`;

content = content.replace(targetCardCreation, replacementCardCreation);

// 2. Insert downloadBtnHtml inside card.innerHTML
const targetCardHtml = `    card.innerHTML = \`
      \${iconHtml}
      <div class="item-name">\${item.name}</div>`;

const replacementCardHtml = `    card.innerHTML = \`
      \${downloadBtnHtml}
      \${iconHtml}
      <div class="item-name">\${item.name}</div>`;

content = content.replace(targetCardHtml, replacementCardHtml);

// 3. Attach click event listener for card-download-btn
const targetCardListener = `    // Handle Selection click
    card.addEventListener('click', () => {
      handleItemSelection(item);
    });`;

const replacementCardListener = `    // Handle download button click
    const dlBtn = card.querySelector('.card-download-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card navigation/cast trigger
        downloadFile(item);
      });
    }

    // Handle Selection click
    card.addEventListener('click', () => {
      handleItemSelection(item);
    });`;

content = content.replace(targetCardListener, replacementCardListener);

// 4. Append downloadFile function to bottom of file
const downloadFunction = `
function downloadFile(item) {
  const url = \`\${getBaseUrl()}/stream?path=\${encodeURIComponent(item.relativePath)}&download=true\`;
  showToast(\`Starting download: \${item.name}...\`, 2000);
  
  // Create an invisible anchor element to trigger browser download manager
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function closeUploadDialog() {`;

// Replace closeUploadDialog with downloadFile followed by closeUploadDialog
content = content.replace('function closeUploadDialog() {', downloadFunction);

// Write to files
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Successfully updated tizen-tv-app/js/app.js with download logic.');

fs.writeFileSync(androidAppJsPath, content, 'utf8');
console.log('Successfully updated android-server/app/src/main/assets/client/js/app.js with download logic.');
