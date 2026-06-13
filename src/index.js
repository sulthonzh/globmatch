'use strict';

// ============================================================
// globmatch — Zero-dep glob pattern matcher
// Supports: *, **, ?, [abc], [a-z], [!abc], {a,b,c}, negation !
// ============================================================

/**
 * Expand braces like {a,b,c} into multiple patterns.
 * Handles nested braces: {a,{b,c}} → [a, b, c]
 * @param {string} pattern
 * @returns {string[]}
 */
function expandBraces(pattern) {
  const results = [];
  const stack = [];
  let depth = 0;
  let start = -1;

  // Find first top-level brace group
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '{' && depth === 0) {
      depth = 1;
      start = i;
    } else if (pattern[i] === '{') {
      depth++;
    } else if (pattern[i] === '}') {
      depth--;
      if (depth === 0) {
        const before = pattern.slice(0, start);
        const after = pattern.slice(i + 1);
        const inner = pattern.slice(start + 1, i);

        // Split inner by top-level commas
        const parts = splitTopLevel(inner, ',');
        if (parts.length > 1) {
          for (const part of parts) {
            const expanded = expandBraces(before + part + after);
            results.push(...expanded);
          }
          return results;
        } else {
          // Single-element brace — treat as literal group, just expand
          const expanded = expandBraces(before + inner + after);
          results.push(...expanded);
          return results;
        }
      }
    }
  }

  return [pattern];
}

/**
 * Split a string by a delimiter, ignoring delimiters inside {} or []
 */
function splitTopLevel(str, delim) {
  const parts = [];
  let current = '';
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;

    if (ch === delim && braceDepth === 0 && bracketDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Convert a single glob pattern (no braces) to a RegExp.
 * Supports: **, *, ?, [abc], [a-z], [!abc], literals
 * @param {string} pattern
 * @param {object} opts
 * @returns {RegExp}
 */
function globToRegex(pattern, opts = {}) {
  const { noglobstar = false, nocase = false, dot = false } = opts;
  let regex = '^';
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // ** — matches anything including path separators
    if (ch === '*' && pattern[i + 1] === '*' && !noglobstar) {
      // Check for **/ or **/
      if (pattern[i + 2] === '/') {
        // **/ matches zero or more path segments
        regex += '(?:.*/)?';
        i += 3;
      } else if (i === 0 || pattern[i - 1] === '/') {
        // ** at start or after / matches everything
        regex += '.*';
        i += 2;
      } else {
        // ** in other contexts — treat as *
        if (dot) {
          regex += '[^/]*';
        } else {
          regex += '[^/]*(?<!\\.\\.)[^/]*';
          // Actually just use [^/]* but handle dot below
          regex = regex.slice(0, -'(?!<\\.\\.)[^/]*'.length);
          regex += '[^/]*';
        }
        i += 2;
      }
      continue;
    }

    // * — matches anything except path separator
    if (ch === '*') {
      if (dot) {
        regex += '[^/]*';
      } else {
        // Don't match leading dot unless explicitly in pattern
        regex += '(?:[^/.][^/]*)?';
      }
      i++;
      continue;
    }

    // ? — matches single char except path separator
    if (ch === '?') {
      if (dot) {
        regex += '[^/]';
      } else {
        regex += '[^/.]';
      }
      i++;
      continue;
    }

    // [...] — character class
    if (ch === '[') {
      const closeIdx = pattern.indexOf(']', i + 1);
      if (closeIdx === -1) {
        // No closing bracket — literal [
        regex += '\\[';
        i++;
        continue;
      }

      let classContent = pattern.slice(i + 1, closeIdx);
      let negate = '';

      if (classContent[0] === '!' || classContent[0] === '^') {
        negate = '^';
        classContent = classContent.slice(1);
      }

      // Escape regex-special chars inside class (only \ and ] need escaping)
      const escaped = classContent.replace(/([\\\]])/g, '\\$1');
      regex += '[' + negate + escaped + ']';
      i = closeIdx + 1;
      continue;
    }

    // Escape regex-special literal chars
    if ('.+^${}()|\\'.includes(ch)) {
      regex += '\\' + ch;
    } else {
      regex += ch;
    }

    i++;
  }

  regex += '$';

  let flags = '';
  if (nocase) flags += 'i';

  return new RegExp(regex, flags);
}

/**
 * Test whether a string matches a glob pattern.
 *
 * @param {string} str — The string to test (e.g. file path)
 * @param {string} pattern — Glob pattern with *, **, ?, [], {}, !
 * @param {object} opts — { noglobstar, nocase, dot, noglob }
 * @returns {boolean}
 */
function match(str, pattern, opts = {}) {
  if (str == null || pattern == null) return false;

  // Handle negation: pattern starts with !
  if (pattern[0] === '!') {
    return !match(str, pattern.slice(1), opts);
  }

  // Handle multiple patterns separated by |
  const alts = splitTopLevel(pattern, '|');
  if (alts.length > 1) {
    return alts.some((p) => match(str, p.trim(), opts));
  }

  // Expand braces
  const patterns = expandBraces(pattern);

  // If brace expansion produced multiple patterns, any can match
  if (patterns.length > 1) {
    return patterns.some((p) => match(str, p, opts));
  }

  const re = globToRegex(patterns[0], opts);
  return re.test(str);
}

/**
 * Filter an array of strings against a glob pattern.
 *
 * @param {string[]} list — Array of strings
 * @param {string} pattern — Glob pattern
 * @param {object} opts — Match options
 * @returns {string[]}
 */
function filter(list, pattern, opts = {}) {
  return list.filter((item) => match(item, pattern, opts));
}

/**
 * Check if a pattern would match a specific path.
 * Alias for match() with path semantics (handles / separators).
 *
 * @param {string} filepath
 * @param {string} pattern
 * @param {object} opts
 * @returns {boolean}
 */
function isMatch(filepath, pattern, opts = {}) {
  return match(filepath, pattern, opts);
}

/**
 * Create a matcher function for a pattern.
 * Useful when matching many strings against the same pattern.
 *
 * @param {string} pattern
 * @param {object} opts
 * @returns {function}
 */
function matcher(pattern, opts = {}) {
  // Pre-compile for performance
  if (pattern[0] === '!') {
    const inner = matcher(pattern.slice(1), opts);
    return (str) => !inner(str);
  }

  const alts = splitTopLevel(pattern, '|');
  if (alts.length > 1) {
    const fns = alts.map((p) => matcher(p.trim(), opts));
    return (str) => fns.some((fn) => fn(str));
  }

  const patterns = expandBraces(pattern);
  const regexes = patterns.map((p) => globToRegex(p, opts));

  return (str) => {
    if (!str) return false;
    return regexes.some((re) => re.test(str));
  };
}

module.exports = { match, filter, isMatch, matcher, expandBraces, globToRegex };
