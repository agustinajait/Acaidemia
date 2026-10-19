import { NextResponse, type NextRequest } from 'next/server';
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';
import { mpPayment } from '@/lib/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentAndEnroll } from '@/lib/enrollment';

export const dynamic = 'force-dynamic';

/**
 * Notificaciones de Mercado Pago. Nunca confiamos en el cuerpo: siempre consultamos
 * el pago a la API de MP con nuestro access token y validamos monto y referencia.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, any>));
  const type = body?.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = String(body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');

  if (type !== 'payment' || !dataId) return NextResponse.json({ ignored: true });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers.get('x-signature'),
        xRequestId: req.headers.get('x-request-id'),
        dataId: url.searchParams.get('data.id') ?? dataId,
        secret,
        toleranceSeconds: 600,
      });
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError) {
        console.warn('[mp-webhook] firma inválida', e.reason, e.requestId);
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
      throw e;
    }
  }

  try {
    const mp = await mpPayment().get({ id: dataId });
    const paymentId = mp.external_reference;
    if (!paymentId) return NextResponse.json({ ignored: true });

    const db = createAdminClient();
    const { data: payment } = await db.from('payments').select('id, amount_ars, status, method').eq('id', paymentId).maybeSingle();
    if (!payment || payment.method !== 'mercadopago') return NextResponse.json({ ignored: true });

    if (mp.status === 'approved') {
      if (Math.abs(Number(mp.transaction_amount) - Number(payment.amount_ars)) > 0.01) {
        await db.from('payments').update({ status: 'en_revision', mp_payment_id: dataId, admin_notes: `Monto MP (${mp.transaction_amount}) no coincide` }).eq('id', paymentId);
      } else {
        await approvePaymentAndEnroll(paymentId, { mp_payment_id: dataId });
      }
    } else if (['rejected', 'cancelled'].includes(mp.status || '') && payment.status !== 'aprobado') {
      await db.from('payments').update({ status: 'rechazado', mp_payment_id: dataId }).eq('id', paymentId);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[mp-webhook]', e);
    return NextResponse.json({ error: 'processing error' }, { status: 500 }); // MP reintenta
  }
}
