import Link from "next/link";

import { StatusMessage } from "@/components/status-message";
import {
  addRoomAction,
  addTransactionAction,
  addVendorAction,
  generateVouchersAction,
  importTransactionsAction,
  saveGatewaySettingsAction,
  sendVoucherManualAction,
} from "@/lib/hotel-actions";
import { getAdminSnapshot, toDateOnly } from "@/lib/hotel-service";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function statusChipClass(status: string): string {
  switch (status) {
    case "Scanned":
    case "Success":
      return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    case "Sent_WA":
      return "bg-cyan-100 text-cyan-800 border border-cyan-300";
    case "Generated":
    case "Pending":
      return "bg-amber-100 text-amber-800 border border-amber-300";
    case "Expired":
    case "Failed":
      return "bg-rose-100 text-rose-800 border border-rose-300";
    default:
      return "bg-zinc-100 text-zinc-700 border border-zinc-300";
  }
}

export default async function AdminPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const snapshot = getAdminSnapshot();

  const managerPhonesMultiline = snapshot.gatewaySettings.managerPhoneNumbers.join("\n");
  const today = toDateOnly();

  return (
    <main className="page-shell space-y-4">
      <section className="panel reveal">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="badge">Dashboard Admin</p>
            <h1 className="hero-title mt-2">Operations Center v2</h1>
            <p className="subtitle mt-2 max-w-3xl">
              Kelola seluruh alur aplikasi mulai dari master data, transaction tamu,
              generate/scan voucher makan pagi, submission rating, sampai monitoring pengiriman
              WA gateway.
            </p>
          </div>

          <div className="flex gap-2">
            <Link className="btn btn-ghost" href="/">
              Kembali ke Home
            </Link>
            <Link className="btn btn-secondary" href="/scan">
              Buka Form Scan
            </Link>
          </div>
        </div>
      </section>

      <StatusMessage status={searchParams.status} message={searchParams.message} />

      <section className="panel reveal delay-60">
        <h2 className="section-title">Dashboard Ringkas Hari Ini</h2>
        <div className="grid-cards">
          <article className="kpi">
            <p className="kpi-label">Total Rooms</p>
            <p className="kpi-value">{snapshot.summary.totalRooms}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Total Vendors</p>
            <p className="kpi-value">{snapshot.summary.totalVendors}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Tamu In-House</p>
            <p className="kpi-value">{snapshot.summary.inHouseGuests}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Voucher Hari Ini</p>
            <p className="kpi-value">{snapshot.summary.vouchersToday}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Voucher Scanned</p>
            <p className="kpi-value">{snapshot.summary.scannedToday}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Rating Hari Ini</p>
            <p className="kpi-value">{snapshot.summary.ratingsToday}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Rata-rata Rating Hari Ini</p>
            <p className="kpi-value">{snapshot.summary.avgRatingToday}</p>
          </article>
          <article className="kpi">
            <p className="kpi-label">Log WA Gagal</p>
            <p className="kpi-value">{snapshot.summary.failedNotifications}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel reveal delay-100">
          <h2 className="section-title">Gateway Settings</h2>
          <form action={saveGatewaySettingsAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="waEndpointVoucher">
                WA Endpoint Voucher
              </label>
              <input
                className="field"
                id="waEndpointVoucher"
                name="waEndpointVoucher"
                defaultValue={snapshot.gatewaySettings.waEndpointVoucher}
                placeholder="https://api-gateway.example/send-voucher"
              />
            </div>

            <div>
              <label className="label" htmlFor="waTokenVoucher">
                WA Token Voucher
              </label>
              <input
                className="field"
                id="waTokenVoucher"
                name="waTokenVoucher"
                defaultValue={snapshot.gatewaySettings.waTokenVoucher}
              />
            </div>

            <div>
              <label className="label" htmlFor="waEndpointRating">
                WA Endpoint Rating
              </label>
              <input
                className="field"
                id="waEndpointRating"
                name="waEndpointRating"
                defaultValue={snapshot.gatewaySettings.waEndpointRating}
                placeholder="https://api-gateway.example/send-rating"
              />
            </div>

            <div>
              <label className="label" htmlFor="waTokenRating">
                WA Token Rating
              </label>
              <input
                className="field"
                id="waTokenRating"
                name="waTokenRating"
                defaultValue={snapshot.gatewaySettings.waTokenRating}
              />
            </div>

            <div>
              <label className="label" htmlFor="managerPhoneNumbers">
                Nomor Manager (pisahkan baris atau koma)
              </label>
              <textarea
                className="textarea"
                id="managerPhoneNumbers"
                name="managerPhoneNumbers"
                defaultValue={managerPhonesMultiline}
                placeholder="6281234567890"
              />
            </div>

            <div>
              <label className="label" htmlFor="videoAdsUrl">
                Video Ads URL
              </label>
              <input
                className="field"
                id="videoAdsUrl"
                name="videoAdsUrl"
                defaultValue={snapshot.gatewaySettings.videoAdsUrl}
                placeholder="https://cdn.example.com/ads.mp4"
              />
            </div>

            <button className="btn btn-primary" type="submit">
              Simpan Gateway Settings
            </button>
          </form>
        </article>

        <article className="panel reveal delay-140">
          <h2 className="section-title">Master Room</h2>
          <form action={addRoomAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="roomNumberName">
                Room Number / Name
              </label>
              <input
                className="field"
                id="roomNumberName"
                name="roomNumberName"
                placeholder="601 atau Kalandra Ballroom"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="type">
                  Type
                </label>
                <select className="select" id="type" name="type" defaultValue="Kamar">
                  <option value="Kamar">Kamar</option>
                  <option value="Meeting Room">Meeting Room</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="capacity">
                  Capacity
                </label>
                <input
                  className="field"
                  id="capacity"
                  name="capacity"
                  type="number"
                  min={0}
                  defaultValue={2}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea className="textarea" id="description" name="description" />
            </div>

            <button className="btn btn-primary" type="submit">
              Tambah Room
            </button>
          </form>

          <div className="table-wrap mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.id}</td>
                    <td>{room.room_number_name}</td>
                    <td>{room.type}</td>
                    <td>{room.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel reveal delay-180">
          <h2 className="section-title">Master Vendor</h2>
          <form action={addVendorAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="vendorName">
                Vendor Name
              </label>
              <input className="field" id="vendorName" name="vendorName" required />
            </div>

            <div>
              <label className="label" htmlFor="companyName">
                Company Name
              </label>
              <input className="field" id="companyName" name="companyName" />
            </div>

            <div>
              <label className="label" htmlFor="contactPerson">
                Contact Person
              </label>
              <input className="field" id="contactPerson" name="contactPerson" />
            </div>

            <div>
              <label className="label" htmlFor="phoneNumber">
                Phone Number (WA)
              </label>
              <input
                className="field"
                id="phoneNumber"
                name="phoneNumber"
                placeholder="628xxxxxxxxxx"
              />
            </div>

            <button className="btn btn-primary" type="submit">
              Tambah Vendor
            </button>
          </form>

          <div className="table-wrap mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Vendor</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>{vendor.id}</td>
                    <td>{vendor.vendor_name}</td>
                    <td>{vendor.company_name || "-"}</td>
                    <td>{vendor.contact_person || "-"}</td>
                    <td>{vendor.phone_number || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel reveal delay-220">
          <h2 className="section-title">Transaction Tamu (Manual)</h2>
          <form action={addTransactionAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="guestName">
                Guest Name
              </label>
              <input className="field" id="guestName" name="guestName" required />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="phoneNumberTx">
                  Phone Number
                </label>
                <input
                  className="field"
                  id="phoneNumberTx"
                  name="phoneNumber"
                  placeholder="628xxxxxxxxxx"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="emailTx">
                  Email
                </label>
                <input className="field" id="emailTx" name="email" type="email" />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="roomIdTx">
                Pilih Room
              </label>
              <select className="select" id="roomIdTx" name="roomId" required>
                <option value="">-- pilih room --</option>
                {snapshot.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number_name} ({room.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="checkInDateTx">
                  Check-in
                </label>
                <input
                  className="field"
                  id="checkInDateTx"
                  name="checkInDate"
                  type="date"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="checkOutDateTx">
                  Check-out
                </label>
                <input
                  className="field"
                  id="checkOutDateTx"
                  name="checkOutDate"
                  type="date"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="paxAdult">
                  Pax Adult
                </label>
                <input
                  className="field"
                  id="paxAdult"
                  name="paxAdult"
                  type="number"
                  min={0}
                  defaultValue={1}
                />
              </div>
              <div>
                <label className="label" htmlFor="paxChild">
                  Pax Child
                </label>
                <input
                  className="field"
                  id="paxChild"
                  name="paxChild"
                  type="number"
                  min={0}
                  defaultValue={0}
                />
              </div>
              <div>
                <label className="label" htmlFor="sourceBooking">
                  Source Booking
                </label>
                <input
                  className="field"
                  id="sourceBooking"
                  name="sourceBooking"
                  placeholder="OTA/Traveloka/Direct"
                />
              </div>
            </div>

            <button className="btn btn-primary" type="submit">
              Tambah Transaction
            </button>
          </form>

          <h3 className="mt-5 text-sm font-semibold text-[#244d42]">Import Excel Transaction</h3>
          <form action={importTransactionsAction} className="mt-2 space-y-3" encType="multipart/form-data">
            <label className="label" htmlFor="excelFileUpload">
              File Excel (.xlsx/.xls/.csv)
            </label>
            <input
              className="field"
              id="excelFileUpload"
              name="excelFile"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
            />
            <button className="btn btn-secondary" type="submit">
              Import Excel
            </button>
          </form>
        </article>
      </section>

      <section className="panel reveal delay-260">
        <h2 className="section-title">Data Transaction</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Guest</th>
                <th>Phone</th>
                <th>Room</th>
                <th>CheckIn</th>
                <th>CheckOut</th>
                <th>Pax A/C</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.id}</td>
                  <td>{transaction.guest_name}</td>
                  <td>{transaction.phone_number}</td>
                  <td>
                    {transaction.room_name} ({transaction.room_type})
                  </td>
                  <td>{transaction.check_in_date}</td>
                  <td>{transaction.check_out_date}</td>
                  <td>
                    {transaction.pax_adult}/{transaction.pax_child}
                  </td>
                  <td>{transaction.source_booking || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel reveal delay-300">
          <h2 className="section-title">Voucher Operations</h2>

          <form action={generateVouchersAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="validDateGenerate">
                Generate Voucher Date
              </label>
              <input
                className="field"
                id="validDateGenerate"
                name="validDate"
                type="date"
                defaultValue={today}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Generate QR Voucher
            </button>
          </form>

          <hr className="my-4 border-[var(--line)]" />

          <form action={sendVoucherManualAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="transactionManual">
                Transaction
              </label>
              <select className="select" id="transactionManual" name="transactionId" required>
                <option value="">-- pilih transaction --</option>
                {snapshot.transactions.map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>
                    #{transaction.id} - {transaction.guest_name} ({transaction.room_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="validDateManual">
                Tanggal Voucher (opsional)
              </label>
              <input className="field" id="validDateManual" name="validDate" type="date" />
            </div>

            <button className="btn btn-secondary" type="submit">
              Send Manual WA Voucher
            </button>
          </form>
        </article>

        <article className="panel reveal delay-340">
          <h2 className="section-title">Laporan Rating per Tipe</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.ratingSummary.map((summary) => (
                  <tr key={summary.rating_type}>
                    <td>{summary.rating_type}</td>
                    <td>{summary.total}</td>
                    <td>{summary.avg_rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel reveal delay-380">
        <h2 className="section-title">Data Voucher</h2>
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
                <th>QR</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>{voucher.id}</td>
                  <td>{voucher.guest_name}</td>
                  <td>{voucher.voucher_code}</td>
                  <td>{voucher.valid_date}</td>
                  <td>
                    {voucher.pax_type} #{voucher.pax_index}
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-1 text-xs ${statusChipClass(voucher.status)}`}>
                      {voucher.status}
                    </span>
                  </td>
                  <td>
                    <a
                      className="text-[#086457] underline"
                      href={`/${voucher.qr_image_key}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Lihat QR
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel reveal delay-420">
        <h2 className="section-title">Data Ratings</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipe</th>
                <th>Reference</th>
                <th>General</th>
                <th>QoS</th>
                <th>Facilities</th>
                <th>Food</th>
                <th>Cleanliness</th>
                <th>Comment</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.ratings.map((rating) => (
                <tr key={rating.id}>
                  <td>{rating.id}</td>
                  <td>{rating.rating_type}</td>
                  <td>{rating.reference_label}</td>
                  <td>{rating.general_rating}</td>
                  <td>{rating.quality_of_service}</td>
                  <td>{rating.facilities}</td>
                  <td>{rating.food_quality}</td>
                  <td>{rating.cleanliness}</td>
                  <td>{rating.comment || "-"}</td>
                  <td>{new Date(rating.submitted_at).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel reveal delay-460">
        <h2 className="section-title">Notification Logs (WA Gateway)</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Status</th>
                <th>Sent At</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.notificationLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.recipient_phone}</td>
                  <td>{log.message_type}</td>
                  <td>
                    <span className={`rounded-full px-2 py-1 text-xs ${statusChipClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>{new Date(log.sent_at).toLocaleString("id-ID")}</td>
                  <td className="max-w-[440px] whitespace-pre-wrap break-words">{log.payload}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
