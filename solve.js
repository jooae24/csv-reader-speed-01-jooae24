// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Same answers on every input, produced by an indexOf-driven scanner:
//  - a whole record line with no quote and no stray CR is split at once;
//  - an unquoted field is one slice up to the next comma / LF / CR;
//  - a quoted field jumps from quote to quote, only touching characters
//    that change its value (doubled quotes, CR/LF inside quotes).
// No regex, no per-character loop, no allocation per field beyond the
// field strings and the row arrays the answer itself needs.

const COMMA = 0;
const DELIM = /[,\r\n]/g;
const QDELIM = /["\r\n]/g;
const LB = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on, its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  // Results of the last field read, shared so no per-field array is allocated.
  let fVal = '';
  let fEnd = END;
  let fAdd = 0;

  function pushErr(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads an unquoted field starting at `start`, with `prefix` already in the value.
  // Sets fVal/fEnd/fAdd (fAdd = characters appended to prefix).
  function readUnquoted(start, prefix) {
    let seg = start;
    let parts = null;
    DELIM.lastIndex = start;
    for (;;) {
      const m = DELIM.exec(text);
      if (m === null) {
        pos = n;
        if (parts === null) {
          fVal = prefix === '' ? text.slice(seg, n) : prefix + text.slice(seg, n);
        } else {
          if (seg < n) parts.push(text.slice(seg, n));
          fVal = prefix + parts.join('');
        }
        fEnd = END;
        fAdd = fVal.length - prefix.length;
        return;
      }
      const j = m.index;
      const ch = m[0];
      if (ch === ',') {
        pos = j + 1;
        if (parts === null) {
          fVal = prefix === '' ? text.slice(seg, j) : prefix + text.slice(seg, j);
        } else {
          if (seg < j) parts.push(text.slice(seg, j));
          fVal = prefix + parts.join('');
        }
        fEnd = COMMA;
        fAdd = fVal.length - prefix.length;
        return;
      }
      if (ch === '\n') {
        pos = j + 1;
        line += 1;
        if (parts === null) {
          fVal = prefix === '' ? text.slice(seg, j) : prefix + text.slice(seg, j);
        } else {
          if (seg < j) parts.push(text.slice(seg, j));
          fVal = prefix + parts.join('');
        }
        fEnd = LB;
        fAdd = fVal.length - prefix.length;
        return;
      }
      // CR
      if (text.charCodeAt(j + 1) === 10) {
        pos = j + 2;
        line += 1;
        if (parts === null) {
          fVal = prefix === '' ? text.slice(seg, j) : prefix + text.slice(seg, j);
        } else {
          if (seg < j) parts.push(text.slice(seg, j));
          fVal = prefix + parts.join('');
        }
        fEnd = LB;
        fAdd = fVal.length - prefix.length;
        return;
      }
      // Lone CR outside quotes: dropped, error recorded, field goes on.
      pushErr('stray_cr');
      if (parts === null) parts = [];
      if (seg < j) parts.push(text.slice(seg, j));
      seg = j + 1;
      DELIM.lastIndex = j + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fVal/fEnd/fAdd.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let seg = open + 1;
    let parts = null;
    QDELIM.lastIndex = open + 1;
    for (;;) {
      const m = QDELIM.exec(text);
      if (m === null) {
        // The quote never closes: literal character, text after it read again as unquoted.
        pos = open + 1;
        line = openLine;
        pushErr('unterminated_quote');
        readUnquoted(open + 1, '"');
        return;
      }
      const j = m.index;
      const ch = m[0];
      if (ch === '\n' || ch === '\r') {
        // CR or LF inside quotes: one LF in the value, one line counted.
        if (parts === null) parts = [];
        if (seg < j) parts.push(text.slice(seg, j));
        parts.push('\n');
        line += 1;
        const nx = ch === '\r' && text.charCodeAt(j + 1) === 10 ? j + 2 : j + 1;
        seg = nx;
        QDELIM.lastIndex = nx;
        continue;
      }
      // A quote at j.
      if (text.charCodeAt(j + 1) === 34) {
        // Doubled quote: one quote in the value.
        if (parts === null) parts = [];
        if (seg < j) parts.push(text.slice(seg, j));
        parts.push('"');
        seg = j + 2;
        QDELIM.lastIndex = j + 2;
        continue;
      }
      // Closing quote.
      let value;
      if (parts === null) {
        value = text.slice(seg, j);
      } else {
        if (seg < j) parts.push(text.slice(seg, j));
        value = parts.join('');
      }
      pos = j + 1;
      if (pos >= n) {
        fVal = value;
        fEnd = END;
        fAdd = 0;
        return;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        fVal = value;
        fEnd = COMMA;
        fAdd = 0;
        return;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        fVal = value;
        fEnd = LB;
        fAdd = 0;
        return;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fVal = value;
        fEnd = LB;
        fAdd = 0;
        return;
      }
      // What follows the closing quote is appended as it stands.
      readUnquoted(pos, value);
      if (fAdd > 0) pushErr('quote_junk');
      return;
    }
  }

  // Finishes a record's fields: header, or a row padded/cut to the first width.
  function finishRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (pos < n) {
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? n : nl;
    if (lineEnd === pos) {
      // Blank line: no record.
      pos = nl + 1;
      line += 1;
      continue;
    }
    const q = text.indexOf('"', pos);
    const hasQuote = q !== -1 && q < lineEnd;
    const r = text.indexOf('\r', pos);
    const hasCR = r !== -1 && r < lineEnd;
    if (!hasQuote && !hasCR) {
      // Fast path: a plain line, no quotes, no CRs: split it at once.
      recordLine = line;
      recordRow = header && columns === null ? null : rows.length;
      const fields = text.slice(pos, lineEnd).split(',');
      if (nl === -1) {
        pos = n;
      } else {
        pos = nl + 1;
        line += 1;
      }
      finishRecord(fields);
      continue;
    }
    if (!hasQuote && hasCR && nl !== -1 && r === lineEnd - 1) {
      // CRLF line ending, no quotes: strip the CR, split the rest.
      // (A line that is only the CR is a blank line.)
      if (lineEnd - 1 === pos) {
        pos = nl + 1;
        line += 1;
        continue;
      }
      recordLine = line;
      recordRow = header && columns === null ? null : rows.length;
      const fields = text.slice(pos, lineEnd - 1).split(',');
      pos = nl + 1;
      line += 1;
      finishRecord(fields);
      continue;
    }
    // Careful path: a quote, a stray CR, or a lone CR at the end of the text.
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    do {
      lastQuoted = text.charCodeAt(pos) === 34;
      if (lastQuoted) readQuoted();
      else readUnquoted(pos, '');
      fields.push(fVal);
    } while (fEnd === COMMA);
    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;
    finishRecord(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
