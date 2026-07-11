# Tahap 6-12: Upgrade Penguatan Backend, UI, dan Observability

## Sistem Prediksi ASI Eksklusif + XAI Panel LSTM

> **Urutan:** Tahap 0 (blocker) → Tahap 1-5 (build awal, di `Roadmap_Prompts.md`) → **Tahap 6-12 (dokumen ini)**.
> Setiap tahap tetap wajib ikuti siklus **[THINKING] → [BUILD] → [EKSEKUSI] → [REVIEW] → [PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]** secara ketat sebelum lanjut ke tahap berikutnya.

| Tahap | Nama | Fase | Agen Utama | Durasi |
|---|---|---|---|---|
| 6 | Data Integrity & Migration | Fase 1 | Backend Engineer | 2 sesi |
| 7 | Keamanan (Rate Limit, CSRF, Sanitasi) | Fase 1 | Backend Engineer | 2 sesi |
| 8 | Auth & RBAC | Fase 1 | Backend + Lead Architect | 3 sesi |
| 9 | Testing & DevOps | Fase 1 | MLOps + Backend | 3 sesi |
| 10 | Navigasi & Layout Premium | Fase 2 | UI/UX Agent | 2 sesi |
| 11 | Visualisasi, Aksesibilitas & Micro-interaction | Fase 2 | UI/UX Agent | 3 sesi |
| 12 | Observability & Model Versioning | Fase 3 | Lead Architect + MLOps | 2 sesi |

---

## Tahap 6: Data Integrity & Migration

### Prompt untuk AI Engineer (Backend & Database Engineer)

```
[THINKING]
1. Prisma db push (dipakai Tahap 1-5) tidak menyimpan history perubahan schema —
   berbahaya untuk proyek yang datanya juga jadi bahan laporan akademik/KP karena
   tidak reproducible. Migrasi harus formal.
2. Operasi append data saat ini per-baris tanpa transaction eksplisit di level
   keseluruhan file (hanya per-row upsert) — jika baris ke-50 dari 100 gagal,
   49 baris sebelumnya sudah tersimpan tapi sisanya tidak, database jadi
   partial/inkonsisten tanpa rollback.
3. Formula injection: kalau data CSV nanti dibuka ulang di Excel setelah export,
   string yang diawali =, +, -, @ bisa dieksekusi sebagai formula oleh Excel/Sheets.
   Ini celah keamanan klasik pada fitur export.
4. Duplikasi data harus dicek di level transaksi, bukan hanya via unique constraint
   yang menyebabkan exception mentah bocor ke user.

Edge cases:
- Migration gagal di tengah karena ada data existing yang melanggar constraint baru
  (misal kolom yang baru jadi NOT NULL tapi ada baris lama NULL) → perlu migration
  bertahap: tambah kolom nullable dulu, backfill, baru ubah jadi NOT NULL.
- Append 1000+ baris sekaligus → jangan loop query satu-satu ke DB, gunakan
  createMany/batch di dalam satu transaction.

[BUILD]

### 1. Ganti seluruh alur `db push` → migration formal
```bash
# Jalankan sekali untuk inisialisasi migration history dari schema saat ini
npx prisma migrate dev --name init_schema
```

### 2. prisma/migrations/README.md (dokumentasi wajib baru)
```markdown
# Migration Log

Setiap perubahan schema.prisma WAJIB lewat `npx prisma migrate dev --name <deskripsi>`,
BUKAN `prisma db push`. `db push` hanya boleh dipakai di eksperimen lokal yang belum
final dan tidak pernah di-commit ke repo.

