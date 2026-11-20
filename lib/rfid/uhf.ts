import { useEffect, useRef, useCallback, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UhfReaderStatus = {
  status: "reading" | "no_reader" | "error";
  reader_connected: boolean;
  serial_port: string | null;
  latest_epc: string | null;
  last_seen: string | null;
};

export type UhfEpcResponse = {
  epc: string | null;
  rssi: number | null;
};

export type UhfWsMessage =
  | { type: "epc"; epc: string; rssi: number | null }
  | { type: "scan_status"; status: string; message: string };

// ─── HTTP Polling (fallback) ───────────────────────────────────────────────────
const UHF_RFID_API_URL =
  process.env.NEXT_PUBLIC_UHF_RFID_API_URL || "http://localhost:5001";

async function requestUhf<T>(path: string): Promise<T> {
  const response = await fetch(`${UHF_RFID_API_URL}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`UHF server returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const getUhfStatus = () =>
  requestUhf<UhfReaderStatus>("/api/rfid/status");

export const getUhfEpc = () =>
  requestUhf<UhfEpcResponse>("/api/rfid/get-epc");

// ─── WebSocket Hook ───────────────────────────────────────────────────────────
const UHF_WS_URL =
  process.env.NEXT_PUBLIC_UHF_WS_URL || "ws://localhost:8765";

export type UseUhfScannerOptions = {
  /** Dipanggil setiap kali EPC buku terbaca */
  onEpc: (epc: string, rssi: number | null) => void;
  /** Aktifkan koneksi WebSocket (mis. saat modal dibuka) */
  enabled: boolean;
};

/**
 * Hook untuk membaca EPC buku dari UHF RFID reader via WebSocket.
 *
 * Cara pakai:
 * ```tsx
 * const { isConnected, startScan, stopScan } = useUhfScanner({
 *   enabled: isModalOpen,
 *   onEpc: (epc, rssi) => setFieldValue("epc", epc),
 * });
 * ```
 */
export function useUhfScanner({ onEpc, enabled }: UseUhfScannerOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  // Simpan onEpc di ref agar WebSocket tidak reconnect setiap render
  const onEpcRef = useRef(onEpc);
  useEffect(() => { onEpcRef.current = onEpc; }, [onEpc]);

  const startScan = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("start_scan");
    }
  }, []);

  const stopScan = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("stop_scan");
    }
  }, []);

  const resetEpc = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("reset");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Tutup koneksi saat tidak aktif
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send("stop_scan");
        }
        wsRef.current.close();
        wsRef.current = null;
        isConnectedRef.current = false;
      }
      return;
    }

    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted || !enabled) return;

      try {
        const ws = new WebSocket(UHF_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          isConnectedRef.current = true;
          setIsConnected(true);
          console.log("[UHF-WS] Terhubung ke", UHF_WS_URL);
          ws.send("start_scan");
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data as string) as UhfWsMessage;
            if (msg.type === "epc") {
              // Panggil via ref agar selalu dapat callback terbaru
              onEpcRef.current(msg.epc, msg.rssi);
            }
          } catch {
            // abaikan pesan non-JSON
          }
        };

        ws.onerror = () => {
          // Tidak menggunakan console.error agar Next.js dev overlay tidak memunculkan popup error saat server belum dinyalakan
          isConnectedRef.current = false;
          setIsConnected(false);
        };

        ws.onclose = () => {
          isConnectedRef.current = false;
          setIsConnected(false);
          wsRef.current = null;
          // Auto-reconnect jika scanner masih diaktifkan
          if (isMounted && enabled) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch {
        isConnectedRef.current = false;
        if (isMounted && enabled) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send("stop_scan");
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectedRef.current = false;
      setIsConnected(false);
    };
  // Hanya re-run saat enabled berubah — onEpc diakses via ref
  }, [enabled]);

  return { isConnected, startScan, stopScan, resetEpc };
}
