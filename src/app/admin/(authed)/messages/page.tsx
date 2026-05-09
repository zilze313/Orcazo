'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Loader2, Search, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Conversation {
  employeeId: string;
  email: string;
  displayName: string;
  lastMessage: string;
  lastAt: string;
  lastFromAdmin: boolean;
  unreadCount: number;
}

interface ChatMsg {
  id: string;
  fromAdmin: boolean;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ConversationsResp { conversations: Conversation[] }
interface MessagesResp {
  employee: { id: string; email: string; displayName: string };
  messages: ChatMsg[];
}

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

export default function MessagesPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [text, setText] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Conversation list — poll every 5s
  const listQuery = useQuery<ConversationsResp>({
    queryKey: ['admin', 'messages'],
    queryFn: () => api.get<ConversationsResp>('/api/admin/messages'),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  // Active conversation — poll every 3s
  const chatQuery = useQuery<MessagesResp>({
    queryKey: ['admin', 'messages', selectedId],
    queryFn: () => api.get<MessagesResp>(`/api/admin/messages/${selectedId}`),
    enabled: !!selectedId,
    refetchInterval: 3_000,
    staleTime: 0,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post<{ message: ChatMsg }>(`/api/admin/messages/${selectedId}`, { content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['admin', 'messages', selectedId] });
      qc.invalidateQueries({ queryKey: ['admin', 'messages'] });
    },
  });

  // Auto-scroll on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatQuery.data?.messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sendMut.isPending || !selectedId) return;
    sendMut.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const conversations = (listQuery.data?.conversations ?? []).filter((c) =>
    !search || c.displayName.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedConv = conversations.find((c) => c.employeeId === selectedId) ??
    listQuery.data?.conversations.find((c) => c.employeeId === selectedId);

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Messages"
        description="Chat with creators who have reached out for support."
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Conversation list ── */}
        <div
          className={cn(
            'w-full md:w-72 lg:w-80 border-r flex flex-col flex-shrink-0',
            selectedId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search creators…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description="Creators who send a support message will appear here."
              />
            ) : (
              conversations.map((c) => (
                <button
                  key={c.employeeId}
                  onClick={() => { setSelectedId(c.employeeId); setText(''); }}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b hover:bg-muted/40 transition-colors',
                    selectedId === c.employeeId && 'bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.displayName}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.unreadCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-red-500 text-white rounded-full">
                          {c.unreadCount > 99 ? '99+' : c.unreadCount}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(c.lastAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.lastFromAdmin ? 'You: ' : ''}{c.lastMessage}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat window ── */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0',
            !selectedId ? 'hidden md:flex' : 'flex',
          )}
        >
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {selectedConv?.displayName ?? chatQuery.data?.employee.displayName ?? '…'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConv?.email ?? chatQuery.data?.employee.email}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {chatQuery.isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (chatQuery.data?.messages.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  chatQuery.data!.messages.map((msg) => (
                    <AdminMessageBubble key={msg.id} msg={msg} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t px-4 py-3 bg-background flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    placeholder="Type a message… (Enter to send)"
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
                      : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminMessageBubble({ msg }: { msg: ChatMsg }) {
  // fromAdmin = true → admin sent it → show on the RIGHT in admin view
  const isOutgoing = msg.fromAdmin;

  return (
    <div className={cn('flex', isOutgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <p
          className={cn(
            'text-[10px] mt-1',
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}