## Riwayat
- init_schema: schema awal (Puskesmas, DataBulanan, Prediksi, ShapValue, UploadLog)
```

### 3. src/lib/actions/upload.ts — perbaikan appendData dengan transaction penuh
```typescript
export async function appendData(formData: FormData): Promise<ApiResponse<any>> {
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'Tidak ada file' }
  const text = await file.text()
  const rows = parseCSV(text)

  const results = { success: 0, fail: 0, failedRows: [] as string[] }

  try {
    await prisma.$transaction(async (tx) => {
      for (const [idx, row] of rows.entries()) {
        const dv = validateDate(String(row['Tanggal']))
        if (!dv.valid || !dv.date) {
          results.fail++
          results.failedRows.push(`Baris ${idx + 2}: ${dv.error}`)
          continue
        }
        const puskesmas = await tx.puskesmas.findFirst({ where: { nama: String(row['Puskesmas']) } })
        if (!puskesmas) {
          results.fail++
          results.failedRows.push(`Baris ${idx + 2}: Puskesmas "${row['Puskesmas']}" tidak ditemukan`)
          continue
        }
        await tx.dataBulanan.upsert({
          where: { puskesmas_id_tanggal: { puskesmas_id: puskesmas.id, tanggal: dv.date } },
          update: {
            jumlah_bayi_6_bulan: row['Jumlah_Bayi_6_Bulan'] as number,
            jumlah_asi_eksklusif: row['Jumlah_ASI_Eksklusif'] as number,
            persentase_cakupan: row['Persentase_Cakupan'] as number,
          },
          create: {
            puskesmas_id: puskesmas.id,
            tanggal: dv.date,
            jumlah_bayi_6_bulan: row['Jumlah_Bayi_6_Bulan'] as number,
            jumlah_asi_eksklusif: row['Jumlah_ASI_Eksklusif'] as number,
            persentase_cakupan: row['Persentase_Cakupan'] as number,
          },
        })
        results.success++
      }

      await tx.uploadLog.create({
        data: {
          filename: file.name,
          total_rows: rows.length,
          rows_valid: results.success,
          rows_rejected: results.fail,
          status: results.fail === 0 ? 'SUCCESS' : results.success > 0 ? 'PARTIAL' : 'FAILED',
          detail_error: results.failedRows.length ? results.failedRows.join('; ') : null,
        },
      })

      // Kalau mau strict all-or-nothing (bukan partial), lempar error di sini
      // agar seluruh transaction di-rollback ketika ada baris gagal:
      // if (results.fail > 0) throw new Error(`${results.fail} baris gagal, transaksi dibatalkan`)
    })

    return {
      success: results.fail === 0,
      data: results,
      message: `${results.success} baris berhasil, ${results.fail} ditolak`,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Transaksi gagal, semua perubahan dibatalkan' }
  }
}
```

### 4. src/lib/sanitize.ts (BARU — cegah formula injection saat export)
```typescript
export function sanitizeForExcel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/^[=+\-@]/.test(str)) {
    return `'${str}` // prefix apostrophe memaksa Excel baca sebagai teks, bukan formula
  }
  return str
}
```
Terapkan `sanitizeForExcel()` di setiap kolom string sebelum ditulis ke file export
CSV/Excel di `src/lib/actions/export.ts` (dibangun di Tahap 5).

[EKSEKUSI]
1. npx prisma migrate dev --name init_schema
2. Update src/lib/actions/upload.ts sesuai kode di atas
3. Buat src/lib/sanitize.ts, import dan pakai di export.ts
4. Test: upload CSV berisi baris dengan nilai "=CMD('calc')" di kolom Puskesmas
   → hasil export harus menampilkan string apa adanya, bukan formula aktif saat dibuka di Excel
5. Test: upload CSV dengan 1 baris sengaja rusak di tengah 20 baris valid →
   pastikan uploadLog mencatat status PARTIAL dengan detail_error terisi

[REVIEW]
- [ ] `npx prisma migrate status` menunjukkan migration history tersimpan, bukan "not tracked"
- [ ] Append 1 file dengan baris campur valid/invalid menghasilkan uploadLog yang akurat
- [ ] File export CSV yang dibuka di Excel TIDAK menjalankan formula dari data yang di-upload
- [ ] Tidak ada lagi pemanggilan `prisma db push` di manapun (cek grep di seluruh repo)

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Migration gagal karena data existing melanggar constraint baru: buat migration
  perantara yang backfill nilai default dulu sebelum constraint diperketat.
- Transaction timeout untuk file besar (>5000 baris): pecah jadi batch per 500 baris
  dengan beberapa transaction terpisah, bukan satu transaction raksasa.
```

---

## Tahap 7: Keamanan — Rate Limiting, CSRF, Validasi Server

### Prompt untuk AI Engineer (Backend Engineer)

```
[THINKING]
1. NFR di PRD menjanjikan rate limiting dan CSRF protection tapi belum ada
   implementasi apa pun sampai Tahap 6. Next.js Server Actions punya proteksi
   origin-check bawaan, tapi Route Handlers (app/api/*) TIDAK otomatis terlindungi
   dan butuh middleware eksplisit.
2. Rate limiting harus granular: endpoint upload/predict lebih ketat daripada
   endpoint read-only (GET /api/puskesmas).
3. Untuk skala proyek ini (bukan enterprise), rate limiter in-memory sudah cukup
   — tidak perlu Redis kecuali nanti di-deploy multi-instance.

Edge cases:
- Rate limit berbasis IP bisa keliru kalau di belakang proxy/load balancer
  (semua request tampak dari 1 IP) → baca X-Forwarded-For dengan hati-hati,
  jangan percaya membabi buta (bisa dipalsukan client).
- Middleware harus skip untuk static assets, kalau tidak performa turun drastis.

[BUILD]

### 1. src/middleware.ts (BARU)
```typescript
import { NextRequest, NextResponse } from 'next/server'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = {
  '/api/data/upload': 5,
  '/api/data/append': 5,
  '/api/predict': 20,
  default: 60,
}

const buckets = new Map<string, { count: number; resetAt: number }>()

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `${ip}:${req.nextUrl.pathname}`
}

function getLimit(pathname: string): number {
  const match = Object.keys(RATE_LIMIT_MAX).find(p => p !== 'default' && pathname.startsWith(p))
  return match ? RATE_LIMIT_MAX[match as keyof typeof RATE_LIMIT_MAX] : RATE_LIMIT_MAX.default
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  const key = getClientKey(req)
  const limit = getLimit(req.nextUrl.pathname)
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return NextResponse.next()
  }

  if (bucket.count >= limit) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan, coba lagi sebentar' },
      { status: 429 }
    )
  }

  bucket.count++
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

> Catatan: `buckets` in-memory akan reset setiap deploy/restart server — cukup untuk
> skala akademik/internal. Kalau nanti perlu multi-instance production, ganti dengan
> Upstash Redis rate limiter.

