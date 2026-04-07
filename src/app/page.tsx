import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1">
      <main className="page-shell space-y-4">
        <section className="panel reveal">
          <p className="badge">Grand Sunshine Hotel</p>
          <h1 className="hero-title mt-3">Hospitality Rating &amp; QR Breakfast System v2</h1>
          <p className="subtitle mt-3 max-w-3xl">
            Platform terpadu untuk rating room, meeting, vendor, generate QR voucher makan
            pagi, scan voucher restoran, dan notifikasi WhatsApp ke tamu serta manager.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/rating/form?type=Room" className="btn btn-primary">
              Rating Room
            </Link>
            <Link href="/rating/form?type=Meeting" className="btn btn-primary">
              Rating Meeting
            </Link>
            <Link href="/rating/form?type=Vendor" className="btn btn-primary">
              Rating Vendor
            </Link>
            <Link href="/scan" className="btn btn-secondary">
              Scan Voucher Makan Pagi
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Dashboard Admin (Login)
            </Link>
            <Link href="/ads?type=Room&next=/rating/thanks?type=Room" className="btn btn-ghost">
              Preview Halaman Advertising
            </Link>
          </div>
        </section>

        <section className="panel reveal delay-80">
          <h2 className="section-title">Flow Implementasi v2</h2>
          <div className="grid-cards">
            <article className="kpi">
              <p className="kpi-label">1. Master Data</p>
              <p className="text-sm text-[#355f53]">
                Kelola Rooms, Vendors, Gateway WA, dan konfigurasi Video Ads.
              </p>
            </article>
            <article className="kpi">
              <p className="kpi-label">2. Transaction & Import</p>
              <p className="text-sm text-[#355f53]">
                Input manual atau import Excel data tamu in-house berikut pax dewasa/anak.
              </p>
            </article>
            <article className="kpi">
              <p className="kpi-label">3. Voucher QR</p>
              <p className="text-sm text-[#355f53]">
                Generate voucher per tanggal, kirim manual WA, scan di restoran, dan tracking
                status.
              </p>
            </article>
            <article className="kpi">
              <p className="kpi-label">4. Rating</p>
              <p className="text-sm text-[#355f53]">
                Form Room/Meeting/Vendor, auto-kirim WA terima kasih dan alert report ke
                manager.
              </p>
            </article>
            <article className="kpi">
              <p className="kpi-label">5. Advertising</p>
              <p className="text-sm text-[#355f53]">
                Setelah submit rating, user diarahkan ke halaman video ads dengan opsi skip.
              </p>
            </article>
            <article className="kpi">
              <p className="kpi-label">6. Dashboard & Report</p>
              <p className="text-sm text-[#355f53]">
                Ringkasan KPI, laporan rating, log notifikasi WA, dan riwayat voucher.
              </p>
            </article>
          </div>
        </section>

        <section className="panel reveal delay-120">
          <h2 className="section-title">Catatan Operasional</h2>
          <p className="subtitle">
            Jika endpoint WA belum diisi, aplikasi tetap berjalan dan mencatat pengiriman sebagai
            simulasi pada Notification Logs. Hal ini memudahkan testing sebelum gateway produksi
            aktif.
          </p>
        </section>
      </main>
    </div>
  );
}
