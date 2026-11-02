# Accessible Demon List (ADL)

A static GitHub Pages site backed by Supabase for accounts, submissions, and moderation. The site displays a real empty state until levels are approved; no example levels or fake accounts are included.

## Setup

1. Create a Supabase project and run `schema.sql` in its SQL editor once. This creates the tables, row-level security policies, and the server-side moderation function.
2. In Supabase Authentication, configure the Site URL to your deployed site and enable email/password authentication. Configure email confirmation and SMTP as appropriate. Add your site URL to the redirect allowlist if needed.
3. Copy the project URL and **anon/publishable** key from Supabase project settings into `config.js`. These are public browser credentials; never put a service-role/secret key or database password in this repository. Security is enforced by the SQL policies and function, not by hiding the anon key.
4. Deploy these files to GitHub Pages. Sign up for your own account and confirm your email. Find your user UUID in Supabase Authentication > Users. In the SQL editor, grant yourself administrator access, substituting your actual UUID:

   ```sql
   insert into public.admins (user_id) values ('YOUR-USER-UUID');
   ```

5. Only the project owner (or someone with privileged Supabase access) can grant or revoke administrators: insert or delete their UUID in `public.admins` via the SQL editor. Ordinary users cannot modify this table, even through the API. Keep your Supabase account secure and enable MFA. Admins sign in through the normal login; membership is verified by the database for every moderation action.

## Moderation

Signed-in users can submit levels and records. Admins see a moderation queue after login. Enter a unique positive rank to approve a level. For a record, enter the database ID of an existing level (find IDs in the Supabase Table Editor). Approved records appear beneath their level, with a link to their proof. The database rejects duplicate ranks; use the Table Editor to reorder levels if needed. Rejected submissions remain in the database for audit. Admins should independently verify level and proof details before approving.

The public list works without configuration but remains empty; login and submission buttons explain that setup is required. To preview locally, run `python3 -m http.server 8000` and open the site. The Supabase JavaScript library and fonts load from CDNs.