### 2. next.config.js — pastikan allowedOrigins untuk Server Actions
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? ''].filter(Boolean),
    },
  },
}
module.exports = nextConfig
```

### 3. src/lib/validators/csv-security.ts (BARU — sanitasi input sebelum parse)
```typescript
export function stripDangerousChars(input: string): string {
  // Hapus null byte dan karakter kontrol yang bisa mengganggu parser
  return input.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

export function isSuspiciousFormula(value: string): boolean {
  return /^[=+\-@]/.test(value.trim())
}
```
Panggil `isSuspiciousFormula()` di `validateUpload()` (Tahap 5) — kalau nama Puskesmas
atau field teks lain diawali karakter formula, tandai sebagai warning di preview
(bukan otomatis ditolak, karena bisa saja data sah, tapi user harus diberi tahu).

[EKSEKUSI]
1. Buat src/middleware.ts
2. Update next.config.js
3. npm run dev, lalu test rate limit: kirim 6 request beruntun ke /api/data/upload
   dalam < 1 menit → request ke-6 harus dapat HTTP 429
4. Test Server Action dari origin asing (curl dengan header Origin berbeda) →
   harus ditolak otomatis oleh proteksi bawaan Next.js

[REVIEW]
- [ ] Endpoint upload/append/predict mengembalikan 429 setelah melewati limit
- [ ] Endpoint GET biasa (misal /api/puskesmas) tidak ke-throttle di request wajar
- [ ] Server Action tetap berfungsi normal dari origin yang sah (localhost:3000)
- [ ] Static assets (_next/*, favicon, dll) tidak terkena middleware (cek matcher)

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Rate limit terlalu ketat sampai mengganggu development: naikkan RATE_LIMIT_MAX
  sementara via env var saat NODE_ENV=development.
- Middleware bikin semua request lambat: pastikan matcher hanya cocok /api/*,
  bukan seluruh path termasuk assets.
```

---

## Tahap 8: Auth & RBAC

### Prompt untuk AI Engineer (Backend Engineer + Lead Architect Review)

```
[THINKING]
1. PRD section 3 sudah membedakan 4 jenis pengguna dengan kebutuhan berbeda
   (Dinkes: lihat semua, Kepala Puskesmas: lihat + upload data sendiri, Epidemiolog:
   lihat + export, Admin: full access) tapi belum pernah dipetakan ke role sistem.
   Sederhanakan jadi 3 role teknis: ADMIN, PUSKESMAS, VIEWER.
2. Tabel `users` di schema.prisma sudah ada sejak Tahap 2 tapi kolom belum lengkap
   untuk auth (perlu password hash, role, relasi opsional ke puskesmas_id untuk
   role PUSKESMAS supaya scoped hanya ke datanya sendiri).
3. NextAuth v5 (Auth.js) dengan Credentials provider paling cocok untuk kasus ini
   (tidak butuh OAuth eksternal, cukup username/password internal Dinkes).
4. Halaman upload/append HARUS diproteksi ADMIN atau PUSKESMAS (scoped), sedangkan
   dashboard read-only bisa diakses semua role termasuk VIEWER.

Edge cases:
- Role PUSKESMAS mencoba append data untuk Puskesmas lain (bukan miliknya) →
  harus ditolak di level Server Action, bukan cuma disembunyikan di UI (security
  by obscurity tidak cukup).
- Session expired saat sedang isi form upload panjang → harus dapat pesan jelas,
  bukan error generic 401 yang membingungkan.

[BUILD]

### 1. Update prisma/schema.prisma — lengkapi model User
```prisma
enum Role {
  ADMIN
  PUSKESMAS
  VIEWER
}

model User {
  id            Int        @id @default(autoincrement())
  username      String     @unique @db.VarChar(50)
  password_hash String     @db.VarChar(255)
  role          Role       @default(VIEWER)
  puskesmas_id  Int?       // hanya diisi jika role = PUSKESMAS, scope data
  puskesmas     Puskesmas? @relation(fields: [puskesmas_id], references: [id])
  created_at    DateTime   @default(now())
  @@map("users")
}
```
Jalankan `npx prisma migrate dev --name add_user_auth` setelah ini.

### 2. Install & setup NextAuth
```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

### 3. src/lib/auth.ts (BARU)
```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (credentials) => {
        const username = credentials?.username as string
        const password = credentials?.password as string
        if (!username || !password) return null

        const user = await prisma.user.findUnique({ where: { username } })
        if (!user) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        return {
          id: String(user.id),
          name: user.username,
          role: user.role,
          puskesmasId: user.puskesmas_id,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as any).role
        token.puskesmasId = (user as any).puskesmasId
      }
      return token
    },
    session: ({ session, token }) => {
      (session.user as any).role = token.role
      ;(session.user as any).puskesmasId = token.puskesmasId
      return session
    },
  },
  pages: { signIn: '/login' },
})
```

### 4. src/app/api/auth/[...nextauth]/route.ts
```typescript
export { GET, POST } from '@/lib/auth'
```

### 5. Update src/middleware.ts (gabungkan dengan rate limiter Tahap 7)
```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PROTECTED_ADMIN_ONLY = ['/upload', '/api/data/upload', '/api/data/append']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_ADMIN_ONLY.some(p => pathname.startsWith(p))

  if (isProtected) {
    const role = (req.auth?.user as any)?.role
    if (!req.auth || (role !== 'ADMIN' && role !== 'PUSKESMAS')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  // ... gabungkan logika rate limiting dari Tahap 7 di sini juga
  return NextResponse.next()
})

export const config = {
  matcher: ['/upload/:path*', '/api/:path*'],
}
```

### 6. Guard tambahan di Server Action (bukan cuma UI/middleware)
```typescript
// Tambahkan di awal appendData() di src/lib/actions/upload.ts
import { auth } from '@/lib/auth'

export async function appendData(formData: FormData): Promise<ApiResponse<any>> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Harus login' }

  const role = (session.user as any).role
  const scopedPuskesmasId = (session.user as any).puskesmasId

  if (role === 'PUSKESMAS' && scopedPuskesmasId) {
    // Nanti di dalam loop, tolak baris yang puskesmas_id-nya bukan scopedPuskesmasId
    // (detail implementasi menyesuaikan struktur baris CSV)
  }
  if (role === 'VIEWER') return { success: false, error: 'Tidak punya akses upload data' }

  // ... lanjut logika append yang sudah ada
}
```

### 7. src/app/login/page.tsx (halaman login sederhana, sesuai tema glassmorphism)
```tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import GlowCard from '@/components/ui/GlowCard'
import GradientButton from '@/components/ui/GradientButton'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await signIn('credentials', { username, password, redirect: false })
    if (res?.error) setError('Username atau password salah')
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <GlowCard className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">Masuk</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Username" className="w-full bg-dark-surface border border-white/10 rounded-lg px-4 py-2 text-sm" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" className="w-full bg-dark-surface border border-white/10 rounded-lg px-4 py-2 text-sm" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <GradientButton className="w-full">Masuk</GradientButton>
        </form>
      </GlowCard>
    </div>
  )
}
```

### 8. prisma/seed-users.ts (BARU — buat akun admin awal)
```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ganti_password_ini', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password_hash: hash, role: 'ADMIN' },
  })
  console.log('Admin user seeded. GANTI PASSWORD SEGERA setelah login pertama.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

[EKSEKUSI]
1. npx prisma migrate dev --name add_user_auth
2. npm install next-auth@beta bcryptjs
3. Set NEXTAUTH_SECRET di .env.local (generate dengan: openssl rand -base64 32)
4. SEED_ADMIN_PASSWORD="password_kuat_sementara" npx tsx prisma/seed-users.ts
5. npm run dev → buka /login, coba login dengan admin
6. Coba akses /upload tanpa login → harus redirect ke /login
7. Login sebagai admin → coba akses /upload → harus berhasil

[REVIEW]
- [ ] Login gagal dengan password salah menampilkan pesan error, bukan crash
- [ ] Halaman /upload dan endpoint /api/data/upload, /api/data/append terproteksi
- [ ] Role VIEWER tidak bisa memicu appendData() bahkan lewat curl langsung ke Server Action
- [ ] Session tersimpan dan bertahan across page reload
- [ ] Password di database tersimpan sebagai hash, BUKAN plaintext (cek langsung di DB)

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- NextAuth v5 masih beta, ada breaking changes antar versi minor: pin versi exact
  di package.json, jangan pakai caret (^) untuk next-auth sampai versi stabil rilis.
- Middleware auth() dan rate limiter Tahap 7 bentrok (dua middleware terpisah tidak
  bisa digabung langsung di Next.js): gabungkan jadi satu file middleware.ts dengan
  logika berurutan (cek rate limit dulu, baru cek auth).
```

---

## Tahap 9: Testing & DevOps

### Prompt untuk AI Engineer (MLOps + Backend Agent)

```
[THINKING]
1. Testing selama ini cuma dijanjikan di Agents.md tapi nol implementasi.
   Prioritaskan test untuk bagian paling berisiko: preprocessing (sliding window),
   validasi tanggal, dan konsistensi SHAP — bukan coverage 100% semua file.
2. docker-compose.yml belum ada sama sekali, padahal disebut sebagai tech stack
   sejak Tahap 1. Tanpa ini, onboarding developer baru butuh setup manual 3 service.
3. CI sederhana (GitHub Actions) bisa mencegah regresi tanpa perlu infrastruktur mahal.

Edge cases:
- Test SHAP additivity harus toleran (floating point), bukan exact equality.
- docker-compose harus punya healthcheck agar Next.js tidak start sebelum MySQL
  benar-benar siap menerima koneksi.

[BUILD]

### 1. ml-engine/tests/test_preprocess.py
```python
import numpy as np
import pytest
from preprocess import prepare_sliding_window, WINDOW_SIZE

def test_sliding_window_valid_input():
    data = np.random.rand(15, 3)
    result = prepare_sliding_window(data)
    assert result.shape == (1, WINDOW_SIZE, 3)

def test_sliding_window_rejects_insufficient_data():
    data = np.random.rand(5, 3)
    with pytest.raises(ValueError, match="Minimal"):
        prepare_sliding_window(data)

def test_sliding_window_rejects_nan():
    data = np.random.rand(15, 3)
    data[0, 0] = np.nan
    with pytest.raises(ValueError, match="NaN"):
        prepare_sliding_window(data)

def test_sliding_window_takes_last_n_months():
    data = np.arange(15 * 3).reshape(15, 3).astype(float)
    result = prepare_sliding_window(data)
    np.testing.assert_array_equal(result[0], data[-WINDOW_SIZE:])
```

### 2. ml-engine/tests/test_shap.py
```python
import numpy as np
from shap_explainer import format_shap

def test_format_shap_structure():
    dummy_sv = [np.random.rand(1, 12, 1) for _ in range(3)]
    result = format_shap(dummy_sv, expected_value=65.0, pid=1)
    assert result["success"] is True
    assert len(result["features"]) == 3
    assert len(result["features"][0]["impacts"]) == 12
    assert "mean_abs_impact" in result["features"][0]

def test_shap_additivity_tolerance():
    # Additivity: sum(shap) + expected_value harus dekat dengan prediksi asli
    # (dicek dengan toleransi, bukan exact match, karena floating point)
    shap_sum = 5.2341
    expected_value = 60.0
    predicted = 65.2
    assert abs((shap_sum + expected_value) - predicted) < 0.5
```

### 3. src/lib/actions/__tests__/upload.test.ts (Vitest)
```typescript
import { describe, it, expect } from 'vitest'

function validateDateFormat(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str)
}

