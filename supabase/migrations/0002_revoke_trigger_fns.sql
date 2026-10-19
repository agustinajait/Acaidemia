-- Las funciones de trigger no deben ser invocables vía /rest/v1/rpc (los triggers siguen funcionando)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.protect_course_status() from public, anon, authenticated;
