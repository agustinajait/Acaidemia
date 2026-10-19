import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ars } from '@/lib/format';
import { enrollFree, payWithMercadoPago, startTransfer } from '@/app/actions/checkout';

export const metadata = { title: 'Comprar curso' };

export default async function Checkout({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, user } = await requireUser(`/checkout/${courseId}`);
  const { data: course } = await supabase.from('courses').select('id, slug, title, price_ars, status').eq('id', courseId).maybeSingle();
  if (!course || course.status !== 'publicado') notFound();
  const { data: enrolled } = await supabase.from('enrollments').select('user_id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle();
  if (enrolled) redirect(`/aprender/${course.slug}`);
  const free = Number(course.price_ars) === 0;
  const mpReady = !!process.env.MP_ACCESS_TOKEN;

  return (
    <div className="container section narrow">
      <h1 style={{ fontSize: '1.8rem' }}>{free ? 'Inscripción' : 'Elegí cómo pagar'}</h1>
      <div className="card flat row between" style={{ marginBottom: 20 }}>
        <div><div className="small muted">Curso</div><strong>{course.title}</strong></div>
        <div className="price" style={{ fontSize: '1.5rem' }}>{ars(course.price_ars)}</div>
      </div>

      {free ? (
        <form action={enrollFree}>
          <input type="hidden" name="course_id" value={course.id} />
          <button className="btn block" type="submit">Confirmar inscripción gratuita</button>
        </form>
      ) : (
        <div className="stack">
          <div className="card">
            <h3>Mercado Pago</h3>
            <p className="muted small">Tarjeta de crédito o débito, dinero en cuenta o cuotas. El acceso se habilita al instante cuando se aprueba el pago.</p>
            <form action={payWithMercadoPago}>
              <input type="hidden" name="course_id" value={course.id} />
              <button className="btn mp block" type="submit" disabled={!mpReady}>Pagar con Mercado Pago</button>
              {!mpReady && <p className="hint">Mercado Pago aún no está configurado.</p>}
            </form>
          </div>
          <div className="card">
            <h3>Transferencia bancaria</h3>
            <p className="muted small">Transferís a nuestra cuenta, subís el comprobante y te habilitamos el curso cuando lo validamos (hasta 48 h hábiles).</p>
            <form action={startTransfer}>
              <input type="hidden" name="course_id" value={course.id} />
              <button className="btn secondary block" type="submit">Pagar por transferencia</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
