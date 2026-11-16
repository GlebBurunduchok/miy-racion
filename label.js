/* Nutrition labels: multilingual aliases, printed rows and OCR word geometry. */
(function (root) {
  'use strict';
  const patterns = {
    saturatedFat:
      /насичен[а-яіїєґ]*\s*(?:жир[а-яіїєґ]*\s*)?(?:кислот[а-яіїєґ]*)?|насыщенн[а-яё]*\s*(?:жир[а-яё]*\s*)?(?:кислот[а-яё]*)?|saturat(?:ed|es)(?:\s+fat)?/i,
    sugars: /цукр[а-яіїєґ]*|сахар[а-яё]*|sugars?/i,
    fiber:
      /(?:харчов[а-яіїєґ]*\s+)?волокн[а-яіїєґ]*|клітковин[а-яіїєґ]*|клетчатк[а-яё]*|(?:dietary\s+)?fib(?:er|re)/i,
    salt: /с[іiї]ль|соли?|salt/i,
    sodium: /натрі[йюя]|натри[йя]|sodium/i,
    calcium: /кальці[йюя]|кальци[йя]|calcium/i,
    potassium: /калі[йюя]|кали[йя]|potassium/i,
    iron: /заліз[ао]|желез[ао]|iron/i,
    vitaminC: /вітамін\s*[cс]|витамин\s*[cс]|vitamin\s*c/i,
    p: /б[іiї]л[кн][а-яіїєґ]*|белк[а-яё]*|proteins?/i,
    f: /жир[а-яіїєґё]*|(?:total\s+)?fats?/i,
    c: /вуглевод[а-яіїєґ]*|углевод[а-яё]*|carbohydrates?/i
  };
  const micros = ['calcium', 'potassium', 'iron', 'vitaminC', 'sodium'];
  const core = ['kcal', 'p', 'f', 'c'];
  const num = '(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
  const numberMatches = (text) =>
    [...text.matchAll(new RegExp(num, 'g'))].map((m) => ({
      value: Number(m[0].replace(',', '.')),
      index: m.index,
      raw: m[0]
    }));
  const normalized = (text) =>
    String(text || '')
      .normalize('NFKC')
      .replace(/\u00a0/g, ' ')
      .replace(/[，]/g, ',')
      .replace(/([0-9])\s*([,.])\s*([0-9])/g, '$1$2$3');
  function energyValue(line) {
    const pair = line.match(
      new RegExp(
        '(кдж|kj|ккал|kcal)\\s*[/|]\\s*(ккал|kcal|кдж|kj)\\s*[):;,—–-]*\\s*(' +
          num +
          ')\\s*[/|]\\s*(' +
          num +
          ')',
        'i'
      )
    );
    if (pair) {
      const v = Number((/ккал|kcal/i.test(pair[2]) ? pair[4] : pair[3]).replace(',', '.'));
      return v <= 1000 ? { value: v } : {};
    }
    const values = [...line.matchAll(new RegExp('(' + num + ')\\s*(?:ккал|kcal)', 'gi'))].map((m) =>
      Number(m[1].replace(',', '.'))
    );
    // A unit may be repeated in translation: "431 ккал (kcal)" is one value.
    if (!values.length) {
      const before = line.match(
        new RegExp('(?:ккал|kcal)(?:\\s*\\((?:ккал|kcal)\\))?\\s*[():/|—–-]*\\s*(' + num + ')', 'i')
      );
      if (before) values.push(Number(before[1].replace(',', '.')));
    }
    const unique = [...new Set(values)];
    return unique.length > 1
      ? { multiple: true }
      : unique.length === 1 && unique[0] <= 1000
        ? { value: unique[0] }
        : {};
  }
  function parse(text) {
    const clean = normalized(text),
      basisMatch = clean.match(
        /(?:на|per|in|у|в)?\s*100\s*(мл|ml|г(?:рам[а-яіїєґ]*)?|g(?:rams?)?)(?![a-zа-яіїєґ])/i
      );
    const translatedBasis = clean.match(/100\s*(?:r|г|g)?\s*\(\s*g\s*\)/i);
    const basis = basisMatch
      ? /мл|ml/i.test(basisMatch[1])
        ? 'ml'
        : 'g'
      : translatedBasis
        ? 'g'
        : null;
    const values = {},
      evidence = {},
      uncertain = new Set();
    let multipleColumns = false;
    const lines = clean
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const original = lines[i],
        line = original.replace(/100\s*(?:мл|ml|г|g)(?![a-zа-яіїєґ])/gi, '');
      const energyLine =
        line + (i + 1 < lines.length && /^\s*\d/.test(lines[i + 1]) ? ' ' + lines[i + 1] : '');
      const energy = energyValue(energyLine);
      if (energy.multiple) {
        multipleColumns = true;
        uncertain.add('kcal');
        delete values.kcal;
      } else if (energy.value !== undefined && !uncertain.has('kcal')) {
        values.kcal = energy.value;
        evidence.kcal = original;
      }
      for (const [key, pattern] of Object.entries(patterns)) {
        const matches = [...line.matchAll(new RegExp(pattern.source, 'ig'))];
        if (!matches.length) continue;
        // Match the final translated label, e.g. "Жири / Fats", not just its first word.
        const match = matches.at(-1);
        let tail = line.slice(match.index + match[0].length).replace(/\([^)]*\)/g, ' ');
        tail = tail.replace(/^[\s:;|/—–-]*[ОоOo]\s*([,.])\s*(\d)/, '0$1$2');
        if (
          !numberMatches(tail).length &&
          i + 1 < lines.length &&
          /^\s*[<≤\d.,]/.test(lines[i + 1])
        )
          tail += ' ' + lines[i + 1];
        const ns = numberMatches(tail).filter(
          (n) => !/^\s*%/.test(tail.slice(n.index + n.raw.length))
        );
        if (ns.length !== 1 || /[<≤>≥]|(?:^|\s)-\s*\d|менше|менее|less than/i.test(tail)) {
          if (ns.length > 1) multipleColumns = true;
          uncertain.add(key);
          break;
        }
        if (/^0\d+$/.test(ns[0].raw)) {
          uncertain.add(key);
          break;
        }
        const prefix = tail.slice(0, ns[0].index).replace(/[\s:;,/|—–-]/g, '');
        if (prefix && !/^(?:г|g|мг|mg|мкг|mcg|µg|total)$/i.test(prefix)) {
          uncertain.add(key);
          break;
        }
        const micro = micros.includes(key);
        let value = ns[0].value;
        const unit = tail.slice(ns[0].index + ns[0].raw.length).trim();
        if (/^[ОоOo](?![a-z])/i.test(unit)) {
          uncertain.add(key);
          break;
        }
        if (micro) {
          if (/^(?:мкг|µg|mcg)/i.test(unit)) value /= 1000;
          else if (/^(?:г|g)(?![a-zа-я])/i.test(unit)) value *= 1000;
          else if (!/^(?:мг|mg)/i.test(unit)) {
            uncertain.add(key);
            break;
          }
        } else if (/^(?:мг|mg)/i.test(unit)) value /= 1000;
        if (Number.isFinite(value) && value >= 0 && value <= (micro ? 100000 : 100)) {
          values[key] = value;
          evidence[key] = original;
          uncertain.delete(key);
        } else uncertain.add(key);
        break;
      }
    }
    return {
      values,
      evidence,
      basis,
      has100: !!basisMatch || !!translatedBasis,
      multipleColumns,
      uncertain: [...uncertain],
      text: clean
    };
  }
  function wordsFrom(data) {
    if (Array.isArray(data?.words)) return data.words;
    const words = [];
    for (const block of data?.blocks || [])
      for (const paragraph of block.paragraphs || [])
        for (const line of paragraph.lines || [])
          for (const word of line.words || []) words.push(word);
    if (words.length) return words;
    if (typeof data?.tsv === 'string')
      for (const row of data.tsv.split('\n').slice(1)) {
        const cols = row.split('\t');
        if (cols[0] !== '5' || cols.length < 12 || !cols[11].trim()) continue;
        words.push({
          text: cols.slice(11).join('\t'),
          confidence: Number(cols[10]),
          bbox: {
            x0: Number(cols[6]),
            y0: Number(cols[7]),
            x1: Number(cols[6]) + Number(cols[8]),
            y1: Number(cols[7]) + Number(cols[9])
          }
        });
      }
    return words;
  }
  function wordRows(data) {
    const words = wordsFrom(data).filter(
      (w) => w?.text?.trim() && w.bbox && Number.isFinite(w.bbox.y0) && w.bbox.y1 > w.bbox.y0
    );
    if (!words.length) return [];
    const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b),
      median = heights[Math.floor(heights.length / 2)];
    const rows = [];
    for (const word of words.sort((a, b) => a.bbox.y0 + a.bbox.y1 - (b.bbox.y0 + b.bbox.y1))) {
      const y = (word.bbox.y0 + word.bbox.y1) / 2;
      let row = rows.find(
        (r) => Math.abs(r.y - y) <= Math.max(4, Math.min(median, word.bbox.y1 - word.bbox.y0) * 0.6)
      );
      if (!row) {
        row = { y, words: [] };
        rows.push(row);
      }
      row.words.push(word);
      row.y = row.words.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / row.words.length;
    }
    return rows.sort((a, b) => a.y - b.y);
  }
  function visualRows(data) {
    return wordRows(data)
      .map((row) =>
        row.words
          .sort((a, b) => a.bbox.x0 - b.bbox.x0)
          .map((w) => w.text)
          .join(' ')
      )
      .join('\n');
  }
  function parseOutput(data) {
    const plain = parse(data?.text || ''),
      spatialText = visualRows(data);
    if (!spatialText) return plain;
    const spatial = parse(spatialText);
    const result = {
      ...plain,
      values: { ...plain.values, ...spatial.values },
      evidence: { ...plain.evidence, ...spatial.evidence },
      basis: spatial.basis || plain.basis,
      has100: spatial.has100 || plain.has100,
      multipleColumns: spatial.multipleColumns,
      uncertain: [...new Set([...plain.uncertain, ...spatial.uncertain])].filter(
        (key) => !(key in spatial.values)
      )
    };
    result.rows = spatialText;
    return result;
  }
  function score(result) {
    return (
      core.reduce(
        (sum, k) => sum + (typeof result.values[k] === 'number' ? (k === 'kcal' ? 6 : 5) : 0),
        0
      ) +
      Object.keys(result.values).filter((k) => !core.includes(k)).length +
      (result.basis ? 2 : 0) -
      (result.multipleColumns ? 3 : 0)
    );
  }
  const api = { parse, parseOutput, visualRows, wordRows, wordsFrom, score, core, patterns };
  root.RationLabel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
