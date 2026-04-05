import Link from "next/link";

import { StatusMessage } from "@/components/status-message";
import { scanVoucherAction } from "@/lib/hotel-actions";
import { listVouchers } from "@/lib/hotel-service";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

export default async function ScanPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const latestVouchers = listVouchers(80);

  return (
    <main className="page-shell space-y-4">
      <section className="panel reveal">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="badge">Breakfast Voucher Validation</p>
            <h1 className="hero-title mt-2">Form Scan Voucher</h1>
            <p className="subtitle mt-2 max-w-3xl">
              Gunakan form QR scan dari perangkat scanner restoran, atau gunakan mode input manual
              untuk mengetik kode voucher.
            </p>
          </div>

          <div className="flex gap-2">
            <Link className="btn btn-ghost" href="/">
              Home
            </Link>
            <Link className="btn btn-secondary" href="/admin">
              Admin
            </Link>
          </div>
        </div>
      </section>

      <StatusMessage status={searchParams.status} message={searchParams.message} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel reveal delay-70">
          <h2 className="section-title">Scan Form QR Makan</h2>
          <p className="subtitle mb-3">
            Arahkan scanner QR ke voucher tamu. Kebanyakan scanner akan otomatis mengisi input di
            bawah ini.
          </p>

          <form action={scanVoucherAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="voucherCodeScan">
                Voucher Code dari Scanner
              </label>
              <input
                className="field"
                id="voucherCodeScan"
                name="voucherCode"
                placeholder="Contoh: GS-20260405-12-A1-AB12CD34"
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Validasi Voucher
            </button>
          </form>
        </article>

        <article className="panel reveal delay-110">
          <h2 className="section-title">Manual Form Scan</h2>
          <p className="subtitle mb-3">
            Jika perangkat scanner bermasalah, ketik kode voucher secara manual lalu submit.
          </p>

          <form action={scanVoucherAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="voucherCodeManual">
                Voucher Code Manual
              </label>
              <input
                className="field"
                id="voucherCodeManual"
                name="voucherCode"
                placeholder="Masukkan kode voucher"
                required
              />
            </div>
            <button className="btn btn-secondary" type="submit">
              Submit Manual Scan
            </button>
          </form>
        </article>
      </section>

      <section className="panel reveal delay-150">
        <h2 className="section-title">Voucher Terbaru</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Guest</th>
                <th>Code</th>
                <th>Tanggal</th>
                <th>Pax</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {latestVouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>{voucher.id}</td>
                  <td>{voucher.guest_name}</td>
                  <td>{voucher.voucher_code}</td>
                  <td>{voucher.valid_date}</td>
                  <td>
                    {voucher.pax_type} #{voucher.pax_index}
                  </td>
                  <td>{voucher.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
