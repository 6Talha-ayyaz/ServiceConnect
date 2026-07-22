import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { fetchMessages, sendChatMessage, type ChatMessage } from "../api/requests";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";

const QUICK_REPLIES = ["On my way", "I'll be 10 minutes late", "Please share a photo"];

export function ChatPanel({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(requestId).then((res) => setMessages(res.messages));
  }, [requestId]);

  useEffect(() => {
    if (!socket) return;
    function handleNewMessage(payload: { requestId: string; message: ChatMessage }) {
      if (payload.requestId !== requestId) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
    }
    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(text?: string) {
    const body = (text ?? draft).trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await sendChatMessage(requestId, body);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ padding: 20 }}>
      <h3 style={{ marginBottom: 10 }}>Chat</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 260,
          overflowY: "auto",
          marginBottom: 12,
          paddingRight: 4,
        }}
      >
        {messages.length === 0 && <p className="muted">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "75%",
                  padding: "8px 12px",
                  borderRadius: 14,
                  fontSize: 14,
                  background: mine ? "var(--accent-gradient)" : "var(--bg-1)",
                  color: mine ? "#ffffff" : "var(--text-0)",
                  border: mine ? "none" : "1px solid var(--border)",
                }}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {QUICK_REPLIES.map((q) => (
          <button key={q} onClick={() => handleSend(q)} className="badge" style={{ cursor: "pointer" }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Type a message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="sm" onClick={() => handleSend()} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}