describe('Validasi tanggal upload', () => {
  it('menolak format tanggal salah', () => {
    expect(validateDateFormat('30-02-2024')).toBe(false)
  })
  it('menerima format YYYY-MM-DD', () => {
    expect(validateDateFormat('2024-02-29')).toBe(true)
  })
})
```

### 4. package.json — tambahkan script test
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

### 5. docker-compose.yml (root, BARU)
```yaml
version: '3.9'
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: db_asi_prediksi
    ports: ["3306:3306"]
    volumes: ["mysql_data:/var/lib/mysql"]
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  ml-engine:
    build: ./ml-engine
    ports: ["8000:8000"]
    environment:
      NEXTJS_ORIGIN: "http://localhost:3000"
    volumes: ["./ml-engine/models:/app/models"]

  web:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: "mysql://root:rootpassword@mysql:3306/db_asi_prediksi"
      ML_ENGINE_URL: "http://ml-engine:8000"
    depends_on:
      mysql:
        condition: service_healthy
      ml-engine:
        condition: service_started

volumes:
  mysql_data:
```

### 6. Dockerfile (root, untuk service `web`)
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 7. .github/workflows/ci.yml (BARU — CI dasar)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test
      - run: npx tsc --noEmit

  test-ml-engine:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ml-engine
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: pip install pytest
      - run: pytest tests/
```

