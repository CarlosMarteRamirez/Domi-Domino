"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Input } from "@/presentation/components/ui/input";
import { Button } from "@/presentation/components/ui/button";
import type { ChatMessageDto } from "@/shared/socket/contract";

const EMOJIS = ["😀", "😂", "😎", "🔥", "👏", "😱", "🎲", "💪", "🤝", "😭"];

interface Props {
  messages: ChatMessageDto[];
  currentUserId: string;
  unread: number;
  onSend: (content: string) => void;
  onSeen: () => void;
  fullHeight?: boolean;
}

export function ChatPanel({ messages, currentUserId, unread, onSend, onSeen, fullHeight }: Props) {
  const [text, setText] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    onSeen();
  }, [messages, onSeen]);

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <Card className={fullHeight ? "flex h-full min-h-[400px] flex-col" : "flex h-full flex-col"}>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-base">
          Chat
          {unread > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 p-3 pt-0">
        <div
          ref={scrollRef}
          className="flex-1 space-y-2 overflow-y-auto pr-1"
          style={fullHeight ? undefined : { maxHeight: 320 }}
        >
          {messages.map((m) => (
            <div key={m.id} className={m.userId === currentUserId ? "text-right" : ""}>
              <p className="text-xs text-muted-foreground">{m.displayName}</p>
              <p className="inline-block rounded-lg bg-secondary px-2 py-1 text-sm">{m.content}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Sé el primero en escribir.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded p-1 text-lg hover:bg-accent"
              onClick={() => setText((t) => t + e)}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribe un mensaje..."
          />
          <Button size="icon" onClick={send}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
