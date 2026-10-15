import { useEffect, useState } from "react";
import { laravelApi } from "../shared/api";

const POLL_MS = 60_000;

/**
 * How many support tickets are waiting for a staff reply, for the admin
 * notification bell. Re-checked every minute and whenever the tab regains
 * focus, so a ticket opened while the dashboard is open still shows up.
 */
export function useTicketsNeedingReply(adminToken: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!adminToken) {
      setCount(0);
      return;
    }

    let isCurrent = true;
    const refresh = () =>
      laravelApi<{ needs_reply: number }>("/api/v1/admin/support-tickets/summary", adminToken)
        .then((response) => isCurrent && setCount(response.needs_reply))
        .catch(() => undefined);

    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);

    return () => {
      isCurrent = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [adminToken]);

  return count;
}
