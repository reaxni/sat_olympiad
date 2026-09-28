import { describe, expect, it } from 'vitest';
import { calculatorEnabled } from './MathTools';
describe('Desmos feature entitlement', () => {
  const construct = () => ({ destroy: () => {}, resize: () => {} });
  it('requires the enabledFeatures flag and constructor for scientific mode', () => {
    expect(calculatorEnabled({ enabledFeatures: { GraphingCalculator: true, ScientificCalculator: false }, GraphingCalculator: construct, ScientificCalculator: construct }, 'scientific')).toBe(false);
    expect(calculatorEnabled({ enabledFeatures: { ScientificCalculator: true }, ScientificCalculator: construct }, 'scientific')).toBe(true);
    expect(calculatorEnabled({ ScientificCalculator: construct }, 'scientific')).toBe(false);
  });
});
