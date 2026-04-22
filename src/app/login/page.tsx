import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusMessage } from "@/components/status-message";
import { getAdminSession } from "@/lib/auth-session";
import { loginAdminAction } from "@/lib/hotel-actions";
import { getSingleQueryValue, normalizeInternalPath } from "@/lib/route-utils";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const requestedNextPath = normalizeInternalPath(getSingleQueryValue(searchParams.next) || "/admin");

  const session = await getAdminSession();
  if (session) {
    redirect(requestedNextPath);
  }

  return (
    <main className="page-shell">
      <section className="panel reveal max-w-2xl mx-auto">
        <p className="badge">Admin Login</p>
        <h1 className="hero-title mt-2">Masuk ke Dashboard Admin</h1>
        <p className="subtitle mt-2">
          Login diperlukan untuk mengakses menu admin dan menjalankan operasi penting
          (master data, generate voucher, report, dan gateway settings).
        </p>

        <StatusMessage status={searchParams.status} message={searchParams.message} />

        <form action={loginAdminAction} className="space-y-3 mt-4">
          <input type="hidden" name="next" value={requestedNextPath} />

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="field"
              id="email"
              name="email"
              type="email"
              placeholder="admin@grandsunshine.local"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="field"
              id="password"
              name="password"
              type="password"
              placeholder="Masukkan password"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit">
            Login
          </button>
        </form>

        <div className="mt-4">
          <Link href="/" className="btn btn-ghost">
            Kembali ke Home
          </Link>
        </div>
      </section>
    </main>
  );
}
