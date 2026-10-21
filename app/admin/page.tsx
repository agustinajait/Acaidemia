import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ars, fecha, statusLabel } from '@/lib/format';
import { approveTransfer, rejectTransfer, reviewCourse, decideTeacher, saveSettings, saveSpecialist, deleteSpecialist } from '@/app/actions/admin';
import { PhotoField } from '@/components/photo-field';
import type { Specialist } from '@/lib/types';
import { Flash, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Administración' };
export const dynamic = 'force-dynamic';

const TABS = [
  ['transferencias', 'Transferencias'],
  ['cursos', 'Cursos a revisar'],
  ['docentes', 'Solicitudes de especialistas'],
  ['especialistas', 'Especialistas'],
  ['ventas', 'Ventas'],
  ['config', 'Configuración'],
] as const;

const one = <T,>(x: T | T[]) => (Array.isArray(x) ? x[0] : x);

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string; editar?: string }> }) {
  const { tab = 'transferencias', ok, error, editar } = await searchParams;
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
      <Flash ok={ok} error={error} okText="Listo." />
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
      {tab === 'especialistas' && <Specialists db={db} editId={editar} />}
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
            <input type="text" name="notes" placeholder="Devolución para el/la especialista (opcional)" style={{ flex: 1, minWidth: 200 }} />
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
        <div className="feature"><div className="small muted">Correspondiente a especialistas</div><div className="price" style={{ fontSize: '1.5rem' }}>{ars(sum('teacher_amount_ars'))}</div></div>
      </div>
      {byTeacher.size > 0 && (
        <div className="card flat">
          <h3>Acumulado por especialista</h3>
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
        <div className="field"><label>Comisión de la plataforma sobre cursos de especialistas (%)</label><input type="number" name="commission_pct" min={0} max={100} step="0.5" defaultValue={s?.commission_pct} /></div>
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

async function Specialists({ db, editId }: { db: DB; editId?: string }) {
  const { data } = await db.from('specialists').select('*').order('position').order('full_name');
  const rows = (data ?? []) as Specialist[];
  const editing = editId ? rows.find((r) => r.id === editId) ?? null : null;
  const categories = [...new Set(rows.map((r) => r.category.trim()).filter(Boolean))];
  return (
    <div className="two-col">
      <div className="stack">
        <div className="row between">
          <p className="muted small" style={{ margin: 0 }}>Se muestran en <Link href="/especialistas" target="_blank">/especialistas</Link>, ordenados por número de orden.</p>
          {editing && <Link className="btn secondary sm" href="/admin?tab=especialistas">+ Nuevo</Link>}
        </div>
        {!rows.length && <div className="card flat muted">Todavía no cargaste especialistas. Usá el formulario.</div>}
        {rows.map((s) => (
          <div key={s.id} className="card flat row" style={{ padding: 14, gap: 14, opacity: s.published ? 1 : .6 }}>
            <span className="avatar sm">{s.photo_url ? <img src={s.photo_url} alt="" /> : s.full_name.slice(0, 1)}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <strong>{s.full_name}</strong> {!s.published && <span className="badge">Oculto</span>}
              <div className="small muted">{s.category || 'Sin categoría'} · orden {s.position}{s.linkedin_url ? ' · LinkedIn ✓' : ''}</div>
            </div>
            <Link className="btn secondary sm" href={`/admin?tab=especialistas&editar=${s.id}#form-especialista`}>Editar</Link>
            <form action={deleteSpecialist}><input type="hidden" name="id" value={s.id} /><button className="btn ghost sm" style={{ color: 'var(--danger)' }}>Eliminar</button></form>
          </div>
        ))}
      </div>
      <div className="card" id="form-especialista">
        <h3>{editing ? `Editar: ${editing.full_name}` : 'Nuevo especialista'}</h3>
        <form action={saveSpecialist} key={editing?.id ?? 'nuevo'}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="field"><label>Nombre y apellido</label><input type="text" name="full_name" defaultValue={editing?.full_name} required /></div>
          <div className="field">
            <label>Categoría</label>
            <input type="text" name="category" defaultValue={editing?.category} list="categorias-especialistas" placeholder="Ej: Abordaje territorial" />
            <datalist id="categorias-especialistas">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="hint">Aparece como etiqueta y sirve para filtrar.</div>
          </div>
          <PhotoField name="photo_url" defaultValue={editing?.photo_url ?? null} />
          <div className="field"><label>Bio</label><textarea name="bio" defaultValue={editing?.bio} rows={5} placeholder="Trayectoria, experiencia y temas que enseña." /></div>
          <div className="field"><label>LinkedIn</label><input type="text" inputMode="url" name="linkedin_url" defaultValue={editing?.linkedin_url ?? ''} placeholder="https://www.linkedin.com/in/…" /></div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '0 1 120px' }}><label>Orden</label><input type="number" name="position" defaultValue={editing?.position ?? rows.length} step={1} /></div>
            <label className="row" style={{ gap: 8, fontWeight: 500, marginBottom: 22 }}><input type="checkbox" name="published" defaultChecked={editing ? editing.published : true} /> Visible en el sitio</label>
          </div>
          <button className="btn" type="submit">{editing ? 'Guardar cambios' : 'Agregar especialista'}</button>
        </form>
      </div>
    </div>
  );
}
