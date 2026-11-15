/* Calendar and optional local identity. All dates are local calendar days. */
(function (root) {
  'use strict';
  const C = root.RationCore;
  C.isBasicFood = (food) =>
    food.source === 'reference' &&
    !food.brand &&
    !food.personalized &&
    !/cooked|boiled|fried|roasted|canned|soup|salad|варен|смажен|жарен|запеч|консерв|суп|салат/i.test(
      food.names.join(' ')
    );
  C.streakCalendar = (state, month = C.dateKey().slice(0, 7), today = C.dateKey()) => {
    if (!/^\d{4}-\d{2}$/.test(month) || !C.validDate(month + '-01')) throw Error('Invalid month');
    const first = month + '-01',
      d = new Date(first + 'T12:00:00');
    const offset = (d.getDay() + 6) % 7;
    d.setMonth(d.getMonth() + 1, 0);
    const active = new Set(C.activityDays(state, today));
    return {
      month,
      offset,
      days: Array.from({ length: d.getDate() }, (_, i) => {
        const date = month + '-' + String(i + 1).padStart(2, '0');
        return { date, active: active.has(date), today: date === today, future: date > today };
      })
    };
  };
  C.validLocalProfile = (p) =>
    p == null ||
    (!!p &&
      typeof p === 'object' &&
      !Array.isArray(p) &&
      typeof p.id === 'string' &&
      /^[a-zA-Z0-9-]{1,100}$/.test(p.id) &&
      typeof p.displayName === 'string' &&
      p.displayName.trim().length > 0 &&
      p.displayName.length <= 40 &&
      ['mint', 'sky', 'lilac', 'peach'].includes(p.color) &&
      C.validDate(p.createdAt));
  const valid = C.validState,
    defaults = C.defaults,
    migrate = C.migrate;
  C.validState = (s) => valid(s) && C.validLocalProfile(s.localProfile);
  C.defaults = () => ({ ...defaults(), localProfile: null });
  C.migrate = (input) => {
    const state = migrate(input);
    state.localProfile ??= null;
    if (!C.validState(state)) throw Error('Invalid local profile');
    return state;
  };
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window === 'undefined' ? globalThis : window);
