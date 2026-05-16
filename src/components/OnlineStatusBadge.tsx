import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Wifi, WifiOff } from "lucide-react";

export function OnlineStatusBadge() {
  const online = useOnlineStatus();
  if (online) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono text-teal"
        title="En línea"
      >
        <Wifi className="w-3 h-3" /> ONLINE
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono text-destructive"
      title="Sin conexión — los cambios se guardarán localmente"
    >
      <WifiOff className="w-3 h-3" /> OFFLINE
    </span>
  );
}
