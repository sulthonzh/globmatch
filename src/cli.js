'use strict';

#!/usr/bin/env node

const { match, filter, matcher } = require('./index');

function usage() {
  console.log(`globmatch — test glob patterns against strings

Usage:
  globmatch <pattern> <string>          Test if string matches pattern
  globmatch <pattern>                   Read strings from stdin (one per line)
  globmatch <pattern> -f <file>         Filter lines from file
  globmatch <pattern> --list a b c      Match against provided strings

Options:
  --noglobstar    Treat ** as two single * 
  --nocase        Case-insensitive matching
  --dot           Allow * to match dotfiles
  --invert        Print non-matching lines (with stdin/file)
  --json          Output as JSON array (with stdin/file/list)
  -h, --help      Show this help

Examples:
  globmatch "*.js" src/index.js
  echo -e "a.js\\nb.ts\\nc.js" | globmatch "*.js"
  globmatch "**/*.test.js" --list src/a.test.js lib/b.test.js
  globmatch "*.{js,ts}" file.js
`);
}

function parseArgs(argv) {
  const opts = { noglobstar: false, nocase: false, dot: false, invert: false, json: false };
  const positional = [];
  let listMode = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--noglobstar': opts.noglobstar = true; break;
      case '--nocase': opts.nocase = true; break;
      case '--dot': opts.dot = true; break;
      case '--invert': opts.invert = true; break;
      case '--json': opts.json = true; break;
      case '-f': opts.file = argv[++i]; break;
      case '--list': listMode = true; break;
      case '-h':
      case '--help': usage(); process.exit(0);
      default: positional.push(arg);
    }
  }

  return { opts, positional, listMode };
}

function main() {
  const { opts, positional, listMode } = parseArgs(process.argv.slice(2));

  if (positional.length === 0) {
    usage();
    process.exit(1);
  }

  const pattern = positional[0];
  const fn = matcher(pattern, opts);

  // Direct match: globmatch <pattern> <string>
  if (!listMode && !opts.file && positional.length === 2) {
    const result = fn(positional[1]);
    console.log(result ? '✓ match' : '✗ no match');
    process.exit(result ? 0 : 1);
  }

  // List mode: globmatch <pattern> --list a b c
  if (listMode) {
    const items = positional.slice(1);
    const results = opts.invert ? items.filter((s) => !fn(s)) : items.filter((s) => fn(s));
    if (opts.json) {
      console.log(JSON.stringify(results));
    } else {
      results.forEach((s) => console.log(s));
    }
    return;
  }

  // File mode
  if (opts.file) {
    const fs = require('fs');
    const lines = fs.readFileSync(opts.file, 'utf8').split('\n').filter(Boolean);
    const results = opts.invert ? lines.filter((s) => !fn(s)) : lines.filter((s) => fn(s));
    if (opts.json) {
      console.log(JSON.stringify(results));
    } else {
      results.forEach((s) => console.log(s));
    }
    return;
  }

  // Stdin mode
  if (positional.length === 1) {
    const fs = require('fs');
    const input = fs.readFileSync(0, 'utf8');
    const lines = input.split('\n').filter(Boolean);
    const results = opts.invert ? lines.filter((s) => !fn(s)) : lines.filter((s) => fn(s));
    if (opts.json) {
      console.log(JSON.stringify(results));
    } else {
      results.forEach((s) => console.log(s));
    }
  }
}

main();
