import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentAndEnroll } from '@/lib/enrollment';
import { mpPayment } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resultado del pago' };

export default async function Resultado({ searchParams }: { searchParams: Promise<{ p?: string; payment_id?: string; collection_id?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser('/mi-cuenta');
  const db = createAdminClient();
  const { data: payment } = sp.p
    ? await db.from('payments').select('id, user_id, status, amount_ars, course:courses(slug, title)').eq('id', sp.p).maybeSingle()
    : { data: null };
  if (!payment || payment.user_id !== user.id) {
    return <div className="container section narrow"><div className="card">No encontramos ese pago. <Link href="/mi-cuenta">Ir a mi cuenta</Link></div></div>;
  }

  // Respaldo del webhook (útil en local): consultamos el pago a MP y lo confirmamos.
  let status = payment.status as string;
  const mpId = sp.payment_id || sp.collection_id;
  if (status !== 'aprobado' && mpId && mpId !== 'null') {
    try {
      const mp = await mpPayment().get({ id: mpId });
      if (mp.external_reference === payment.id && mp.status === 'approved' && Math.abs(Number(mp.transaction_amount) - Number(payment.amount_ars)) < 0.01) {
        await approvePaymentAndEnroll(payment.id, { mp_payment_id: String(mp.id) });
        status = 'aprobado';
      } else if (mp.status === 'rejected') status = 'rechazado';
    } catch (e) {
      console.error('[pago/resultado]', e);
    }
  }
  const course = Array.isArray(payment.course) ? payment.course[0] : payment.course;

  return (
    <div className="container section narrow">
      {status === 'aprobado' ? (
        <div className="celebrate">
          <div style={{ fontSize: '2.5rem' }}>🎉</div>
          <h1 style={{ fontSize: '1.8rem' }}>¡Pago aprobado!</h1>
          <p>Ya tenés acceso a <strong>{course?.title}</strong>.</p>
          <Link href={`/aprender/${course?.slug}`} className="btn">Empezar el curso</Link>
        </div>
      ) : status === 'rechazado' ? (
        <div className="card">
          <h1 style={{ fontSize: '1.6rem' }}>El pago no se aprobó</h1>
          <p className="muted">Podés intentar con otro medio o pagar por transferencia.</p>
          <Link href={`/cursos/${course?.slug}`} className="btn">Volver al curso</Link>
        </div>
      ) : (
        <div className="card">
          <h1 style={{ fontSize: '1.6rem' }}>Pago en proceso</h1>
          <p className="muted">Mercado Pago todavía está procesando el pago. Te habilitamos el curso apenas se confirme; podés ver el estado en tu cuenta.</p>
          <Link href="/mi-cuenta" className="btn secondary">Ir a mi cuenta</Link>
        </div>
      )}
    </div>
  );
}
