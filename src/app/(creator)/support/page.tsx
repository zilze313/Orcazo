'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, MessageCircle, HelpCircle, ImagePlus, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  fromAdmin: boolean;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  readAt: string | null;
  createdAt: string;
}

interface ChatResp { messages: ChatMsg[] }

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SupportPage() {
  const qc = useQueryClient();
  const [text, setText] = React.useState('');
  const [pendingImage, setPendingImage] = React.useState<{ url: string; type: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<ChatResp>({
    queryKey: ['chat'],
    queryFn: () => api.get<ChatResp>('/api/chat'),
    refetchInterval: 3_000,
    staleTime: 0,
  });

  const sendMut = useMutation({
    mutationFn: (payload: { content: string; mediaUrl?: string; mediaType?: string }) =>
      api.post<{ message: ChatMsg }>('/api/chat', payload),
    onSuccess: () => {
      setText('');
      setPendingImage(null);
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/chat/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Upload failed');
        return;
      }
      const data = await res.json();
      setPendingImage({ url: data.url, type: data.mediaType });
    } finally {
      setUploading(false);
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || sendMut.isPending) return;
    sendMut.mutate({
      content: trimmed || (pendingImage ? '📎 Image' : ''),
      mediaUrl: pendingImage?.url,
      mediaType: pendingImage?.type,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const messages = data?.messages ?? [];
  const canSend = (text.trim().length > 0 || !!pendingImage) && !sendMut.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-background flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Support</p>
          <p className="text-xs text-muted-foreground">Chat with our team · we usually reply within a few hours</p>
        </div>
        <Link
          href="/support/faq"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          FAQ
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No messages yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Send us a message below and our team will get back to you as soon as possible.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.url}
              alt="Pending upload"
              className="h-20 w-20 object-cover rounded-lg border"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 py-3 bg-background flex-shrink-0">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            onChange={handleImageSelect}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="flex-shrink-0 h-10 w-10 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sendMut.isPending}
            title="Attach image (max 50 MB)"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>
          <textarea
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMut.isPending}
            rows={1}
            className="flex-1 resize-none min-h-[40px] max-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className="flex-shrink-0 h-10 w-10"
          >
            {sendMut.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isIncoming = msg.fromAdmin;

  return (
    <div className={cn('flex', isIncoming ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isIncoming
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm',
        )}
      >
        {msg.mediaUrl && (
          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.mediaUrl}
              alt="Attached image"
              className="max-w-full rounded-lg max-h-64 object-contain"
            />
          </a>
        )}
        {msg.content !== '📎 Image' && (
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        )}
        <p
          className={cn(
            'text-[10px] mt-1',
            isIncoming ? 'text-muted-foreground' : 'text-primary-foreground/70',
          )}
        >
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}
