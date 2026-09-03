import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTaskText } from './index.ts';

test('parses a Russian task with a relative day', () => {
  const parsed = parseTaskText('Купить молоко завтра 18:00', new Date('2026-09-03T12:00:00Z'));

  assert.equal(parsed.title, 'Купить молоко');
  assert.equal(parsed.dueAt, '2026-09-04T15:00:00.000Z');
});

test('uses the nearest occurrence for a time without a day', () => {
  const parsed = parseTaskText('Позвонить маме в 18:00', new Date('2026-09-03T16:00:00Z'));

  assert.equal(parsed.title, 'Позвонить маме');
  assert.equal(parsed.dueAt, '2026-09-04T15:00:00.000Z');
});

test('parses an English ISO date', () => {
  const parsed = parseTaskText('Ship portfolio 2026-12-20 at 09:15');

  assert.equal(parsed.title, 'Ship portfolio');
  assert.equal(parsed.dueAt, '2026-12-20T06:15:00.000Z');
});
