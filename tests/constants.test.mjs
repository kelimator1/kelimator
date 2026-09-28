// V7 dry-run for data/constants.json (task A2, EXECUTION.md §4 V7 / docs/02 §8).
//
// The canonical shape in docs/02 §8 keeps 0 / "" as schema-valid placeholders
// until A2 replaces them with evidence-backed values; this test is the
// enforcement point. It uses the `required` annotations of the frozen schema
// (data/constants.schema.json, created by C1) instead of duplicating any field
// list, and additionally requires evidence strings for every top-level group.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const schemaPath = new URL('../data/constants.schema.json', import.meta.url);
const constantsPath = new URL('../data/constants.json', import.meta.url);

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const constants = JSON.parse(readFileSync(constantsPath, 'utf8'));

/**
 * Walk the schema's `required` annotations against the data instance.
 * Collects: missing required keys, type mismatches and placeholder values
 * ("" for strings, 0 for numbers) in required fields.
 */
function collectProblems(schemaNode, value, path, problems) {
  if (!schemaNode || typeof schemaNode !== 'object') return;

  if (Object.hasOwn(schemaNode, 'const') && value !== schemaNode.const) {
    problems.push(`${path}: expected const ${JSON.stringify(schemaNode.const)}, got ${JSON.stringify(value)}`);
  }

  if (schemaNode.type === 'object' || schemaNode.properties) {
    const required = Array.isArray(schemaNode.required) ? schemaNode.required : [];
    for (const key of required) {
      const childPath = `${path}.${key}`;
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) {
        problems.push(`${childPath}: required by schema but missing in data`);
        continue;
      }
      const child = value[key];
      if (child === '') problems.push(`${childPath}: empty-string placeholder`);
      if (child === 0) problems.push(`${childPath}: zero placeholder`);
      collectProblems(schemaNode.properties?.[key], child, childPath, problems);
    }
    // Recurse into non-required object properties that exist in the data
    // (e.g. the free-form `evidence` map) so nested required rules still apply.
    for (const [key, childSchema] of Object.entries(schemaNode.properties ?? {})) {
      if (required.includes(key)) continue;
      const child = value?.[key];
      if (child === undefined || child === null) continue;
      if (childSchema?.type === 'object') collectProblems(childSchema, child, `${path}.${key}`, problems);
    }
    return;
  }

  if (schemaNode.type === 'string' && (typeof value !== 'string' || value.length === 0)) {
    problems.push(`${path}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
  if (schemaNode.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    problems.push(`${path}: expected a finite number, got ${JSON.stringify(value)}`);
  }
}

describe('constants.json (V7 dry-run)', () => {
  it('has no ""/0 placeholders or missing values in required fields', () => {
    const problems = [];
    collectProblems(schema, constants, 'constants', problems);
    expect(problems).toEqual([]);
  });

  it('carries non-empty evidence strings for every top-level group', () => {
    const groups = (schema.required ?? []).filter((key) => key !== 'schemaVersion' && key !== 'evidence');
    const evidence = constants.evidence;
    expect(evidence && typeof evidence === 'object').toBe(true);
    const missing = groups.filter((key) => typeof evidence[key] !== 'string' || evidence[key].length === 0);
    expect(missing).toEqual([]);
  });

  it('evidence strings are non-empty and every referenced evidence/ file exists', () => {
    const problems = [];
    const referenced = new Set();
    for (const [key, value] of Object.entries(constants.evidence ?? {})) {
      if (typeof value !== 'string' || value.length === 0) {
        problems.push(`evidence.${key}: empty or non-string`);
        continue;
      }
      for (const match of value.matchAll(/evidence\/[\w.-]+\.md/g)) referenced.add(match[0]);
    }
    expect(problems).toEqual([]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const ref of referenced) {
      if (!existsSync(`${repoRoot}${ref}`)) problems.push(`referenced evidence file missing: ${ref}`);
    }
    expect(problems).toEqual([]);
  });
});
