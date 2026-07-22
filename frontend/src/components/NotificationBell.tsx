import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useSocket();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleToggle() {
    setOpen((o) => !o);
    if (!open) markAllRead();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleToggle}
        className="btn btn-ghost btn-sm"
        style={{ position: "relative", padding: "7px 10px" }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "var(--danger)",
              color: "#ffffff",
              borderRadius: "50%",
              fontSize: 10,
              fontWeight: 700,
              width: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass-card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            padding: 8,
            zIndex: 100,
          }}
        >
          {notifications.length === 0 && (
            <p className="muted" style={{ padding: 12, margin: 0 }}>
              No notifications yet.
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                setOpen(false);
                if (n.type === "REQUEST_NEW") {
                  // A brand-new broadcast isn't accepted yet, so the provider isn't
                  // authorized to view its full detail page (FR-4.13) — send them to
                  // the list where they can preview and Accept/Decline instead.
                  navigate("/provider/available");
                } else if (n.requestId) {
                  navigate(`/requests/${n.requestId}`);
                }
              }}
              style={{
                padding: 10,
                borderRadius: 10,
                cursor: n.requestId ? "pointer" : "default",
                marginBottom: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <strong style={{ fontSize: 13 }}>{n.title}</strong>
              <p style={{ margin: "2px 0 0", fontSize: 13 }}>{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
