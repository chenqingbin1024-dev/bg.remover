const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const removeBgBtn = document.getElementById('removeBgBtn');
const previewSection = document.getElementById('previewSection');
const originalPreview = document.getElementById('originalPreview');
const processedPreview = document.getElementById('processedPreview');
const downloadOriginalBtn = document.getElementById('downloadOriginal');
const downloadProcessedBtn = document.getElementById('downloadProcessed');
const downloadProcessedJpgBtn = document.getElementById('downloadProcessedJpg');
const previewStateOverlay = document.getElementById('previewStateOverlay');
const previewStateText = document.getElementById('previewStateText');
const loadingSpinner = document.getElementById('loadingSpinner');
const uploadStep = document.getElementById('uploadStep');
const processingStep = document.getElementById('processingStep');
const completeStep = document.getElementById('completeStep');
const viewOriginalStepBtn = document.getElementById('viewOriginalStep');
const viewResultStepBtn = document.getElementById('viewResultStep');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// 顶部拖动对比组件
const heroCompare = document.getElementById('heroCompare');
const heroCompareInner = document.querySelector('.hero-compare-inner');
const heroBefore = document.getElementById('heroBefore');
const heroAfter = document.getElementById('heroAfter');
const heroHandle = document.getElementById('heroHandle');

let selectedFile;
let originalDataUrl = '';
let processedDataUrl = '';

const MAX_SIZE = 12 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// 点击按钮：只触发一次文件选择，并阻止事件冒泡到 label，避免再次触发
selectFileBtn.addEventListener('click', event => {
  event.stopPropagation();
  fileInput.click();
});

// 点击整个上传区域（label），也触发一次文件选择
dropzone.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', event => {
  const file = event.dataTransfer.files?.[0];
  if (file) {
    handleFile(file);
  }
});

fileInput.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) {
    handleFile(file);
  }
});

removeBgBtn.addEventListener('click', async () => {
  if (!selectedFile || !originalDataUrl) return;
  await processRemoveBg();
});

downloadOriginalBtn.addEventListener('click', () => {
  if (!originalDataUrl) return;
  triggerDownload(originalDataUrl, selectedFile?.name || 'original.png');
});

downloadProcessedBtn.addEventListener('click', () => {
  if (!processedDataUrl) return;
  triggerDownload(processedDataUrl, buildFileName('background-removed.png'));
});

downloadProcessedJpgBtn.addEventListener('click', async () => {
  if (!processedDataUrl) return;
  const jpgDataUrl = await convertPngToJpg(processedDataUrl);
  triggerDownload(jpgDataUrl, buildFileName('background-removed.jpg'));
});

viewOriginalStepBtn?.addEventListener('click', () => {
  scrollToPreview();
});

viewResultStepBtn?.addEventListener('click', () => {
  scrollToPreview();
});

// 初始状态：等待上传
setWorkflowState('idle');
// 初始化预览状态（如果预览区域已显示）
if (previewSection && !previewSection.hidden) {
  updatePreviewState('waiting');
}

// ===== 顶部对比拖动交互 =====
let isDraggingCompare = false;

function updateCompareSplit(clientX) {
  if (!heroCompareInner) return;
  const rect = heroCompareInner.getBoundingClientRect();
  let x = clientX - rect.left;
  x = Math.max(0, Math.min(x, rect.width));
  const percent = (x / rect.width) * 100;
  heroCompareInner.style.setProperty('--split', `${percent}%`);
}

if (heroCompareInner && heroHandle) {
  const startDrag = event => {
    isDraggingCompare = true;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    updateCompareSplit(clientX);
  };

  const moveDrag = event => {
    if (!isDraggingCompare) return;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    updateCompareSplit(clientX);
  };

  const endDrag = () => {
    isDraggingCompare = false;
  };

  heroHandle.addEventListener('mousedown', startDrag);
  heroCompare.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);

  heroHandle.addEventListener('touchstart', startDrag, { passive: true });
  heroCompare.addEventListener('touchstart', startDrag, { passive: true });
  window.addEventListener('touchmove', moveDrag, { passive: true });
  window.addEventListener('touchend', endDrag);
}

function handleFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    showToast('仅支持 PNG / JPG / WebP 格式');
    return;
  }

  if (file.size > MAX_SIZE) {
    showToast('图片大小不能超过 12MB');
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = event => {
    originalDataUrl = event.target?.result;
    processedDataUrl = '';
    originalPreview.src = originalDataUrl;
    processedPreview.removeAttribute('src');
    previewSection.hidden = false;
    removeBgBtn.disabled = false;
    setWorkflowState('ready');
    updatePreviewState('waiting');

    if (viewOriginalStepBtn) {
      viewOriginalStepBtn.hidden = false;
    }
    if (viewResultStepBtn) {
      viewResultStepBtn.hidden = true;
    }
  };
  reader.readAsDataURL(file);
}

async function processRemoveBg() {
  setWorkflowState('processing');
  toggleButtonLoading(true);
  updatePreviewState('loading');

  try {
    const response = await fetch('/api/remove-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: originalDataUrl,
        fileName: selectedFile?.name || 'upload.png'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.message || '去背景失败');
    }

    const data = await response.json();
    processedDataUrl = data.processedImage;
    processedPreview.src = processedDataUrl;
    previewSection.hidden = false;
    setWorkflowState('done');
    updatePreviewState('completed');
    if (viewResultStepBtn) {
      viewResultStepBtn.hidden = false;
    }
    showToast('处理完成，可以下载啦 ✅');
  } catch (error) {
    console.error(error);
    setWorkflowState('error');
    updatePreviewState('waiting');
    showToast(error.message || '处理失败，请稍后重试');
  } finally {
    toggleButtonLoading(false);
  }
}

function toggleButtonLoading(isLoading) {
  removeBgBtn.disabled = isLoading;
  if (isLoading) {
    removeBgBtn.textContent = 'AI 正在抠图...';
  } else {
    removeBgBtn.textContent = '开始去背景';
  }
}

function setWorkflowState(state) {
  const baseClass = 'step';

  // 重置
  uploadStep.className = baseClass;
  processingStep.className = baseClass;
  completeStep.className = baseClass;

  switch (state) {
    case 'idle': {
      uploadStep.classList.add('active');
      break;
    }
    case 'ready': {
      uploadStep.classList.add('active', 'step--done');
      break;
    }
    case 'processing': {
      uploadStep.classList.add('step--done');
      processingStep.classList.add('active', 'step--processing');
      break;
    }
    case 'done': {
      uploadStep.classList.add('step--done');
      processingStep.classList.add('step--done');
      completeStep.classList.add('active', 'step--done');
      break;
    }
    case 'error': {
      uploadStep.classList.add('step--done');
      processingStep.classList.add('active', 'step--error');
      break;
    }
    default: {
      uploadStep.classList.add('active');
    }
  }
}

function scrollToPreview() {
  if (!previewSection) return;
  previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function buildFileName(defaultName) {
  if (!selectedFile?.name) return defaultName;
  const base = selectedFile.name.replace(/\.[a-zA-Z0-9]+$/, '');
  return `${base}-bg-removed${pathExt(defaultName)}`;
}

function pathExt(name) {
  const match = name.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function updatePreviewState(state) {
  if (!previewStateOverlay || !previewStateText || !loadingSpinner) return;

  switch (state) {
    case 'waiting':
      previewStateOverlay.hidden = false;
      previewStateText.textContent = '请点击"开始去背景"';
      loadingSpinner.hidden = true;
      if (downloadProcessedBtn) downloadProcessedBtn.hidden = true;
      break;
    case 'loading':
      previewStateOverlay.hidden = false;
      previewStateText.textContent = 'AI生成中';
      loadingSpinner.hidden = false;
      if (downloadProcessedBtn) downloadProcessedBtn.hidden = true;
      break;
    case 'completed':
      previewStateOverlay.hidden = true;
      if (downloadProcessedBtn) downloadProcessedBtn.hidden = false;
      break;
    default:
      previewStateOverlay.hidden = false;
      previewStateText.textContent = '请点击"开始去背景"';
      loadingSpinner.hidden = true;
      if (downloadProcessedBtn) downloadProcessedBtn.hidden = true;
  }
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.hidden = false;
  toast.style.opacity = 1;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => (toast.hidden = true), 300);
  }, 2500);
}

function convertPngToJpg(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = dataUrl;
  });
}

