import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ars, fecha, statusLabel } from '@/lib/format';
import { approveTransfer, rejectTransfer, reviewCourse, decideTeacher, saveSettings } from '@/app/actions/admin';
import { Flash, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Administración' };
export const dynamic = 'force-dynamic';

const TABS = [
  ['transferencias', 'Transferencias'],
  ['cursos', 'Cursos a revisar'],
  ['docentes', 'Solicitudes docentes'],
  ['ventas', 'Ventas'],
  ['config', 'Configuración'],
] as const;

const one = <T,>(x: T | T[]) => (Array.isArray(x) ? x[0] : x);

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string }> }) {
  const { tab = 'transferencias', ok } = await searchParams;
  await requireRole(['admin'], '/admin');
  const db = createAdminClient();

  const [{ count: pendingTransfers }, { count: pendingCourses }, { count: pendingTeachers }] = await Promise.all([
    db.from('payments').select('id', { count: 'exact', head: true }).eq('method', 'transferencia').eq('status', 'en_revision'),
    db.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'en_revision'),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('teacher_request', true),
  ]);
  const counts: Record<string, number> = { transferencias: pendingTransfers ?? 0, cursos: pendingCourses ?? 0, docentes: pendingTeachers ?? 0 };

  return (
    <div className="container section">
      <h1>Administración</h1>
      <Flash ok={ok} okText="Listo." />
      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'active' : ''}>
            {label}{counts[k] ? ` (${counts[k]})` : ''}
          </Link>
        ))}
      </nav>
      {tab === 'transferencias' && <Transfers db={db} />}
      {tab === 'cursos' && <CoursesReview db={db} />}
      {tab === 'docentes' && <Teachers db={db} />}
      {tab === 'ventas' && <Sales db={db} />}
      {tab === 'config' && <Settings db={db} />}
    </div>
  );
}

type DB = ReturnType<typeof createAdminClient>;

async function Transfers({ db }: { db: DB }) {
  const { data: rows } = await db.from('payments')
    .select('id, status, amount_ars, receipt_path, created_at, user:profiles!payments_user_id_fkey(full_name), course:courses(title)')
    .eq('method', 'transferencia').in('status', ['en_revision', 'pendiente'])
    .order('status', { ascending: true }).order('created_at', { ascending: true });
  const paths = (rows ?? []).map((r) => r.receipt_path).filter(Boolean) as string[];
  const { data: signed } = paths.length ? await db.storage.from('comprobantes').createSignedUrls(paths, 60 * 30) : { data: [] };
  const urlFor = (p: string | null) => signed?.find((s) => s.path === p)?.signedUrl ?? undefined;

  if (!rows?.length) return <div className="card flat muted">No hay transferencias pendientes.</div>;
  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.id} className="card flat">
          <div className="row between">
            <div>
              <strong>{one(r.user)?.full_name}</strong> · {one(r.course)?.title}
              <div className="small muted">Ref. <span className="copy">{r.id.slice(0, 8).toUpperCase()}</span> · {fecha(r.created_at)}</div>
            </div>
            <div className="row"><span className="price">{ars(r.amount_ars)}</span><StatusBadge s={r.status} /></div>
          </div>
          {r.receipt_path ? (
            <div className="row" style={{ marginTop: 12 }}>
              {urlFor(r.receipt_path) && <a className="btn secondary sm" href={urlFor(r.receipt_path)} target="_blank" rel="noreferrer">Ver comprobante</a>}
              <form action={approveTransfer} className="row">
                <input type="hidden" name="id" value={r.id} />
                <button className="btn ok sm" type="submit">Aprobar e inscribir</button>
              </form>
              <form action={rejectTransfer} className="row" style={{ flex: 1 }}>
                <input type="hidden" name="id" value={r.id} />
                <input type="text" name="notes" placeholder="Motivo del rechazo (lo ve el alumno)" style={{ flex: 1, minWidth: 180 }} />
                <button className="btn danger sm" type="submit">Rechazar</button>
              </form>
            </div>
          ) : <p className="small muted" style={{ margin: '8px 0 0' }}>Esperando que el alumno suba el comprobante.</p>}
        </div>
      ))}
    </div>
  );
}

async function CoursesReview({ db }: { db: DB }) {
  const { data: rows } = await db.from('courses')
    .select('id, slug, title, subtitle, price_ars, updated_at, owner:profiles!courses_owner_id_fkey(full_name), lessons(id)')
    .eq('status', 'en_revision').order('updated_at');
  if (!rows?.length) return <div className="card flat muted">No hay cursos esperando revisión.</div>;
  return (
    <div className="stack">
      {rows.map((c) => (
        <div key={c.id} className="card flat">
          <div className="row between">
            <div><strong>{c.title}</strong><div className="small muted">{one(c.owner)?.full_name} · {c.lessons?.length ?? 0} lecciones · {ars(c.price_ars)}</div></div>
            <div className="row">
              <Link className="btn secondary sm" href={`/cursos/${c.slug}`} target="_blank">Ver página</Link>
              <Link className="btn secondary sm" href={`/aprender/${c.slug}`} target="_blank">Ver contenido</Link>
            </div>
          </div>
          <form action={reviewCourse} className="row" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={c.id} />
            <input type="text" name="notes" placeholder="Devolución para el docente (opcional)" style={{ flex: 1, minWidth: 200 }} />
            <button className="btn ok sm" name="decision" value="publicar" type="submit">Publicar</button>
            <button className="btn secondary sm" name="decision" value="devolver" type="submit">Devolver con cambios</button>
          </form>
        </div>
      ))}
    </div>
  );
}

