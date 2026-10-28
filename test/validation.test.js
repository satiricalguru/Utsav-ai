import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError, cleanText, validateChatInput, validateEventInput } from '../src/validation.js';
import { TODAY, eventInput } from './helpers.js';

const opts = { today: TODAY };

describe('cleanText', () => {
  it('strips control and bidi characters, collapses spaces and truncates', () => {
    assert.equal(cleanText('  hi\u0000 \u202Ethere   friend ', 100), 'hi there friend');
    assert.equal(cleanText('abcdef', 3), 'abc');
    assert.equal(cleanText(42, 10), '');
  });
});

describe('validateEventInput', () => {
  it('accepts and normalises a valid event', () => {
    const result = validateEventInput({ ...eventInput(), budget: 1500000.6, extra: 'dropped' }, opts);
    assert.equal(result.budget, 1500001);
    assert.equal('extra' in result, false);
  });

  it('applies defaults for optional fields', () => {
    const { eventType, date, city, guests, budget } = eventInput();
    const result = validateEventInput({ eventType, date, city, guests, budget }, opts);
    assert.equal(result.currency, 'INR');
    assert.equal(result.style, 'modern');
    assert.equal(result.language, 'en');
    assert.deepEqual(result.dietary, []);
  });

  it('de-duplicates dietary options', () => {
    const result = validateEventInput(eventInput({ dietary: ['vegan', 'vegan'] }), opts);
    assert.deepEqual(result.dietary, ['vegan']);
  });

  it('collects every error at once', () => {
    try {
      validateEventInput(
        {
          eventType: 'rave',
          date: '2020-01-01',
          city: '',
          guests: 0,
          budget: 10,
          currency: 'BTC',
          style: 'x',
          venueType: 'moon',
          language: 'xx',
          dietary: ['paleo'],
        },
        opts,
      );
      assert.fail('should throw');
    } catch (err) {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.details.length, 10);
    }
  });

  it('rejects dates too far ahead and non-object bodies', () => {
    assert.throws(() => validateEventInput(eventInput({ date: '2031-01-01' }), opts), ValidationError);
    assert.throws(() => validateEventInput(null, opts), ValidationError);
    assert.throws(() => validateEventInput([], opts), ValidationError);
  });

  it('rejects fractional guest counts and prototype tricks', () => {
    assert.throws(() => validateEventInput(eventInput({ guests: 10.5 }), opts), ValidationError);
    assert.throws(() => validateEventInput(eventInput({ currency: '__proto__' }), opts), ValidationError);
    assert.throws(() => validateEventInput(eventInput({ language: 'toString' }), opts), ValidationError);
  });
});

describe('validateChatInput', () => {
  it('keeps only the last valid history turns', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      text: `turn ${i}`,
    }));
    history.push({ role: 'system', text: 'ignore me' });
    const result = validateChatInput({ event: eventInput(), question: 'What next?', history }, opts);
    assert.equal(result.history.length, 5);
    assert.ok(result.history.every((t) => t.role !== 'system'));
  });

  it('requires a question', () => {
    assert.throws(() => validateChatInput({ event: eventInput(), question: ' ' }, opts), ValidationError);
    assert.throws(() => validateChatInput('nope', opts), ValidationError);
  });
});
