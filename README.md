# globmatch

Zero-dependency glob pattern matcher for Node.js. Supports the full set of common glob features without pulling in a massive dependency tree.

## Why?

Most glob libraries are either huge (`micromatch` + its dependency tree) or too limited (`minimatch` quirks). `globmatch` gives you the patterns you actually need — `*`, `**`, `?`, `[abc]`, `{a,b}`, negation — in ~200 lines with zero deps.

## Install

```bash
npm install globmatch
```

## Usage

### Library

```js
const { match, filter, matcher } = require('globmatch');

// Basic matching
match('file.js', '*.js');              // true
match('file.ts', '*.js');              // false

// Globstar — crosses directory boundaries
match('src/deep/nested/x.js', '**/*.js');  // true

// Character classes
match('b', '[abc]');                   // true
match('file.js', 'file.[jt]s');        // true

// Brace expansion
match('app.jsx', '*.{js,ts,jsx}');     // true
match('src/lib/x.js', 'src/{lib,bin}/**');  // true

// Negation
match('src/index.js', '!node_modules/**');  // true

// Filter arrays
filter(['a.js', 'b.ts', 'c.js'], '*.js');   // ['a.js', 'c.js']

// Pre-compiled matcher (faster for repeated use)
const isJs = matcher('*.js');
['a.js', 'b.ts'].filter(isJs);  // ['a.js']
```

### Options

```js
match('FILE.JS', '*.js', { nocase: true });     // true (case-insensitive)
match('.env', '*env', { dot: true });            // true (* matches leading dot)
match('a/b/c', '**', { noglobstar: true });      // false (** treated as *)
```

### CLI

```bash
# Test a single match
globmatch "*.js" src/index.js

# Filter stdin
find . -type f | globmatch "**/*.{js,ts}"

# Match against a list
globmatch "*.test.js" --list a.test.js b.spec.js c.test.js

# JSON output
globmatch "src/**" --json --list src/a.js lib/b.js

# From file
globmatch "*.js" -f filelist.txt

# Invert (non-matching lines)
find . -type f | globmatch --invert "node_modules/**"
```

## Supported Patterns

| Pattern | Meaning |
|---------|---------|
| `*` | Match zero or more chars (except `/`) |
| `**` | Match zero or more path segments |
| `?` | Match exactly one char (except `/` or `.`) |
| `[abc]` | Match any char in set |
| `[a-z]` | Match any char in range |
| `[!abc]` | Match any char NOT in set |
| `{a,b,c}` | Brace expansion (match any alternative) |
| `!pattern` | Negation |
| `a\|b` | Alternation |

## API

### `match(str, pattern, opts?)` → `boolean`
Test if a string matches a glob pattern.

### `filter(list, pattern, opts?)` → `string[]`
Filter an array of strings.

### `isMatch(str, pattern, opts?)` → `boolean`
Alias for `match()`.

### `matcher(pattern, opts?)` → `function`
Create a pre-compiled matcher function. Faster for repeated matching.

### `expandBraces(pattern)` → `string[]`
Expand brace patterns into all combinations.

### `globToRegex(pattern, opts?)` → `RegExp`
Convert a single glob pattern (no braces) to a RegExp.

## License

MIT
