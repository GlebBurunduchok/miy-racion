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
  function outlinedTable(image) {
    const { width: w, height: h } = image,
      { gray } = grayscale(image),
      n = w * h;
    let best = null,
      bestScore = 0;
    for (const threshold of [75, 100, 125]) {
      const seen = new Uint8Array(n),
        queue = new Int32Array(n);
      for (let start = 0; start < n; start++) {
        if (seen[start] || gray[start] > threshold) continue;
        let head = 0,
          tail = 1,
          left = w,
          right = 0,
          top = h,
          bottom = 0;
        queue[0] = start;
        seen[start] = 1;
        while (head < tail) {
          const i = queue[head++],
            x = i % w,
            y = Math.floor(i / w);
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy,
                q = yy * w + xx;
              if (xx < 0 || xx >= w || yy < 0 || yy >= h || seen[q] || gray[q] > threshold)
                continue;
              seen[q] = 1;
              queue[tail++] = q;
            }
        }
        const rw = right - left,
          rh = bottom - top;
        if (rw < w * 0.23 || rh < h * 0.12 || rw / rh < 0.5 || rw / rh > 4 || tail > rw * rh * 0.5)
          continue;
        const edge = (side) => {
          let hit = 0,
            total = 0;
          for (let t = 0.05; t < 0.95; t += 0.02) {
            const x = side < 2 ? (side === 0 ? left : right) : left + rw * t,
              y = side < 2 ? top + rh * t : side === 2 ? top : bottom;
            total++;
            let found = false;
            for (let dy = -3; dy <= 3; dy++)
              for (let dx = -3; dx <= 3; dx++) {
                const xx = Math.round(x) + dx,
                  yy = Math.round(y) + dy;
                if (xx >= 0 && xx < w && yy >= 0 && yy < h && gray[yy * w + xx] <= threshold)
                  found = true;
              }
            if (found) hit++;
          }
          return hit / total;
        };
        const quality = Math.min(...[0, 1, 2, 3].map(edge)),
          score = quality * rw * rh;
        if (quality < 0.72 || score <= bestScore) continue;
        bestScore = score;
        const x = Math.max(0, left - 8),
          y = Math.max(0, top - 8);
        best = {
          x: x / w,
          y: y / h,
          w: (Math.min(w, right + 8) - x) / w,
          h: (Math.min(h, bottom + 8) - y) / h,
          confidence: quality
        };
      }
    }
    return best;
  }
  function detectTable(canvas) {
    const small = document.createElement('canvas'),
      scale = Math.min(1, 800 / Math.max(canvas.width, canvas.height));
    small.width = Math.round(canvas.width * scale);
    small.height = Math.round(canvas.height * scale);
    const ctx = small.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    const pixels = ctx.getImageData(0, 0, small.width, small.height),
      result = outlinedTable(pixels) || findTableRect(pixels);
    return result?.confidence >= 0.9 && result.h >= 0.45 && result.w >= 0.45 ? result : null;
  }
  function preparePixels(image, mode = 'contrast') {
    if (mode === 'raw') return image;
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
  function energyRegion(data, image) {
    const words = root.RationLabel.wordsFrom(data),
      energy = words.filter((w) => /ккал|kcal|kkal|kkan|keal/i.test(w.text));
    if (!energy.length) return null;
    energy.sort((a, b) => b.confidence - a.confidence);
    const e = energy[0],
      h = Math.max(12, e.bbox.y1 - e.bbox.y0),
      cy = (e.bbox.y0 + e.bbox.y1) / 2;
    const line = words.filter(
        (w) =>
          Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - cy) < h * 1.5 &&
          w.bbox.x0 < e.bbox.x1 &&
          w.text.length > 2
      ),
      header = words
        .filter((w) => /100/.test(w.text) && w.bbox.y0 < e.bbox.y0 && e.bbox.y0 - w.bbox.y0 < h * 7)
        .sort((a, b) => b.bbox.y0 - a.bbox.y0)[0];
    const x = Math.max(
        0,
        Math.floor(Math.min(...line.map((w) => w.bbox.x0), e.bbox.x0 - h * 14) - h)
      ),
      y = Math.max(0, Math.floor(header ? header.bbox.y0 - h * 2 : e.bbox.y0 - h * 4)),
      right = Math.min(image.width, Math.ceil(e.bbox.x1 + h * 3)),
      bottom = Math.min(image.height, Math.ceil(e.bbox.y1 + h * 22));
    return right - x > 100 && bottom - y > 100
      ? { x, y, width: right - x, height: bottom - y }
      : null;
  }
  function semanticRegion(data, image) {
    const words = root.RationLabel.wordsFrom(data),
      anchors = [];
    for (const word of words) {
      const key = Object.entries(root.RationLabel.patterns).find(([, rx]) =>
        rx.test(word.text)
      )?.[0];
      if (key && word.confidence !== 0)
        anchors.push({ key, word, y: (word.bbox.y0 + word.bbox.y1) / 2 });
    }
    anchors.sort((a, b) => a.y - b.y);
    const clusters = [];
    for (const anchor of anchors) {
      const h = anchor.word.bbox.y1 - anchor.word.bbox.y0;
      let c = clusters.at(-1);
      if (!c || anchor.y - c.at > Math.max(40, h * 5)) {
        c = { at: anchor.y, anchors: [] };
        clusters.push(c);
      }
      c.anchors.push(anchor);
      c.at = anchor.y;
    }
    const score = (c) =>
      new Set(c.anchors.map((a) => a.key)).size +
      new Set(c.anchors.filter((a) => ['p', 'f', 'c'].includes(a.key)).map((a) => a.key)).size * 3;
    clusters.sort((a, b) => score(b) - score(a));
    const c = clusters[0];
    if (!c || new Set(c.anchors.map((a) => a.key)).size < 3) return null;
    const a = c.anchors.map((a) => a.word),
      hs = a.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b),
      h = hs[Math.floor(hs.length / 2)],
      top = Math.min(...a.map((w) => w.bbox.y0)),
      bottom = Math.max(...a.map((w) => w.bbox.y1)),
      left = Math.min(...a.map((w) => w.bbox.x0));
    const nearby = words.filter(
      (w) =>
        w.bbox.y0 > top - h * 3 &&
        w.bbox.y1 < bottom + h * 3 &&
        w.bbox.x0 > left &&
        /^\d/.test(w.text) &&
        Number(w.text.match(/^\d+(?:[.,]\d+)?/)?.[0].replace(',', '.')) <= 1000
    );
    const x = Math.max(0, Math.floor(left - h)),
      y = Math.max(0, Math.floor(top - h * 5)),
      right = Math.min(
        image.width,
        Math.ceil(Math.max(...a.concat(nearby).map((w) => w.bbox.x1)) + h * 2)
      ),
      end = Math.min(image.height, Math.ceil(bottom + h * 3));
    return right - x > 100 && end - y > 100 ? { x, y, width: right - x, height: end - y } : null;
  }
  function scalePixels(image, factor) {
    const canvas = asCanvas(image),
      large = document.createElement('canvas');
    large.width = Math.round(image.width * factor);
    large.height = Math.round(image.height * factor);
    large.getContext('2d').drawImage(canvas, 0, 0, large.width, large.height);
    return large.getContext('2d').getImageData(0, 0, large.width, large.height);
  }
  function decimalPosition(image) {
    const { gray, hist, width: w, height: h } = grayscale(image),
      threshold = otsu(hist, w * h),
      votes = [];
    for (const limit of [threshold - 16, threshold, threshold + 16]) {
      const seen = new Uint8Array(w * h),
        queue = new Int32Array(w * h),
        parts = [];
      for (let start = 0; start < gray.length; start++) {
        if (seen[start] || gray[start] > limit) continue;
        let head = 0,
          tail = 1,
          x0 = w,
          x1 = 0,
          y0 = h,
          y1 = 0;
        seen[start] = 1;
        queue[0] = start;
        while (head < tail) {
          const i = queue[head++],
            x = i % w,
            y = Math.floor(i / w);
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy,
                q = yy * w + xx;
              if (xx < 0 || xx >= w || yy < 0 || yy >= h || seen[q] || gray[q] > limit) continue;
              seen[q] = 1;
              queue[tail++] = q;
            }
        }
        if (tail > 2 && tail < w * h * 0.4)
          parts.push({ x0, x1, y0, y1, area: tail, height: y1 - y0 + 1 });
      }
      const maxH = Math.max(1, ...parts.map((p) => p.height)),
        digits = parts
          .filter((p) => p.height > maxH * 0.62 && p.area > maxH * 0.2)
          .sort((a, b) => a.x0 - b.x0);
      if (digits.length < 2 || digits.length > 6) continue;
      const baseline = Math.max(...digits.map((p) => p.y1));
      for (let i = 1; i < digits.length; i++) {
        const a = digits[i - 1],
          b = digits[i];
        if (
          parts.some(
            (p) =>
              p.x0 > a.x1 &&
              p.x1 < b.x0 &&
              p.height < maxH * 0.4 &&
              p.x1 - p.x0 < maxH * 0.3 &&
              p.y0 > baseline - maxH * 0.27 &&
              p.y1 < baseline + maxH * 0.4 &&
              p.area < Math.min(a.area, b.area) * 0.3
          )
        )
          votes.push({ position: i, digits: digits.length });
      }
    }
    return (
      votes.find(
        (a) => votes.filter((b) => a.position === b.position && a.digits === b.digits).length >= 2
      ) || null
    );
  }
  function symbolReading(image, word) {
    const sequence = [];
    for (const symbol of word.symbols || []) {
      if (!/^[0-9.,]$/.test(symbol.text)) break;
      if (symbol.bbox.x1 - symbol.bbox.x0 < 3) continue;
      sequence.push(symbol);
    }
    if (sequence.length < 2) return null;
    const tall = sequence
        .filter((s) => /\d/.test(s.text))
        .map((s) => s.bbox.y1 - s.bbox.y0)
        .sort((a, b) => a - b),
      height = tall[Math.floor(tall.length / 2)];
    const firstHeight = sequence[0].bbox.y1 - sequence[0].bbox.y0,
      fontHeight = Math.min(
        ...sequence
          .filter((s) => /^\d$/.test(s.text) && s.bbox.y1 - s.bbox.y0 > firstHeight * 0.5)
          .slice(0, 2)
          .map((s) => s.bbox.y1 - s.bbox.y0)
      );
    let text = '',
      verified = false;
    for (let i = 0; i < sequence.length; i++) {
      const symbol = sequence[i],
        b = symbol.bbox,
        next = sequence[i + 1],
        h = b.y1 - b.y0;
      if (i > 0 && next && h < height * 0.4 && b.y0 > next.bbox.y1 - height * 0.4) {
        text += '.';
        verified = true;
        continue;
      }
      if (
        i > 0 &&
        text.includes('.') &&
        /^\d$/.test(symbol.text) &&
        h < fontHeight * 0.8 &&
        b.x0 - sequence[i - 1].bbox.x1 > fontHeight * 0.24
      )
        break;
      text += symbol.text.replace(',', '.');
      if (/[.,]/.test(symbol.text)) verified = true;
      if (!next || !/^\d$/.test(symbol.text) || !/^\d$/.test(next.text)) continue;
      const baseline = Math.min(b.y1, next.bbox.y1),
        x0 = Math.round(b.x0 + (b.x1 - b.x0) * 0.62),
        x1 = Math.round(next.bbox.x0),
        y0 = Math.round(baseline + height * 0.05),
        y1 = Math.round(baseline + height * 0.3);
      let votes = 0;
      for (const threshold of [90, 115, 140]) {
        let ink = 0;
        for (let y = y0; y < Math.min(image.height, y1); y++)
          for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) {
            const p = (y * image.width + x) * 4;
            if (Math.max(image.data[p], image.data[p + 1], image.data[p + 2]) < threshold) ink++;
          }
        if (ink >= 3 && ink < height * height * 0.08) votes++;
      }
      if (votes >= 2) {
        text += '.';
        verified = true;
      }
    }
    if (!verified || !/^\d+\.\d+$/.test(text)) return null;
    const confidence = Math.min(
      ...sequence.filter((s) => s.bbox.y1 - s.bbox.y0 > height * 0.5).map((s) => s.confidence || 0)
    );
    return confidence >= 85
      ? {
          value: Number(text),
          text,
          decimal: true,
          confidence,
          review: true,
          correctedPunctuation: !sequence.some((s) => /[.,]/.test(s.text))
        }
      : null;
  }
  function chooseNumber(reads, initial) {
    const valid = reads.filter((r) => r && !r.ambiguous),
      groups = new Map();
    for (const r of valid) {
      const k = String(r.value);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const ranked = [...groups.values()].sort(
      (a, b) =>
        b.length - a.length ||
        Math.max(...b.map((r) => r.confidence)) - Math.max(...a.map((r) => r.confidence))
    );
    if (!ranked.length) return null;
    const decimals = ranked.filter((g) => g[0].decimal);
    let top = ranked[0];
    // A decimal reading is stronger evidence than the same digits with punctuation lost.
    for (const g of decimals)
      if (top[0].text.replace(/[.,]/g, '') === g[0].text.replace(/[.,]/g, '')) top = g;
    const conflict = ranked.some((g) => g !== top && g[0].value !== top[0].value),
      winner = top.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    if (
      winner.decimal &&
      valid.some(
        (r) =>
          r.decimal &&
          r.confidence >= 55 &&
          r.value !== winner.value &&
          String(winner.value).startsWith(String(r.value))
      )
    )
      return null;
    if (conflict && top.length < 2 && winner.confidence < 70) return null;
    if (
      !winner.decimal &&
      Number.isFinite(initial) &&
      initial % 1 !== 0 &&
      String(initial).replace('.', '') === winner.text
    )
      return { ...winner, value: initial, decimal: true, review: true };
    return { ...winner, review: conflict || top.length < 2 || winner.confidence < 65 };
  }
  const regionQuality = (item) =>
    (item.word.confidence || 0) +
    (/[.,]/.test(item.word.text) ? 20 : 0) -
    (!/^\d/.test(item.word.text) ? 25 : 0);
  function numericRegions(data) {
    const L = root.RationLabel,
      rows = [
        ...(data.blocks || []).flatMap((b) =>
          (b.paragraphs || []).flatMap((p) =>
            (p.lines || []).map((l) => ({ words: l.words || [] }))
          )
        ),
        ...L.wordRows(data)
      ],
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
        (word) => /^(?:\d|[OoОоIlL](?=[\d.,мМгg])|ОМ)/.test(word.text) && word.bbox.x0 >= maxX * 0.4
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
        if (key === 'kcal' && (n > 1000 || /кдж|kj/i.test(word.text) || !/ккал|kcal/i.test(text)))
          continue;
        candidates.push({ key, word, text });
      }
    }
    const clusters = [];
    for (const item of candidates) {
      const x = item.word.bbox.x0,
        h = item.word.bbox.y1 - item.word.bbox.y0;
      let cluster = clusters
        .filter((c) => Math.abs(c.x - x) < Math.max(15, h * 0.7))
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      if (!cluster) {
        cluster = { x, items: [] };
        clusters.push(cluster);
      }
      cluster.items.push(item);
      cluster.x = cluster.items.reduce((s, r) => s + r.word.bbox.x0, 0) / cluster.items.length;
    }
    const rank = (c) => new Set(c.items.map((i) => i.key)).size;
    clusters.sort((a, b) => rank(b) - rank(a) || b.items.length - a.items.length);
    if (
      !clusters.length ||
      (clusters[1] && rank(clusters[1]) >= 3 && rank(clusters[1]) >= rank(clusters[0]) * 0.8)
    )
      return [];
    const unique = new Map();
    for (const item of clusters[0].items) {
      const old = unique.get(item.key);
      if (!old || regionQuality(item) > regionQuality(old)) unique.set(item.key, item);
    }
    if (!unique.has('kcal')) {
      const energy = candidates
        .filter((i) => i.key === 'kcal')
        .sort((a, b) => regionQuality(b) - regionQuality(a))[0];
      if (energy) unique.set('kcal', energy);
    }
    return [...unique.values()];
  }
  function digitRegion(image, word) {
    const b = word.bbox,
      symbols = word.symbols || [],
      heights = symbols.filter((s) => /\d/.test(s.text)).map((s) => s.bbox.y1 - s.bbox.y0),
      maxH = Math.max(...heights, 1);
    const lastNumeric = symbols.findLastIndex((s) => /^\d$/.test(s.text));
    let end = b.x1;
    for (let i = 0; i < symbols.length; i++) {
      const s = symbols[i],
        h = s.bbox.y1 - s.bbox.y0;
      if (
        i > 0 &&
        !/^[.,]$/.test(s.text) &&
        (/^[gгrкk(]$/i.test(s.text) || (i === lastNumeric && i > 1 && h < maxH * 0.55))
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
      regions = [
        ...(best.sources || [best.data])
          .flatMap((data) => numericRegions(data))
          .reduce((map, item) => {
            const old = map.get(item.key);
            if (!old || regionQuality(item) > regionQuality(old)) map.set(item.key, item);
            return map;
          }, new Map())
          .values()
      ],
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
      const digitScale = Math.min(3, 80 / part.height);
      large.width = Math.max(1, Math.round(part.width * digitScale));
      large.height = Math.max(1, Math.round(part.height * digitScale));
      large.getContext('2d').drawImage(original, 0, 0, large.width, large.height);
      const raw = large
          .getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, large.width, large.height),
        paper = asCanvas(preparePixels(raw, 'paper'));
      const read = async (canvas) => {
        const { data } = await worker.recognize(canvas, {}, { text: true });
        const number = data.text.trim().replace(/\s/g, '');
        if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(number)) return null;
        return {
          ambiguous: /^0\d+$/.test(number),
          value: Number(number.replace(',', '.')),
          confidence: data.confidence,
          decimal: /[.,]/.test(number),
          text: number
        };
      };
      const contrast = asCanvas(preparePixels(raw, 'contrast'));
      const reads = [await read(large), await read(contrast), await read(paper)];
      const marker = key === 'kcal' ? null : decimalPosition(raw);
      const recover = (r) => {
        if (r && !r.decimal && marker && r.text.length === marker.digits) {
          const text = r.text.slice(0, marker.position) + '.' + r.text.slice(marker.position);
          return { ...r, text, value: Number(text), decimal: true, ambiguous: false };
        }
        return r;
      };
      for (let j = 0; j < reads.length; j++) reads[j] = recover(reads[j]);
      const initial = best.result.values[key];
      if (Number.isFinite(initial))
        reads.push({
          value: initial,
          text: String(initial),
          decimal: initial % 1 !== 0,
          confidence: word.confidence || 0
        });
      let value = chooseNumber(reads, best.result.values[key]);
      if (!value || value.review) {
        await worker.setParameters({ tessedit_pageseg_mode: '13' });
        reads.push(recover(await read(contrast)));
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        value = chooseNumber(reads, best.result.values[key]);
      }
      if (value?.review) notes.push(key);
      contrast.width = contrast.height = 1;
      if (!value) {
        delete best.result.values[key];
        best.result.uncertain.push(key);
        notes.push(key);
      }
      let symbolic = symbolReading(pixels, word);
      const decimalDisagreement = value?.decimal && symbolic && value.value !== symbolic.value;
      if (decimalDisagreement) {
        value = null;
        symbolic = null;
        notes.push(key);
      }
      if (
        symbolic &&
        reads.some(
          (r) =>
            r &&
            r.decimal &&
            r.confidence >= 55 &&
            r.value !== symbolic.value &&
            String(symbolic.value).startsWith(String(r.value))
        )
      )
        symbolic = null;
      if (
        symbolic &&
        key !== 'kcal' &&
        (symbolic.correctedPunctuation ||
          !value ||
          value.confidence < 50 ||
          symbolic.value === value.value)
      ) {
        value = symbolic;
        notes.push(key);
      }
      if (!value) {
        delete best.result.values[key];
        best.result.uncertain.push(key);
        notes.push(key);
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
    if (L.core.every((key) => Number.isFinite(best.result.values[key])))
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
    const readings = [];
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
          tessedit_pageseg_mode: '11',
          user_defined_dpi: '300'
        });
        const attempt = async (mode, angle, regionPixels) => {
          check();
          pass++;
          onProgress({ stage: 'read', progress: 0, pass, angle });
          const readPixels = regionPixels || rotatePixels(pixels, angle);
          const oriented = preparePixels(readPixels, mode),
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
              pixels: readPixels,
              angle,
              mode,
              confidence: data.confidence,
              score: L.score(result) + labels * 2,
              passes: pass,
              data
            };
          readings.push(candidate);
          if (
            !best ||
            candidate.score > best.score ||
            (candidate.score === best.score && candidate.confidence > best.confidence)
          )
            best = candidate;
          canvas.width = canvas.height = 1;
          return (
            labels >= 4 || (Number.isFinite(result.values.kcal) && /ккал|kcal/i.test(result.text))
          );
        };
        for (const angle of [0, 90, 270, 180]) if (await attempt('raw', angle)) break;
        if (best) {
          const oriented = best.pixels,
            region = energyRegion(best.data, oriented) || semanticRegion(best.data, oriented),
            part = region ? cropPixels(oriented, region) : oriented,
            factor = Math.min(
              3,
              Math.max(1, 1400 / part.width),
              2300 / Math.max(part.width, part.height)
            ),
            enlarged = scalePixels(part, factor),
            angle = best.angle;
          await worker.setParameters({ tessedit_pageseg_mode: '6' });
          if (region) best = null;
          await attempt('raw', angle, enlarged);
          await attempt('contrast', angle, enlarged);
          await attempt('paper', angle, enlarged);
        }
        if (best) {
          const oriented = best.pixels;
          best.sources = readings.filter((r) => r.pixels === best.pixels).map((r) => r.data);
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
    energyRegion,
    outlinedTable,
    semanticRegion,
    symbolReading,
    decimalPosition,
    chooseNumber,
    numericRegions,
    digitRegion,
    cropPixels
  };
  root.RationOCR = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
