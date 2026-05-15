import type { Metadata } from 'next';
import { PlayCircle } from 'lucide-react';

export const metadata: Metadata = { title: 'Guide' };

const VIDEO_ID = ''; // Replace with your YouTube video ID

export default function GuidePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <p className="text-muted-foreground mt-1">
          Watch this short guide to learn how to browse campaigns, submit content, and get paid.
        </p>
      </div>

      {VIDEO_ID ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border bg-muted">
          <iframe
            src={`https://www.youtube.com/embed/${VIDEO_ID}?modestbranding=1&rel=0`}
            title="Orcazo Guide"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : (
        <div className="w-full aspect-video rounded-xl border bg-muted flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <PlayCircle className="h-12 w-12" />
          <p className="text-sm">Video guide coming soon</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 space-y-1">
          <div className="text-sm font-semibold">1. Browse campaigns</div>
          <p className="text-xs text-muted-foreground">
            Go to Explore Campaigns and find one that fits your audience.
          </p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <div className="text-sm font-semibold">2. Submit your video</div>
          <p className="text-xs text-muted-foreground">
            Post the content on your social account and submit the link.
          </p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <div className="text-sm font-semibold">3. Get paid</div>
          <p className="text-xs text-muted-foreground">
            Track views on your dashboard and request payouts via bank or crypto.
          </p>
        </div>
      </div>
    </div>
  );
}
