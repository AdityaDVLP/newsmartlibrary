import asyncio
import json
import threading
import serial
import serial.tools.list_ports
from http.server import HTTPServer, BaseHTTPRequestHandler

# ─── CONFIG ────────────────────────────────────────────────────────────────────
BAUD_RATE  = 115200
WS_PORT    = 8765      # WebSocket port
HTTP_PORT  = 5001      # HTTP polling port (5000 sudah dipakai HF reader)

# ─── SHARED STATE ──────────────────────────────────────────────────────────────
latest_epc = {"epc": None, "rssi": None}
epc_lock   = threading.Lock()
reset_last_epc = threading.Event()   # Flag untuk reset dedup di serial thread

# ─── AUTO DETECT SERIAL PORT ──────────────────────────────────────────────────
def auto_detect_serial_port():
    """
    Scan semua COM port dan cari RFID UHF reader ELC RC04.

    Strategi (urutan prioritas):
    1. Deskripsi chip → pilih port USB-serial yang paling mungkin
    2. Kirim perintah inventory (0xCF) → validasi respons reader
    3. Fallback ke port pertama yang ada
    """
    import time

    ports = serial.tools.list_ports.comports()

    if not ports:
        print("[SERIAL] Tidak ada COM port ditemukan!")
        return None

    print(f"[SERIAL] Scanning {len(ports)} port(s)...")
    for port_info in ports:
        print(f"  → {port_info.device}: {port_info.description} [{port_info.hwid}]")

    # ── Tahap 1: Filter berdasarkan deskripsi chip (cepat) ──────────────────
    keywords = ["ch340", "ch341", "cp210", "cp2102", "ftdi", "usb serial", "uart", "rfid"]
    candidate_ports = []

    for port_info in ports:
        desc_lower = (port_info.description or "").lower()
        hwid_lower = (port_info.hwid or "").lower()
        combined = desc_lower + " " + hwid_lower
        for kw in keywords:
            if kw in combined:
                candidate_ports.append(port_info.device)
                print(f"  [SERIAL] Kandidat: {port_info.device} ({port_info.description})")
                break

    # Jika tidak ada kandidat dari deskripsi, coba semua port
    if not candidate_ports:
        candidate_ports = [p.device for p in ports]

    # ── Tahap 2: Kirim inventory command, cek respons ────────────────────────
    # Build inventory frame sementara (INVENTORY_CMD belum dideklarasi)
    def _build_cmd():
        frame = bytes([0xCF, 0x00, 0x00, 0x01, 0x00])
        val = 0xFFFF
        for b in frame:
            val ^= b
            for _ in range(8):
                val = (val >> 1) ^ 0x8408 if val & 1 else (val >> 1)
        return frame + bytes([(val >> 8) & 0xFF, val & 0xFF])

    inventory_cmd = _build_cmd()

    for port in candidate_ports:
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=0.5)
            time.sleep(0.1)  # Tunggu port stabil

            # Kirim 3x inventory command, baca respons
            found = False
            for attempt in range(3):
                ser.write(inventory_cmd)
                time.sleep(0.1)
                data = ser.read(64)
                if data and b'\xCF' in data:
                    print(f"[SERIAL] ✓ ELC RC04 merespons di {port}! (attempt {attempt+1})")
                    found = True
                    break

            ser.close()

            if found:
                return port

            print(f"  [SERIAL] {port} tidak merespons inventory command.")
        except (serial.SerialException, OSError) as e:
            print(f"  [SERIAL] {port} gagal dibuka: {e}")
            continue

    # ── Tahap 3: Fallback — gunakan kandidat pertama tanpa validasi ──────────
    if candidate_ports:
        port = candidate_ports[0]
        print(f"[SERIAL] ⚠ Tidak ada respons dari reader.")
        print(f"[SERIAL] ⚠ Fallback ke {port} — pastikan reader terhubung & driver terinstall.")
        return port

    first_port = ports[0].device
    print(f"[SERIAL] ⚠ Fallback ke port pertama: {first_port}")
    return first_port

# ─── RSSI PARSER ──────────────────────────────────────────────────────────────
def parse_rssi(rssi_bytes: bytes) -> float:
    """
    Konversi 2 byte RSSI ke nilai dBm.
    Format : two's complement, big-endian, unit 0.1 dBm
    Contoh : 0xFE48 → -440 → -44.0 dBm
    """
    raw = int.from_bytes(rssi_bytes, byteorder='big', signed=True)
    return raw / 10.0