async function Teachers({ db }: { db: DB }) {
  const { data: rows } = await db.from('profiles').select('id, full_name, bio, created_at').eq('teacher_request', true).order('created_at');
  if (!rows?.length) return <div className="card flat muted">No hay solicitudes.</div>;
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const email = (id: string) => users?.users.find((u) => u.id === id)?.email;
  return (
    <div className="stack">
      {rows.map((p) => (
        <div key={p.id} className="card flat row between">
          <div><strong>{p.full_name}</strong> <span className="small muted">{email(p.id)}</span>{p.bio && <div className="small muted">{p.bio}</div>}</div>
          <form action={decideTeacher} className="row">
            <input type="hidden" name="id" value={p.id} />
            <button className="btn ok sm" name="decision" value="aprobar">Aprobar</button>
            <button className="btn secondary sm" name="decision" value="rechazar">Rechazar</button>
          </form>
        </div>
      ))}
    </div>
  );
}

async function Sales({ db }: { db: DB }) {
  const { data: rows } = await db.from('payments')
    .select('id, method, status, amount_ars, platform_fee_ars, teacher_amount_ars, created_at, user:profiles!payments_user_id_fkey(full_name), course:courses(title, owner:profiles!courses_owner_id_fkey(full_name, role))')
    .neq('method', 'gratis').order('created_at', { ascending: false }).limit(200);
  const approved = (rows ?? []).filter((r) => r.status === 'aprobado');
  const sum = (k: 'amount_ars' | 'platform_fee_ars' | 'teacher_amount_ars') => approved.reduce((a, r) => a + Number(r[k]), 0);

  // A liquidar por docente
  const byTeacher = new Map<string, number>();
  approved.forEach((r) => {
    const owner = one(one(r.course)?.owner);
    if (owner && owner.role !== 'admin' && Number(r.teacher_amount_ars) > 0) byTeacher.set(owner.full_name, (byTeacher.get(owner.full_name) ?? 0) + Number(r.teacher_amount_ars));
  });

  return (
    <div className="stack">
      <div className="features">
        <div className="feature"><div className="small muted">Facturación aprobada</div><div className="price" style={{ fontSize: '1.5rem' }}>{ars(sum('amount_ars'))}</div></div>
        <div className="feature"><div className="small muted">Ingreso HUEHACI</div><div className="price" style={{ fontSize: '1.5rem' }}>{ars(sum('platform_fee_ars'))}</div></div>
        <div className="feature"><div className="small muted">Correspondiente a docentes</div><div className="price" style={{ fontSize: '1.5rem' }}>{ars(sum('teacher_amount_ars'))}</div></div>
      </div>
      {byTeacher.size > 0 && (
        <div className="card flat">
          <h3>Acumulado por docente</h3>
          <table><tbody>{[...byTeacher].map(([n, v]) => <tr key={n}><td>{n}</td><td style={{ textAlign: 'right' }}>{ars(v)}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="card flat table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Alumno</th><th>Curso</th><th>Medio</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{fecha(r.created_at)}</td><td>{one(r.user)?.full_name}</td><td>{one(r.course)?.title}</td>
                <td>{statusLabel[r.method]}</td><td>{ars(r.amount_ars)}</td><td><StatusBadge s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function Settings({ db }: { db: DB }) {
  const { data: s } = await db.from('settings').select('*').eq('id', 1).single();
  return (
    <div className="card" id="config" style={{ maxWidth: 640 }}>
      <h2>Configuración</h2>
      <form action={saveSettings}>
        <div className="field"><label>Comisión de la plataforma sobre cursos de docentes (%)</label><input type="number" name="commission_pct" min={0} max={100} step="0.5" defaultValue={s?.commission_pct} /></div>
        <h3 style={{ marginTop: 24 }}>Datos para transferencias</h3>
        <div className="field"><label>Titular</label><input type="text" name="bank_holder" defaultValue={s?.bank_holder} /></div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: '1 1 200px' }}><label>CUIT</label><input type="text" name="bank_cuit" defaultValue={s?.bank_cuit} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Banco</label><input type="text" name="bank_name" defaultValue={s?.bank_name} /></div>
        </div>
        <div className="field"><label>CBU / CVU</label><input type="text" name="bank_cbu" defaultValue={s?.bank_cbu} /></div>
        <div className="field"><label>Alias</label><input type="text" name="bank_alias" defaultValue={s?.bank_alias} /></div>
        <div className="field"><label>Indicaciones para el alumno</label><textarea name="transfer_notes" defaultValue={s?.transfer_notes} rows={3} /></div>
        <button className="btn" type="submit">Guardar configuración</button>
      </form>
    </div>
  );
}
