# Acaidemia · un producto de HUEHACI

Plataforma de cursos online pagos con certificado verificable por QR y estrellas en el perfil.

**Stack:** Next.js 15 (App Router, Server Actions) · Supabase (Auth, Postgres con RLS, Storage) · Mercado Pago Checkout Pro · pdf-lib + qrcode.

## Qué incluye

| Rol | Funcionalidades |
|---|---|
| **Alumno/a** | Registro, catálogo con búsqueda, compra por Mercado Pago o transferencia (sube comprobante), cursada con progreso por lección, certificado PDF con QR al completar, ⭐ por curso en su perfil público |
| **Docente** | Solicita serlo desde "Mi cuenta"; crea cursos y lecciones (video YouTube/Vimeo + texto), envía a revisión, ve alumnos y ventas netas de comisión |
| **Admin (HUEHACI)** | Aprueba/rechaza transferencias viendo el comprobante, publica o devuelve cursos, aprueba docentes, ve ventas y acumulado a liquidar por docente, configura comisión y datos bancarios. También crea sus propios cursos (100% para la plataforma) |
| **Público** | Verificación de certificados en `/certificados/<código>` (a donde apunta el QR) |

## Puesta en marcha (Windows / PowerShell)

1. **Supabase:** creá un proyecto y en *SQL Editor* ejecutá `supabase/migrations/0001_acaidemia.sql` completo.
2. En *Authentication → URL Configuration* agregá `http://localhost:3000/auth/callback` (y la de producción) a *Redirect URLs*.
3. Copiá `.env.example` a `.env.local` y completá las claves (*Project Settings → API*).
4. Instalá y levantá:
   ```powershell
   npm install
   npm run dev
   ```
5. Registrate en http://localhost:3000/registro y convertite en admin desde el SQL Editor:
   ```sql
   begin;
   -- el trigger protect_profile_role solo deja cambiar roles al service_role o a un admin
   select set_config('request.jwt.claims', '{"role":"service_role"}', true);
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'TU_MAIL');
   commit;
   ```
6. En **Admin → Configuración** cargá CBU/alias y la comisión.

## Mercado Pago

- Usá primero las **credenciales de prueba** (Tus integraciones → tu app → Credenciales de prueba) en `MP_ACCESS_TOKEN`.
- **Webhook** (producción): en *Tus integraciones → Webhooks* configurá `https://TU-DOMINIO/api/mp/webhook`, evento **Pagos**, y copiá la clave secreta en `MP_WEBHOOK_SECRET`.
- El webhook nunca confía en el cuerpo de la notificación: consulta el pago a la API de MP y valida monto y referencia antes de inscribir.
- En local (http) MP no envía webhooks; el pago se confirma igual al volver a `/pago/resultado`, que consulta el estado a MP.

## Comisiones

Cada pago guarda `platform_fee_ars` y `teacher_amount_ars` según la comisión vigente. La liquidación a docentes es **manual** (se ve en Admin → Ventas). Para split automático hace falta el modelo marketplace de Mercado Pago (OAuth por docente) — próximo paso posible.

## Deploy

Vercel: importá el repo, cargá las mismas variables de entorno con `NEXT_PUBLIC_SITE_URL` = dominio final (el QR del certificado usa esa URL), y agregá ese dominio a las Redirect URLs de Supabase.

## Seguridad

- RLS en todas las tablas. El contenido de las lecciones solo lo ven inscriptos, el docente dueño y admin; el temario público sale de la función `course_syllabus`.
- Pagos, inscripciones y certificados se escriben solo desde el servidor (service role).
- Evaluación final: las respuestas correctas solo las leen dueño/admin; el alumno recibe las preguntas por `course_quiz()` y la corrección se hace en el servidor.
- Triggers impiden que un usuario cambie su propio rol o que un docente publique sin revisión.
- Comprobantes en bucket privado `comprobantes/<user_id>/…`; el admin los ve con URLs firmadas de 30 min.

## Próximos pasos sugeridos

emails transaccionales (pago aprobado, comprobante rechazado) · subida de portadas a Storage · cupones de descuento · split de pagos para docentes.
