from enum import Enum
from typing import Iterator
 
from command import CommandRequest, Command
from response import Response, Tag, ReaderSettings, InventoryStatus, HEADER
from transport import Transport
 
 
class StopType(Enum):
    TIME = 0x00
    NUMBER = 0x01
 
 
class Reader:
    def __init__(self, transport: Transport) -> None:
        super().__init__()
        self.transport = transport
        self.transport.connect()
 
    def close(self) -> None:
        self.transport.close()
 
    def __receive_response(self) -> bytes | None:
        while True:
            first_byte = self.transport.read_bytes(1)
 
            if not first_byte:
                continue
 
            # DEBUG (boleh dihapus nanti)
            print("BYTE:", first_byte.hex())
 
            # 🔥 Sinkronisasi header
            if first_byte[0] == HEADER:
                break
 
        # Ambil sisa header (4 byte lagi)
        rest_header = self.transport.read_bytes(4)
        response_header_section = first_byte + rest_header
 
        if len(response_header_section) != 5:
            return None
 
        # Ambil panjang body
        body_length = response_header_section[-1]
 
        # Ambil body + checksum
        response_body_section = self.transport.read_bytes(body_length + 2)
 
        return response_header_section + response_body_section
 
    def reader_settings(self) -> ReaderSettings:
        cmd_request: CommandRequest = CommandRequest.GET_ALL_PARAM
        command: Command = Command(cmd_request)
 
        self.transport.write_bytes(command.serialize())
 
        response: Response = Response(self.__receive_response())
 
        assert response.command == cmd_request
 
        return ReaderSettings.from_bytes(response.payload)
 
    def set_reader_settings(self, reader_settings: ReaderSettings) -> Response:
        cmd_request: CommandRequest = CommandRequest.SET_ALL_PARAM
        command: Command = Command(cmd_request, data=reader_settings.to_command_data())
 
        self.transport.write_bytes(command.serialize())
 
        response: Response = Response(self.__receive_response())
 
        assert response.command == cmd_request
 
        return response
 
    def start_inventory_answer_mode(self, stop_type: StopType, value: int) -> Iterator[str]:
        cmd_request: CommandRequest = CommandRequest.INVENTORY_ISO_CONTINUE
        data = bytearray([stop_type.value])
        data.extend(value.to_bytes(4, "big"))
 
        command = Command(cmd_request, data=data)
 
        self.transport.write_bytes(command.serialize())
 
        while True:
            raw_response: bytes | None = self.__receive_response()
            if raw_response is None:
                continue
 
            try:
                response: Response = Response(raw_response)
            except Exception:
                # skip kalau parsing gagal
                continue
 
            inventory_status: InventoryStatus = InventoryStatus(response.status.value)
 
            # 🔥 FIX: jangan break (biar realtime)
            if inventory_status == InventoryStatus.NO_COUNT_LABEL:
                continue
 
            if response.command == CommandRequest.INVENTORY_STOP:
                break
 
            # 🔥 Ambil EPC
            epc = response.payload[5:].hex().upper()
 
            yield epc
 
    def stop_inventory_answer_mode(self) -> Response:
        cmd_request: CommandRequest = CommandRequest.INVENTORY_STOP
        command: Command = Command(cmd_request)
 
        self.transport.write_bytes(command.serialize())
 
        response: Response = Response(self.__receive_response())
 
        assert response.command == cmd_request
 
        return response