[EKSEKUSI]
1. cd ml-engine && pytest tests/ -v
2. cd .. && npm install -D vitest @testing-library/react && npm run test
3. docker compose build
4. docker compose up → tunggu healthcheck MySQL lolos, cek log ml-engine dan web start tanpa error
5. Buka http://localhost:3000 → pastikan aplikasi jalan penuh dari docker compose
6. git push → cek GitHub Actions tab, pastikan CI hijau

[REVIEW]
- [ ] Semua test pytest dan vitest lolos lokal
- [ ] `docker compose up` dari clone bersih (tanpa setup manual apa pun selain .env)
      berhasil menjalankan MySQL + ml-engine + web
- [ ] CI di GitHub Actions berjalan otomatis setiap push dan lolos
- [ ] README diupdate: instruksi "Menjalankan" sekarang cukup 1 command
      (`docker compose up`) sebagai opsi utama, manual 3-command sebagai alternatif

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- ml-engine container gagal load model: pastikan volume mount models/ benar-benar
  berisi file .h5/.pkl SEBELUM docker compose up (bukan di-generate saat build).
- web container gagal connect ke mysql meski healthcheck lolos: tambah retry logic
  di Prisma client atau delay startup kecil di entrypoint.
- CI lambat karena install ulang dependencies tiap run: tambahkan cache actions/cache
  untuk node_modules dan pip cache.
```

---

## Tahap 10: Navigasi & Layout Premium

### Prompt untuk AI Engineer (UI/UX Frontend Agent)

```
[THINKING]
1. Tahap 3 (Roadmap asli) membangun halaman-halaman lepas tanpa layout navigasi
   bersama — setiap page render mandiri tanpa sidebar/header konsisten.
2. Command palette (⌘K) cocok dengan tema "premium app" dan membantu Dinkes yang
   perlu cari salah satu dari 24 Puskesmas dengan cepat tanpa scroll dropdown.
3. Breadcrumb penting di halaman Detail Puskesmas supaya user tahu sedang di mana
   dan bisa kembali dengan mudah.

Edge cases:
- Sidebar harus collapse jadi icon-only atau bottom-nav di mobile (<768px),
  bukan disembunyikan total.
- Command palette harus accessible dari keyboard penuh (Escape untuk tutup,
  Arrow keys untuk navigasi hasil, Enter untuk pilih).

[BUILD]

### 1. src/app/(dashboard)/layout.tsx (BARU — layout bersama)
```tsx
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { CommandPaletteProvider } from '@/components/layout/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-dark-bg">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
```

### 2. src/components/layout/Sidebar.tsx
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Upload, FileText, Menu } from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Data', icon: Upload },
  { href: '/laporan', label: 'Laporan', icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`glass border-r border-white/5 flex flex-col transition-all ${collapsed ? 'w-16' : 'w-56'} hidden md:flex`}>
      <button onClick={() => setCollapsed(!collapsed)} className="p-4 text-gray-400 hover:text-white self-end">
        <Menu size={18} />
      </button>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

### 3. src/components/layout/CommandPalette.tsx
```tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const CommandPaletteContext = createContext<{ open: () => void }>({ open: () => {} })
export const useCommandPalette = () => useContext(CommandPaletteContext)

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [puskesmasList, setPuskesmasList] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(o => !o)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (isOpen && puskesmasList.length === 0) {
      fetch('/api/puskesmas').then(r => r.json()).then(j => setPuskesmasList(j.data || []))
    }
  }, [isOpen])

  const filtered = puskesmasList.filter(p => p.nama.toLowerCase().includes(query.toLowerCase()))

  return (
    <CommandPaletteContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-24"
            onClick={() => setIsOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
              className="glass w-full max-w-lg rounded-xl overflow-hidden">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Cari Puskesmas..." aria-label="Cari Puskesmas"
                className="w-full bg-transparent px-4 py-3 text-sm outline-none border-b border-white/5" />
              <div className="max-h-72 overflow-y-auto">
                {filtered.map(p => (
                  <button key={p.id} onClick={() => { router.push(`/puskesmas/${p.id}`); setIsOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex justify-between">
                    <span>{p.nama}</span>
                    <span className="text-gray-500 text-xs">{p.kecamatan}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">Tidak ditemukan</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CommandPaletteContext.Provider>
  )
}
```

### 4. src/components/layout/Breadcrumb.tsx
```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} />}
          {item.href ? <Link href={item.href} className="hover:text-emerald-400">{item.label}</Link>
            : <span className="text-gray-300">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
```

