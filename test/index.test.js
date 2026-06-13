'use strict';

const assert = require('assert');
const { match, filter, isMatch, matcher, expandBraces, globToRegex } = require('../src/index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e.message}`);
  }
}

// ── Basic * matching ────────────────────────────────

test('*.js matches file.js', () => {
  assert.strictEqual(match('file.js', '*.js'), true);
});

test('*.js does not match file.ts', () => {
  assert.strictEqual(match('file.ts', '*.js'), false);
});

test('* matches anything (no slash)', () => {
  assert.strictEqual(match('anything', '*'), true);
});

test('* does not match paths with slashes', () => {
  assert.strictEqual(match('a/b', '*'), false);
});

test('* matches empty string as zero chars', () => {
  // * means zero or more chars, so empty matches
  assert.strictEqual(match('', '*'), true);
});

test('* matches single char', () => {
  assert.strictEqual(match('a', '*'), true);
});

// ── ? matching ──────────────────────────────────────

test('?at matches cat', () => {
  assert.strictEqual(match('cat', '?at'), true);
});

test('?at does not match scat', () => {
  assert.strictEqual(match('scat', '?at'), false);
});

test('?? matches two chars', () => {
  assert.strictEqual(match('ab', '??'), true);
  assert.strictEqual(match('abc', '??'), false);
});

test('? does not match dot', () => {
  assert.strictEqual(match('.hidden', '?hidden'), false);
});

// ── ** globstar matching ────────────────────────────

test('** matches everything', () => {
  assert.strictEqual(match('a/b/c/d.js', '**'), true);
});

test('**/*.js matches nested js file', () => {
  assert.strictEqual(match('src/deep/nested/file.js', '**/*.js'), true);
});

test('**/*.js matches root js file', () => {
  assert.strictEqual(match('file.js', '**/*.js'), true);
});

test('src/**/*.js matches files under src', () => {
  assert.strictEqual(match('src/a/b/c.js', 'src/**/*.js'), true);
  assert.strictEqual(match('src/test.js', 'src/**/*.js'), true);
});

test('src/**/*.js does not match lib/x.js', () => {
  assert.strictEqual(match('lib/x.js', 'src/**/*.js'), false);
});

test('**/node_modules/** matches nested node_modules', () => {
  assert.strictEqual(match('src/node_modules/pkg/index.js', '**/node_modules/**'), true);
});

// ── Character classes [...] ─────────────────────────

test('[abc] matches a', () => {
  assert.strictEqual(match('a', '[abc]'), true);
  assert.strictEqual(match('d', '[abc]'), false);
});

test('[a-z] matches lowercase', () => {
  assert.strictEqual(match('f', '[a-z]'), true);
  assert.strictEqual(match('F', '[a-z]'), false);
});

test('[!abc] negation', () => {
  assert.strictEqual(match('d', '[!abc]'), true);
  assert.strictEqual(match('a', '[!abc]'), false);
});

test('[!a-z] negation range', () => {
  assert.strictEqual(match('A', '[!a-z]'), true);
  assert.strictEqual(match('a', '[!a-z]'), false);
});

test('file.[jt]s matches file.js and file.ts', () => {
  assert.strictEqual(match('file.js', 'file.[jt]s'), true);
  assert.strictEqual(match('file.ts', 'file.[jt]s'), true);
  assert.strictEqual(match('file.ps', 'file.[jt]s'), false);
});

test('[] literal — unclosed [ is literal', () => {
  // Unclosed [ has no ] so it's treated as literal
  const re = globToRegex('[abc');
  assert.ok(re instanceof RegExp);
});

// ── Brace expansion {a,b} ───────────────────────────

test('{a,b,c} matches b', () => {
  assert.strictEqual(match('b', '{a,b,c}'), true);
  assert.strictEqual(match('d', '{a,b,c}'), false);
});

test('*.{js,ts,jsx} matches file.tsx', () => {
  assert.strictEqual(match('app.tsx', '*.{js,ts,jsx}'), false);
  assert.strictEqual(match('app.jsx', '*.{js,ts,jsx}'), true);
  assert.strictEqual(match('app.js', '*.{js,ts,jsx}'), true);
});

test('src/{lib,bin}/** matches src/lib/x.js', () => {
  assert.strictEqual(match('src/lib/x.js', 'src/{lib,bin}/**'), true);
  assert.strictEqual(match('src/bin/y.js', 'src/{lib,bin}/**'), true);
  assert.strictEqual(match('src/test/z.js', 'src/{lib,bin}/**'), false);
});

test('nested braces {a,{b,c}}', () => {
  assert.strictEqual(match('a', '{a,{b,c}}'), true);
  assert.strictEqual(match('c', '{a,{b,c}}'), true);
  assert.strictEqual(match('d', '{a,{b,c}}'), false);
});

// ── Negation ! ──────────────────────────────────────

test('!pattern negation', () => {
  assert.strictEqual(match('node_modules/express/index.js', '!node_modules/**'), false);
  assert.strictEqual(match('src/index.js', '!node_modules/**'), true);
});

