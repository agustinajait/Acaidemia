import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fecha } from '@/lib/format';

export const metadata = { title: 'Verificación de certificado' };

export default async function Verificacion({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from('certificates').select('*, course:courses(slug)').eq('code', decodeURIComponent(code).toUpperCase()).maybeSingle();

  if (!c) {
    return (
      <div className="container section" style={{ maxWidth: 560 }}>
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <span className="badge danger">No válido</span>
          <h1 style={{ fontSize: '1.6rem', marginTop: 12 }}>No encontramos este certificado</h1>
          <p className="muted">El código <span className="copy">{decodeURIComponent(code)}</span> no corresponde a ningún certificado emitido por Acaiidemia.</p>
          <Link href="/certificados" className="btn secondary">Probar otro código</Link>
        </div>
      </div>
    );
  }
  const course = Array.isArray(c.course) ? c.course[0] : c.course;
  return (
    <div className="container section" style={{ maxWidth: 560 }}>
      <div className="card verify-ok stack">
        <span className="badge ok">✓ Certificado válido</span>
        <div>
          <div className="small muted">Otorgado a</div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: 0 }}><Link href={`/perfil/${c.user_id}`} style={{ textDecoration: 'none' }}>{c.holder_name}</Link></h1>
        </div>
        <div><div className="small muted">Curso aprobado</div><strong style={{ fontSize: '1.15rem' }}>{course ? <Link href={`/cursos/${course.slug}`}>{c.course_title}</Link> : c.course_title}</strong></div>
        <div className="row" style={{ gap: 28 }}>
          <div><div className="small muted">Emitido</div>{fecha(c.issued_at)}</div>
          {c.hours && <div><div className="small muted">Carga horaria</div>{String(c.hours).replace('.', ',')} h</div>}
          <div><div className="small muted">Código</div><span className="copy">{c.code}</span></div>
        </div>
        <a className="btn" href={`/api/certificados/${c.code}`} target="_blank">Ver certificado PDF</a>
        <p className="small muted" style={{ margin: 0 }}>Emitido por Acaiidemia · HUEHACI</p>
      </div>
    </div>
  );
}