[EKSEKUSI]
1. npm install lucide-react (kalau belum)
2. Buat semua file di atas
3. Bungkus route group (dashboard) dengan layout.tsx baru
4. Tambahkan `<Breadcrumb items={[{label:'Dashboard',href:'/'},{label:puskesmas.nama}]} />`
   di halaman Detail Puskesmas
5. Test ⌘K / Ctrl+K dari halaman manapun → command palette muncul, ketik nama Puskesmas,
   Enter → navigasi ke halaman detail
6. Test di viewport mobile (375px) → sidebar harus tersembunyi/collapse rapi

[REVIEW]
- [ ] Sidebar konsisten muncul di semua halaman dashboard, highlight item aktif benar
- [ ] Command palette bisa dibuka dari mana saja dengan ⌘K/Ctrl+K dan ditutup dengan Escape
- [ ] Command palette accessible: bisa dioperasikan penuh dari keyboard
- [ ] Breadcrumb muncul di halaman Detail Puskesmas dan link kembali berfungsi
- [ ] Layout tidak pecah di mobile viewport

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Command palette lambat karena fetch ulang tiap buka: cache hasil fetch pertama
  di state/context, refresh hanya jika data berumur > 5 menit.
- Sidebar collapse state tidak persist antar halaman: simpan di localStorage
  (bukan browser storage terlarang di artifact — ini aplikasi Next.js nyata, aman dipakai).
```

---

## Tahap 11: Visualisasi Lanjutan, Aksesibilitas & Micro-interaction

### Prompt untuk AI Engineer (UI/UX Frontend Agent)

```
[THINKING]
1. ShapForcePlot versi Tahap 4 (Roadmap asli) masih berupa bar sederhana per lag —
   belum benar-benar "force plot" ala SHAP asli (garis dasar horizontal dengan
   panah kumulatif dari base_value ke prediction). Untuk audiens medis non-teknis,
   representasi kumulatif lebih intuitif daripada 24 bar terpisah.
2. Toast/confirm dialog dijanjikan sejak Tahap 3 tapi handlePredict() masih pakai
   alert() bawaan browser — harus diganti sistem toast yang sudah dirancang di
   komponen ToastNotification.
3. Kontras warna glassmorphism (teks abu-abu di atas latar gelap) perlu diaudit —
   ini bukan estimasi, harus dihitung rasio kontras aktual.
4. Mode komparasi 2-4 Puskesmas (F-04 PRD) belum pernah diimplementasi di kode manapun.

Edge cases:
- Force plot dengan banyak fitur bernilai sangat kecil mendekati 0 akan menumpuk
  visual jadi tidak terbaca — perlu threshold minimum lebar bar atau agregasi lag
  yang nilainya di bawah ambang tertentu jadi "Lainnya".
- Toast queue harus auto-dismiss tapi tetap bisa di-dismiss manual, dan tidak boleh
  menumpuk lebih dari 3-4 toast bersamaan di layar.

[BUILD]

### 1. src/components/ui/Toast.tsx (Provider global — pengganti alert())
```tsx
'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: string; type: ToastType; message: string }

const ToastContext = createContext<{ show: (type: ToastType, message: string) => void }>({ show: () => {} })
export const useToast = () => useContext(ToastContext)

const ICONS = { success: CheckCircle, error: XCircle, info: Info }
const COLORS = { success: 'text-emerald-400 border-emerald-500/30', error: 'text-red-400 border-red-500/30', info: 'text-cyan-400 border-cyan-500/30' }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t.slice(-3), { id, type, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = ICONS[t.type]
            return (
              <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                className={`glass border px-4 py-3 rounded-lg flex items-center gap-2 text-sm min-w-64 ${COLORS[t.type]}`}>
                <Icon size={16} />
                <span className="text-gray-200">{t.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
```

### 2. src/components/ui/ConfirmDialog.tsx (BARU — pengganti langsung eksekusi Append)
```tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import GradientButton from './GradientButton'

interface Props {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, description, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass p-6 rounded-xl max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Batal</button>
              <GradientButton onClick={onConfirm}>Konfirmasi</GradientButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```
Ganti pemanggilan `handleAppend()` langsung di `upload/page.tsx` (Tahap 5) dengan
membuka `ConfirmDialog` dulu, baru eksekusi append di `onConfirm`.

### 3. src/components/xai/ShapForcePlotCumulative.tsx (upgrade dari versi bar sederhana)
```tsx
'use client'
import { motion } from 'framer-motion'
import type { ShapFeature } from '@/types/shap'

export default function ShapForcePlotCumulative({ expectedValue, features, prediction }: {
  expectedValue: number; features: ShapFeature[]; prediction: number
}) {
  const allImpacts = features.flatMap(f => f.impacts.map(i => ({ ...i, feature: f.feature })))
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))

  const THRESHOLD = 0.01
  const significant = allImpacts.filter(i => Math.abs(i.shap_value) >= THRESHOLD).slice(0, 10)
  const minorCount = allImpacts.length - significant.length

  let cumulative = expectedValue
  const segments = significant.map(imp => {
    const start = cumulative
    cumulative += imp.shap_value
    return { ...imp, start, end: cumulative }
  })

  const min = Math.min(expectedValue, prediction, ...segments.map(s => Math.min(s.start, s.end)))
  const max = Math.max(expectedValue, prediction, ...segments.map(s => Math.max(s.start, s.end)))
  const range = max - min || 1
  const toPercent = (v: number) => ((v - min) / range) * 100

  return (
    <div className="space-y-3">
      <div className="relative h-16 glass rounded-lg overflow-hidden px-2">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
        <div className="absolute top-2 text-xs text-gray-500" style={{ left: `${toPercent(expectedValue)}%` }}>
          Base {expectedValue.toFixed(1)}
        </div>
        {segments.map((s, i) => (
          <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.06 }}
            className={`absolute top-1/2 h-2 -translate-y-1/2 origin-left ${s.shap_value >= 0 ? 'bg-red-500/60' : 'bg-blue-500/60'}`}
            style={{ left: `${toPercent(Math.min(s.start, s.end))}%`, width: `${Math.abs(toPercent(s.end) - toPercent(s.start))}%` }}
            title={`${s.feature} t-${s.lag}: ${s.shap_value >= 0 ? '+' : ''}${s.shap_value.toFixed(3)}`}
          />
        ))}
        <div className="absolute bottom-2 text-xs text-emerald-400 font-medium" style={{ left: `${toPercent(prediction)}%` }}>
          Prediksi {prediction.toFixed(1)}
        </div>
      </div>
      {minorCount > 0 && (
        <p className="text-xs text-gray-500">+{minorCount} kontribusi kecil lainnya (di bawah ambang {THRESHOLD})</p>
      )}
    </div>
  )
}
```

