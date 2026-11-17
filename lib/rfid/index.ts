export type RfidReaderStatus = {
  uid: string | null;
  timestamp: string | null;
  status: "waiting" | "detected" | "removed" | "no_reader" | "error";
  reader_connected: boolean;
  last_sent_uid: string | null;
};

export type RfidUidResponse = {
  uid: string | null;
  status: "ok" | "waiting";
};

const RFID_API_URL = process.env.NEXT_PUBLIC_RFID_API_URL || "http://localhost:5000";

async function requestRfid<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${RFID_API_URL}${path}`, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RFID server returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const getRfidStatus = () => requestRfid<RfidReaderStatus>("/api/rfid/status");

export const getRfidUid = () => requestRfid<RfidUidResponse>("/api/rfid/get-uid");

export const resetRfid = () =>
  requestRfid<{ message: string }>("/api/rfid/reset", { method: "POST" });
