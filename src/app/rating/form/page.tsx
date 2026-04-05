import Link from "next/link";

import { StatusMessage } from "@/components/status-message";
import { submitRatingAction } from "@/lib/hotel-actions";
import { listTransactionsForRating, listVendorsForRating } from "@/lib/hotel-service";
import type { RatingType } from "@/lib/hotel-types";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function normalizeType(value: string | undefined): RatingType {
  if (value === "Room" || value === "Meeting" || value === "Vendor") {
    return value;
  }

  return "Room";
}

export default async function RatingFormPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const ratingType = normalizeType(
    Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type,
  );

  const transactionOptions =
    ratingType === "Vendor" ? [] : listTransactionsForRating(ratingType as "Room" | "Meeting");
  const vendorOptions = ratingType === "Vendor" ? listVendorsForRating() : [];

  const hasReference = ratingType === "Vendor" ? vendorOptions.length > 0 : transactionOptions.length > 0;

  return (
    <main className="page-shell space-y-4">
      <section className="panel reveal">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="badge">Public Rating Form</p>
            <h1 className="hero-title mt-2">Rating {ratingType}</h1>
            <p className="subtitle mt-2 max-w-2xl">
              Setelah submit, sistem akan mengirim WA report ke manager dan WA terima kasih ke
              pengisi rating, lalu menampilkan halaman advertising.
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/rating/form?type=Room"
            className={`btn ${ratingType === "Room" ? "btn-primary" : "btn-ghost"}`}
          >
            Room
          </Link>
          <Link
            href="/rating/form?type=Meeting"
            className={`btn ${ratingType === "Meeting" ? "btn-primary" : "btn-ghost"}`}
          >
            Meeting
          </Link>
          <Link
            href="/rating/form?type=Vendor"
            className={`btn ${ratingType === "Vendor" ? "btn-primary" : "btn-ghost"}`}
          >
            Vendor
          </Link>
        </div>
      </section>

      <StatusMessage status={searchParams.status} message={searchParams.message} />

      <section className="panel reveal delay-70">
        {!hasReference ? (
          <div className="status-box error">
            Data referensi belum tersedia. Tambahkan data terkait dulu dari dashboard admin.
          </div>
        ) : null}

        <form action={submitRatingAction} className="space-y-3">
          <input type="hidden" name="ratingType" value={ratingType} />

          <div>
            <label className="label" htmlFor="referenceId">
              {ratingType === "Vendor" ? "Pilih Vendor" : "Pilih Tamu / Referensi"}
            </label>
            <select className="select" id="referenceId" name="referenceId" required>
              <option value="">-- pilih referensi --</option>
              {ratingType === "Vendor"
                ? vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name}
                      {vendor.company_name ? ` - ${vendor.company_name}` : ""}
                    </option>
                  ))
                : transactionOptions.map((transaction) => (
                    <option key={transaction.id} value={transaction.id}>
                      {transaction.guest_name} - {transaction.room_name} ({transaction.check_in_date}
                      {" "}s/d {transaction.check_out_date})
                    </option>
                  ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="qualityOfService">
                Quality of Service
              </label>
              <select className="select" id="qualityOfService" name="qualityOfService" defaultValue="Good">
                <option value="Poor">Poor</option>
                <option value="Good">Good</option>
                <option value="Excellent">Excellent</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="facilities">
                Facilities
              </label>
              <select className="select" id="facilities" name="facilities" defaultValue="Good">
                <option value="Poor">Poor</option>
                <option value="Good">Good</option>
                <option value="Excellent">Excellent</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="foodQuality">
                Food Quality
              </label>
              <select className="select" id="foodQuality" name="foodQuality" defaultValue="Good">
                <option value="Poor">Poor</option>
                <option value="Good">Good</option>
                <option value="Excellent">Excellent</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="cleanliness">
                Cleanliness
              </label>
              <select className="select" id="cleanliness" name="cleanliness" defaultValue="Good">
                <option value="Poor">Poor</option>
                <option value="Good">Good</option>
                <option value="Excellent">Excellent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="sourceAwareness">
                Source Awareness
              </label>
              <select className="select" id="sourceAwareness" name="sourceAwareness" defaultValue="Friend">
                <option value="Friend">Friend</option>
                <option value="Ads">Ads</option>
                <option value="Medsos">Medsos</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="generalRating">
                General Rating (1-5)
              </label>
              <select className="select" id="generalRating" name="generalRating" defaultValue="5">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="comment">
              Comment
            </label>
            <textarea
              className="textarea"
              id="comment"
              name="comment"
              placeholder="Tulis masukan Anda..."
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={!hasReference}>
            Submit Rating
          </button>
        </form>
      </section>
    </main>
  );
}
