/* Keep personal pictures small; the diary stores each photo only once. */
window.RationMedia = {
  async prepare(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)
      throw Error('Invalid image');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas'),
        scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.5, 0.35]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= 120000) return data;
      }
      throw Error('Image too large');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
};
