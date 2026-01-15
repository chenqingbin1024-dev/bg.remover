// 导入 Supabase 认证
import { auth } from '/supabase.js';

// 导入 Supabase 认证
import { auth } from '/supabase.js';

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
const deleteOriginalBtn = document.getElementById('deleteOriginalBtn');
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

// 认证相关元素
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

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

if (deleteOriginalBtn) {
  deleteOriginalBtn.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    console.log('删除原图按钮被点击');
    try {
      resetToInitialState();
    } catch (error) {
      console.error('删除原图时出错:', error);
    }
  });
}

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

// ===== 认证功能 =====
// 初始化认证状态
async function initAuth() {
  // 先显示登录按钮（如果配置缺失也能看到按钮）
  if (loginBtn) loginBtn.hidden = false;
  if (logoutBtn) logoutBtn.hidden = true;
  if (userInfo) userInfo.hidden = true;
  
  try {
    // 检查 Supabase 配置
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.warn('Supabase 配置缺失，登录功能不可用');
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.title = 'Supabase 配置缺失，请检查环境变量';
      }
      return;
    }
    
    if (loginBtn) loginBtn.disabled = false;
    
    // 检查当前会话
    const { data: { session }, error: sessionError } = await auth.getSession();
    if (sessionError) {
      console.error('获取会话失败:', sessionError);
      updateAuthUI(null);
      return;
    }
    
    if (session) {
      updateAuthUI(session.user);
    } else {
      updateAuthUI(null);
    }

    // 监听认证状态变化
    auth.onAuthStateChange((event, session) => {
      console.log('认证状态变化:', event, session?.user?.email);
      if (session?.user) {
        updateAuthUI(session.user);
      } else {
        updateAuthUI(null);
      }
    });
  } catch (error) {
    console.error('初始化认证失败:', error);
    updateAuthUI(null);
    // 确保登录按钮可见
    if (loginBtn) {
      loginBtn.hidden = false;
      loginBtn.disabled = false;
    }
  }
}

// 更新认证 UI
function updateAuthUI(user) {
  if (user) {
    // 用户已登录
    if (loginBtn) loginBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    if (userInfo) userInfo.hidden = false;
    
    // 显示用户信息
    if (userAvatar) {
      userAvatar.src = user.user_metadata?.avatar_url || 
                      user.user_metadata?.picture || 
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      userAvatar.alt = user.user_metadata?.full_name || user.email || '用户头像';
    }
    if (userName) {
      userName.textContent = user.user_metadata?.full_name || 
                            user.user_metadata?.name || 
                            user.email?.split('@')[0] || 
                            '用户';
    }
  } else {
    // 用户未登录
    if (loginBtn) loginBtn.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;
    if (userInfo) userInfo.hidden = true;
  }
}

// 登录按钮事件
if (loginBtn) {
  console.log('登录按钮已找到，绑定事件监听器');
  loginBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('登录按钮被点击');
    
    // 检查 Supabase 配置
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error('Supabase 配置缺失:', {
        url: window.SUPABASE_URL,
        key: window.SUPABASE_ANON_KEY ? '已设置' : '未设置'
      });
      showToast('Supabase 配置缺失，请检查环境变量');
      return;
    }
    
    try {
      loginBtn.disabled = true;
      const originalHTML = loginBtn.innerHTML;
      loginBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-7-4a5 5 0 1 1 10 0A5 5 0 0 1 5 14zm0 0c0 2.5 2 4.5 4.5 4.5S14 16.5 14 14"/></svg> 登录中...';
      
      console.log('开始调用 signInWithGoogle');
      const { data, error } = await auth.signInWithGoogle();
      
      if (error) {
        console.error('登录失败:', error);
        showToast(`登录失败: ${error.message || '请重试'}`);
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalHTML;
      } else {
        console.log('登录成功，重定向中...', data);
        // signInWithOAuth 会触发重定向，所以这里不需要额外处理
      }
    } catch (error) {
      console.error('登录错误:', error);
      showToast(`登录出错: ${error.message || '请重试'}`);
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-7-4a5 5 0 1 1 10 0A5 5 0 0 1 5 14zm0 0c0 2.5 2 4.5 4.5 4.5S14 16.5 14 14"/></svg> Google 登录';
    }
  });
} else {
  console.warn('登录按钮未找到');
}

// 登出按钮事件
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      logoutBtn.disabled = true;
      const { error } = await auth.signOut();
      if (error) {
        console.error('登出失败:', error);
        showToast('登出失败，请重试');
        logoutBtn.disabled = false;
      } else {
        showToast('已成功登出');
        updateAuthUI(null);
      }
    } catch (error) {
      console.error('登出错误:', error);
      showToast('登出出错，请重试');
      logoutBtn.disabled = false;
    }
  });
}

// 初始化认证
initAuth();

// ===== 顶部对比拖动交互 =====
let isDraggingCompare = false;

function updateCompareSplit(clientX) {
  if (!heroCompareInner) {
    console.warn('heroCompareInner 未找到');
    return;
  }
  const rect = heroCompareInner.getBoundingClientRect();
  let x = clientX - rect.left;
  x = Math.max(0, Math.min(x, rect.width));
  const percent = (x / rect.width) * 100;
  heroCompareInner.style.setProperty('--split', `${percent}%`);
  // 确保滑块按钮也跟随移动
  if (heroHandle) {
    heroHandle.style.left = `${percent}%`;
  }
}

