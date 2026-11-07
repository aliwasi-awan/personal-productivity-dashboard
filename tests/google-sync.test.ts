import { describe, expect, it } from 'vitest';
import { enabledCalendarIds, isCalendarDataFresh } from '../src/google';
import type { CalendarAssignment } from '../src/types';

const now = Date.parse('2026-11-07T10:00:00Z');
const refreshedAgo = (milliseconds: number) => new Date(now - milliseconds).toISOString();

describe('Google Calendar sync freshness', () => {
  it('stops reusing cached data after five minutes', () => {
    expect(isCalendarDataFresh(refreshedAgo(299_999), undefined, now)).toBe(true);
    expect(isCalendarDataFresh(refreshedAgo(300_000), undefined, now)).toBe(false);
  });

  it('uses a shorter freshness threshold on focus and reconnect', () => {
    expect(isCalendarDataFresh(refreshedAgo(59_999), 60_000, now)).toBe(true);
    expect(isCalendarDataFresh(refreshedAgo(60_000), 60_000, now)).toBe(false);
  });

  it('refreshes if a timestamp is missing, invalid, or ahead of the clock', () => {
    expect(isCalendarDataFresh(null, undefined, now)).toBe(false);
    expect(isCalendarDataFresh('invalid', undefined, now)).toBe(false);
    expect(isCalendarDataFresh(refreshedAgo(-1), undefined, now)).toBe(false);
  });
});

describe('Google Calendar sync selection', () => {
  it('selects only explicitly enabled assignments', () => {
    const assignments: CalendarAssignment[] = [
      { id: 'selected', name: 'Selected', domains: [], enabled: true },
      { id: 'disabled', name: 'Disabled', domains: [], enabled: false },
    ];
    expect([...enabledCalendarIds(assignments)]).toEqual(['selected']);
    expect([...enabledCalendarIds(assignments.slice(1))]).toEqual([]);
    expect([...enabledCalendarIds([])]).toEqual([]);
  });
});
