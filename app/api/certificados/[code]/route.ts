import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderCertificatePdf } from '@/lib/certificate-pdf';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = createAdminClient();
  const { data: cert } = await db.from('certificates').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (!cert) return NextResponse.json({ error: 'Certificado inexistente' }, { status: 404 });

  const { data: course } = await db.from('courses').select('owner_id').eq('id', cert.course_id).single();
  const { data: teacher } = course
    ? await db.from('profiles').select('full_name, role').eq('id', course.owner_id).single()
    : { data: null };

  const pdf = await renderCertificatePdf({
    code: cert.code,
    holderName: cert.holder_name,
    courseTitle: cert.course_title,
    hours: cert.hours,
    issuedAt: cert.issued_at,
    teacherName: teacher && teacher.role !== 'admin' ? teacher.full_name : null,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificado-${cert.code}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
