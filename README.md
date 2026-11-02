# Accessible Demon List (ADL)

A static GitHub Pages site backed by Supabase for accounts, submissions, and moderation. The site displays a real empty state until levels are approved; no example levels or fake accounts are included.

## Setup

1. Create a Supabase project and run `schema.sql` in its SQL editor once. This creates the tables, row-level security policies, and the server-side moderation function.
2. Create a Discord application at <https://discord.com/developers/applications>, open **OAuth2**, and add this redirect URL exactly:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   Copy the **Client ID** and **Client Secret**.
3. In Supabase, open **Authentication > Providers > Discord**, enable it, paste the Client ID and Client Secret, and save. Email/password sign-in is no longer used by the site; you can leave the Email provider disabled so Discord is the only way in.
4. In **Authentication > URL Configuration**, set the Site URL to your deployed site (for example `https://minlol12.github.io/`) and add that URL to the redirect allowlist. This is the address users come back to after authorizing with Discord.
5. Copy the project URL and **anon/publishable** key from Supabase project settings into `config.js`. These are public browser credentials; never put a service-role/secret key or database password in this repository. Security is enforced by the SQL policies and function, not by hiding the anon key.
6. Deploy these files to GitHub Pages. Log in with Discord. Find your user UUID in Supabase Authentication > Users (the Discord account appears as a user with provider `discord`). In the SQL editor, grant yourself administrator access, substituting your actual UUID:

   ```sql
   insert into public.admins (user_id) values ('YOUR-USER-UUID');
   ```

7. Only the project owner (or someone with privileged Supabase access) can grant or revoke administrators: insert or delete their UUID in `public.admins` via the SQL editor. Ordinary users cannot modify this table, even through the API. Keep your Supabase account secure and enable MFA. Admins sign in through the normal Discord login; membership is verified by the database for every moderation action.

## Sign-in

Discord is the only sign-in method. Visitors are greeted with a "Continue with Discord" gate: the list, submissions, and admin queue stay hidden until they authorize the app. Accounts are created automatically on first login, and the site shows the Discord display name and avatar. Only `identify` scope is requested (username, display name, avatar) — no email, guilds, or messages.

To allow public browsing while still requiring Discord for submissions, set `requireLogin: false` in `config.js`.

## Moderation

Signed-in (Discord) users can submit levels and records. Admins see a moderation queue after login. Enter a unique positive rank to approve a level. For a record, enter the database ID of an existing level (find IDs in the Supabase Table Editor). Approved records appear beneath their level, with a link to their proof. The database rejects duplicate ranks; use the Table Editor to reorder levels if needed. Rejected submissions remain in the database for audit. Admins should independently verify level and proof details before approving.

Without configuration the gate is skipped so you can still see the layout, and the login and submission buttons explain that setup is required. To preview locally, run `python3 -m http.server 8000` and open the site. The Supabase JavaScript library and fonts load from CDNs.
