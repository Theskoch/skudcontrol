import { zonedDayKey } from "../../lib/timezone.js";

export type RawEvent = {
  id: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  occurredAt: Date;
};

export type Session = {
  dayKey: string; // YYYY-MM-DD in APP_TZ, attributed to the check-in day
  checkInEventId: string | null;
  checkOutEventId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  durationMinutes: number;
  incomplete: boolean;
};

/**
 * Pairs a chronological CHECK_IN/CHECK_OUT event log into work sessions.
 * A session spanning midnight is attributed entirely to its check-in day.
 * Unmatched events (missing checkout, or a stray checkout with no open
 * check-in) become `incomplete` sessions excluded from worked-minutes totals.
 */
export function pairEventsIntoSessions(events: RawEvent[], timeZone: string): Session[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const sessions: Session[] = [];
  let open: RawEvent | null = null;

  for (const event of sorted) {
    if (event.eventType === "CHECK_IN") {
      if (open) {
        // Previous check-in never got a matching checkout: close it out as incomplete.
        sessions.push(buildIncompleteFromOpen(open, timeZone));
      }
      open = event;
    } else {
      // CHECK_OUT
      if (open) {
        sessions.push(buildCompleted(open, event, timeZone));
        open = null;
      } else {
        // Orphan checkout with no matching check-in.
        sessions.push({
          dayKey: zonedDayKey(event.occurredAt, timeZone),
          checkInEventId: null,
          checkOutEventId: event.id,
          checkIn: null,
          checkOut: event.occurredAt,
          durationMinutes: 0,
          incomplete: true,
        });
      }
    }
  }

  if (open) {
    sessions.push(buildIncompleteFromOpen(open, timeZone));
  }

  return sessions.sort((a, b) => (a.checkIn ?? a.checkOut!).getTime() - (b.checkIn ?? b.checkOut!).getTime());
}

function buildCompleted(checkIn: RawEvent, checkOut: RawEvent, timeZone: string): Session {
  const durationMinutes = Math.max(
    0,
    Math.round((checkOut.occurredAt.getTime() - checkIn.occurredAt.getTime()) / 60_000),
  );
  return {
    dayKey: zonedDayKey(checkIn.occurredAt, timeZone),
    checkInEventId: checkIn.id,
    checkOutEventId: checkOut.id,
    checkIn: checkIn.occurredAt,
    checkOut: checkOut.occurredAt,
    durationMinutes,
    incomplete: false,
  };
}

function buildIncompleteFromOpen(open: RawEvent, timeZone: string): Session {
  return {
    dayKey: zonedDayKey(open.occurredAt, timeZone),
    checkInEventId: open.id,
    checkOutEventId: null,
    checkIn: open.occurredAt,
    checkOut: null,
    durationMinutes: 0,
    incomplete: true,
  };
}

export function groupSessionsByDay(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const list = map.get(session.dayKey) ?? [];
    list.push(session);
    map.set(session.dayKey, list);
  }
  return map;
}

export function workedMinutesForDay(sessions: Session[]): number {
  return sessions.filter((s) => !s.incomplete).reduce((sum, s) => sum + s.durationMinutes, 0);
}
