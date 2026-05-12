// Offscreen document — handles Canvas-based image compression
// Receives a PNG dataUrl, scales to max 1920px width, returns compressed JPEG

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'COPY_TEXT_OFFSCREEN') {
    copyTextToClipboard(msg.text)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.type === 'COMPRESS_IMAGE') {
    compressImage(msg.dataUrl, msg.maxWidth || 1920, msg.quality || 0.82)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function compressImage(dataUrl, maxWidth, quality) {
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > maxWidth) {
    const ratio = maxWidth / w;
    w = maxWidth;
    h = Math.round(h * ratio);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  let compressed = canvas.toDataURL('image/jpeg', quality);
  let sizeKB = Math.round((compressed.length * 3) / 4 / 1024);

  if (sizeKB > 350 && quality > 0.5) {
    compressed = canvas.toDataURL('image/jpeg', 0.65);
    sizeKB = Math.round((compressed.length * 3) / 4 / 1024);
  }

  return {
    success: true,
    dataUrl: compressed,
    width: w,
    height: h,
    sizeKB: sizeKB
  };
}

async function copyTextToClipboard(text) {
  // Use the Clipboard API in the offscreen document context
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback: textarea + execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('execCommand copy failed');
}
