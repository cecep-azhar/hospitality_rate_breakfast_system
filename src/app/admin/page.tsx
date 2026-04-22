import Link from "next/link";
import { redirect } from "next/navigation";
import "./admin.css";

import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { StatusMessage } from "@/components/status-message";
import { getAdminSession } from "@/lib/auth-session";
import {
  addRoomAction,
  addTransactionAction,
  addVendorAction,
  generateVouchersAction,
  importTransactionsAction,
  logoutAdminAction,
  saveGatewaySettingsAction,
  sendVoucherManualAction,
} from "@/lib/hotel-actions";
import { getAdminSnapshot, toDateOnly } from "@/lib/hotel-service";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function statusChipClass(status: string): string {
  switch (status) {
    case "Scanned":
    case "Success":
      return "admin-pill admin-pill-success";
    case "Sent_WA":
      return "admin-pill admin-pill-info";
    case "Generated":
    case "Pending":
      return "admin-pill admin-pill-warning";
    case "Expired":
    case "Failed":
      return "admin-pill admin-pill-danger";
    default:
      return "admin-pill admin-pill-neutral";
  }
}

function maskToken(token: string): string {
  if (!token || token.length < 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("id-ID");
}

export default async function AdminPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const session = await getAdminSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  const snapshot = getAdminSnapshot();
  const managerPhonesMultiline = snapshot.gatewaySettings.managerPhoneNumbers.join("\n");
  const today = toDateOnly();
  const navItems = [
    { id: "overview", label: "Dashboard" },
    { id: "gateway", label: "Gateway" },
    { id: "master-data", label: "Master Data" },
    { id: "transactions", label: "Transactions" },
    { id: "vouchers", label: "Voucher Ops" },
    { id: "ratings", label: "Ratings" },
    { id: "notifications", label: "Notification Logs" },
  ];

  const summaryCards = [
    {
      label: "Total Rooms",
      value: snapshot.summary.totalRooms,
      hint: "Master ruangan terdaftar",
    },
    {
      label: "Total Vendors",
      value: snapshot.summary.totalVendors,
      hint: "Vendor aktif di sistem",
    },
    {
      label: "Tamu In-House",
      value: snapshot.summary.inHouseGuests,
      hint: "Tamu menginap hari ini",
    },
    {
      label: "Voucher Hari Ini",
      value: snapshot.summary.vouchersToday,
      hint: "Voucher yang digenerate",
    },
    {
      label: "Voucher Scanned",
      value: snapshot.summary.scannedToday,
      hint: "Voucher tervalidasi hari ini",
    },
    {
      label: "Rating Hari Ini",
      value: snapshot.summary.ratingsToday,
      hint: "Respons rating masuk",
    },
    {
      label: "Rata-rata Rating",
      value: snapshot.summary.avgRatingToday,
      hint: "Skor keseluruhan hari ini",
    },
    {
      label: "Log WA Gagal",
      value: snapshot.summary.failedNotifications,
      hint: "Butuh tindak lanjut",
    },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <p className="admin-brand-title">Grand Sunshine</p>
          <p className="admin-brand-subtitle">Hospitality Admin v2</p>
        </div>

        <AdminSidebarNav items={navItems} defaultActiveId="overview" />
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-topbar-eyebrow">Operations Center</p>
            <h1 className="admin-topbar-title">Admin Panel</h1>
          </div>

          <div className="admin-topbar-actions">
            <span className="admin-user-chip">
              {session.name} ({session.role})
            </span>
            <Link className="admin-btn admin-btn-soft" href="/scan">
              Buka Scan
            </Link>
            <Link className="admin-btn admin-btn-soft" href="/">
              Home
            </Link>
            <form action={logoutAdminAction}>
              <button className="admin-btn admin-btn-danger" type="submit">
                Keluar
              </button>
            </form>
          </div>
        </header>

        <main className="admin-content">
          <section className="admin-section" id="overview">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Dashboard</h2>
              <p className="admin-section-subtitle">Ringkasan aktivitas dan statistik operasional harian.</p>
            </div>

            <StatusMessage status={searchParams.status} message={searchParams.message} />

            <div className="admin-stats-grid">
              {summaryCards.map((card) => (
                <article className="admin-stat-card" key={card.label}>
                  <p className="admin-stat-label">{card.label}</p>
                  <p className="admin-stat-value">{card.value}</p>
                  <p className="admin-stat-hint">{card.hint}</p>
                </article>
              ))}
            </div>

            <div className="admin-grid-2">
              <article className="admin-panel">
                <h3 className="admin-panel-title">Laporan Rating per Tipe</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
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

              <article className="admin-panel">
                <h3 className="admin-panel-title">Akses Cepat</h3>
                <div className="admin-quick-grid">
                  <Link className="admin-quick-item" href="/rating/form?type=Room">
                    Form Rating Room
                  </Link>
                  <Link className="admin-quick-item" href="/rating/form?type=Meeting">
                    Form Rating Meeting
                  </Link>
                  <Link className="admin-quick-item" href="/rating/form?type=Vendor">
                    Form Rating Vendor
                  </Link>
                  <Link className="admin-quick-item" href="/ads?type=Room&next=/rating/thanks?type=Room">
                    Preview Halaman Ads
                  </Link>
                </div>
              </article>
            </div>
          </section>

          <section className="admin-section" id="gateway">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Gateway Settings</h2>
              <p className="admin-section-subtitle">Kelola endpoint, token WA, manager alert, dan video advertising.</p>
            </div>

            <article className="admin-panel">
              <form action={saveGatewaySettingsAction} className="admin-form-grid">
                <div>
                  <label className="admin-label" htmlFor="waEndpointVoucher">
                    WA Endpoint Voucher
                  </label>
                  <input
                    className="admin-field"
                    id="waEndpointVoucher"
                    name="waEndpointVoucher"
                    defaultValue={snapshot.gatewaySettings.waEndpointVoucher}
                    placeholder="https://api-gateway.example/send-voucher"
                  />
                </div>

                <div>
                  <label className="admin-label" htmlFor="waTokenVoucher">
                    WA Token Voucher
                  </label>
                  <input
                    className="admin-field"
                    id="waTokenVoucher"
                    name="waTokenVoucher"
                    type="password"
                    defaultValue={snapshot.gatewaySettings.waTokenVoucher}
                    placeholder="Masukkan token WA"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="admin-label" htmlFor="waEndpointRating">
                    WA Endpoint Rating
                  </label>
                  <input
                    className="admin-field"
                    id="waEndpointRating"
                    name="waEndpointRating"
                    defaultValue={snapshot.gatewaySettings.waEndpointRating}
                    placeholder="https://api-gateway.example/send-rating"
                  />
                </div>

                <div>
                  <label className="admin-label" htmlFor="waTokenRating">
                    WA Token Rating
                  </label>
                  <input
                    className="admin-field"
                    id="waTokenRating"
                    name="waTokenRating"
                    type="password"
                    defaultValue={snapshot.gatewaySettings.waTokenRating}
                    placeholder="Masukkan token WA"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="admin-label" htmlFor="managerPhoneNumbers">
                    Nomor Manager (pisahkan baris atau koma)
                  </label>
                  <textarea
                    className="admin-textarea"
                    id="managerPhoneNumbers"
                    name="managerPhoneNumbers"
                    defaultValue={managerPhonesMultiline}
                    placeholder="6281234567890"
                  />
                </div>

                <div>
                  <label className="admin-label" htmlFor="videoAdsUrl">
                    Video Ads URL
                  </label>
                  <input
                    className="admin-field"
                    id="videoAdsUrl"
                    name="videoAdsUrl"
                    defaultValue={snapshot.gatewaySettings.videoAdsUrl}
                    placeholder="https://cdn.example.com/ads.mp4"
                  />
                </div>

                <div className="admin-form-actions">
                  <button className="admin-btn admin-btn-primary" type="submit">
                    Simpan Gateway Settings
                  </button>
                </div>
              </form>
            </article>
          </section>

          <section className="admin-section" id="master-data">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Master Data</h2>
              <p className="admin-section-subtitle">Tambahkan room dan vendor, lalu pantau daftar yang sudah tersimpan.</p>
            </div>

            <div className="admin-grid-2">
              <article className="admin-panel">
                <h3 className="admin-panel-title">Master Room</h3>
                <form action={addRoomAction} className="admin-form-stack">
                  <div>
                    <label className="admin-label" htmlFor="roomNumberName">
                      Room Number / Name
                    </label>
                    <input
                      className="admin-field"
                      id="roomNumberName"
                      name="roomNumberName"
                      placeholder="601 atau Kalandra Ballroom"
                      required
                    />
                  </div>

                  <div className="admin-form-split">
                    <div>
                      <label className="admin-label" htmlFor="type">
                        Type
                      </label>
                      <select className="admin-select" id="type" name="type" defaultValue="Kamar">
                        <option value="Kamar">Kamar</option>
                        <option value="Meeting Room">Meeting Room</option>
                      </select>
                    </div>

                    <div>
                      <label className="admin-label" htmlFor="capacity">
                        Capacity
                      </label>
                      <input
                        className="admin-field"
                        id="capacity"
                        name="capacity"
                        type="number"
                        min={0}
                        defaultValue={2}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="description">
                      Description
                    </label>
                    <textarea className="admin-textarea" id="description" name="description" />
                  </div>

                  <div className="admin-form-actions">
                    <button className="admin-btn admin-btn-primary" type="submit">
                      Tambah Room
                    </button>
                  </div>
                </form>

                <div className="admin-table-wrap admin-spacing-top">
                  <table className="admin-table">
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

              <article className="admin-panel">
                <h3 className="admin-panel-title">Master Vendor</h3>
                <form action={addVendorAction} className="admin-form-stack">
                  <div>
                    <label className="admin-label" htmlFor="vendorName">
                      Vendor Name
                    </label>
                    <input className="admin-field" id="vendorName" name="vendorName" required />
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="companyName">
                      Company Name
                    </label>
                    <input className="admin-field" id="companyName" name="companyName" />
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="contactPerson">
                      Contact Person
                    </label>
                    <input className="admin-field" id="contactPerson" name="contactPerson" />
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="phoneNumber">
                      Phone Number (WA)
                    </label>
                    <input
                      className="admin-field"
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="628xxxxxxxxxx"
                    />
                  </div>

                  <div className="admin-form-actions">
                    <button className="admin-btn admin-btn-primary" type="submit">
                      Tambah Vendor
                    </button>
                  </div>
                </form>

                <div className="admin-table-wrap admin-spacing-top">
                  <table className="admin-table">
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
            </div>
          </section>

          <section className="admin-section" id="transactions">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Transactions</h2>
              <p className="admin-section-subtitle">Input manual atau import Excel data tamu in-house.</p>
            </div>

            <article className="admin-panel">
              <h3 className="admin-panel-title">Transaction Tamu (Manual)</h3>
              <form action={addTransactionAction} className="admin-form-stack">
                <div>
                  <label className="admin-label" htmlFor="guestName">
                    Guest Name
                  </label>
                  <input className="admin-field" id="guestName" name="guestName" required />
                </div>

                <div className="admin-form-split">
                  <div>
                    <label className="admin-label" htmlFor="phoneNumberTx">
                      Phone Number
                    </label>
                    <input
                      className="admin-field"
                      id="phoneNumberTx"
                      name="phoneNumber"
                      placeholder="628xxxxxxxxxx"
                      required
                    />
                  </div>
                  <div>
                    <label className="admin-label" htmlFor="emailTx">
                      Email
                    </label>
                    <input className="admin-field" id="emailTx" name="email" type="email" />
                  </div>
                </div>

                <div>
                  <label className="admin-label" htmlFor="roomIdTx">
                    Pilih Room
                  </label>
                  <select className="admin-select" id="roomIdTx" name="roomId" required>
                    <option value="">-- pilih room --</option>
                    {snapshot.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number_name} ({room.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-split">
                  <div>
                    <label className="admin-label" htmlFor="checkInDateTx">
                      Check-in
                    </label>
                    <input
                      className="admin-field"
                      id="checkInDateTx"
                      name="checkInDate"
                      type="date"
                      required
                    />
                  </div>
                  <div>
                    <label className="admin-label" htmlFor="checkOutDateTx">
                      Check-out
                    </label>
                    <input
                      className="admin-field"
                      id="checkOutDateTx"
                      name="checkOutDate"
                      type="date"
                      required
                    />
                  </div>
                </div>

                <div className="admin-form-triple">
                  <div>
                    <label className="admin-label" htmlFor="paxAdult">
                      Pax Adult
                    </label>
                    <input
                      className="admin-field"
                      id="paxAdult"
                      name="paxAdult"
                      type="number"
                      min={0}
                      defaultValue={1}
                    />
                  </div>
                  <div>
                    <label className="admin-label" htmlFor="paxChild">
                      Pax Child
                    </label>
                    <input
                      className="admin-field"
                      id="paxChild"
                      name="paxChild"
                      type="number"
                      min={0}
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <label className="admin-label" htmlFor="sourceBooking">
                      Source Booking
                    </label>
                    <input
                      className="admin-field"
                      id="sourceBooking"
                      name="sourceBooking"
                      placeholder="OTA/Traveloka/Direct"
                    />
                  </div>
                </div>

                <div className="admin-form-actions">
                  <button className="admin-btn admin-btn-primary" type="submit">
                    Tambah Transaction
                  </button>
                </div>
              </form>

              <hr className="admin-divider" />

              <h3 className="admin-panel-title">Import Excel Transaction</h3>
              <form action={importTransactionsAction} className="admin-form-stack">
                <div>
                  <label className="admin-label" htmlFor="excelFileUpload">
                    File Excel (.xlsx/.xls/.csv)
                  </label>
                  <input
                    className="admin-field"
                    id="excelFileUpload"
                    name="excelFile"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    required
                  />
                </div>

                <div className="admin-form-actions">
                  <button className="admin-btn admin-btn-soft" type="submit">
                    Import Excel
                  </button>
                </div>
              </form>
            </article>

            <article className="admin-panel">
              <h3 className="admin-panel-title">Data Transaction</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
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
            </article>
          </section>

          <section className="admin-section" id="vouchers">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Voucher Operations</h2>
              <p className="admin-section-subtitle">Generate QR voucher dan kirim manual melalui WA gateway.</p>
            </div>

            <div className="admin-grid-2">
              <article className="admin-panel">
                <h3 className="admin-panel-title">Generate Voucher</h3>
                <form action={generateVouchersAction} className="admin-form-stack">
                  <div>
                    <label className="admin-label" htmlFor="validDateGenerate">
                      Generate Voucher Date
                    </label>
                    <input
                      className="admin-field"
                      id="validDateGenerate"
                      name="validDate"
                      type="date"
                      defaultValue={today}
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button className="admin-btn admin-btn-primary" type="submit">
                      Generate QR Voucher
                    </button>
                  </div>
                </form>
              </article>

              <article className="admin-panel">
                <h3 className="admin-panel-title">Send Manual WA Voucher</h3>
                <form action={sendVoucherManualAction} className="admin-form-stack">
                  <div>
                    <label className="admin-label" htmlFor="transactionManual">
                      Transaction
                    </label>
                    <select className="admin-select" id="transactionManual" name="transactionId" required>
                      <option value="">-- pilih transaction --</option>
                      {snapshot.transactions.map((transaction) => (
                        <option key={transaction.id} value={transaction.id}>
                          #{transaction.id} - {transaction.guest_name} ({transaction.room_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="validDateManual">
                      Tanggal Voucher (opsional)
                    </label>
                    <input className="admin-field" id="validDateManual" name="validDate" type="date" />
                  </div>

                  <div className="admin-form-actions">
                    <button className="admin-btn admin-btn-soft" type="submit">
                      Kirim WA Voucher
                    </button>
                  </div>
                </form>
              </article>
            </div>

            <article className="admin-panel">
              <h3 className="admin-panel-title">Data Voucher</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
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
                          <span className={statusChipClass(voucher.status)}>{voucher.status}</span>
                        </td>
                        <td>
                          <a
                            className="admin-link"
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
            </article>
          </section>

          <section className="admin-section" id="ratings">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Ratings</h2>
              <p className="admin-section-subtitle">Pantau seluruh hasil rating yang masuk dari form publik.</p>
            </div>

            <article className="admin-panel">
              <div className="admin-table-wrap">
                <table className="admin-table">
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
                        <td>{formatDateTime(rating.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="admin-section" id="notifications">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Notification Logs</h2>
              <p className="admin-section-subtitle">Riwayat pengiriman notifikasi melalui WA gateway.</p>
            </div>

            <article className="admin-panel">
              <div className="admin-table-wrap">
                <table className="admin-table">
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
                          <span className={statusChipClass(log.status)}>{log.status}</span>
                        </td>
                        <td>{formatDateTime(log.sent_at)}</td>
                        <td className="admin-payload-cell">{log.payload}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
