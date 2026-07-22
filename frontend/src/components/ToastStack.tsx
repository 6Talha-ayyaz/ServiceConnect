import { AnimatePresence, motion } from "framer-motion";
import type { AppNotification } from "../context/SocketContext";

export function ToastStack({ toasts, onDismiss }: { toasts: AppNotification[]; onDismiss: (id: string) => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 84,
        right: 20,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 320,
        maxWidth: "calc(100vw - 40px)",
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="glass-card"
            style={{ padding: 14, cursor: "pointer" }}
            onClick={() => onDismiss(t.id)}
          >
            <strong style={{ fontSize: 13 }}>{t.title}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>{t.body}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
