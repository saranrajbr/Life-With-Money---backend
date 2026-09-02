export const RANGE_TYPES = ["day", "week", "month", "year", "all"];

const pad = (n) => String(n).padStart(2, "0");

function parseComponents(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

function utcStr({ y, m, d }) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function getRange({ range, dateStr } = {}) {
  let startStr;
  let endStr;

  if (range === "all") {
    startStr = "0000-01-01";
    endStr = "9999-12-31";
  } else {
    const now = new Date();
    const base = parseComponents(dateStr) || {
      y: now.getUTCFullYear(),
      m: now.getUTCMonth() + 1,
      d: now.getUTCDate()
    };

    // Build a UTC Date pushed to local-independent noon to avoid DST/timezone edge cases.
    const baseDate = new Date(Date.UTC(base.y, base.m - 1, base.d, 12, 0, 0));

    switch (range) {
      case "day":
        startStr = utcStr(base);
        endStr = utcStr(base);
        break;
      case "week": {
        // Monday as first day of week
        const offset = (baseDate.getUTCDay() + 6) % 7;
        const startD = new Date(baseDate);
        startD.setUTCDate(startD.getUTCDate() - offset);
        const endD = new Date(startD);
        endD.setUTCDate(startD.getUTCDate() + 6);
        startStr = `${startD.getUTCFullYear()}-${pad(startD.getUTCMonth() + 1)}-${pad(startD.getUTCDate())}`;
        endStr = `${endD.getUTCFullYear()}-${pad(endD.getUTCMonth() + 1)}-${pad(endD.getUTCDate())}`;
        break;
      }
      case "month":
        startStr = `${base.y}-${pad(base.m)}-01`;
        endStr = `${base.y}-${pad(base.m)}-${new Date(Date.UTC(base.y, base.m, 0)).getUTCDate()}`;
        break;
      case "year":
        startStr = `${base.y}-01-01`;
        endStr = `${base.y}-12-31`;
        break;
      default:
        throw new Error("Invalid range");
    }
  }

  return {
    start: new Date(`${startStr}T00:00:00.000Z`),
    end: new Date(`${endStr}T23:59:59.999Z`)
  };
}

export function groupByDateStr(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const key = tx.dateStr;
    if (!map.has(key)) {
      map.set(key, { date: key, income: 0, expense: 0 });
    }
    const entry = map.get(key);
    if (tx.type === "income") entry.income += tx.amount;
    else entry.expense += tx.amount;
  }
  return map;
}