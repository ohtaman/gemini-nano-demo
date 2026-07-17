// Global capture variables
let mediaStream = null;
let captureIntervalId = null;
let isCapturing = false;
let isAnalyzing = false;

// Get the LanguageModel constructor / namespace helper (W3C standard or legacy)
function getLanguageModelAPI() {
  return window.LanguageModel || (window.ai && window.ai.languageModel);
}

// Check AI availability using standard or legacy methods
async function getAIAvailability() {
  const LM = getLanguageModelAPI();
  if (!LM) return 'no';
  
  try {
    // W3C standard availability() check
    if (typeof LM.availability === 'function') {
      const avail = await LM.availability();
      // Translate standard 'unavailable' to 'no' for consistency
      return avail === 'unavailable' ? 'no' : avail;
    }
    // Legacy capabilities() check
    if (typeof LM.capabilities === 'function') {
      const cap = await LM.capabilities();
      return cap.available;
    }
  } catch (e) {
    console.error('Error checking model availability:', e);
  }
  return 'no';
}

// Check for Chrome's built-in Prompt API capabilities
async function checkAICapabilities() {
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const troubleshootingCard = document.getElementById('troubleshooting-card');
  const btnStart = document.getElementById('btn-start');

  // Reset status indicator classes
  statusDot.className = 'status-dot';

  // Check if LanguageModel API is available
  const LM = getLanguageModelAPI();
  if (!LM) {
    statusText.textContent = '非対応 (LanguageModel API が検出されませんでした)';
    statusDot.classList.add('status-unsupported');
    troubleshootingCard.classList.remove('hidden');
    return false;
  }

  try {
    statusDot.classList.add('status-checking');
    statusText.textContent = 'AIモデルの利用可能ステータスを確認中...';
    
    const availability = await getAIAvailability();

    statusDot.className = 'status-dot'; // Reset checking state
    
    if (availability === 'no') {
      statusText.textContent = 'モデルがこのデバイスで利用できません';
      statusDot.classList.add('status-unsupported');
      troubleshootingCard.classList.remove('hidden');
      return false;
    } else if (availability === 'after-download') {
      statusText.textContent = 'モデルのダウンロードが必要です';
      statusDot.classList.add('status-checking');
      troubleshootingCard.classList.remove('hidden');
      
      // Enable capture button (user can start screen sharing while waiting for model download)
      btnStart.removeAttribute('disabled');
      return true;
    } else {
      statusText.textContent = '準備完了 (オンデバイスAI有効)';
      statusDot.classList.add('status-ready');
      troubleshootingCard.classList.add('hidden');
      
      // Enable capture button
      btnStart.removeAttribute('disabled');
      return true;
    }
  } catch (err) {
    console.error('Error checking AI status:', err);
    statusText.textContent = 'エラー: ' + err.message;
    statusDot.classList.add('status-unsupported');
    troubleshootingCard.classList.remove('hidden');
    return false;
  }
}

// Grabs the current frame from the video stream and draws it onto the visible canvas
function captureFrame() {
  const videoElement = document.getElementById('video-stream');
  const canvas = document.getElementById('captured-canvas');
  const noStreamPlaceholder = document.getElementById('no-stream-placeholder');
  const captureTimeSpan = document.getElementById('capture-time');

  if (!mediaStream || mediaStream.getVideoTracks().length === 0) {
    return;
  }

  const videoTrack = mediaStream.getVideoTracks()[0];
  if (videoTrack.readyState !== 'live') {
    return;
  }

  // Ensure stream dimensions are fully ready
  if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    return;
  }

  // Set canvas dimensions to a standard 16:9 box for high-quality display and processing
  canvas.width = 640;
  canvas.height = 360;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Hide placeholder card
  noStreamPlaceholder.classList.add('hidden');

  // Update capture timestamp label
  const now = new Date().toLocaleTimeString();
  captureTimeSpan.textContent = now;

  // Automatically trigger analysis if not currently analyzing
  if (!isAnalyzing) {
    analyzeCurrentScreen();
  }
}

// Start window capture stream and periodic processing
async function startCapture() {
  const intervalInput = document.getElementById('capture-interval');
  const intervalSec = parseInt(intervalInput.value, 10) || 5;
  const intervalMs = intervalSec * 1000;

  try {
    isAnalyzing = false;
    // Prompt browser for display stream
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" },
      audio: false
    });

    const videoElement = document.getElementById('video-stream');
    videoElement.srcObject = mediaStream;
    videoElement.play().catch(e => console.warn("Video play failed:", e));
    
    // Adjust UI buttons
    document.getElementById('btn-start').classList.add('hidden');
    document.getElementById('btn-stop').classList.remove('hidden');
    
    isCapturing = true;

    // Detect when user clicks standard browser "Stop Sharing" button
    mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopCapture();
    });

    // Run first screenshot capture immediately when metadata loads
    videoElement.addEventListener('loadedmetadata', () => {
      setTimeout(captureFrame, 300);
    }, { once: true });

    // Set interval for periodic screenshot capture (grabs frame only, does NOT prompt AI)
    captureIntervalId = setInterval(captureFrame, intervalMs);

  } catch (err) {
    console.error('Error starting screen capture:', err);
    alert('画面キャプチャを開始できませんでした: ' + err.message);
  }
}

