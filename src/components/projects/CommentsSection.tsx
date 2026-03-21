'use client';

import { useEffect, useRef, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToCollection, create } from '@/lib/firestore/helpers';
import type { CommentDoc } from '@/types';
import { cn } from '@/lib/utils';

interface CommentsSectionProps {
  projectId: string;
  taskId: string;
}

export function CommentsSection({ projectId, taskId }: CommentsSectionProps) {
  const { user, userDoc } = useAuth();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToCollection<CommentDoc>(
      `projects/${projectId}/tasks/${taskId}/comments`,
      [orderBy('createdAt', 'asc')],
      setComments,
    );
    return unsub;
  }, [projectId, taskId]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const sendComment = async () => {
    if (!text.trim() || !user) return;
    const draft = text.trim();
    setText('');
    setSending(true);
    try {
      await create<CommentDoc>(`projects/${projectId}/tasks/${taskId}/comments`, {
        taskId,
        projectId,
        text: draft,
        authorId: user.uid,
        authorName: userDoc?.displayName ?? user.email ?? 'Unknown',
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send comment');
      setText(draft); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendComment();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Comments</h3>

      {/* Messages */}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No comments yet. Be the first!
          </p>
        )}
        {comments.map((c) => {
          const isOwn = c.authorId === user?.uid;
          const ts = c.createdAt
            ? format(new Date(c.createdAt.seconds * 1000), 'MMM d · h:mm a')
            : '';
          return (
            <div
              key={c.id}
              className={cn('flex flex-col gap-0.5 max-w-[85%]', isOwn ? 'self-end items-end' : 'self-start items-start')}
            >
              <span className="text-[10px] text-muted-foreground px-1">
                {isOwn ? 'You' : c.authorName} · {ts}
              </span>
              <div
                className={cn(
                  'px-3 py-2 rounded-2xl text-sm leading-snug break-words',
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm',
                )}
              >
                {c.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… (Enter to send)"
          rows={2}
          className={cn(
            'flex-1 rounded-lg border border-input bg-transparent px-3 py-2',
            'text-sm outline-none transition-colors resize-none',
            'focus:border-ring focus:ring-3 focus:ring-ring/50',
          )}
        />
        <button
          onClick={sendComment}
          disabled={!text.trim() || sending}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
