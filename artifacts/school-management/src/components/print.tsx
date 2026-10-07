import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';

export function BarcodeSvg({ value, height = 44 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', height, width: 1.8, displayValue: true, fontSize: 13, margin: 2, background: 'transparent' });
    } catch {
      /* invalid value */
    }
  }, [value, height]);
  return <svg ref={ref} role="img" aria-label={`باركود ${value}`} className="max-w-full" />;
}

export function usePrint() {
  const [content, setContent] = useState<ReactNode>(null);
  useEffect(() => {
    if (!content) return;
    const clear = () => setContent(null);
    window.addEventListener('afterprint', clear);
    const t = setTimeout(() => window.print(), 250);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', clear); };
  }, [content]);
  const node = content ? createPortal(<div dir="rtl" className="print-area print-only">{content}</div>, document.body) : null;
  return { printNode: node, print: (c: ReactNode) => setContent(c) };
}

export function PrintTable({ school, title, subtitle, headers, rows }: { school: string; title: string; subtitle?: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div>
      <div style={{ borderBottom: '2px solid #0d3b5c', paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13 }}>{school}</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0' }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12 }}>{subtitle}</div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{headers.map((h) => <th key={h} style={{ border: '1px solid #888', padding: '4px 6px', background: '#eee', textAlign: 'right' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ border: '1px solid #888', padding: '4px 6px' }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
