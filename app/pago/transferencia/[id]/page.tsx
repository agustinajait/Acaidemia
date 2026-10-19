import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ars } from '@/lib/format';
import { uploadReceipt } from '@/app/actions/checkout';
import { Flash, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Pago por transferencia' };

export default async function Transferencia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireUser(`/pago/transferencia/${id}`);
  const [{ data: payment }, { data: s }] = await Promise.all([
    supabase.from('payments').select('id, status, amount_ars, receipt_path, admin_notes, method, course:courses(title, slug)').eq('id', id).maybeSingle(),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ]);
  if (!payment || payment.method !== 'transferencia') notFound();
  const course = Array.isArray(payment.course) ? payment.course[0] : payment.course;
  const rows: [string, string][] = [
    ['Titular', s?.bank_holder], ['CUIT', s?.bank_cuit], ['Banco', s?.bank_name], ['CBU / CVU', s?.bank_cbu], ['Alias', s?.bank_alias],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="container section narrow">
      <div className="row between"><h1 style={{ fontSize: '1.8rem', margin: 0 }}>Pago por transferencia</h1><StatusBadge s={payment.status} /></div>
      <p className="muted">{course?.title}</p>
      <Flash ok={ok ? 'Recibimos tu comprobante. Te avisamos en tu cuenta cuando lo validemos.' : undefined} error={error} />

      {payment.status === 'aprobado' ? (
        <div className="celebrate"><h2>¡Transferencia validada!</h2><Link href={`/aprender/${course?.slug}`} className="btn">Ir al curso</Link></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>1. Transferí exactamente <span style={{ color: 'var(--brand)' }}>{ars(payment.amount_ars)}</span></h3>
            {rows.length ? (
              <table><tbody>{rows.map(([k, v]) => <tr key={k}><th style={{ width: 120 }}>{k}</th><td><span className="copy">{v}</span></td></tr>)}</tbody></table>
            ) : <p className="muted">La administración todavía no cargó los datos bancarios.</p>}
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Referencia: <span className="copy">{payment.id.slice(0, 8).toUpperCase()}</span>. {s?.transfer_notes}</p>
          </div>
          <div className="card">
            <h3>2. Subí el comprobante</h3>
            {payment.status === 'rechazado' && <div className="flash error">Rechazado: {payment.admin_notes}. Podés subir un nuevo comprobante.</div>}
            {payment.status === 'en_revision' && <div className="flash info">Tu comprobante está en revisión. Si te equivocaste de archivo, podés reemplazarlo.</div>}
            <form action={uploadReceipt}>
              <input type="hidden" name="payment_id" value={payment.id} />
              <div className="field"><input type="file" name="receipt" accept="image/jpeg,image/png,image/webp,application/pdf" required /><div className="hint">JPG, PNG, WEBP o PDF · máx. 5 MB</div></div>
              <button className="btn" type="submit">Enviar comprobante</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