# ─── FRAME VALIDATOR (CRC16) ──────────────────────────────────────────────────
def calc_crc16(data: bytes) -> tuple:
    """Hitung CRC16 sesuai protokol EL-UHF-RC4."""
    value = 0xFFFF
    for d in data:
        value ^= d
        for _ in range(8):
            value = (value >> 1) ^ 0x8408 if value & 0x0001 else (value >> 1)
    return (value >> 8) & 0xFF, value & 0xFF   # MSB, LSB

def is_valid_frame(frame: bytes) -> bool:
    """Validasi CRC16 frame ELC RC04."""
    if len(frame) < 7:
        return False
    crc_msb, crc_lsb = calc_crc16(frame[:-2])
    return frame[-2] == crc_msb and frame[-1] == crc_lsb

# ─── INVENTORY COMMAND BUILDER ────────────────────────────────────────────────
def build_inventory_command() -> bytes:
    """
    Bangun frame perintah inventory (CMD 0x0001) untuk ELC RC04.

    Format frame request:
    ┌──────┬──────┬────────┬─────┬────────┐
    │ HEAD │ ADDR │  CMD   │ LEN │ CRC(2) │
    │  CF  │  00  │ 00 01  │ 00  │  ??    │
    └──────┴──────┴────────┴─────┴────────┘
    LEN=0 → tidak ada parameter tambahan
    """
    frame_without_crc = bytes([0xCF, 0x00, 0x00, 0x01, 0x00])
    crc_msb, crc_lsb = calc_crc16(frame_without_crc)
    return frame_without_crc + bytes([crc_msb, crc_lsb])

INVENTORY_CMD = build_inventory_command()

# ─── SERIAL READER (background thread) ────────────────────────────────────────
def serial_reader_thread(on_epc_callback, serial_port):
    """
    Kirim perintah inventory ke ELC RC04 secara terus-menerus dan baca
    respons EPC.

    Reader UHF tidak broadcast otomatis — harus di-poll dengan mengirim
    perintah inventory (CMD 0x0001) setiap siklus.

    Format frame response inventory (CMD 0x0001):
    ┌──────┬──────┬────────┬─────┬────────┬─────────┬─────────┬─────────┬────────────┬────────────┬────────┐
    │ HEAD │ ADDR │  CMD   │ LEN │ STATUS │ RSSI(2) │ ANT.(1) │  CH.(1) │TagInfoLen  │  TagInfo   │ CRC(2) │
    │  CF  │  00  │ 00 01  │  N  │   00   │ FE 48   │   01    │   00    │    0C      │  EPC...    │  ??    │
    └──────┴──────┴────────┴─────┴────────┴─────────┴─────────┴─────────┴────────────┴────────────┴────────┘
    Offset:  0      1        2-3    4        5         6-7       8         9            10           11+N
    """
    import time

    last   = None
    buffer = bytearray()

    if not serial_port:
        print("[SERIAL] ERROR: Tidak ada serial port yang terdeteksi!")
        return

    try:
        ser = serial.Serial(serial_port, BAUD_RATE, timeout=0.3)
        print(f"[SERIAL] Connected to {serial_port} @ {BAUD_RATE}")
        print(f"[SERIAL] Mengirim perintah inventory ELC RC04 secara terus-menerus...")
    except Exception as e:
        print(f"[SERIAL] ERROR: {e}")
        return

    while True:
        try:
            # Cek apakah perlu reset dedup (start_scan dikirim)
            if reset_last_epc.is_set():
                last = None
                buffer.clear()
                reset_last_epc.clear()
                print("[SERIAL] Dedup reset → ready to re-read same tag")

            # ── Kirim perintah inventory ke reader ─────────────────────────
            ser.write(INVENTORY_CMD)

            # Baca respons (tunggu maks 300ms sesuai timeout serial)
            data = ser.read(128)
            if data:
                buffer.extend(data)

            # ── Parse frame ────────────────────────────────────────────────
            while len(buffer) >= 7:

                # Cari HEAD byte 0xCF
                if buffer[0] != 0xCF:
                    buffer.pop(0)
                    continue

                # Butuh minimal 5 byte untuk tahu panjang frame
                if len(buffer) < 5:
                    break

                cmd    = (buffer[2] << 8) | buffer[3]   # 2 byte CMD
                length = buffer[4]                        # LEN field

                # Total ukuran frame: HEAD(1)+ADDR(1)+CMD(2)+LEN(1)+Param(length)+CRC(2)
                frame_size = 7 + length
                if len(buffer) < frame_size:
                    break   # Data belum lengkap, tunggu

                frame = bytes(buffer[:frame_size])

                # Validasi CRC
                if not is_valid_frame(frame):
                    # CRC gagal → buang 1 byte dan coba lagi
                    buffer.pop(0)
                    continue

                # ── Hanya proses CMD 0x0001 (inventory response) ──────────
                if cmd == 0x0001:
                    status = frame[5]

                    if status == 0x00 and length >= 6:
                        # Offset setelah STATUS (index 5):
                        # [6..7]  = RSSI (2 byte)
                        # [8]     = Antenna
                        # [9]     = Channel
                        # [10]    = TagInfoLen
                        # [11..N] = TagInfo (EPC)
                        rssi_bytes   = frame[6:8]
                        # antenna    = frame[8]
                        # channel    = frame[9]
                        tag_info_len = frame[10]

                        if len(frame) >= 11 + tag_info_len:
                            tag_info = frame[11:11 + tag_info_len]
                            epc      = tag_info.hex().upper()
                            rssi_dbm = parse_rssi(rssi_bytes)

                            if epc and epc != last:
                                last = epc
                                print(f"[RFID] EPC: {epc} | RSSI: {rssi_dbm:.1f} dBm")

                                with epc_lock:
                                    latest_epc["epc"]  = epc
                                    latest_epc["rssi"] = rssi_dbm

                                on_epc_callback(epc, rssi_dbm)

                    elif status == 0x12:
                        pass   # No tag found – normal, abaikan
                    else:
                        print(f"[SERIAL] Status non-OK: 0x{status:02X}")

                # Buang frame yang sudah diproses
                buffer = buffer[frame_size:]

            # Jeda singkat sebelum inventory berikutnya
            time.sleep(0.05)

        except Exception as e:
            print(f"[SERIAL] Read error: {e}")
            buffer.clear()
            time.sleep(1)   # Jeda sebelum retry agar tidak flood error log

