import type { ReactNode } from 'react';

/**
 * Formato simple para lecciones y descripciones (sin HTML, todo se escapa):
 *   ## Título          ### Subtítulo
 *   - ítem de lista     1. ítem numerado
 *   > Recuadro destacado
 *   **negrita**
 *   Respuesta orientativa: …   → queda oculta hasta que el alumno la abre
 * Las líneas en blanco separan párrafos. Un texto sin estas marcas se ve igual que antes.
 */
export function RichText({ text, className = 'prose rich' }: { text: string; className?: string }) {
  return <div className={className}>{parseBlocks(text)}</div>;
}

const ANSWER = /^respuesta orientativa:\s*/i;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const t = line.trim();
    if (!t) { i++; continue; }

    if (t.startsWith('### ')) { out.push(<h4 key={key++}>{inline(t.slice(4))}</h4>); i++; continue; }
    if (t.startsWith('## ')) { out.push(<h3 key={key++}>{inline(t.slice(3))}</h3>); i++; continue; }

    if (/^[-•] /.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•] /.test(lines[i].trim())) { items.push(lines[i].trim().slice(2)); i++; }
      out.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)] /.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)] /.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+[.)] /, '')); i++; }
      out.push(<ol key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>);
      continue;
    }
    if (t.startsWith('> ')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) { parts.push(lines[i].trim().slice(2)); i++; }
      out.push(<aside key={key++} className="callout">{parts.map((p, j) => <p key={j}>{inline(p)}</p>)}</aside>);
      continue;
    }

    // Párrafo: líneas seguidas hasta una línea en blanco o un bloque especial
    const para: string[] = [];
    while (i < lines.length) {
      const n = lines[i].trim();
      if (!n || /^(#{2,3} |[-•] |\d+[.)] |> )/.test(n)) break;
      if (para.length && ANSWER.test(n)) break; // la respuesta arranca su propio bloque
      para.push(n); i++;
    }
    const joined = para.join('\n');
    if (ANSWER.test(joined)) {
      out.push(
        <details key={key++} className="answer">
          <summary>Ver respuesta orientativa</summary>
          <p>{inline(capitalize(joined.replace(ANSWER, '')))}</p>
        </details>,
      );
    } else {
      out.push(<p key={key++}>{inline(joined)}</p>);
    }
  }
  return out;
}
