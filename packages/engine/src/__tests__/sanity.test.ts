import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../index.js';

describe('Engine Setup Sanity', () => {
  it('exports valid engine version', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
