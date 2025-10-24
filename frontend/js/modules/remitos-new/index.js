// Minimal scaffold for new remitos module
export function createRemitosModule({ showView, apiUrl, getToken } = {}) {
  let lastReport = null;

  function initialize() {
    // noop: wire up later — the host app can call attachFilePicker or call pickAndSendPhotos()
  }

  function handleMaintenanceSaved(report) {
    lastReport = report ? JSON.parse(JSON.stringify(report)) : null;
  }

  // Resize an image File to a max width and return base64 + mime + filename
  async function fileToResizedBase64(file, { maxWidth = 1200, quality = 0.8 } = {}) {
    if (!file) return null;
    // If running outside browser (tests) skip
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      // attempt to read as-is is unsupported in non-browser environment
      throw new Error('fileToResizedBase64 requires a browser environment');
    }
    const img = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Failed reading file'));
      fr.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed loading image')); 
        image.src = fr.result;
      };
      fr.readAsDataURL(file);
    });

    const canvas = document.createElement('canvas');
    const ratio = img.width ? Math.min(1, maxWidth / img.width) : 1;
    canvas.width = Math.round((img.width || maxWidth) * ratio);
    canvas.height = Math.round((img.height || maxWidth) * ratio);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // use JPEG for photos; preserve PNG if original is PNG with transparency
    const isPng = file.type === 'image/png';
    const mime = isPng ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, quality);
    const base64 = dataUrl.split(',')[1];
    // include the generated pixel dimensions so the server can decide display size
    return {
      base64Data: base64,
      mimeType: mime,
      fileName: file.name || `photo.${mime.split('/')[1]}`,
      width: canvas.width,
      height: canvas.height,
      origWidth: img.naturalWidth || img.width,
      origHeight: img.naturalHeight || img.height
    };
  }

  // Get original image dimensions (pixels) without resizing
  async function getImageDimensions(file) {
    if (!file) return { width: 0, height: 0 };
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('getImageDimensions requires a browser environment');
    }
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Failed reading file'));
      fr.onload = () => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
        image.onerror = () => reject(new Error('Failed loading image'));
        image.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // Resize an image file by a percentage (0-1) and return base64 + metadata
  async function resizeFileToPercent(file, percent = 1, { mimeType = null, quality = 0.8 } = {}) {
    if (!file) return null;
    const dims = await getImageDimensions(file);
    const newW = Math.max(1, Math.round(dims.width * percent));
    const newH = Math.max(1, Math.round(dims.height * percent));

    // draw to canvas with target dims
    const img = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Failed reading file'));
      fr.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed loading image'));
        image.src = fr.result;
      };
      fr.readAsDataURL(file);
    });

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newW, newH);

    const isPng = file.type === 'image/png';
    const chosenMime = mimeType || (isPng ? 'image/png' : 'image/jpeg');
    const dataUrl = canvas.toDataURL(chosenMime, quality);
    const base64 = dataUrl.split(',')[1];
    return {
      base64Data: base64,
      mimeType: chosenMime,
      fileName: file.name || `photo.${chosenMime.split('/')[1]}`,
      width: newW,
      height: newH,
      origWidth: dims.width,
      origHeight: dims.height
    };
  }

  // Resize an image file to fit within maxWidth/maxHeight preserving aspect ratio
  async function resizeFileToFit(file, { maxWidth = null, maxHeight = null, mimeType = null, quality = 0.8, square = false, background = '#ffffff' } = {}) {
    if (!file) return null;
    const dims = await getImageDimensions(file);
    let scale = 1;
    if (maxWidth && dims.width > 0) scale = Math.min(scale, maxWidth / dims.width);
    if (maxHeight && dims.height > 0) scale = Math.min(scale, maxHeight / dims.height);
    scale = Math.min(1, scale);
  let targetW = Math.max(1, Math.round(dims.width * scale));
  let targetH = Math.max(1, Math.round(dims.height * scale));

    // draw to canvas with target dims
    const img = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Failed reading file'));
      fr.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed loading image'));
        image.src = fr.result;
      };
      fr.readAsDataURL(file);
    });

    const canvas = document.createElement('canvas');
    if (square && maxWidth && maxHeight) {
      // create fixed square canvas and draw scaled image centered with background
      canvas.width = maxWidth;
      canvas.height = maxHeight;
    } else {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    if (square && maxWidth && maxHeight) {
      // fill background
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // compute centered position
      const dx = Math.round((canvas.width - targetW) / 2);
      const dy = Math.round((canvas.height - targetH) / 2);
      ctx.drawImage(img, dx, dy, targetW, targetH);
      // for metadata, report the visible image area as targetW/targetH but width/height returned as canvas size
    } else {
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }

    const isPng = file.type === 'image/png';
    const chosenMime = mimeType || (isPng ? 'image/png' : 'image/jpeg');
    const dataUrl = canvas.toDataURL(chosenMime, quality);
    const base64 = dataUrl.split(',')[1];
    return {
      base64Data: base64,
      mimeType: chosenMime,
      fileName: file.name || `photo.${chosenMime.split('/')[1]}`,
      // if square, we return the canvas size so server will insert a square thumbnail
      width: canvas.width,
      height: canvas.height,
      origWidth: dims.width,
      origHeight: dims.height,
      visibleWidth: targetW,
      visibleHeight: targetH
    };
  }

  // Open file picker and return array of { base64Data, mimeType, fileName }
  function openFilePicker({ multiple = true, accept = 'image/*', maxFiles = 4, percent = null, quality = 0.8, thumbMaxWidth = 100, thumbMaxHeight = 100, singleMaxWidth = 1000, singleMaxHeight = 800 } = {}) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve([]);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []).slice(0, maxFiles);
        const results = [];
        // Decide sizing strategy based on number of selected files
        const useSingleSizing = files.length === 1;
        for (const f of files) {
          try {
            let r;
            if (percent && typeof percent === 'number' && percent > 0 && percent <= 1) {
              r = await resizeFileToPercent(f, percent, { quality });
            } else if (useSingleSizing) {
              // resize to a larger single image size (fit within singleMaxWidth/singleMaxHeight)
              r = await resizeFileToFit(f, { maxWidth: singleMaxWidth, maxHeight: singleMaxHeight, quality, square: false });
            } else {
              // resize to thumbnail bounds for grid (fit within thumbMaxWidth/thumbMaxHeight) and produce square padded thumbs
              r = await resizeFileToFit(f, { maxWidth: thumbMaxWidth, maxHeight: thumbMaxHeight, quality, square: true });
            }
            results.push(r);
          } catch (err) {
            console.warn('Skipping file', f.name, err);
          }
        }
        resolve(results);
      };
      // trigger
      input.click();
    });
  }

  // Convenience: pick photos then send a remito using crear_remito_new
  async function pickAndSendPhotos({ observaciones = '', percent = null, quality = 0.8 } = {}) {
    const fotos = await openFilePicker({ multiple: true, maxFiles: 4, percent, quality });
    if (!fotos || fotos.length === 0) return { result: 'cancelled' };
    return sendRemitoWithFotos({ fotos, observaciones });
  }

  // Send fotos (base64 objects) to the new crear_remito_new endpoint
  async function sendRemitoWithFotos({ fotos = [], observaciones = '' } = {}) {
    if (!lastReport) throw new Error('No report available');
    const token = typeof getToken === 'function' ? getToken() : '';
    const payload = { action: 'crear_remito_new', token, reporteData: lastReport, fotos, observaciones };
    const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  // Backwards-compatible generator: accept already-prepared fotos array or none.
  async function generateRemito({ fotos = [], observaciones = '' } = {}) {
    // if fotos contain File objects (from input) convert them
    const preparedFotos = [];
    for (const f of fotos) {
      if (f instanceof File) {
        const r = await fileToResizedBase64(f);
        preparedFotos.push(r);
      } else if (f && f.base64Data) {
        preparedFotos.push(f);
      }
    }
    // If there are photos, call the new endpoint to ensure DocumentApp flow
    if (preparedFotos.length > 0) {
      return sendRemitoWithFotos({ fotos: preparedFotos, observaciones });
    }
    // Otherwise, fallback to old action (if still desired)
    if (!lastReport) throw new Error('No report available');
    const token = typeof getToken === 'function' ? getToken() : '';
    const payload = { action: 'crear_remito', token, reporteData: lastReport, fotos: preparedFotos, observaciones };
    const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  return { initialize, handleMaintenanceSaved, generateRemito, openFilePicker, pickAndSendPhotos, fileToResizedBase64, resizeFileToPercent, getImageDimensions };
}

// Test helper: sends a tiny 1x1 PNG (transparent) to the new endpoint
export async function sendTestRemito(apiUrl, token) {
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const fotos = [{ base64Data: tinyPngBase64, mimeType: 'image/png', fileName: 'test.png' }];
  const payload = { action: 'crear_remito_new', token, reporteData: { cliente: 'Prueba' }, observaciones: 'test-e2e', fotos };
  const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(payload) });
  return resp.json();
}