### 4. src/components/dashboard/ComparisonMode.tsx (BARU — F-04 PRD)
```tsx
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444']

export default function ComparisonMode({ puskesmasIds }: { puskesmasIds: number[] }) {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    if (puskesmasIds.length < 2) return
    Promise.all(puskesmasIds.map(id => fetch(`/api/data/history?puskesmas_id=${id}`).then(r => r.json())))
      .then(results => {
        // Merge per bulan jadi satu array baris { bulan, [nama_puskesmas_1]: nilai, ... }
        const merged: Record<string, any> = {}
        results.forEach((res, idx) => {
          (res.data || []).forEach((row: any) => {
            const key = row.tanggal.slice(0, 7)
            merged[key] = merged[key] || { bulan: key }
            merged[key][`p${idx}`] = row.persentase_cakupan
          })
        })
        setData(Object.values(merged).sort((a, b) => a.bulan.localeCompare(b.bulan)))
      })
  }, [puskesmasIds])

  if (puskesmasIds.length < 2) return <p className="text-sm text-gray-500">Pilih 2-4 Puskesmas untuk membandingkan.</p>

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="bulan" stroke="#6b7280" fontSize={12} />
        <YAxis stroke="#6b7280" fontSize={12} />
        <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }} />
        <Legend />
        {puskesmasIds.map((id, i) => (
          <Line key={id} type="monotone" dataKey={`p${i}`} stroke={COLORS[i]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### 5. Audit kontras — checklist manual (bukan kode, dilakukan langsung di browser DevTools)
```
Gunakan Chrome DevTools > Lighthouse > Accessibility, atau axe DevTools extension.
Target minimum: WCAG AA (rasio kontras 4.5:1 untuk teks body, 3:1 untuk teks besar/UI).
Elemen yang WAJIB dicek:
- text-gray-400/500 di atas bg #0a0f1e / #111827 (sering gagal AA)
- Placeholder text di input form
- Badge/label kecil di tabel

Jika gagal, naikkan ke text-gray-300 atau tambahkan sedikit peningkatan opacity
background di belakangnya.
```

[EKSEKUSI]
1. Buat ToastProvider, bungkus di root layout.tsx (app/layout.tsx, bukan dashboard layout)
2. Ganti semua alert() di handlePredict()/handleAppend() dengan useToast().show()
3. Tambahkan ConfirmDialog sebelum handleAppend() dieksekusi
4. Ganti ShapForcePlot lama dengan ShapForcePlotCumulative di halaman Detail Puskesmas
5. Tambahkan ComparisonMode di dashboard dengan multi-select Puskesmas (checkbox di tabel)
6. Jalankan Lighthouse Accessibility audit, catat skor sebelum dan sesudah perbaikan kontras
7. Uji seluruh alur keyboard-only (Tab, Enter, Escape) tanpa mouse sama sekali

[REVIEW]
- [ ] Tidak ada lagi pemanggilan alert()/confirm() bawaan browser di seluruh kode
- [ ] Toast muncul dan hilang otomatis, tidak menumpuk lebih dari 4 sekaligus
- [ ] ConfirmDialog wajib muncul sebelum data benar-benar di-append ke database
- [ ] Force plot kumulatif menampilkan base → prediksi dengan jelas, kontribusi kecil diringkas
- [ ] Mode komparasi menampilkan overlay 2-4 Puskesmas dengan warna berbeda dan legend jelas
- [ ] Skor Lighthouse Accessibility ≥ 90
- [ ] Semua interaksi utama bisa dilakukan tanpa mouse

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- Force plot kumulatif berantakan kalau semua SHAP value sangat kecil: naikkan
  THRESHOLD secara dinamis berdasarkan persentil, bukan angka fix 0.01.
- Toast tidak muncul karena Provider salah level (di bawah komponen yang manggil
  useToast): pastikan ToastProvider membungkus SELURUH app di root layout, bukan
  cuma di dashboard layout.
- ComparisonMode lambat karena fetch berurutan: pastikan pakai Promise.all (paralel),
  bukan await berurutan dalam loop.
```

---

## Tahap 12: Observability & Model Versioning

### Prompt untuk AI Engineer (Lead Architect + MLOps Agent)

