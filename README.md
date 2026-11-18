This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase backend

The application uses Supabase for members, books, visitor and book logs, activities, RSSI history, device status, and loans. Database changes are tracked in `supabase/migrations/`; the schema and loan operations have been created in the connected Supabase project. New databases should use these migrations as the source of truth, not the legacy standalone SQL files in `supabase/`.

Configure the project URL and publishable key in `.env` (see `.env.example`), then restart the Next.js server. Do not put a `service_role` key in a `NEXT_PUBLIC_` variable. For deployments, set the same two public variables in the hosting provider's environment settings.

The home page (`/`) is the public RFID visitor kiosk, matching the first commit. It uses the `rfid-kiosk` Edge Function for check-in and self-registration; anonymous clients still have no direct read/write access to the library tables. Kiosk registration is limited to five attempts per IP per hour.

Administrative routes require a staff RFID scan followed by the staff member's Supabase email and password. RLS allows library data operations only for accounts whose **App Metadata** contains `"library_role": "staff"`. To provision a staff member:

1. Create a user under **Supabase Dashboard → Authentication → Users** and set its App Metadata to `{"library_role":"staff"}`.
2. Register that user's badge in **SQL Editor**, replacing the email and UID:

   ```sql
   insert into public.staff_rfid_badges (user_id, rfid_uid)
   select id, regexp_replace(upper('UID_KARTU_STAF'), '[^A-Z0-9]', '', 'g')
   from auth.users
   where lower(email) = lower('staf@example.com');
   ```

3. Give the user their Supabase email and password. App Metadata changes take effect after the user signs in again.

The RFID scan is an additional check in the application's login flow, not Supabase MFA: the Supabase password and staff App Metadata remain the actual database authorization. The Edge Function is public for kiosk use but only accepts the three bounded RFID actions and applies per-IP rate limits.

## RFID Reader

The Flask bridge is in `lib/rfid/server.py`. Install the Python dependencies and start it separately:

```bash
pip install Flask flask-cors pyscard
python lib/rfid/server.py
```

The browser client uses `http://localhost:5000` by default. Set `NEXT_PUBLIC_RFID_API_URL` for another host or port. The reader is polled on the visitor kiosk and the staff login screen. Visitor scans are checked and recorded through the Edge Function; unknown cards can use the original public registration form.

### Windows service installer

Build the single-file Windows installer from a Windows x64 development machine:

```powershell
powershell -ExecutionPolicy Bypass -File tools\rfid-installer\build.ps1
```

The installer is created at `artifacts\NewSmartLibraryRFIDSetup-v3.exe`. On each laptop that will use the RFID reader, run it as Administrator while connected to the internet. It installs Python and the RFID dependencies, registers the RFID bridge as an automatic Windows service, and checks that the local API responds. The reader's Windows/PCSC driver must still be installed if Windows does not recognize the reader. The service keeps checking for a reader, so it can be plugged in after the service starts.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