// Stop window capture stream
function stopCapture() {
  if (captureIntervalId) {
    clearInterval(captureIntervalId);
    captureIntervalId = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  const videoElement = document.getElementById('video-stream');
  videoElement.srcObject = null;
  
  // Clear canvas
  const canvas = document.getElementById('captured-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById('no-stream-placeholder').classList.remove('hidden');
  document.getElementById('btn-start').classList.remove('hidden');
  document.getElementById('btn-stop').classList.add('hidden');
  document.getElementById('capture-time').textContent = '-';
  
  isCapturing = false;
  isAnalyzing = false;
}

// Capture current frame and send it to Chrome's Gemini Nano Model
async function analyzeCurrentScreen() {
  const canvas = document.getElementById('captured-canvas');
  const promptText = document.getElementById('ai-prompt').value;
  const latestContent = document.getElementById('latest-analysis-content');
  
  if (!mediaStream) {
    alert("キャプチャが開始されていません。");
    return;
  }

  if (isAnalyzing) return;
  isAnalyzing = true;

  // Pause periodic capture during analysis to prevent texture updates and lock-up crashes
  if (captureIntervalId) {
    clearInterval(captureIntervalId);
    captureIntervalId = null;
  }

  // Show subtle loader status indicator next to heading
  const statusSpan = document.getElementById('analysis-status');
  if (statusSpan) {
    statusSpan.style.display = 'inline';
  }

  // Clear placeholder on first analysis, but keep previous results visible on subsequent ticks
  if (latestContent.querySelector('.empty-state')) {
    latestContent.classList.remove('empty');
    latestContent.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding: 20px;">
        <p style="font-weight: 500; color: var(--google-blue);">🤖 Gemini Nano が最初の解析を実行中...</p>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">オンデバイスでの処理のため、数秒〜数十秒かかる場合があります...</p>
      </div>
    `;
  }

  const timestamp = new Date().toLocaleTimeString();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
  let session = null;
  let bitmap = null;

  try {
    // 1. Create a fresh session for this image to prevent visual token context build-up slowness
    const LM = getLanguageModelAPI();
    session = await LM.create({
      expectedInputs: [{ type: 'image' }]
    });

    // Create an immutable GPU-backed snapshot bitmap to bypass slow CPU pixel read-back and speed up inference
    bitmap = await createImageBitmap(canvas);

    const responseText = await session.prompt([
      {
        role: "user",
        content: [
          { type: "text", value: promptText },
          { type: "image", value: bitmap }
        ]
      }
    ]);

    // Parse and show result (safely parse Markdown via Marked library)
    const htmlContent = marked.parse(responseText);
    latestContent.innerHTML = htmlContent;

    // Log this success event to history timeline
    addHistoryItem(timestamp, dataUrl, htmlContent, true);

  } catch (err) {
    console.error('Screen analysis error:', err);
    latestContent.innerHTML = `
      <div style="padding: 16px;">
        <p style="color: var(--color-danger); font-weight: 600;">⚠️ 解析失敗</p>
        <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">${err.message}</p>
      </div>
    `;
    
    // If screenshot succeeded but AI failed, add failing record to timeline
    if (dataUrl) {
      addHistoryItem(
        timestamp, 
        dataUrl, 
        `<p style="color: var(--color-danger); font-weight: 500;">画面キャプチャの解析に失敗しました: ${err.message}</p>`, 
        false
      );
    }
  } finally {
    if (bitmap) {
      try {
        bitmap.close();
      } catch (e) {}
    }
    if (session) {
      try {
        session.destroy();
      } catch (e) {}
    }
    isAnalyzing = false;

    // Hide subtle status indicator
    if (statusSpan) {
      statusSpan.style.display = 'none';
    }

    // Resume periodic capture if capturing is still enabled and interval is not running
    if (isCapturing && !captureIntervalId) {
      const intervalInput = document.getElementById('capture-interval');
      const intervalSec = parseInt(intervalInput.value, 10) || 5;
      const intervalMs = intervalSec * 1000;
      captureIntervalId = setInterval(captureFrame, intervalMs);
    }
  }
}

// Add analysis block to history log
function addHistoryItem(timestamp, dataUrl, htmlContent, isSuccess) {
  const historyList = document.getElementById('history-list');
  
  // Remove blank state label
  const emptyState = historyList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const historyItem = document.createElement('div');
  historyItem.className = 'history-item';
  
  const statusText = isSuccess ? '成功' : 'エラー';
  const statusClass = isSuccess ? 'status-success' : 'status-error';

  historyItem.innerHTML = `
    <div class="history-header">
      <span class="history-timestamp">解析時刻: ${timestamp}</span>
      <span class="history-status ${statusClass}">${statusText}</span>
    </div>
    <div class="history-body">
      <div class="history-thumbnail-container" onclick="openZoomModal('${dataUrl}')">
        <img src="${dataUrl}" class="history-thumbnail" alt="キャプチャ画像">
        <span class="history-thumbnail-zoom-hint">🔍 拡大</span>
      </div>
      <div class="history-details">
        ${htmlContent}
      </div>
    </div>
  `;

  // Prepend so that newest appears first
  historyList.insertBefore(historyItem, historyList.firstChild);
}

// Image preview zoom modal controllers
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalClose = document.getElementById('modal-close');

function openZoomModal(src) {
  modalImg.src = src;
  modal.classList.add('visible');
}

modalClose.addEventListener('click', () => {
  modal.classList.remove('visible');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('visible');
  }
});

// Hook event listeners safely
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
if (btnStart) btnStart.addEventListener('click', startCapture);
if (btnStop) btnStop.addEventListener('click', stopCapture);

// Run initialization check
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    checkAICapabilities();
  });
} else {
  checkAICapabilities();
}
