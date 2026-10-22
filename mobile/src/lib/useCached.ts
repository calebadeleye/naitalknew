import { useCallback, useEffect, useRef, useState } from "react";
import { NetworkError } from "./api";
import { cacheKey, kvGet, kvSet } from "./db";
import { useSession } from "../state/session";

/**
 * Load something from the API, showing the phone's last copy first and
 * keeping that copy when offline. `key` names the cache entry per mailbox.
 */
export function useCached<T>(key: string, load: (token: string) => Promise<T>, deps: unknown[] = []) {
  const { account, handleError } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  loader.current = load;

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const fresh = await loader.current(account.token);
      setData(fresh);
      setOffline(false);
      setError(null);
      await kvSet(cacheKey(account.email, key), fresh).catch(() => {});
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true);
      else setError(handleError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, key, ...deps]);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    kvGet<T>(cacheKey(account.email, key)).then((cached) => {
      if (!cancelled && cached) setData(cached);
    });
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, offline, error, loading, refresh };
}
