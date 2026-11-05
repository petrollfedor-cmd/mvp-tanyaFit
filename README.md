# myFitnea MVP

Mobile-first PWA: калькулятор калорий, дневник питания и Supabase Auth.

## Запуск

1. Скопируйте `.env.example` в `.env.local` и укажите URL и Publishable key Supabase-проекта.
2. Выполните `supabase/schema.sql` в **Supabase Dashboard → SQL Editor**.
3. В Supabase: **Authentication → URL Configuration** добавьте `http://localhost:3000/auth/callback` в Redirect URLs.
4. В **Authentication → Providers → Google** включите Google. В Google Cloud укажите callback URL Supabase, отображённый в настройках Google provider.
5. Запустите `npm run dev` и откройте `http://localhost:3000`.

Для production добавьте URL домена и его `/auth/callback` в Supabase Redirect URLs. На iPhone откройте сайт в Safari и выберите «На экран Домой».