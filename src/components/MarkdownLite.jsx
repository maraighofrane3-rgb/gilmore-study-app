import React from 'react';

// 🔤 Inline formatting: `code`, **bold**, *italic*
const inline = (text) => {
  const parts = [];
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let last = 0, m, key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      parts.push(<code key={key++} className="px-1 py-0.5 bg-page-cream border border-coffee-cream/20 rounded-sm font-mono text-[0.85em] text-maple-rust">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      parts.push(<strong key={key++} className="font-semibold text-yale-blue">{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const isBlockStart = (t) =>
  !t || /^(#{1,4}\s|[-*•]\s|\d+[.)]\s|>\s)/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t);

export default function MarkdownLite({ text, className = '' }) {
  if (!text) return null;
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let i = 0, key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    // # Headings → visible subtitles
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

    // > blockquote
    if (trimmed.startsWith('> ')) {
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) { q.push(lines[i].trim().slice(2)); i++; }
      blocks.push(<blockquote key={key++} className="my-2 pl-3 border-l-2 border-gilmore-gold italic text-coffee-cream">{q.map((s, idx) => <React.Fragment key={idx}>{idx > 0 && <br />}{inline(s)}</React.Fragment>)}</blockquote>);
      continue;
    }

    // - bullet list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*•]\s+/, '')); i++; }
      blocks.push(
        <ul key={key++} className="my-2 ml-4 space-y-1.5 list-disc marker:text-maple-rust">
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
        <ol key={key++} className="my-2 ml-5 space-y-1.5 list-decimal marker:text-maple-rust marker:font-semibold">
          {items.map((it, idx) => <li key={idx} className="leading-relaxed pl-1">{inline(it)}</li>)}
        </ol>
      );
      continue;
    }

    // paragraph (collect until blank line or next block)
    const para = [trimmed];
    i++;
    while (i < lines.length && !isBlockStart(lines[i].trim())) { para.push(lines[i].trim()); i++; }
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed first:mt-0 last:mb-0">
        {para.map((p, idx) => <React.Fragment key={idx}>{idx > 0 && <br />}{inline(p)}</React.Fragment>)}
      </p>
    );
  }

  return <div className={`font-body text-sm text-library-ink ${className}`}>{blocks}</div>;
}