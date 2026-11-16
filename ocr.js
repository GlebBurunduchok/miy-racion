/* On-device label recognition. No image upload, no nutritional guesses. */
(function (root) {
  'use strict';
  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let left = 0,
      weight = 0,
      best = -1,
      threshold = 127;
    for (let i = 0; i < 256; i++) {
      weight += hist[i];
      if (!weight) continue;
      const right = total - weight;
      if (!right) break;
      left += i * hist[i];
      const delta = left / weight - (sum - left) / right,
        variance = weight * right * delta * delta;
      if (variance > best) {
        best = variance;
        threshold = i;
      }
    }
    return threshold;
  }
  function grayscale(image) {
    const { width, height, data } = image,
      gray = new Uint8Array(width * height),
      hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = Math.round(0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]);
      hist[gray[i]]++;
    }
    return { gray, hist, width, height };
  }
  function findTableRect(image) {
    const { gray, hist, width: w, height: h } = grayscale(image);
    if (w < 60 || h < 60) return null;
    const threshold = Math.min(otsu(hist, w * h), 155),
      dark = (x, y) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= w || y < 0 || y >= h) return false;
        return gray[y * w + x] < threshold;
      };
    const lines = [];
    for (let degrees = -10; degrees <= 10; degrees += 2) {
      const slope = Math.tan((degrees * Math.PI) / 180);
      for (let intercept = 0; intercept < h; intercept += 2) {
        let start = -1,
          last = -1,
          gap = 0,
          bestStart = 0,
          bestEnd = 0,
          ink = 0,
          bestInk = 0;
        for (let x = 0; x < w; x++) {
          const y = intercept + (x - w / 2) * slope,
            hit = dark(x, y) || dark(x, y - 1) || dark(x, y + 1);
          if (hit) {
            if (start < 0) start = x;
            last = x;
            gap = 0;
            ink++;
            if (last - start > bestEnd - bestStart) {
              bestStart = start;
              bestEnd = last;
              bestInk = ink;
            }
          } else if (start >= 0 && ++gap > 2) {
            start = -1;
            ink = 0;
          }
        }
        const length = bestEnd - bestStart,
          ratio = length > 0 ? bestInk / (length + 1) : 0;
        if (length > w * 0.32 && ratio > 0.7)
          lines.push({ left: bestStart, right: bestEnd, y: intercept, slope, ratio, length });
      }
    }
    const distinct = [];
    for (const line of lines.sort((a, b) => b.length * b.ratio - a.length * a.ratio)) {
      if (
        !distinct.some(
          (other) => Math.abs(other.y - line.y) < 7 && Math.abs(other.left - line.left) < w * 0.15
        )
      )
        distinct.push(line);
      if (distinct.length === 30) break;
    }
    let best = null,
      bestScore = 0;
    const edgeScore = (top, bottom, side) => {
      let count = 0,
        hits = 0;
      const x0 = top[side],
        x1 = bottom[side];
      const y0 = top.y + (x0 - w / 2) * top.slope,
        y1 = bottom.y + (x1 - w / 2) * bottom.slope;
      for (let t = 0.02; t < 0.98; t += 0.02) {
        const x = x0 + (x1 - x0) * t,
          y = y0 + (y1 - y0) * t;
        count++;
        if (dark(x, y) || dark(x - 1, y) || dark(x + 1, y) || dark(x - 2, y) || dark(x + 2, y))
          hits++;
      }
      return hits / count;
    };
    for (const a of distinct)
      for (const b of distinct) {
        if (a.y >= b.y || b.y - a.y < h * 0.12 || Math.abs(a.slope - b.slope) > 0.11) continue;
        if (Math.abs(a.left - b.left) > w * 0.14 || Math.abs(a.right - b.right) > w * 0.14)
          continue;
        const left = edgeScore(a, b, 'left'),
          right = edgeScore(a, b, 'right');
        if (left < 0.4 || right < 0.4) continue;
        const area = (Math.min(a.right, b.right) - Math.max(a.left, b.left)) * (b.y - a.y),
          score = area * Math.sqrt(left * right);
        if (score <= bestScore) continue;
        const x0 = Math.min(a.left, b.left),
          x1 = Math.max(a.right, b.right);
        const ys = [
          a.y + (x0 - w / 2) * a.slope,
          a.y + (x1 - w / 2) * a.slope,
          b.y + (x0 - w / 2) * b.slope,
          b.y + (x1 - w / 2) * b.slope
        ];
        const padX = w * 0.018,
          padY = h * 0.018,
          x = Math.max(0, x0 - padX),
          y = Math.max(0, Math.min(...ys) - padY);
        best = {
          x: x / w,
          y: y / h,
          w: (Math.min(w, x1 + padX) - x) / w,
          h: (Math.min(h, Math.max(...ys) + padY) - y) / h,
          confidence: Math.min(left, right)
        };
        bestScore = score;
      }
    if (best && best.confidence < 0.85) {
      const oldRight = best.x + best.w;
      best.x = Math.max(0, best.x - 0.2);
      best.w = Math.min(1, oldRight + 0.22) - best.x;
      const bottom = best.y + best.h;
      best.y = Math.max(0, best.y - 0.025);
      best.h = Math.min(1, bottom + 0.025) - best.y;
    }
    return best;
  }
  function detectTable(canvas) {
    const small = document.createElement('canvas'),
      scale = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
    small.width = Math.round(canvas.width * scale);
    small.height = Math.round(canvas.height * scale);
    const ctx = small.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    return findTableRect(ctx.getImageData(0, 0, small.width, small.height));
  }
  function preparePixels(image, mode = 'contrast') {
    const { gray, hist, width, height } = grayscale(image),
      data = new Uint8ClampedArray(width * height * 4),
      n = gray.length;
    let lo = 0,
      hi = 255,
      sum = 0;
    while (lo < 254 && sum < n * 0.01) sum += hist[lo++];
    sum = 0;
    while (hi > lo + 1 && sum < n * 0.01) sum += hist[hi--];
    if (mode === 'paper') {
      const red = new Uint8Array(n),
        rh = new Uint32Array(256);
      for (let i = 0; i < n; i++) {
        red[i] = Math.max(image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]);
        rh[red[i]]++;
      }
      const threshold = Math.max(105, Math.min(165, otsu(rh, n) - 12));
      const black = new Uint8Array(n),
        labels = new Int32Array(n),
        queue = new Int32Array(n),
        components = [null];
      for (let i = 0; i < n; i++) black[i] = red[i] < threshold ? 1 : 0;
      for (let start = 0; start < n; start++) {
        if (!black[start] || labels[start]) continue;
        const id = components.length;
        let head = 0,
          tail = 1,
          x0 = width,
          x1 = 0,
          y0 = height,
          y1 = 0;
        queue[0] = start;
        labels[start] = id;
        while (head < tail) {
          const p = queue[head++],
            x = p % width,
            y = Math.floor(p / width);
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
              const q = yy * width + xx;
              if (black[q] && !labels[q]) {
                labels[q] = id;
                queue[tail++] = q;
              }
            }
        }
        const cw = x1 - x0 + 1,
          ch = y1 - y0 + 1,
          minH = Math.max(8, Math.round(Math.min(width, height) / 70)),
          border =
            (cw > width * 0.65 && ch < 12) ||
            (ch > height * 0.6 && cw < 12) ||
            (cw > width * 0.65 && ch > height * 0.45);
        components.push({ x0, x1, y0, y1, area: tail, keep: !border && ch >= minH && tail >= 14 });
      }
      const grid = new Map(),
        cell = 32;
      components.forEach((c, id) => {
        if (!c?.keep) return;
        for (let gy = Math.floor((c.y0 - 9) / cell); gy <= Math.floor((c.y1 + 9) / cell); gy++)
          for (let gx = Math.floor((c.x0 - 9) / cell); gx <= Math.floor((c.x1 + 9) / cell); gx++) {
            const key = gx + ',' + gy;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(id);
          }
      });
      for (const c of components) {
        if (!c || c.keep || c.area > 24) continue;
        const x = (c.x0 + c.x1) / 2,
          y = (c.y0 + c.y1) / 2,
          near = grid.get(Math.floor(x / cell) + ',' + Math.floor(y / cell)) || [];
        if (
          near.some((id) => {
            const b = components[id];
            return x > b.x0 - 8 && x < b.x1 + 8 && y > b.y0 - 3 && y < b.y1 + 5;
          })
        )
          c.keep = true;
      }
      for (let i = 0; i < n; i++) {
        const value = labels[i] && components[labels[i]].keep ? 0 : 255,
          p = i * 4;
        data[p] = data[p + 1] = data[p + 2] = value;
        data[p + 3] = 255;
      }
    } else if (mode === 'binary') {
      const stride = width + 1,
        integral = new Uint32Array((height + 1) * stride);
      for (let y = 1; y <= height; y++) {
        let row = 0;
        for (let x = 1; x <= width; x++) {
          row += gray[(y - 1) * width + x - 1];
          integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
        }
      }
      const radius = Math.max(12, Math.round(Math.min(width, height) / 40));
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const x0 = Math.max(0, x - radius),
            y0 = Math.max(0, y - radius),
            x1 = Math.min(width, x + radius + 1),
            y1 = Math.min(height, y + radius + 1),
            mean =
              (integral[y1 * stride + x1] -
                integral[y0 * stride + x1] -
                integral[y1 * stride + x0] +
                integral[y0 * stride + x0]) /
              ((x1 - x0) * (y1 - y0));
          const p = (y * width + x) * 4,
            center = gray[y * width + x],
            smooth =
              (center * 4 +
                gray[y * width + Math.max(0, x - 1)] +
                gray[y * width + Math.min(width - 1, x + 1)] +
                gray[Math.max(0, y - 1) * width + x] +
                gray[Math.min(height - 1, y + 1) * width + x]) /
              8,
            value = smooth < mean - 22 ? 0 : 255;
          data[p] = data[p + 1] = data[p + 2] = value;
          data[p + 3] = 255;
        }
    } else
      for (let i = 0; i < n; i++) {
        const p = i * 4,
          value = Math.round(255 * Math.max(0, Math.min(1, (gray[i] - lo) / Math.max(1, hi - lo))));
        data[p] = data[p + 1] = data[p + 2] = value;
        data[p + 3] = 255;
      }
    return { width, height, data };
  }
  function rotatePixels(image, angle) {
    angle = ((angle % 360) + 360) % 360;
    if (angle === 0) return image;
    const w = angle === 180 ? image.width : image.height,
      h = angle === 180 ? image.height : image.width,
      data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const nx = angle === 90 ? image.height - 1 - y : angle === 180 ? image.width - 1 - x : y,
          ny = angle === 90 ? x : angle === 180 ? image.height - 1 - y : image.width - 1 - x;
        const from = (y * image.width + x) * 4,
          to = (ny * w + nx) * 4;
        data[to] = image.data[from];
        data[to + 1] = image.data[from + 1];
        data[to + 2] = image.data[from + 2];
        data[to + 3] = image.data[from + 3];
      }
    return { width: w, height: h, data };
  }
  function asCanvas(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d'),
      pixels = ctx.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }
  function numericRegions(data) {
    const L = root.RationLabel,
      rows = L.wordRows(data),
      all = L.wordsFrom(data),
      maxX = Math.max(1, ...all.map((w) => w.bbox?.x1 || 0)),
      candidates = [];
    for (const row of rows) {
      row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const text = row.words.map((w) => w.text).join(' ');
      let key = Object.entries(L.patterns).find(([, rx]) => rx.test(text))?.[0];
      if (!key && /ккал|kcal|energy|енергетич|энергетич/i.test(text)) key = 'kcal';
      if (!key) continue;
      const numbers = row.words.filter(
        (word) => /^\d/.test(word.text) && word.bbox.x0 >= maxX * 0.48
      );
      for (let i = 0; i < numbers.length; i++) {
        let word = numbers[i];
        const next = numbers[i + 1],
          height = word.bbox.y1 - word.bbox.y0;
        if (
          word.text === '0' &&
          next &&
          next.bbox.x0 - word.bbox.x1 < height &&
          /^\d{1,3}(?:\D|$)/.test(next.text)
        ) {
          word = {
            ...word,
            text: word.text + ' ' + next.text,
            bbox: {
              x0: word.bbox.x0,
              y0: Math.min(word.bbox.y0, next.bbox.y0),
              x1: next.bbox.x1,
              y1: Math.max(word.bbox.y1, next.bbox.y1)
            },
            symbols: [...(word.symbols || []), ...(next.symbols || [])]
          };
          i++;
        }
        const n = Number(word.text.match(/^\d+(?:[.,]\d+)?/)?.[0].replace(',', '.'));
        if (key === 'kcal' && (n > 1000 || !/ккал|kcal/i.test(text))) continue;
        candidates.push({ key, word, text });
      }
    }
    const clusters = [];
    for (const item of candidates) {
      const x = item.word.bbox.x0,
        h = item.word.bbox.y1 - item.word.bbox.y0;
      let cluster = clusters.find((c) => Math.abs(c.x - x) < Math.max(15, h));
      if (!cluster) {
        cluster = { x, items: [] };
        clusters.push(cluster);
      }
      cluster.items.push(item);
      cluster.x = cluster.items.reduce((s, r) => s + r.word.bbox.x0, 0) / cluster.items.length;
    }
    clusters.sort((a, b) => b.items.length - a.items.length);
    if (
      !clusters.length ||
      (clusters[1]?.items.length >= 3 &&
        clusters[1].items.length >= clusters[0].items.length * 0.65)
    )
      return [];
    return [...new Map(clusters[0].items.map((item) => [item.key, item])).values()];
  }
  function digitRegion(image, word) {
    const b = word.bbox,
      symbols = word.symbols || [],
      heights = symbols.filter((s) => /\d/.test(s.text)).map((s) => s.bbox.y1 - s.bbox.y0),
      maxH = Math.max(...heights, 1);
    let end = b.x1;
    for (let i = 0; i < symbols.length; i++) {
      const s = symbols[i],
        h = s.bbox.y1 - s.bbox.y0;
      if (
        i > 0 &&
        !/^[.,]$/.test(s.text) &&
        (!/^\d$/.test(s.text) || (h < maxH * 0.78 && h > maxH * 0.3))
      ) {
        end = s.bbox.x0 - 1;
        break;
      }
    }
    const x = Math.max(0, Math.floor(b.x0) - 4),
      y = Math.max(0, Math.floor(b.y0) - 5),
      right = Math.min(image.width, Math.ceil(end) + 3),
      bottom = Math.min(image.height, Math.ceil(b.y1) + 6);
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  }
  function cropPixels(image, region) {
    const data = new Uint8ClampedArray(region.width * region.height * 4);
    for (let y = 0; y < region.height; y++) {
      const start = ((y + region.y) * image.width + region.x) * 4;
      data.set(image.data.subarray(start, start + region.width * 4), y * region.width * 4);
    }
    return { width: region.width, height: region.height, data };
  }
  async function refineNumbers(worker, pixels, best, signal, onProgress) {
    const L = root.RationLabel,
      regions = numericRegions(best.data),
      fields = {},
      notes = [];
    if (regions.length < 3) return;
    await worker.reinitialize('eng', 1);
    await worker.setParameters({
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: '0123456789.,',
      user_defined_dpi: '300'
    });
    for (let i = 0; i < regions.length; i++) {
      if (signal?.aborted) throw Error('OCR_ABORT');
      const { key, word, text } = regions[i],
        region = digitRegion(pixels, word),
        part = cropPixels(pixels, region),
        original = asCanvas(part),
        large = document.createElement('canvas');
      large.width = Math.max(1, Math.round(part.width * 3));
      large.height = Math.max(1, Math.round(part.height * 3));
      large.getContext('2d').drawImage(original, 0, 0, large.width, large.height);
      const raw = large
          .getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, large.width, large.height),
        paper = asCanvas(preparePixels(raw, 'paper'));
      const read = async (canvas) => {
        const { data } = await worker.recognize(canvas, {}, { text: true });
        const number = data.text.trim().replace(/\s/g, '');
        if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(number) || /^0\d+$/.test(number)) return null;
        return {
          value: Number(number.replace(',', '.')),
          confidence: data.confidence,
          decimal: /[.,]/.test(number),
          text: number
        };
      };
      let value = await read(paper);
      if (!value || value.confidence < 55) {
        const alternate = await read(large);
        if (alternate) {
          if (!value) value = alternate;
          else if (value.value !== alternate.value) {
            notes.push(key);
            if (!value.decimal && alternate.decimal) value = alternate;
          } else if (alternate.confidence > value.confidence) value = alternate;
        }
      }
      if (!value) {
        await worker.setParameters({ tessedit_pageseg_mode: '13' });
        const contrast = asCanvas(preparePixels(raw, 'contrast'));
        value = await read(contrast);
        if (!value) value = await read(paper);
        contrast.width = contrast.height = 1;
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        if (value) notes.push(key);
      }
      const micro = ['calcium', 'iron', 'potassium', 'vitaminC', 'sodium'].includes(key);
      if (value) {
        let factor = 1;
        if (micro) {
          if (/мкг|mcg|µg/i.test(text)) factor = 0.001;
          else if (/мг|mg/i.test(text)) factor = 1;
          else if (/\b(?:g|г)\b/i.test(text)) factor = 1000;
          else factor = null;
        } else if (/мг|mg/i.test(text)) factor = 0.001;
        if (
          factor !== null &&
          Number.isFinite(value.value) &&
          value.value >= 0 &&
          value.value * factor <= (key === 'kcal' ? 1000 : micro ? 100000 : 100)
        ) {
          fields[key] = value.confidence;
          if (value.confidence < 65) notes.push(key);
          best.result.values[key] = value.value * factor;
          best.result.evidence[key] = text;
          best.result.uncertain = best.result.uncertain.filter((k) => k !== key);
        }
      }
      onProgress({
        stage: 'numbers',
        progress: (i + 1) / regions.length,
        pass: best.passes,
        field: key
      });
      original.width =
        original.height =
        paper.width =
        paper.height =
        large.width =
        large.height =
          1;
    }
    best.result.lowConfidence = [...new Set(notes)];
    best.result.fieldConfidence = fields;
    if (
      !best.result.uncertain.length &&
      L.core.every((key) => Number.isFinite(best.result.values[key]))
    )
      best.result.multipleColumns = false;
  }

  async function run({
    image,
    engine,
    language = 'ukr+eng',
    localBase,
    signal,
    onProgress = () => {},
    timeoutMs = 150000
  }) {
    const L = root.RationLabel;
    let worker,
      closed = false,
      stage = 'model',
      timer,
      pass = 0;
    const abort = () => {
      closed = true;
      worker?.terminate().catch(() => {});
    };
    const check = () => {
      if (closed || signal?.aborted) throw Error('OCR_ABORT');
    };
    const ctx = image.getContext('2d', { willReadFrequently: true }),
      pixels = ctx.getImageData(0, 0, image.width, image.height);
    const options = {
      logger: (m) => {
        if (!closed)
          onProgress({
            stage: stage === 'model' ? 'model' : 'read',
            progress: m.progress || 0,
            pass,
            angle: best?.angle || 0
          });
      }
    };
    if (localBase)
      Object.assign(options, {
        workerPath: new URL('vendor/ocr/worker.min.js', localBase).href,
        corePath: new URL('vendor/ocr/core/', localBase).href,
        langPath: new URL('vendor/ocr/lang', localBase).href
      });
    let best = null;
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const job = (async () => {
        check();
        const created = await engine.createWorker(language, 1, options);
        if (closed || signal?.aborted) {
          await created.terminate();
          throw Error('OCR_ABORT');
        }
        worker = created;
        stage = 'read';
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: '6',
          user_defined_dpi: '300'
        });
        const attempt = async (mode, angle) => {
          check();
          pass++;
          onProgress({ stage: 'read', progress: 0, pass, angle });
          const oriented = preparePixels(rotatePixels(pixels, angle), mode),
            canvas = asCanvas(oriented);
          const { data } = await worker.recognize(
            canvas,
            { rotateAuto: false },
            { text: true, blocks: true, tsv: true }
          );
          check();
          const result = L.parseOutput(data),
            labels = Object.values(L.patterns).filter((rx) =>
              rx.test(result.rows || result.text)
            ).length,
            candidate = {
              result,
              angle,
              mode,
              confidence: data.confidence,
              score: L.score(result) + labels * 2,
              passes: pass,
              data
            };
          if (
            !best ||
            candidate.score > best.score ||
            (candidate.score === best.score && candidate.confidence > best.confidence)
          )
            best = candidate;
          canvas.width = canvas.height = 1;
          return labels >= 4;
        };
        for (const angle of [0, 90, 270, 180]) if (await attempt('paper', angle)) break;
        if (best) {
          const oriented = rotatePixels(pixels, best.angle);
          await refineNumbers(worker, oriented, best, signal, onProgress);
          if (!best.result.basis) {
            await worker.reinitialize(language, 1);
            await worker.setParameters({
              tessedit_pageseg_mode: '11',
              tessedit_char_whitelist: '',
              preserve_interword_spaces: '1'
            });
            const canvas = asCanvas(preparePixels(oriented));
            const { data } = await worker.recognize(canvas, {}, { text: true });
            const header = L.parse(data.text);
            if (header.basis) {
              best.result.basis = header.basis;
              best.result.has100 = true;
            }
            canvas.width = canvas.height = 1;
            if (!best.result.basis) {
              const top = cropPixels(oriented, {
                x: 0,
                y: 0,
                width: oriented.width,
                height: Math.max(1, Math.round(oriented.height * 0.26))
              });
              const headerCanvas = asCanvas(top);
              await worker.setParameters({ tessedit_pageseg_mode: '6' });
              const { data: headerData } = await worker.recognize(headerCanvas, {}, { text: true });
              const recovered = L.parse(headerData.text);
              if (recovered.basis) {
                best.result.basis = recovered.basis;
                best.result.has100 = true;
              }
              headerCanvas.width = headerCanvas.height = 1;
            }
          }
        }
        check();
        return {
          result: best.result,
          angle: best.angle,
          confidence: best.confidence,
          passes: pass
        };
      })();
      return await Promise.race([
        job,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            abort();
            reject(Error('OCR_TIMEOUT'));
          }, timeoutMs);
        })
      ]);
    } catch (error) {
      if (/^OCR_/.test(error.message)) throw error;
      const details = String(error?.message || error).toLowerCase();
      throw Error(
        /memory|out of bounds|allocation|abort\(/.test(details)
          ? 'OCR_MEMORY'
          : stage === 'model'
            ? 'OCR_MODEL'
            : 'OCR_READ'
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      closed = true;
      await worker?.terminate().catch(() => {});
    }
  }
  const api = {
    run,
    detectTable,
    findTableRect,
    preparePixels,
    rotatePixels,
    grayscale,
    numericRegions,
    digitRegion,
    cropPixels
  };
  root.RationOCR = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
