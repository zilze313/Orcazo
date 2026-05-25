'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Upload, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface VideoRow {
  id: string;
  url: string;
  title: string | null;
  order: number;
  active: boolean;
  createdAt: string;
}
interface VideosResp { videos: VideoRow[] }

export default function HomepageVideosPage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [titleInput, setTitleInput] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<VideosResp>({
    queryKey: ['admin', 'homepage-videos'],
    queryFn: () => api.get<VideosResp>('/api/admin/homepage-videos'),
    staleTime: 10_000,
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: get a signed upload URL from our API
      const signRes = await fetch('/api/admin/homepage-videos/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type || 'video/mp4' }),
      });
      const signJson = await signRes.json();
      if (!signRes.ok) {
        toast.error(signJson.error || 'Could not start upload');
        return;
      }
      const { uploadUrl, publicUrl } = signJson as { uploadUrl: string; publicUrl: string };

      // Step 2: PUT the file directly to Supabase (no Next.js body limit)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Supabase upload failed: ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.send(file);
      });

      // Step 3: register the video in our DB
      const createRes = await fetch('/api/admin/homepage-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: publicUrl, title: titleInput.trim() || undefined }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        toast.error(createJson.error || 'Upload succeeded but failed to save');
        return;
      }

      toast.success('Video uploaded');
      setTitleInput('');
      qc.invalidateQueries({ queryKey: ['admin', 'homepage-videos'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function toggleActive(video: VideoRow) {
    const res = await fetch(`/api/admin/homepage-videos/${video.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !video.active }),
    });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['admin', 'homepage-videos'] });
      toast.success(video.active ? 'Video hidden' : 'Video shown');
    }
  }

  async function deleteVideo(id: string) {
    if (!confirm('Delete this video? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/homepage-videos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ['admin', 'homepage-videos'] });
      toast.success('Video deleted');
    }
  }

  return (
    <>
      <PageHeader
        title="Homepage Videos"
        description="Manage the campaign showcase carousel on the homepage."
      />

      <div className="container max-w-4xl py-6 space-y-6">
        {/* Upload area */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">Upload a new video</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="Campaign name or description…"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="sr-only"
                onChange={handleUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading{uploadProgress > 0 ? ` ${uploadProgress}%` : '…'}</>
                  : <><Upload className="h-4 w-4" /> Choose video</>
                }
              </Button>
              <p className="text-xs text-muted-foreground">MP4, MOV, WebM · max 50 MB · 9:16 ratio recommended</p>
            </div>
            {uploading && uploadProgress > 0 && (
              <div className="w-full max-w-sm h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Videos list */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (data?.videos.length ?? 0) === 0 ? (
            <EmptyState icon={Film} title="No videos yet" description="Upload a campaign video to display in the homepage carousel." />
          ) : (
            data!.videos.map((video) => (
              <Card key={video.id} className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-20 rounded-lg border bg-muted overflow-hidden relative">
                  <video
                    src={video.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{video.title || 'Untitled'}</span>
                    <Badge variant={video.active ? 'default' : 'secondary'} className="text-[10px]">
                      {video.active ? 'Active' : 'Hidden'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Order: {video.order}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Added {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => toggleActive(video)}
                    title={video.active ? 'Hide from carousel' : 'Show in carousel'}
                  >
                    {video.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteVideo(video.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
