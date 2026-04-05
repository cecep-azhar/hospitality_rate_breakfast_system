import Link from "next/link";

export default function RatingIndexPage() {
  return (
    <main className="page-shell">
      <section className="panel reveal">
        <p className="badge">Rating Entry</p>
        <h1 className="hero-title mt-2">Pilih Jenis Rating</h1>
        <p className="subtitle mt-2">
          Pilih jenis layanan yang ingin dinilai: room, meeting room, atau vendor.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link href="/rating/form?type=Room" className="btn btn-primary">
            Rating Room
          </Link>
          <Link href="/rating/form?type=Meeting" className="btn btn-primary">
            Rating Meeting
          </Link>
          <Link href="/rating/form?type=Vendor" className="btn btn-primary">
            Rating Vendor
          </Link>
        </div>
      </section>
    </main>
  );
}
