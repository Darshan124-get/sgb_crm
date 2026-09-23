const path = require('path');

const parseOrderDate = (rawDate) => {
    if (!rawDate) return new Date();
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
    if (typeof rawDate === 'number') {
        const parsed = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const str = String(rawDate).trim();
    if (!str) return new Date();

    const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1], 10);
        const month = parseInt(yyyymmddMatch[2], 10) - 1;
        const day = parseInt(yyyymmddMatch[3], 10);
        const parsed = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        const year = parseInt(ddmmyyyyMatch[3], 10);
        const parsed = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    return new Date();
};

const testDates = [
    "2026-08-12",
    "11-06-2026",
    "10-06-2026",
    "09-04-2026",
    "2026-04-09",
    "28-08-2026"
];

testDates.forEach(d => {
    const res = parseOrderDate(d);
    const yyyy = res.getFullYear();
    const mm = String(res.getMonth() + 1).padStart(2, '0');
    const dd = String(res.getDate()).padStart(2, '0');
    console.log(`Input: "${d}" => Output Date: ${yyyy}-${mm}-${dd} (Day=${dd}, Month=${mm}, Year=${yyyy})`);
});
