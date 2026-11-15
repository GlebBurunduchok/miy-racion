/* Label parsing is deliberately conservative. OCR output always needs review. */
(function (root) {
  'use strict';
  const fields = {
    saturatedFat:
      /насичен[а-яіїєґ]*\s*(?:жир[а-яіїєґ]*\s*)?(?:кислот[а-яіїєґ]*)?|насыщенн[а-яё]*\s*(?:жир[а-яё]*\s*)?(?:кислот[а-яё]*)?|saturat(?:ed|es)(?:\s+fat)?/i,
    sugars: /цукр[а-яіїєґ]*|сахар[а-яё]*|sugars?/i,
    fiber:
      /(?:харчов[а-яіїєґ]*\s+)?волокн[а-яіїєґ]*|клітковин[а-яіїєґ]*|клетчатк[а-яё]*|fib(?:er|re)/i,
    salt: /сіль|соли?|salt/i,
    sodium: /натрі[йюя]|натри[йя]|sodium/i,
    calcium: /кальці[йюя]|кальци[йя]|calcium/i,
    potassium: /калі[йюя]|кали[йя]|potassium/i,
    iron: /заліз[ао]|желез[ао]|iron/i,
    vitaminC: /вітамін\s*[cс]|витамин\s*[cс]|vitamin\s*c/i,
    p: /білк[а-яіїєґ]*|белк[а-яё]*|proteins?/i,
    f: /жир[а-яіїєґё]*|(?:total\s+)?fats?/i,
    c: /вуглевод[а-яіїєґ]*|углевод[а-яё]*|carbohydrates?/i
  };
  const numbers = (text) =>
    [...text.matchAll(/(?:\d+[.,]\d+|\d+)/g)].map((m) => ({
      value: Number(m[0].replace(',', '.')),
      index: m.index,
      raw: m[0]
    }));
  function parse(text) {
    const clean = String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/([0-9])\s*[,，]\s*([0-9])/g, '$1,$2');
    const basisMatch = clean.match(
      /(?:на|per|in|у|в)?\s*100\s*(мл|ml|г(?:рам[а-яіїєґ]*)?|g(?:rams?)?)(?![a-zа-яіїєґ])/i
    );
    const basis = basisMatch ? (/мл|ml/i.test(basisMatch[1]) ? 'ml' : 'g') : null;
    const values = {},
      evidence = {},
      uncertain = [];
    let multipleColumns = false;
    const lines = clean
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (let index = 0; index < lines.length; index++) {
      const original = lines[index],
        line = original.replace(/100\s*(?:мл|ml|г|g)(?![a-zа-яіїєґ])/gi, '');
      // kcal and kJ may appear in either order; never confuse them.
      const energyLine =
        line +
        (index + 1 < lines.length && /^\s*\d/.test(lines[index + 1]) ? ' ' + lines[index + 1] : '');
      const paired = energyLine.match(
        /(кдж|kj|ккал|kcal)\s*[/|]\s*(ккал|kcal|кдж|kj)\s*[):;,—–-]*\s*(\d+(?:[.,]\d+)?)\s*[/|]\s*(\d+(?:[.,]\d+)?)/i
      );
      const energy =
        paired && /ккал|kcal/i.test(paired[2])
          ? [paired[0], paired[4]]
          : paired && /ккал|kcal/i.test(paired[1])
            ? [paired[0], paired[3]]
            : energyLine.match(/(\d+(?:[.,]\d+)?)\s*(?:ккал|kcal)/i) ||
              energyLine.match(/(?:ккал|kcal)\s*[():/|—–-]*\s*(\d+(?:[.,]\d+)?)/i);
      if (energy) {
        const v = Number(energy[1].replace(',', '.'));
        if (v <= 1000) {
          values.kcal = v;
          evidence.kcal = original;
        }
        if ((line.match(/ккал|kcal/gi) || []).length > 1) {
          multipleColumns = true;
          delete values.kcal;
        }
      }
      for (const [key, pattern] of Object.entries(fields)) {
        const match = pattern.exec(line);
        if (!match) continue;
        let tail = line.slice(match.index + match[0].length).replace(/\([^)]*\)/g, ' ');
        // OCR often reads the zero in 0,10 as a Cyrillic О. Only normalize it
        // at the start of a numeric value, never inside a food name.
        tail = tail.replace(/^[\s:;|—–-]*[ОоOo]\s*([,.])\s*(\d)/, '0$1$2');
        if (
          !numbers(tail).length &&
          index + 1 < lines.length &&
          /^\s*[<≤\d]/.test(lines[index + 1])
        )
          tail += ' ' + lines[index + 1];
        const ns = numbers(tail).filter((n) => !/^\s*%/.test(tail.slice(n.index + n.raw.length)));
        if (ns.length !== 1 || /[<≤>≥]|менше|менее|less than/i.test(tail)) {
          if (ns.length > 1) multipleColumns = true;
          uncertain.push(key);
          break;
        }
        const prefix = tail.slice(0, ns[0].index).replace(/[\s:;,/|—–-]/g, '');
        if (prefix && !/^(?:г|g|мг|mg|мкг|mcg|µg|total)$/i.test(prefix)) {
          uncertain.push(key);
          break;
        }
        const micro = ['calcium', 'potassium', 'iron', 'vitaminC', 'sodium'].includes(key);
        let value = ns[0].value;
        const unit = tail.slice(ns[0].index + ns[0].raw.length).trim();
        if (/^[ОоOo](?![a-z])/i.test(unit)) {
          uncertain.push(key);
          break;
        }
        if (micro) {
          if (/^(?:мкг|µg|mcg)/i.test(unit)) value /= 1000;
          else if (/^(?:г|g)(?![a-zа-я])/i.test(unit)) value *= 1000;
          else if (!/^(?:мг|mg)/i.test(unit)) {
            uncertain.push(key);
            break;
          }
        } else if (/^(?:мг|mg)/i.test(unit)) value /= 1000;
        if (value <= (micro ? 100000 : 100)) {
          values[key] = value;
          evidence[key] = original;
        } else uncertain.push(key);
        break;
      }
    }
    return {
      values,
      evidence,
      basis,
      has100: !!basisMatch,
      multipleColumns,
      uncertain: [...new Set(uncertain)],
      text: clean
    };
  }
  root.RationLabel = { parse };
  if (typeof module !== 'undefined') module.exports = root.RationLabel;
})(typeof window === 'undefined' ? globalThis : window);
