import Link from "next/link";

import { getGatewaySettings } from "@/lib/hotel-service";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function getSingle(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function toYoutubeEmbed(url: string): string | null {
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (!watchMatch) {
    return null;
  }

  return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&mute=1&rel=0`;
}

export default async function AdsPage(props: { searchParams: SearchParamsInput }) {
  const searchParams = await props.searchParams;
  const type = getSingle(searchParams.type) || "Room";
  const nextPath = getSingle(searchParams.next) || `/rating/thanks?type=${encodeURIComponent(type)}`;

  const settings = getGatewaySettings();
  const configuredVideoUrl = settings.videoAdsUrl.trim();
  const fallbackVideo =
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  const videoUrl = configuredVideoUrl || fallbackVideo;
  const youtubeEmbedUrl = toYoutubeEmbed(videoUrl);

  return (
    <main className="page-shell space-y-4">
      <section className="panel reveal">
        <p className="badge">Advertising Screen</p>
        <h1 className="hero-title mt-2">Thank you for your feedback</h1>
        <p className="subtitle mt-2">
          Anda sedang berada di halaman advertising sesuai flow aplikasi. Klik skip untuk
          melanjutkan ke halaman akhir rating.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
          {youtubeEmbedUrl ? (
            <iframe
              title="Video Advertising"
              src={youtubeEmbedUrl}
              className="h-[220px] w-full md:h-[420px]"
              allow="autoplay; encrypted-media"
            />
          ) : (
            <video
              className="h-[220px] w-full object-cover md:h-[420px]"
              src={videoUrl}
              autoPlay
              loop
              muted
              controls
              playsInline
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={nextPath}>
            Skip dan Lanjutkan
          </Link>
          <Link className="btn btn-ghost" href="/">
            Kembali ke Home
          </Link>
        </div>
      </section>
    </main>
  );
}
