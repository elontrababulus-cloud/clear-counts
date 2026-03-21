# ClearCounts CRM — Project Structure

A Perfex CRM-style system built on Next.js, TypeScript, Tailwind CSS, shadcn/ui, and Firebase.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.0 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 | ^4 |
| UI Components | shadcn/ui | 4.1.0 |
| Backend / DB | Firebase (Firestore) | ^12 |
| Auth | Firebase Auth | ^12 |
| File Storage | Firebase Storage | ^12 |
| Deployment | Firebase App Hosting | — |
| Server State | TanStack React Query | ^5 |
| Client State | Zustand | ^5 |
| Forms | React Hook Form + Zod | ^7 / ^4 |
| Icons | Lucide React | ^0.577 |
| Dates | date-fns | ^4 |
| PDF Export | jsPDF + html2canvas | ^4 / ^1 |
| Drag & Drop | @dnd-kit/core + sortable | ^6 / ^10 |

---

## Directory Structure

```
clearcounts-crm/
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (fonts, providers)
│   │   ├── page.tsx                # Home / landing page
│   │   ├── globals.css             # Tailwind v4 global styles + CSS variables
│   │   └── favicon.ico
│   │
│   ├── components/
│   │   └── ui/                     # shadcn/ui primitives (do not edit directly)
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── sheet.tsx
│   │       ├── table.tsx
│   │       └── tabs.tsx
│   │
│   └── lib/
│       ├── firebase.ts             # Firebase app init — exports: auth, db, storage
│       └── utils.ts                # shadcn cn() utility (clsx + tailwind-merge)
│
├── public/                         # Static assets
│
├── .env.local                      # Local Firebase env vars (gitignored)
├── .env.example                    # Env var template to commit
├── .firebaserc                     # Firebase project alias
├── .gitignore
├── apphosting.yaml                 # Firebase App Hosting runtime config
├── components.json                 # shadcn/ui config
├── eslint.config.mjs
├── firebase.json                   # Firebase hosting config
├── next.config.ts
├── next-env.d.ts
├── package.json
├── postcss.config.mjs              # @tailwindcss/postcss plugin
└── tsconfig.json
```

---

## Environment Variables

All Firebase credentials are passed via `NEXT_PUBLIC_*` env vars. Copy `.env.example` to `.env.local` and fill in your Firebase project values.

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

---

## Firebase Config (`src/lib/firebase.ts`)

Initialises a single Firebase app instance (safe for hot-reload) and exports:

| Export | Type | Used for |
|--------|------|----------|
| `auth` | Auth | Firebase Authentication |
| `db` | Firestore | Database reads/writes |
| `storage` | Storage | File uploads |
| `default` (app) | FirebaseApp | Raw app instance |

---

## Firebase App Hosting (`apphosting.yaml`)

```yaml
runConfig:
  minInstances: 0   # scales to zero when idle
  maxInstances: 10
env:
  - variable: NODE_ENV
    value: production
```

---

## Planned Route Structure

> To be built out as the CRM features are added.

```
src/app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── layout.tsx          # Sidebar + topbar shell
│   ├── dashboard/
│   ├── clients/
│   ├── projects/
│   ├── invoices/
│   ├── estimates/
│   ├── tasks/
│   ├── leads/
│   ├── staff/
│   └── settings/
└── api/                    # Route handlers (if needed)
```

---

## Scripts

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Adding shadcn Components

```bash
npx shadcn@latest add <component-name>
```

Uses Tailwind v4 — no `tailwind.config.ts` needed. Styles live in `globals.css`.
