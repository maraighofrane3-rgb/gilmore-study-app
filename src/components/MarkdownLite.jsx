import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// 🕌 Detect right-to-left scripts (Arabic, Hebrew, etc.)
export const isRTL = (text) =>
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''));

// ============================================================
// 🧮 MATH: extract $..$ / $$..$$ / \(.. \) / \[..\] into tokens
// BEFORE markdown parsing, so no regex below can touch them.
// Code spans (`..`) and fences (```..```) are copied verbatim.
// Pure string ops; still guarded at the call site.
// ============================================================
const IM_S = '\uE000', IM_E = '\uE001'; // inline token delimiters
const DM_S = '\uE002', DM_E = '\uE003'; // display token delimiters
const makeInlineRe = () => new RegExp(IM_S + '\\d+' + IM_E, 'g');
const DISPLAY_LINE_RE = new RegExp('^' + DM_S + '(\\d+)' + DM_E + '$');

function extractMath(input) {
  const src = String(input || '');
  const map = {};
  let out = '';
  let iid = 0, did = 0, i = 0;
  const n = src.length;
  const findFrom = (needle, from) => src.indexOf(needle, from);

  while (i < n) {
    // fenced code ``` ... ``` -> verbatim (no math inside)
    if (src.startsWith('```', i)) {
      const end = findFrom('```', i + 3);
      if (end === -1) { out += src.slice(i); break; }
      out += src.slice(i, end + 3); i = end + 3; continue;
    }
    // inline code ` ... ` -> verbatim
    if (src[i] === '`') {
      const end = findFrom('`', i + 1);
      if (end === -1) { out += src[i]; i++; continue; }
      out += src.slice(i, end + 1); i = end + 1; continue;
    }
    // \[ .. \] display
    if (src.startsWith('\\[', i)) {
      const end = findFrom('\\]', i + 2);
      if (end !== -1) {
        const latex = src.slice(i + 2, end).trim();
        const tok = DM_S + (did++) + DM_E; map[tok] = { latex, display: true };
        out += '\n\n' + tok + '\n\n'; i = end + 2; continue;
      }
    }
    // $$ .. $$ display
    if (src.startsWith('$$', i)) {
      const end = findFrom('$$', i + 2);
      if (end !== -1) {
        const latex = src.slice(i + 2, end).trim();
        const tok = DM_S + (did++) + DM_E; map[tok] = { latex, display: true };
        out += '\n\n' + tok + '\n\n'; i = end + 2; continue;
      }
    }
    // \( .. \) inline (single line)
    if (src.startsWith('\\(', i)) {
      let j = i + 2, close = -1;
      while (j < n && src[j] !== '\n') { if (src.startsWith('\\)', j)) { close = j; break; } j++; }
      if (close !== -1) {
        const latex = src.slice(i + 2, close).trim();
        if (latex) {
          const tok = IM_S + (iid++) + IM_E; map[tok] = { latex, display: false };
          out += tok; i = close + 2; continue;
        }
      }
    }
    // $ .. $ inline (single line, not escaped, not empty)
    if (src[i] === '$' && !(i > 0 && src[i - 1] === '\\')) {
      let j = i + 1, close = -1;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '$' && src[j - 1] !== '\\') { close = j; break; }
        j++;
      }
      if (close !== -1) {
        const latex = src.slice(i + 1, close).trim();
        if (latex) {
          const tok = IM_S + (iid++) + IM_E; map[tok] = { latex, display: false };
          out += tok; i = close + 1; continue;
        }
      }
    }
    out += src[i]; i++;
  }
  return { text: out, map };
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// latex -> html, guarded 3 ways: capability check, try/catch, literal fallback.
const safeKatex = (latex, display) => {
  try {
    if (!katex || typeof katex.renderToString !== 'function') {
      return '<code>' + escapeHtml(latex) + '</code>';
    }
    return katex.renderToString(latex, {
      displayMode: !!display,
      throwOnError: false,
      errorColor: '#b3402f', // maple-rust: broken tex shows red, never crashes
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return '<code>' + escapeHtml(latex) + '</code>';
  }
};

const isBlockStart = (t) =>
  !t || /^(#{1,4}\s|[-*•]\s|\d+[.)]\s|>\s)/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t);

export default function MarkdownLite({ text, className = '' }) {
  if (!text) return null;
  const src = String(text);
  const rtl = isRTL(src);

  // 🛡️ Outer guard: with NO error boundary, an uncaught throw would blank the
  // whole app. So everything risky lives in here; worst case = plain text.
  try {
    // inner guard: if extraction ever fails, parse the original text with no math
    let processed = src, mathMap = {};
    try {
      const r = extractMath(src);
      processed = r.text; mathMap = r.map;
    } catch (e) {
      console.warn('MarkdownLite: math extraction skipped:', e?.message);
      processed = src; mathMap = {};
    }

    // Replace inline-math tokens inside a plain string with rendered nodes
    const renderWithMath = (str) => {
      const nodes = [];
      const re = makeInlineRe();
      let last = 0, m;
      while ((m = re.exec(str))) {
        if (m.index > last) nodes.push(str.slice(last, m.index));
        const tok = m[0];
        const entry = mathMap[tok];
        if (entry) {
          nodes.push(
            <span
              key={tok}
              dir="ltr"
              style={{ unicodeBidi: 'isolate' }}
              dangerouslySetInnerHTML={{ __html: safeKatex(entry.latex, false) }}
            />
          );
        } else {
          nodes.push(tok);
        }
        last = m.index + tok.length;
      }
      if (last < str.length) nodes.push(str.slice(last));
      return nodes;
    };

    // 🔤 Inline formatting: `code`, **bold**, *italic*  (+ math tokens)
    const inline = (t) => {
      const parts = [];
      const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
      let last = 0, m, key = 0;
      while ((m = regex.exec(t))) {
        if (m.index > last) parts.push(...renderWithMath(t.slice(last, m.index)));
        const tok = m[0];
        if (tok.startsWith('`')) {
          // code stays literal — math inside code is NOT rendered
          parts.push(<code key={key++} className="px-1 py-0.5 bg-page-cream border border-coffee-cream/20 rounded-sm font-mono text-[0.85em] text-maple-rust">{tok.slice(1, -1)}</code>);
        } else if (tok.startsWith('**') || tok.startsWith('__')) {
          parts.push(<strong key={key++} className="font-semibold text-yale-blue">{renderWithMath(tok.slice(2, -2))}</strong>);
        } else {
          parts.push(<em key={key++}>{renderWithMath(tok.slice(1, -1))}</em>);
        }
        last = m.index + tok.length;
      }
      if (last < t.length) parts.push(...renderWithMath(t.slice(last)));
      return parts;
    };

    const lines = processed.split(/\r?\n/);
    const blocks = [];
    let i = 0, key = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      if (!trimmed) { i++; continue; }

      // 🧮 display-math block (its own line, produced by extractMath)
      if (DISPLAY_LINE_RE.test(trimmed)) {
        const entry = mathMap[trimmed];
        if (entry) {
          blocks.push(
            <div
              key={key++}
              dir="ltr"
              className="my-3 overflow-x-auto overflow-y-hidden [&_.katex-display]:my-0 [&_.katex-display]:text-left"
              dangerouslySetInnerHTML={{ __html: safeKatex(entry.latex, true) }}
            />
          );
          i++; continue;
        }
      }

      // # Headings
      const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        const level = h[1].length;
        blocks.push(level <= 2
          ? <h4 key={key++} className="font-display text-base text-yale-blue mt-4 mb-1.5 first:mt-0">{inline(h[2])}</h4>
          : <h5 key={key++} className="font-display text-sm text-maple-rust mt-3 mb-1 first:mt-0 uppercase tracking-wide">{inline(h[2])}</h5>);
        i++; continue;
      }

      // --- horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        blocks.push(<hr key={key++} className="my-3 border-coffee-cream/30" />);
        i++; continue;
      }

      // > blockquote (border flips side in RTL)
      if (trimmed.startsWith('> ')) {
        const q = [];
        while (i < lines.length && lines[i].trim().startsWith('> ')) { q.push(lines[i].trim().slice(2)); i++; }
        blocks.push(
          <blockquote key={key++} className={`my-2 italic text-coffee-cream ${rtl ? 'border-r-2 pr-3' : 'border-l-2 pl-3'} border-gilmore-gold`}>
            {q.map((s, idx) => <React.Fragment key={idx}>{idx > 0 && <br />}{inline(s)}</React.Fragment>)}
          </blockquote>
        );
        continue;
      }

      // - bullet list (indent flips side in RTL)
      if (/^[-*•]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*•]\s+/, '')); i++; }
        blocks.push(
          <ul key={key++} className={`my-2 space-y-1.5 list-disc marker:text-maple-rust ${rtl ? 'mr-4' : 'ml-4'}`}>
            {items.map((it, idx) => <li key={idx} className="leading-relaxed pl-1">{inline(it)}</li>)}
          </ul>
        );
        continue;
      }

      // 1. numbered list
      if (/^\d+[.)]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+[.)]\s+/, '')); i++; }
        blocks.push(
          <ol key={key++} className={`my-2 space-y-1.5 list-decimal marker:text-maple-rust marker:font-semibold ${rtl ? 'mr-5' : 'ml-5'}`}>
            {items.map((it, idx) => <li key={idx} className="leading-relaxed pl-1">{inline(it)}</li>)}
          </ol>
        );
        continue;
      }

      // paragraph
      const para = [trimmed];
      i++;
      while (i < lines.length && !isBlockStart(lines[i].trim())) { para.push(lines[i].trim()); i++; }
      blocks.push(
        <p key={key++} className="my-2 leading-relaxed first:mt-0 last:mb-0">
          {para.map((p, idx) => <React.Fragment key={idx}>{idx > 0 && <br />}{inline(p)}</React.Fragment>)}
        </p>
      );
    }

    // 🕌 dir="rtl" flips alignment, punctuation order, list markers — everything
    return (
      <div dir={rtl ? 'rtl' : 'ltr'} className={`font-body text-sm text-library-ink ${className}`}>
        {blocks}
      </div>
    );
  } catch (err) {
    // 🛟 Last resort: never blank the page, never re-run math. Show the raw note.
    console.error('MarkdownLite render failed, showing plain text:', err);
    return (
      <div
        dir={rtl ? 'rtl' : 'ltr'}
        className={`font-body text-sm text-library-ink whitespace-pre-wrap break-words ${className}`}
      >
        {src}
      </div>
    );
  }
}