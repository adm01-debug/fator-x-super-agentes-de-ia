/**
 * cronSchedulerService tests (next-frontier coverage expansion #3)
 *
 * Targets: ~322 lines, 0% → 60%+ coverage on the pure functions.
 * Focus: parseCronExpression, getNextCronRun, describeCronExpression
 * (these are pure and account for the bulk of the testable surface).
 */
import { describe, it, expect } from 'vitest';
import {
  parseCronExpression,
  getNextCronRun,
  describeCronExpression,
} from '@/services/cronSchedulerService';

describe('cronSchedulerService — parseCronExpression', () => {
  it('throws on invalid expression (wrong field count)', () => {
    expect(() => parseCronExpression('* * *')).toThrow(/expected 5 fields/);
    expect(() => parseCronExpression('* * * * * *')).toThrow(/expected 5 fields/);
  });

  it('parses "* * * * *" as every minute / every hour / every day / etc', () => {
    const cron = parseCronExpression('* * * * *');
    expect(cron.minute.length).toBe(60);    // 0..59
    expect(cron.hour.length).toBe(24);      // 0..23
    expect(cron.dayOfMonth.length).toBe(31); // 1..31
    expect(cron.month.length).toBe(12);     // 1..12
    expect(cron.dayOfWeek.length).toBe(7);  // 0..6
  });

  it('parses single literal values', () => {
    const cron = parseCronExpression('30 14 1 6 0');
    expect(cron.minute).toEqual([30]);
    expect(cron.hour).toEqual([14]);
    expect(cron.dayOfMonth).toEqual([1]);
    expect(cron.month).toEqual([6]);
    expect(cron.dayOfWeek).toEqual([0]);
  });

  it('parses comma-separated lists', () => {
    const cron = parseCronExpression('0,15,30,45 * * * *');
    expect(cron.minute).toEqual([0, 15, 30, 45]);
  });

  it('parses ranges', () => {
    const cron = parseCronExpression('* * * * 1-5');
    expect(cron.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses step values with */N syntax', () => {
    const cron = parseCronExpression('*/15 * * * *');
    expect(cron.minute).toEqual([0, 15, 30, 45]);
  });

  it('parses step values with start point N/M syntax', () => {
    const cron = parseCronExpression('5/10 * * * *');
    expect(cron.minute).toEqual([5, 15, 25, 35, 45, 55]);
  });

  it('handles every-2-hours pattern', () => {
    const cron = parseCronExpression('0 */2 * * *');
    expect(cron.minute).toEqual([0]);
    expect(cron.hour).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  });

  it('deduplicates and sorts values', () => {
    const cron = parseCronExpression('30,15,30,0 * * * *');
    expect(cron.minute).toEqual([0, 15, 30]);
  });
});

describe('cronSchedulerService — getNextCronRun', () => {
  it('finds the next minute for "* * * * *"', () => {
    const now = new Date('2026-04-08T10:30:15Z');
    const next = getNextCronRun('* * * * *', now);
    // Should be 10:31:00 (next whole minute)
    expect(next.getUTCMinutes()).toBe(31);
    expect(next.getUTCSeconds()).toBe(0);
  });

  it('finds the next 9 AM for "0 9 * * *"', () => {
    const now = new Date('2026-04-08T10:30:00Z');
    const next = getNextCronRun('0 9 * * *', now);
    // Should jump to next day 9:00
    expect(next.getUTCHours()).toBe(9);
    expect(next.getUTCMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('produces an increasing time always', () => {
    const start = new Date('2026-04-08T00:00:00Z');
    const next = getNextCronRun('*/30 * * * *', start);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe('cronSchedulerService — describeCronExpression', () => {
  it('returns friendly label for known presets', () => {
    expect(describeCronExpression('* * * * *')).toBe('Every minute');
    expect(describeCronExpression('*/5 * * * *')).toBe('Every 5 minutes');
    expect(describeCronExpression('0 * * * *')).toBe('Every hour');
    expect(describeCronExpression('0 0 * * *')).toBe('Daily at midnight');
    expect(describeCronExpression('0 9 * * *')).toBe('Daily at 9:00 AM');
    expect(describeCronExpression('0 9 * * 1-5')).toBe('Weekdays at 9:00 AM');
    expect(describeCronExpression('0 0 1 * *')).toBe('Monthly on the 1st');
  });

  it('returns "Custom: ..." for unknown expressions', () => {
    const desc = describeCronExpression('17 3 * * 2,4');
    expect(desc).toMatch(/^Custom:/);
    expect(desc).toContain('17 3 * * 2,4');
  });
});
