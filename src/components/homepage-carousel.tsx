'use client';

import * as React from 'react';

interface CarouselVideo {
  id: string;
  url: string;
  title: string | null;
}

interface HomepageCarouselProps {
  videos: CarouselVideo[];
}

export function HomepageCarousel({ videos }: HomepageCarouselProps) {
  // Duplicate the list to create seamless infinite loop
  const items = videos.length > 0 ? [...videos, ...videos, ...videos] : [];

  if (videos.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-8 text-muted-foreground text-sm">
        No campaign videos available yet.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex gap-4 animate-carousel"
        style={{
          width: `max-content`,
          animationDuration: `${Math.max(20, videos.length * 8)}s`,
        }}
      >
        {items.map((video, i) => (
          <CarouselCard key={`${video.id}-${i}`} video={video} />
        ))}
      </div>
    </div>
  );
}

function CarouselCard({ video }: { video: CarouselVideo }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative flex-shrink-0 rounded-xl overflow-hidden border bg-muted"
      style={{ width: '160px', height: '284px' }} // 9:16 ratio at ~160px wide
    >
      <video
        ref={videoRef}
        src={video.url}
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {video.title && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
          <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{video.title}</p>
        </div>
      )}
    </div>
  );
}