// 初始化拖动交互
if (heroCompareInner && heroHandle) {
  console.log('初始化拖动对比交互', { heroCompareInner, heroHandle });
  
  const startDrag = event => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingCompare = true;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    updateCompareSplit(clientX);
  };

  const moveDrag = event => {
    if (!isDraggingCompare) return;
    event.preventDefault();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    updateCompareSplit(clientX);
  };

  const endDrag = event => {
    if (isDraggingCompare) {
      isDraggingCompare = false;
    }
  };

  // 在滑块按钮上开始拖动
  heroHandle.addEventListener('mousedown', startDrag);
  heroHandle.addEventListener('touchstart', startDrag, { passive: false });
  
  // 在对比区域内点击时，直接移动到该位置并开始拖动
  heroCompareInner.addEventListener('mousedown', (event) => {
    // 如果点击的不是按钮本身，才开始拖动
    if (event.target !== heroHandle && !heroHandle.contains(event.target)) {
      startDrag(event);
    }
  });
  heroCompareInner.addEventListener('touchstart', (event) => {
    if (event.target !== heroHandle && !heroHandle.contains(event.target)) {
      startDrag(event);
    }
  }, { passive: false });
  
  // 全局监听移动和结束事件
  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', moveDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
} else {
  console.warn('拖动对比组件未找到', { heroCompareInner, heroHandle });
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
    setWorkflowState('ready');
    updatePreviewState('waiting');

    // 显示"开始去背景"按钮和"删除原图"按钮，隐藏"下载原图"按钮
    if (removeBgBtn) {
      removeBgBtn.hidden = false;
    }
    if (downloadOriginalBtn) {
      downloadOriginalBtn.hidden = true;
    }
    if (deleteOriginalBtn) {
      deleteOriginalBtn.hidden = false;
    }

    // 自动滚动到对比预览区域
    setTimeout(() => {
      scrollToPreview();
    }, 100);
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

    // 隐藏"开始去背景"按钮，显示"下载原图"按钮，保持"删除原图"按钮可见
    if (removeBgBtn) {
      removeBgBtn.hidden = true;
    }
    if (downloadOriginalBtn) {
      downloadOriginalBtn.hidden = false;
    }
    if (deleteOriginalBtn) {
      deleteOriginalBtn.hidden = false;
    }

    showToast('处理完成，可以下载啦 ✅');
  } catch (error) {
    console.error(error);
    setWorkflowState('error');
    updatePreviewState('waiting');
    // 处理失败时，恢复按钮状态
    if (removeBgBtn) {
      removeBgBtn.hidden = false;
      removeBgBtn.textContent = '开始去背景';
    }
    if (downloadOriginalBtn) {
      downloadOriginalBtn.hidden = true;
    }
    if (deleteOriginalBtn) {
      deleteOriginalBtn.hidden = false;
    }
    showToast(error.message || '处理失败，请稍后重试');
  } finally {
    toggleButtonLoading(false);
  }
}

function toggleButtonLoading(isLoading) {
  if (!removeBgBtn) return;
  if (isLoading) {
    removeBgBtn.textContent = 'AI 正在抠图...';
    removeBgBtn.disabled = true;
  } else {
    removeBgBtn.textContent = '开始去背景';
    removeBgBtn.disabled = false;
  }
}

function setWorkflowState(state) {
  // 步骤提示已移除，此函数保留以避免报错，但不执行任何操作
  return;
}

function scrollToPreview() {
  if (!previewSection) return;
  previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetToInitialState() {
  console.log('开始重置到初始状态');
  
  // 清空数据
  selectedFile = null;
  originalDataUrl = '';
  processedDataUrl = '';

  // 清空图片
  if (originalPreview) {
    originalPreview.src = '';
    originalPreview.removeAttribute('src');
  }
  if (processedPreview) {
    processedPreview.src = '';
    processedPreview.removeAttribute('src');
  }

  // 清空文件输入
  if (fileInput) {
    fileInput.value = '';
  }

  // 隐藏预览区域
  if (previewSection) {
    previewSection.hidden = true;
  }

  // 重置按钮状态
  if (removeBgBtn) {
    removeBgBtn.hidden = true;
    removeBgBtn.textContent = '开始去背景';
    removeBgBtn.disabled = false;
  }
  if (downloadOriginalBtn) {
    downloadOriginalBtn.hidden = true;
  }
  if (deleteOriginalBtn) {
    deleteOriginalBtn.hidden = true;
  }
  if (downloadProcessedBtn) {
    downloadProcessedBtn.hidden = true;
  }

  // 重置预览状态
  if (previewStateOverlay) {
    previewStateOverlay.hidden = false;
  }
  if (previewStateText) {
    previewStateText.textContent = '请点击"开始去背景"';
  }
  if (loadingSpinner) {
    loadingSpinner.hidden = true;
  }
  updatePreviewState('waiting');

  // 重置工作流状态
  setWorkflowState('idle');

  // 显示提示
  showToast('已删除原图，可以重新上传');
  
  // 滚动回顶部
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);
  
  console.log('重置完成');
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

