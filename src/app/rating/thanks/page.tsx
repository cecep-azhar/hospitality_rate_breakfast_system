import Link from "next/link";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function getSingle(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

export default async function RatingThanksPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const type = getSingle(searchParams.type) || "Room";

  return (
    <main className="page-shell">
      <section className="panel reveal">
        <p className="badge">Rating Submitted</p>
        <h1 className="hero-title mt-2">Terima kasih sudah mengisi rating {type}</h1>
        <p className="subtitle mt-3 max-w-2xl">
          Masukan Anda sudah tersimpan dan tim kami terima. Laporan juga telah diproses ke jalur
          notifikasi manager sesuai konfigurasi gateway.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/">
            Kembali ke Home
          </Link>
          <Link className="btn btn-ghost" href={`/rating/form?type=${encodeURIComponent(type)}`}>
            Isi Rating Lagi
          </Link>
        </div>
      </section>
    </main>
  );
}