# ─── WEBSOCKET SERVER (asyncio) ───────────────────────────────────────────────
connected_clients = set()
scanning_clients  = set()   # Hanya client yang aktif scan (modal terbuka)
loop = None

async def ws_handler(websocket):
    """Handle satu koneksi WebSocket."""
    connected_clients.add(websocket)
    remote = websocket.remote_address
    print(f"[WS] Client connected: {remote}")

    try:
        async for message in websocket:
            msg = message.strip().lower()

            if msg == "start_scan":
                scanning_clients.add(websocket)
                print(f"[WS] Client {remote} → START SCAN (modal opened)")

                with epc_lock:
                    latest_epc["epc"]  = None
                    latest_epc["rssi"] = None
                reset_last_epc.set()

                try:
                    await websocket.send(json.dumps({
                        "type":    "scan_status",
                        "status":  "scanning",
                        "message": "RFID scanning aktif, silakan scan tag..."
                    }))
                except Exception:
                    pass

            elif msg == "stop_scan":
                scanning_clients.discard(websocket)
                print(f"[WS] Client {remote} → STOP SCAN (modal closed)")

                with epc_lock:
                    latest_epc["epc"]  = None
                    latest_epc["rssi"] = None

            elif msg == "reset":
                with epc_lock:
                    latest_epc["epc"]  = None
                    latest_epc["rssi"] = None
                print("[WS] EPC reset by client")

    except Exception:
        pass
    finally:
        connected_clients.discard(websocket)
        scanning_clients.discard(websocket)
        print(f"[WS] Client disconnected: {remote}")

