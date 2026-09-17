import * as cheerio from "cheerio";
import { normalizeMacAddress } from "../../lib/mac.js";

export type ParsedDayEntry = {
  dateKey: string; // YYYY-MM-DD
  employeeName: string;
  macAddress: string | null;
  checkIn: string | null; // "HH:MM"
  checkOut: string | null; // "HH:MM"
};

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_OR_DASH_RE = /^\d{2}:\d{2}$|^-$/;

function cleanText(raw: string): string {
  return raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parses the "Учет рабочего времени" HTML export. Deliberately positional
 * rather than keyed on the report's auto-generated CSS class hashes (those
 * change between exports); a data row is recognised by its column shape
 * (name, MAC address, then two HH:MM-or-"-" cells for check-in/out).
 */
export function parseAttendanceReport(html: string): ParsedDayEntry[] {
  const $ = cheerio.load(html);
  const entries: ParsedDayEntry[] = [];
  let currentDateKey: string | null = null;

  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("> td")
      .toArray()
      .map((td) => cleanText($(td).text()));

    const wholeRowText = cleanText(cells.join(""));
    const dateMatch = wholeRowText.match(DATE_RE);
    if (dateMatch) {
      const [, dd, mm, yyyy] = dateMatch;
      currentDateKey = `${yyyy}-${mm}-${dd}`;
      return;
    }

    if (cells.length < 5 || !currentDateKey) return;

    const name = cells[1];
    const macAddress = normalizeMacAddress(cells[2] ?? "");
    const checkInRaw = cells[3];
    const checkOutRaw = cells[4];

    if (!name || name === "Итого") return;
    if (!TIME_OR_DASH_RE.test(checkInRaw) || !TIME_OR_DASH_RE.test(checkOutRaw)) return;

    entries.push({
      dateKey: currentDateKey,
      employeeName: name,
      macAddress,
      checkIn: checkInRaw === "-" ? null : checkInRaw,
      checkOut: checkOutRaw === "-" ? null : checkOutRaw,
    });
  });

  return entries;
}
