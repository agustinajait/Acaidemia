import Link from 'next/link';
import { Icon } from '@/components/icons';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fecha } from '@/lib/format';
import { CourseCard } from '@/components/ui';

export default async function Perfil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from('profiles').select('id, full_name, bio, avatar_url, role, created_at').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [{ data: certs }, { data: taught }] = await Promise.all([
    supabase.from('certificates').select('code, course_title, hours, issued_at').eq('user_id', id).order('issued_at', { ascending: false }),
    supabase.from('courses').select('id, slug, title, subtitle, cover_url, price_ars, hours, category').eq('owner_id', id).eq('status', 'publicado'),
  ]);
  const n = certs?.length ?? 0;

  return (
    <div className="container section stack">
      <div className="card row" style={{ gap: 20 }}>
        {p.avatar_url ? <img src={p.avatar_url} alt="" className="avatar" /> : <div className="avatar">{p.full_name[0]?.toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ marginBottom: 6 }}>{p.full_name}</h1>
          <div className="row">
            <span className="stars" aria-label={`${n} estrellas`}>{'★'.repeat(Math.min(n, 10))}{n > 10 ? '+' : ''}{n === 0 && <span className="muted small">Sin estrellas aún</span>}</span>
            <span className="small muted">{n} curso{n === 1 ? '' : 's'} aprobado{n === 1 ? '' : 's'}</span>
            {p.role === 'docente' && <span className="badge brand">Docente</span>}
          </div>
          {p.bio && <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{p.bio}</p>}
        </div>
      </div>

      {n > 0 && (
        <section>
          <h2>Certificaciones</h2>
          <div className="grid">
            {certs!.map((c) => (
              <Link key={c.code} href={`/certificados/${c.code}`} className="cert-tile">
                <span className="medal"><Icon name="award" size={22} /></span>
                <span><strong>{c.course_title}</strong><br /><span className="small muted">{fecha(c.issued_at)}{c.hours ? ` · ${String(c.hours).replace('.', ',')} h` : ''}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!!taught?.length && (
        <section>
          <h2>Cursos que dicta</h2>
          <div className="grid">{taught.map((c) => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}
    </div>
  );
}
