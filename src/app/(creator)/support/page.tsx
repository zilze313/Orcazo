'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  fromAdmin: boolean;
  content: string;
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
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery<ChatResp>({
    queryKey: ['chat'],
    queryFn: () => api.get<ChatResp>('/api/chat'),
    refetchInterval: 3_000,
    staleTime: 0,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post<{ message: ChatMsg }>('/api/chat', { content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sendMut.isPending) return;
    sendMut.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const messages = data?.messages ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-background flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">Support</p>
          <p className="text-xs text-muted-foreground">Chat with our team · we usually reply within a few hours</p>
        </div>
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

      {/* Input */}
      <div className="border-t px-4 py-3 bg-background flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
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
            disabled={!text.trim() || sendMut.isPending}
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
  // fromAdmin = true → admin sent it → show on the LEFT in creator view
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
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