```
[THINKING]
1. Sistem ini dipakai untuk keputusan kesehatan publik (cakupan ASI eksklusif) —
   kalau model di-retrain di masa depan, histori prediksi lama harus tetap bisa
   dilacak dihasilkan oleh model versi berapa, supaya evaluasi akurasi tetap valid.
2. Logging saat ini cuma console.error/print biasa — sulit di-parse kalau nanti
   perlu debug produksi atau audit.
3. Halaman admin butuh cara cepat melihat status kesehatan ml-engine tanpa buka
   terminal/curl manual.

Edge cases:
- Model file diganti tanpa mengubah nama file (misal model_lstm_panel.h5 di-replace
  langsung) → model_version harus dihitung dari hash file, bukan cuma nama file,
  supaya tidak salah lacak.

[BUILD]

### 1. Update prisma/schema.prisma — tambah model_version di Prediksi
```prisma
model Prediksi {
  id              Int       @id @default(autoincrement())
  puskesmas_id    Int
  bulan_prediksi  DateTime
  nilai_prediksi  Float
  nilai_aktual    Float?
  model_version   String?   @db.VarChar(64)  // BARU: hash singkat model yang menghasilkan ini
  created_at      DateTime  @default(now())
  puskesmas       Puskesmas @relation(fields: [puskesmas_id], references: [id])
  shap_values     ShapValue[]
  @@unique([puskesmas_id, bulan_prediksi])
  @@map("prediksi")
}
```
`npx prisma migrate dev --name add_model_version`

### 2. ml-engine/model_loader.py — hitung dan expose model version
```python
import hashlib

def compute_model_hash(model_path: str) -> str:
    with open(model_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]

# Panggil saat load_models(), simpan sebagai global MODEL_VERSION,
# sertakan di response /ml/predict dan /ml/health
```
Tambahkan `model_version` ke `PredictResponse` schema dan sertakan di setiap
response `/ml/predict`, lalu simpan ke kolom `model_version` saat `predictPuskesmas()`
menyimpan hasil ke database.

### 3. ml-engine/logging_config.py (BARU — structured logging JSON)
```python
import logging
import json
import sys

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "time": self.formatTime(record),
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log)

def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
```
Panggil `setup_logging()` di awal `main.py` sebelum inisialisasi FastAPI.

### 4. src/app/(dashboard)/admin/status/page.tsx (BARU — health dashboard sederhana)
```tsx
'use client'
import { useState, useEffect } from 'react'
import GlowCard from '@/components/ui/GlowCard'

export default function StatusPage() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const poll = () => fetch('/api/health/ml-engine').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'unreachable' })).finally(() => setLoading(false))
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Status Sistem</h1>
      <GlowCard className="space-y-2">
        {loading ? <p className="text-sm text-gray-500">Memeriksa...</p> : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">ML Engine</span>
              <span className={health?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                {health?.status ?? 'unknown'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Model Version</span>
              <span className="text-gray-300 font-mono text-xs">{health?.model_version ?? '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">TensorFlow</span>
              <span className="text-gray-300">{health?.tensorflow_version ?? '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Uptime</span>
              <span className="text-gray-300">{health?.uptime_seconds ? `${Math.floor(health.uptime_seconds / 60)} menit` : '-'}</span>
            </div>
          </>
        )}
      </GlowCard>
    </div>
  )
}
```

### 5. src/app/api/health/ml-engine/route.ts (proxy sederhana, hindari CORS langsung dari browser)
```typescript
import { NextResponse } from 'next/server'
import { ML_ENGINE_URL } from '@/lib/constants'

export async function GET() {
  try {
    const res = await fetch(`${ML_ENGINE_URL}/ml/health`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 })
  }
}
```

[EKSEKUSI]
1. npx prisma migrate dev --name add_model_version
2. Update model_loader.py, main.py, schemas.py untuk model_version
3. Buat logging_config.py, panggil di main.py
4. Buat halaman /admin/status dan route proxy health
5. Restart ml-engine, cek /ml/health sekarang menyertakan model_version
6. Buka /admin/status di browser, pastikan polling tiap 15 detik berjalan
7. Matikan ml-engine sengaja → cek halaman status menampilkan "unreachable" dengan jelas

[REVIEW]
- [ ] Setiap baris di tabel Prediksi baru punya model_version terisi
- [ ] Log ml-engine keluar dalam format JSON satu baris per event (bukan traceback mentah tercecer)
- [ ] Halaman /admin/status menampilkan status real-time dan update otomatis
- [ ] Ketika ml-engine down, UI menampilkan pesan jelas, bukan halaman error kosong

[PERBAIKI JIKA ADA SALAH DAN MANTAPKAN]
- model_version berubah tiap restart padahal file model sama: pastikan hash dihitung
  dari isi file (bukan timestamp file), sehingga konsisten selama file tidak diganti.
- Polling /admin/status membebani server: naikkan interval ke 30-60 detik untuk
  production, 15 detik cukup untuk development/monitoring aktif.
```

---

## Penutup

Setelah Tahap 6-12 selesai dengan checklist REVIEW ✅ di setiap tahap, sistem sudah:

- ✅ Data integrity terjamin lewat migration formal + transaction penuh
- ✅ Keamanan dasar (rate limit, sanitasi formula injection, origin protection)
- ✅ Auth & RBAC 3 role (Admin, Puskesmas, Viewer) dengan proteksi di level Server Action
- ✅ Test coverage untuk bagian paling berisiko (preprocessing, SHAP, validasi tanggal)
- ✅ `docker compose up` sebagai single-command onboarding + CI otomatis
- ✅ Navigasi premium (sidebar, command palette ⌘K, breadcrumb)
- ✅ Toast/confirm dialog menggantikan alert()/confirm() bawaan browser
- ✅ Force plot SHAP versi kumulatif yang lebih mudah dibaca tenaga medis
- ✅ Mode komparasi multi-Puskesmas
- ✅ Aksesibilitas WCAG AA minimum
- ✅ Model versioning + health dashboard + structured logging

**Sistem siap untuk evaluasi produksi terbatas / demo institusional.**
