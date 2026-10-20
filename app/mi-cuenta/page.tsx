import Link from 'next/link';
import { Icon } from '@/components/icons';
import { requireUser } from '@/lib/auth';
import { ars, fecha, statusLabel } from '@/lib/format';
import { updateProfile, requestTeacher } from '@/app/actions/profile';
import { Cover, Flash, Stars, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Mi cuenta' };

export default async function MiCuenta({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, user, profile } = await requireUser('/mi-cuenta');
  const [{ data: enrollments }, { data: payments }, { data: certs }, { data: progress }] = await Promise.all([
    supabase.from('enrollments').select('course:courses(id, slug, title, cover_url, lessons(id))').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('payments').select('id, status, method, amount_ars, created_at, admin_notes, course:courses(title)').eq('user_id', user.id).neq('method', 'gratis').order('created_at', { ascending: false }),
    supabase.from('certificates').select('code, course_title, issued_at').eq('user_id', user.id).order('issued_at', { ascending: false }),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user.id),
  ]);
  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  const one = <T,>(x: T | T[]) => (Array.isArray(x) ? x[0] : x);

  return (
    <div className="container section stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Hola, {profile.full_name.split(' ')[0]}</h1>
          <span className="muted small">{statusLabel[profile.role]} · <Link href={`/perfil/${user.id}`}>Ver mi perfil público</Link></span>
        </div>
        <Stars n={certs?.length ?? 0} />
      </div>
      <Flash ok={ok === 'solicitud' ? 'Recibimos tu solicitud para ser docente.' : ok} error={error} />

      <section>
        <h2>Mis cursos</h2>
        {enrollments?.length ? (
          <div className="grid">
            {enrollments.map((e) => {
              const c = one(e.course)!;
              const total = c.lessons?.length ?? 0;
              const d = (c.lessons ?? []).filter((l: { id: string }) => done.has(l.id)).length;
              return (
                <Link key={c.id} href={`/aprender/${c.slug}`} className="course-card">
                  <Cover url={c.cover_url} title={c.title} />
                  <div className="body">
                    <h3>{c.title}</h3>
                    <div className="progress"><div style={{ width: `${total ? (d / total) * 100 : 0}%` }} /></div>
                    <span className="small muted">{d} de {total} lecciones</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : <div className="card flat muted">Todavía no te inscribiste a ningún curso. <Link href="/cursos">Explorá el catálogo</Link>.</div>}
      </section>

      {!!certs?.length && (
        <section>
          <h2>Mis certificados</h2>
          <div className="grid">
            {certs.map((c) => (
              <a key={c.code} className="cert-tile" href={`/api/certificados/${c.code}`} target="_blank">
                <span className="medal"><Icon name="award" size={22} /></span>
                <span><strong>{c.course_title}</strong><br /><span className="small muted">{fecha(c.issued_at)} · {c.code}</span></span>
              </a>
            ))}
          </div>
        </section>
      )}

      {!!payments?.length && (
        <section>
          <h2>Mis pagos</h2>
          <div className="card flat table-wrap">
            <table>
              <thead><tr><th>Curso</th><th>Medio</th><th>Monto</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{one(p.course)?.title}</td>
                    <td>{statusLabel[p.method]}</td>
                    <td>{ars(p.amount_ars)}</td>
                    <td>{fecha(p.created_at)}</td>
                    <td>
                      <StatusBadge s={p.status} />
                      {p.method === 'transferencia' && p.status !== 'aprobado' && <div><Link className="small" href={`/pago/transferencia/${p.id}`}>{p.status === 'pendiente' ? 'Subir comprobante' : 'Ver detalle'}</Link></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="two-col">
        <div className="card">
          <h2>Mis datos</h2>
          <form action={updateProfile}>
            <div className="field"><label>Nombre y apellido</label><input type="text" name="full_name" defaultValue={profile.full_name} required /><div className="hint">Los certificados nuevos usan este nombre.</div></div>
            <div className="field"><label>Foto (URL)</label><input type="url" name="avatar_url" defaultValue={profile.avatar_url ?? ''} /></div>
            <div className="field"><label>Sobre mí</label><textarea name="bio" defaultValue={profile.bio ?? ''} /></div>
            <button className="btn" type="submit">Guardar</button>
          </form>
        </div>
        <div className="card" id="docente">
          <h2>Enseñar en Acaiidemia</h2>
          {profile.role !== 'alumno' ? (
            <><p className="muted">Ya tenés acceso al panel docente.</p><Link className="btn" href="/docente">Ir al panel docente</Link></>
          ) : profile.teacher_request ? (
            <p className="muted">Tu solicitud está en revisión. Te habilitamos el panel docente cuando se apruebe.</p>
          ) : (
            <><p className="muted">Creá tus cursos, la administración los revisa y los publica. Cobrás tu parte de cada venta.</p>
              <form action={requestTeacher}><button className="btn secondary" type="submit">Quiero ser docente</button></form></>
          )}
        </div>
      </section>
    </div>
  );
}
