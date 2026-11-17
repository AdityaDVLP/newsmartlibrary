from datetime import datetime
import threading
import time

from flask import Flask, jsonify
from flask_cors import CORS
from smartcard.Exceptions import NoCardException
from smartcard.System import readers

app = Flask(__name__)
CORS(app)

rfid_state = {
    "uid": None,
    "timestamp": None,
    "status": "waiting",
    "reader_connected": False,
    "last_sent_uid": None,
}


def rfid_loop():
    while True:
        try:
            available_readers = readers()
            if not available_readers:
                rfid_state["reader_connected"] = False
                rfid_state["status"] = "no_reader"
                time.sleep(2)
                continue

            reader = available_readers[0]
            rfid_state["reader_connected"] = True
            connection = reader.createConnection()
            last_uid = None

            while True:
                try:
                    connection.connect()
                    data, sw1, sw2 = connection.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])

                    if sw1 == 0x90 and sw2 == 0x00:
                        uid = "".join(format(value, "02X") for value in data)
                        if uid != last_uid:
                            rfid_state["uid"] = uid
                            rfid_state["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            rfid_state["status"] = "detected"
                            last_uid = uid

                    time.sleep(0.5)

                except NoCardException:
                    if last_uid is not None:
                        rfid_state["status"] = "removed"
                        rfid_state["last_sent_uid"] = None
                        last_uid = None
                    time.sleep(0.5)

        except Exception:
            rfid_state["status"] = "error"
            rfid_state["reader_connected"] = False
            time.sleep(3)


@app.get("/api/rfid/status")
def get_status():
    return jsonify(rfid_state)


@app.get("/api/rfid/get-uid")
def get_uid_once():
    uid = rfid_state["uid"]
    if uid and uid != rfid_state["last_sent_uid"]:
        rfid_state["last_sent_uid"] = uid
        return jsonify({"uid": uid, "status": "ok"})
    return jsonify({"uid": None, "status": "waiting"})


@app.post("/api/rfid/reset")
def reset():
    rfid_state["uid"] = None
    rfid_state["last_sent_uid"] = None
    rfid_state["status"] = "waiting"
    return jsonify({"message": "reset ok"})


if __name__ == "__main__":
    threading.Thread(target=rfid_loop, daemon=True).start()
    print("RFID Server jalan di http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
