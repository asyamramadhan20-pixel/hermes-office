# Design system — Hermes Virtual Office

## Rasional
Pusat komando operasional kelas enterprise, bukan UI game. Hierarki tipografi tegas, ruang kosong lega, animasi terkendali.
Setiap status = **ikon + teks** (warna bukan satu-satunya penanda). Mode demo memakai fixture deterministik dan **setiap kartu
berlabel DEMO**; tombol aksi kontrol tidak dirender sama sekali di mode demo.

## Token warna (`app/assets/css/main.css`, `@theme static`)
| Token | Nilai | Pakai untuk |
|---|---|---|
| `graphite-950` | `#101319` | latar shell gelap |
| `graphite-900` | `#181C25` | kartu gelap |
| `graphite-50` | `#F4F6F8` | latar shell terang |
| `#FFFFFF` | — | kartu terang |
| `brand-500` | `#8C83F5` | aksen (ungu lembut) |
| `brand-600` | `#6F63EA` | `--ui-primary` terang (4,6:1 di atas putih, AA) |
| `brand-400` | `#A099F6` | `--ui-primary` gelap (7:1 di atas graphite-900) |
| `cyan` (Tailwind) | — | **hanya** indikator aktivitas "berjalan" |
| `emerald / amber / red` | — | success / warning / error |

Variabel semantik Nuxt UI: `--ui-bg-shell`, `--ui-bg`, `--ui-text*`, `--ui-border*`, `--ui-primary` diatur untuk `:root` dan `.dark`.
Font: Inter / system. Angka metrik `tabular-nums` (`tnum`). Fokus keyboard: outline 2px `--ui-primary`. `prefers-reduced-motion` dihormati.

## Arsitektur informasi (navigasi)
1. **Pusat Komando** `/` — KPI, komposer perintah (live), tugas aktif, aktivitas, persetujuan, kesehatan runtime, roster AI employee.
2. **Kantor Virtual** `/kantor` — kantor 3D (Three.js/TresJS) dengan denah: Ruang Meeting · HQ supervisor · Lab Subagent (belakang), ruangan per divisi berkaca dengan papan tulis & meja berjajar (tengah), Ruang Santai · Pantry (depan). **Koreografi berbasis data** (`app/utils/koreografi.ts`): menerima tugas → jalan dari HQ ke meja; RUNNING → mengetik (tempo = jumlah event nyata); event `tool.completed` → gerakan kecil + chip; `subagent.started` → asisten kecil ke Lab; WAITING_APPROVAL → duduk di Ruang Meeting; CANCEL_REQUESTED/UNKNOWN → layar amber; selesai → lompat; idle → sesekali ke Santai/Pantry (label tetap idle). Mode demo memutar ulang event fixture (berlabel DEMO); live memakai event nyata (poll 15 dtk).
3. Papan Tugas `/tugas` — tabel/kanban status (placeholder).
4. Persetujuan `/persetujuan` (placeholder). 5. Kesehatan Runtime `/runtime` (placeholder). 6. Pengaturan `/pengaturan` (placeholder).
Top bar: pemilih perusahaan (`USelectMenu`), mode warna, menu pengguna. Mobile: `USlideover`. Banner DEMO global saat demo.

## Komponen (`app/components/`)
`KartuMetrik`, `BadgeStatus` (StatusTugas/Run/Runtime → ikon+label), `BadgeDemo`, `KartuRuntime`, `DaftarAktivitas`,
`KomposerPerintah` (emit `kirim` dengan `BuatPerintah`), `KartuKaryawan`, `Keadaan` (memuat/kosong/basi/terputus/ditolak/gagal), `LaciTugas`.

## Inventaris state
| State | Di mana | Tampilan |
|---|---|---|
| memuat | semua kartu | `USkeleton` |
| kosong | daftar tugas/aktivitas | `Keadaan jenis="kosong"` |
| basi | runtime `menitSejakEventTerakhir > 10` | `UAlert warning` "Data basi" |
| terputus | runtime `status = offline` | KartuRuntime merah + alasan `lastError` |
| belum dipasang | runtime `terpasang = false` | KartuRuntime netral + petunjuk admin |
| ditolak | 403 dari API | `Keadaan jenis="ditolak"` |
| gagal | error fetch | `UAlert error` |
| belum tersambung | metrik tanpa sumber (Pendapatan) | teks "Belum tersambung", tanpa angka |
| demo | `officeMode = demo` | badge per kartu + banner, aksi tidak dirender |

## Kontrak frontend (siap integrasi)
Tipe di `shared/kontrak.ts`: `ProfilSaya` (`GET /api/me`), `RingkasanOrg` (`GET /api/orgs/:id/ringkasan`), `TugasRingkas[]`
(`GET /api/orgs/:id/tasks`), detail (`GET /api/orgs/:id/tasks/:taskId`), `EventRingkas[]` (`GET /api/orgs/:id/events?json=1`,
SSE tanpa `json`), `ApprovalRingkas[]` (`GET /api/orgs/:id/approvals`), `BuatPerintah` (`POST /api/orgs/:id/commands`).

## Ketergantungan backend yang masih terbuka
- Konsumsi SSE di klien (`EventSource`) untuk timeline realtime; saat ini `refresh` manual + poll.
- Layar 3–5 (Papan Tugas, Detail Tugas penuh, Profil Agen penuh) menunggu review. Kantor Virtual 3D: `docs/design/screens/kantor-*.png`.
- Metrik finansial: belum ada sumber (ditampilkan "Belum tersambung").

## Screenshot
`docs/design/screens/{desktop,mobile}-{light,dark}.png` (1440×900 & 390×844), dibuat `npm run screenshot` saat `nuxt dev` mode demo.
Kritik putaran 1 → perbaikan: label KPI terpotong oleh badge DEMO (badge dipindah ke pojok, label 2 baris), inisial avatar
mengandung tanda kurung (disaring), versi Hermes fixture tidak realistis (diganti `2026.9.24`), `events()` salah memanggil endpoint SSE
(ditambah cabang `?json=1`).
