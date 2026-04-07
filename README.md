# Grand Sunshine Hospitality Flow v2

Aplikasi ini adalah implementasi v2 untuk flow berikut:

- Rating Room
- Rating Meeting
- Rating Vendor
- Generate QR Voucher makan pagi
- Scan voucher (QR scanner/manual)
- Send WA voucher + WA thank you rating + WA manager alert
- Halaman advertising setelah submit rating
- Dashboard admin dan report operasional

Arsitektur dibangun dengan:

- Next.js App Router
- SQLite lokal (via node:sqlite bawaan Node.js)
- Import Excel (via xlsx)
- QR generator (via qrcode)

## Menjalankan Aplikasi

1. Install dependency:

```bash
npm install
```

1. Jalankan mode development:

```bash
npm run dev
```

1. Buka browser:

```text
http://localhost:3000
```

## Struktur Flow Halaman

- `/` landing flow v2
- `/login` halaman login admin
- `/admin` dashboard operasional
- `/rating/form?type=Room|Meeting|Vendor` form rating publik
- `/ads` halaman advertising setelah submit rating
- `/rating/thanks` halaman ucapan terima kasih
- `/scan` halaman scan voucher restoran

## Login Admin

Admin wajib login sebelum mengakses `/admin`.

Default akun (otomatis dibuat jika tabel users masih kosong):

- Email: `admin@grandsunshine.local`
- Password: `Admin123!`

Kredensial default bisa diganti lewat environment variable:

- `DEFAULT_ADMIN_NAME`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `APP_AUTH_SECRET` (wajib diganti untuk production)

## Ringkasan Fitur Admin

- Master data Rooms
- Master data Vendors
- Input transaction tamu manual
- Import transaction via Excel
- Generate voucher QR per tanggal
- Send manual WA voucher (trigger saat cron mati)
- Konfigurasi dynamic WA gateway endpoint/token
- Konfigurasi nomor manager untuk alert rating
- Konfigurasi video ads URL
- Report rating per tipe + detail rating
- Log notifikasi WA (success/failed)

## Database Lokal

Database akan otomatis dibuat saat aplikasi jalan pertama kali di:

- `data/hospitality.db`

QR image voucher disimpan di:

- `public/generated-qr`

## Catatan WA Gateway

Jika endpoint WA belum diisi di halaman admin:

- Sistem tetap menyimpan log dengan mode simulasi sukses
- Flow tetap dapat dites penuh tanpa gateway produksi

Jika endpoint WA sudah diisi:

- Sistem akan POST JSON ke endpoint sesuai channel voucher/rating
- Response dan error disimpan di Notification Logs
