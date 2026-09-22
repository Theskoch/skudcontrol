import * as cheerio from "cheerio";
import { normalizeMacAddress } from "../../lib/mac.js";

export type ParsedDayEntry = {
  dateKey: string; // YYYY-MM-DD
  employeeName: string;
  patronymic: string;
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
 * The client's "Сотрудник" column is a raw ФИО string where first/last name
 * may be missing, but the last token is always an appended device/badge code
 * ending in a digit (e.g. "Admin Андрей p129" -> "p129"). That trailing code
 * is the only stable identifier across report exports, so it doubles as the
 * employee-matching key. A row whose last token doesn't end in a digit has no
 * such code and must not be imported/tracked at all.
 */
function extractPatronymicCode(fullName: string): string | null {
  const tokens = fullName.split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last || !/\d$/.test(last)) return null;
  return last;
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

    const patronymic = extractPatronymicCode(name);
    if (!patronymic) return;

    entries.push({
      dateKey: currentDateKey,
      employeeName: name,
      patronymic,
      macAddress,
      checkIn: checkInRaw === "-" ? null : checkInRaw,
      checkOut: checkOutRaw === "-" ? null : checkOutRaw,
    });
  });

  return entries;
}
