import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { ars } from '@/lib/format';
import { StatusBadge } from '@/components/ui';

export const metadata = { title: 'Panel de especialista' };

export default async function Docente() {
  const { supabase, user } = await requireRole(['docente', 'admin'], '/docente');
  const { data: courses } = await supabase.from('courses').select('id, slug, title, status, price_ars, review_notes, enrollments(user_id)').eq('owner_id', user.id).order('created_at', { ascending: false });
  const ids = (courses ?? []).map((c) => c.id);
  const { data: sales } = ids.length
    ? await supabase.from('payments').select('course_id, amount_ars, teacher_amount_ars').in('course_id', ids).eq('status', 'aprobado')
    : { data: [] };
  const gross = (sales ?? []).reduce((a, s) => a + Number(s.amount_ars), 0);
  const mine = (sales ?? []).reduce((a, s) => a + Number(s.teacher_amount_ars), 0);
  const students = (courses ?? []).reduce((a, c) => a + (c.enrollments?.length ?? 0), 0);

  return (
    <div className="container section stack">
      <div className="row between"><h1 style={{ margin: 0 }}>Panel de especialista</h1><Link className="btn" href="/docente/cursos/nuevo">+ Nuevo curso</Link></div>
      <div className="features">
        <div className="feature"><div className="small muted">Alumnos</div><div className="price" style={{ fontSize: '1.6rem' }}>{students}</div></div>
        <div className="feature"><div className="small muted">Ventas aprobadas</div><div className="price" style={{ fontSize: '1.6rem' }}>{ars(gross)}</div></div>
        <div className="feature"><div className="small muted">Tu parte (neto de comisión)</div><div className="price" style={{ fontSize: '1.6rem' }}>{ars(mine)}</div></div>
      </div>
      <div className="card flat table-wrap">
        <table>
          <thead><tr><th>Curso</th><th>Precio</th><th>Alumnos</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {(courses ?? []).map((c) => (
              <tr key={c.id}>
                <td><strong>{c.title}</strong>{c.review_notes && c.status === 'borrador' && <div className="small" style={{ color: 'var(--warn)' }}>Devolución: {c.review_notes}</div>}</td>
                <td>{ars(c.price_ars)}</td>
                <td>{c.enrollments?.length ?? 0}</td>
                <td><StatusBadge s={c.status} /></td>
                <td><Link className="btn secondary sm" href={`/docente/cursos/${c.id}`}>Editar</Link></td>
              </tr>
            ))}
            {!courses?.length && <tr><td colSpan={5} className="muted">Todavía no creaste cursos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