async def broadcast_epc(epc: str, rssi: float = None):
    """Kirim EPC + RSSI HANYA ke client yang sedang scanning (modal terbuka)."""
    if not scanning_clients:
        return

    message = json.dumps({
        "type": "epc",
        "epc":  epc,
        "rssi": rssi        # float dBm, mis. -44.0
    })

    tasks = [
        asyncio.create_task(client.send(message))
        for client in scanning_clients.copy()
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
        print(f"[WS] EPC {epc} | RSSI {rssi:.1f} dBm → {len(tasks)} scanning client(s)")

def on_epc_from_serial(epc: str, rssi: float = None):
    """Callback dari serial thread → schedule broadcast ke asyncio event loop."""
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_epc(epc, rssi), loop)

# ─── HTTP SERVER (polling fallback) ───────────────────────────────────────────
class RFIDHTTPHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        if self.path == "/api/rfid/get-epc":
            with epc_lock:
                payload = {
                    "epc":  latest_epc["epc"],
                    "rssi": latest_epc["rssi"]
                }
            self._send_json(payload)

        elif self.path == "/api/rfid/status":
            with epc_lock:
                payload = {
                    "scanning_clients":  len(scanning_clients),
                    "connected_clients": len(connected_clients),
                    "latest_epc":        latest_epc["epc"],
                    "latest_rssi":       latest_epc["rssi"],
                }
            self._send_json(payload)

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/rfid/reset-epc":
            with epc_lock:
                latest_epc["epc"]  = None
                latest_epc["rssi"] = None
            self._send_json({"success": True})
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _send_json(self, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type",                "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length",              str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass   # Suppress default HTTP logs

def start_http_server():
    """Jalankan HTTP server di thread terpisah."""
    server = HTTPServer(("0.0.0.0", HTTP_PORT), RFIDHTTPHandler)
    print(f"[HTTP] Polling server on http://localhost:{HTTP_PORT}")
    server.serve_forever()

# ─── MAIN ──────────────────────────────────────────────────────────────────────
async def main():
    global loop
    loop = asyncio.get_event_loop()

    # Auto-detect serial port
    print("[SERIAL] Auto-detecting ELC RC04 RFID UHF reader...")
    detected_port = auto_detect_serial_port()

    if not detected_port:
        print("=" * 55)
        print("  ⚠ PERINGATAN: Tidak ada serial port terdeteksi!")
        print("  Server tetap berjalan (WebSocket + HTTP)")
        print("  Sambungkan ELC RC04 lalu restart server.")
        print("=" * 55)

    try:
        import websockets
    except ImportError:
        print("=" * 55)
        print("Module 'websockets' belum terinstall!")
        print("Jalankan: pip install websockets")
        print("=" * 55)
        print("[FALLBACK] Menjalankan HTTP polling saja (tanpa WebSocket)")

        if detected_port:
            threading.Thread(
                target=serial_reader_thread,
                args=(on_epc_from_serial, detected_port),
                daemon=True,
            ).start()

        start_http_server()   # blocking
        return

    # Start serial reader thread
    if detected_port:
        threading.Thread(
            target=serial_reader_thread,
            args=(on_epc_from_serial, detected_port),
            daemon=True,
        ).start()

    # Start HTTP polling server thread
    threading.Thread(target=start_http_server, daemon=True).start()

    # Banner
    print()
    print("=" * 55)
    print("  ELC RC04 RFID UHF Server — with RSSI Support")
    print("=" * 55)
    print(f"  WebSocket : ws://localhost:{WS_PORT}")
    print(f"  HTTP Poll : http://localhost:{HTTP_PORT}/api/rfid/get-epc")
    print(f"  Status    : http://localhost:{HTTP_PORT}/api/rfid/status")
    print(f"  Serial    : {detected_port or 'NOT DETECTED'} @ {BAUD_RATE}")
    print()
    print("  WebSocket messages:")
    print("    → send  : 'start_scan'  (modal dibuka)")
    print("    → send  : 'stop_scan'   (modal ditutup)")
    print("    → send  : 'reset'       (clear EPC)")
    print("    ← recv  : {type, epc, rssi}  (saat tag terbaca)")
    print()
    print("  RSSI: nilai dBm (mis. -44.0), makin kecil = makin jauh")
    print()
    print("  Mode: Polling inventory aktif (CMD 0x0001, ~50ms/siklus)")
    print("        Reader membaca terus-menerus seperti HF server")
    print("=" * 55)
    print()

    async with websockets.serve(ws_handler, "0.0.0.0", WS_PORT):
        await asyncio.Future()   # run forever

if __name__ == "__main__":
    asyncio.run(main())