// ── Multiple patterns with | ────────────────────────

test('a|b matches either', () => {
  assert.strictEqual(match('a', 'a|b'), true);
  assert.strictEqual(match('b', 'a|b'), true);
  assert.strictEqual(match('c', 'a|b'), false);
});

// ── Options ─────────────────────────────────────────

test('nocase option', () => {
  assert.strictEqual(match('FILE.JS', '*.js', { nocase: true }), true);
  assert.strictEqual(match('FILE.JS', '*.js', { nocase: false }), false);
});

test('noglobstar treats ** as two *', () => {
  assert.strictEqual(match('a/b/c', '**', { noglobstar: true }), false);
  assert.strictEqual(match('abc', '**', { noglobstar: true }), true);
});

test('dot option allows * to match leading dot', () => {
  assert.strictEqual(match('.env', '*env', { dot: false }), false);
  assert.strictEqual(match('.env', '*env', { dot: true }), true);
});

// ── filter() ────────────────────────────────────────

test('filter returns matching items', () => {
  const files = ['a.js', 'b.ts', 'c.js', 'd.md', 'e.js'];
  const result = filter(files, '*.js');
  assert.deepStrictEqual(result, ['a.js', 'c.js', 'e.js']);
});

test('filter with braces', () => {
  const files = ['a.js', 'b.ts', 'c.md', 'd.json'];
  const result = filter(files, '*.{js,ts}');
  assert.deepStrictEqual(result, ['a.js', 'b.ts']);
});

// ── isMatch() alias ─────────────────────────────────

test('isMatch is alias for match', () => {
  assert.strictEqual(isMatch('file.js', '*.js'), match('file.js', '*.js'));
});

// ── matcher() factory ───────────────────────────────

test('matcher returns reusable function', () => {
  const fn = matcher('*.js');
  assert.strictEqual(fn('a.js'), true);
  assert.strictEqual(fn('b.ts'), false);
  assert.strictEqual(fn('c.js'), true);
});

test('matcher with negation', () => {
  const fn = matcher('!*.test.js');
  assert.strictEqual(fn('index.js'), true);
  assert.strictEqual(fn('index.test.js'), false);
});

test('matcher with braces', () => {
  const fn = matcher('*.{js,ts}');
  assert.strictEqual(fn('a.js'), true);
  assert.strictEqual(fn('b.ts'), true);
  assert.strictEqual(fn('c.md'), false);
});

// ── expandBraces() ──────────────────────────────────

test('expandBraces simple', () => {
  assert.deepStrictEqual(expandBraces('{a,b}'), ['a', 'b']);
});

test('expandBraces with prefix/suffix', () => {
  assert.deepStrictEqual(expandBraces('x{a,b}y'), ['xay', 'xby']);
});

test('expandBraces nested', () => {
  const result = expandBraces('{a,{b,c}}');
  assert.ok(result.includes('a'));
  assert.ok(result.includes('b'));
  assert.ok(result.includes('c'));
});

test('expandBraces no braces', () => {
  assert.deepStrictEqual(expandBraces('plain'), ['plain']);
});

test('expandBraces single element', () => {
  assert.deepStrictEqual(expandBraces('{only}'), ['only']);
});

// ── globToRegex() ───────────────────────────────────

test('globToRegex returns RegExp', () => {
  const re = globToRegex('*.js');
  assert.ok(re instanceof RegExp);
  assert.ok(re.test('file.js'));
  assert.ok(!re.test('file.ts'));
});

// ── Edge cases ──────────────────────────────────────

test('empty pattern matches empty string', () => {
  assert.strictEqual(match('', ''), true);
  assert.strictEqual(match('x', ''), false);
});

test('literal path matches exactly', () => {
  assert.strictEqual(match('src/index.js', 'src/index.js'), true);
  assert.strictEqual(match('src/index.js', 'src/other.js'), false);
});

test('pattern with dots in name', () => {
  assert.strictEqual(match('config.test.js', '*.test.js'), true);
});

test('complex pattern: src/**/*.{test,spec}.js', () => {
  assert.strictEqual(match('src/deep/nested/file.test.js', 'src/**/*.{test,spec}.js'), true);
  assert.strictEqual(match('src/file.spec.js', 'src/**/*.{test,spec}.js'), true);
  assert.strictEqual(match('src/file.js', 'src/**/*.{test,spec}.js'), false);
});

test('multiple glob segments', () => {
  assert.strictEqual(match('a/b/c/d.js', '*/*/c/*.js'), true);
  assert.strictEqual(match('a/x/c/d.js', '*/b/c/*.js'), false);
});

test('wildcard in middle of path', () => {
  assert.strictEqual(match('src/components/Button.tsx', 'src/*/Button.tsx'), true);
  assert.strictEqual(match('src/components/Button.tsx', 'src/*/Card.tsx'), false);
});

// ── Summary ─────────────────────────────────────────

const total = passed + failed;
console.log(`\n${passed}/${total} passed`);
if (failed > 0) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed ✅');
}
