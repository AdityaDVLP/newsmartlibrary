import unittest

from lib.rfid.uhf_server import (
    calc_crc16,
    extract_frames,
    get_pending_epc,
    is_valid_frame,
    parse_inventory_frame,
    _publish_epc,
)


def make_frame(command: bytes, payload: bytes) -> bytes:
    frame = bytes((0xCF, 0x00)) + command + bytes((len(payload),)) + payload
    return frame + bytes(calc_crc16(frame))


class UHFServerTests(unittest.TestCase):
    def test_extracts_epc_from_valid_inventory_response(self) -> None:
        epc_bytes = bytes.fromhex("300833B2DDD9014000000001")
        payload = bytes((0x00, 0xFE, 0x48, 0x01, 0x00, len(epc_bytes))) + epc_bytes
        frame = make_frame(b"\x00\x01", payload)

        self.assertTrue(is_valid_frame(frame))
        self.assertEqual(parse_inventory_frame(frame), (epc_bytes.hex().upper(), 0))

    def test_identifies_no_tag_response_for_scan_deduplication(self) -> None:
        frame = make_frame(b"\x00\x01", bytes((0x12,)))

        self.assertEqual(parse_inventory_frame(frame), (None, 0x12))

    def test_epc_polling_returns_each_pending_scan_once(self) -> None:
        _publish_epc("300833B2DDD9014000000001")

        self.assertEqual(get_pending_epc(), "300833B2DDD9014000000001")
        self.assertIsNone(get_pending_epc())

    def test_rejects_bad_crc_and_truncated_epc_data(self) -> None:
        epc_bytes = bytes.fromhex("300833B2")
        valid_payload = bytes((0x00, 0, 0, 1, 0, len(epc_bytes))) + epc_bytes
        bad_crc = make_frame(b"\x00\x01", valid_payload)[:-1] + b"\x00"
        truncated_payload = bytes((0x00, 0, 0, 1, 0, 8)) + epc_bytes
        truncated_frame = make_frame(b"\x00\x01", truncated_payload)

        self.assertIsNone(parse_inventory_frame(bad_crc))
        self.assertIsNone(parse_inventory_frame(truncated_frame))

    def test_extracts_concatenated_frames_and_keeps_partial_frame(self) -> None:
        first = make_frame(b"\x00\x01", bytes((0x12,)))
        second = make_frame(b"\x00\x01", bytes((0x12,)))
        buffer = bytearray(first + second[:-2])

        self.assertEqual(extract_frames(buffer), [first])
        self.assertEqual(bytes(buffer), second[:-2])
        buffer.extend(second[-2:])
        self.assertEqual(extract_frames(buffer), [second])
        self.assertEqual(buffer, bytearray())


if __name__ == "__main__":
    unittest.main()
