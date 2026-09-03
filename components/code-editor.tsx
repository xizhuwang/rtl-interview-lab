'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';

import type { Challenge } from '@/lib/challenges';

type CodeLanguage = Challenge['language'];

const tokenPattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|`[A-Za-z_]\w*|\$[A-Za-z_]\w*|\b(?:always|assign|begin|case|class|default|else|end|endcase|endclass|endfunction|endmodule|endtask|for|function|if|import|initial|input|localparam|module|output|parameter|reg|repeat|task|wire|while)\b|\b(?:integer|signed|unsigned|posedge|negedge)\b|\b(?:\d+(?:\.\d+)?|\d*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ?_]+)\b|(?:===|!==|==|!=|<=|>=|&&|\|\||<<|>>|\^~|~\^|[-+*/%&|^~!<>=?:]))/g;

function tokenClass(token: string) {
  if (token.startsWith('//') || token.startsWith('/*')) return 'text-slate-500';
  if (token.startsWith('"')) return 'text-amber-300';
  if (token.startsWith('`')) return 'text-fuchsia-300';
  if (token.startsWith('$')) return 'text-cyan-300';
  if (/^(?:always|assign|begin|case|class|default|else|end|endcase|endclass|endfunction|endmodule|endtask|for|function|if|import|initial|localparam|module|parameter|repeat|task|while)$/.test(token)) return 'text-violet-300';
  if (/^(?:input|output|reg|wire|integer|signed|unsigned|posedge|negedge)$/.test(token)) return 'text-sky-300';
  if (/^(?:\d|\d*')/.test(token)) return 'text-orange-300';
  return 'text-rose-300';
}

function HighlightedLine({ line, language }: { line: string; language: CodeLanguage }) {
  if (language === 'CNF / DIMACS') {
    if (/^\s*c(?:\s|$)/.test(line)) return <span className="text-slate-500">{line || ' '}</span>;
    const parts = line.split(/(p\s+cnf|^-?\d+|\s-?\d+)/g);
    return <>{parts.map((part, index) => <span key={index} className={/p\s+cnf/.test(part) ? 'text-violet-300' : /-?\d+/.test(part) ? 'text-orange-300' : undefined}>{part}</span>)}</>;
  }

  const pieces: { text: string; token: boolean }[] = [];
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ text: line.slice(cursor, index), token: false });
    pieces.push({ text: match[0], token: true });
    cursor = index + match[0].length;
  }
  if (cursor < line.length) pieces.push({ text: line.slice(cursor), token: false });
  if (!pieces.length) return <> </>;
  return <>{pieces.map((piece, index) => piece.token ? <span key={index} className={tokenClass(piece.text)}>{piece.text}</span> : <span key={index}>{piece.text}</span>)}</>;
}

function CodeLines({ code, language }: { code: string; language: CodeLanguage }) {
  const lines = code.split('\n');
  return <>{lines.map((line, index) => <span key={index}><HighlightedLine line={line} language={language} />{index < lines.length - 1 ? '\n' : null}</span>)}</>;
}

export function ReadOnlyCodeBlock({ code, language, ariaLabel }: { code: string; language: CodeLanguage; ariaLabel: string }) {
  const lines = code.split('\n');
  return (
    <section className="code-surface mt-3 grid max-h-[34rem] grid-cols-[3.25rem_minmax(0,1fr)] overflow-auto rounded-lg border border-editor-border bg-editor" aria-label={ariaLabel}>
      <div aria-hidden="true" className="sticky left-0 z-10 border-r border-editor-border bg-editor/95 py-4 text-right font-code text-sm leading-[1.625rem] text-editor-muted select-none">
        {lines.map((_, index) => <span className="block pr-3" key={index}>{index + 1}</span>)}
      </div>
      <pre className="min-w-max p-4 font-code text-sm leading-[1.625rem] text-editor-foreground"><code><CodeLines code={code} language={language} /></code></pre>
    </section>
  );
}

export function CodeEditor({ value, onChange, language, ariaLabel }: { value: string; onChange: (value: string) => void; language: CodeLanguage; ariaLabel: string }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const lines = useMemo(() => value.split('\n'), [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = value.slice(0, start) + '  ' + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start + 2, start + 2);
    });
  };

  return (
    <div className="code-surface relative min-h-[430px] h-[31rem] resize-y overflow-hidden bg-editor" data-testid="code-editor">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-[3.25rem] overflow-hidden border-r border-editor-border bg-editor/95 py-4 text-right font-code text-sm leading-[1.625rem] text-editor-muted select-none">
        <div style={{ transform: `translateY(-${scroll.top}px)` }}>{lines.map((_, index) => <span className="block pr-3" key={index}>{index + 1}</span>)}</div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-[3.25rem] overflow-hidden">
        <pre className="absolute min-w-max p-4 font-code text-sm leading-[1.625rem] text-editor-foreground" style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}><code><CodeLines code={value} language={language} /></code></pre>
      </div>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={ariaLabel}
        className="code-input absolute inset-y-0 right-0 left-[3.25rem] z-20 w-[calc(100%-3.25rem)] resize-none overflow-auto whitespace-pre bg-transparent p-4 font-code text-sm leading-[1.625rem] outline-none"
      />
    </div>
  );
}
