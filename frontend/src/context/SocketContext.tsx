import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../api/client";
import { ToastStack } from "../components/ToastStack";

const SOCKET_URL = (import.meta.env.VITE_API_URL as string).replace(/\/api\/v1$/, "");

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  requestId?: string;
  createdAt: number;
  read: boolean;
}

interface SocketContextValue {
  socket: Socket | null;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const instance = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });

    instance.on(
      "notification",
      (payload: { type: string; title: string; body: string; requestId?: string }) => {
        const notif: AppNotification = {
          ...payload,
          id: `${Date.now()}-${Math.random()}`,
          createdAt: Date.now(),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
        setToasts((prev) => [...prev, notif]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== notif.id)), 6000);
      }
    );

    setSocket(instance);

    return () => {
      instance.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAllRead }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
