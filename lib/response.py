from dataclasses import dataclass
from enum import Enum
from typing import TypeVar, Type
 
from command import HEADER, CommandRequest
from utils import calculate_checksum, hex_readable, calculate_rssi
 
T = TypeVar('T', bound='Parent')
 
 
class Status(Enum):
    SUCCESS = 0x00
    WRONG_PARAM = 0x01
    CMD_EXECUTION_FAILED = 0x02
    RESERVE = 0x03
    NO_COUNT_LABEL = 0x12
    TIMEOUT = 0x14
    TAG_RESPONSE_ERROR = 0x15
    AUTHENTICATION_FAILED = 0x16
    WRONG_PASSWORD = 0x17
    NO_MORE_DATA = 0xFF
 
 
class TagStatus(Enum):
    NO_ERROR = 0xFF
    TIMEOUT = 0x14
    OTHER_ERROR = 0x81
    STORAGE_AREA_ERROR = 0x82
    STORAGE_LOCK = 0x83
    INSUFFICIENT_POWER = 0x84
    NO_POWER = 0x85
 
 
class InventoryStatus(Enum):
    SUCCESS = 0x00
    WRONG_PARAM = 0x01
    CMD_EXECUTION_FAILED = 0x02
    NO_COUNT_LABEL = 0x12
    EXCEED_MAX_TRANSMIT_SERIAL = 0x17
 
 
@dataclass
class Tag:
    rssi: bytes
    antenna: int
    channel: int
    data: bytes
    count: int = 1
 
    def __str__(self) -> str:
        return f'Tag(rssi: {str(calculate_rssi(self.rssi))[0:3]}, ' \
               f'antenna: {self.antenna}, channel: {self.channel}, ' \
               f'data: {hex_readable(self.data)})'
 
 
class Response:
    def __init__(self, response: bytes) -> None:
        if response is None:
            raise ValueError("Response is None")
 
        header_section: bytes = response[0:5]
        assert header_section[0] == HEADER
        self.header: int = response[0]
        self.address: int = response[1]
        self.command: CommandRequest = CommandRequest(int.from_bytes(response[2:4], "big"))
        self.length: int = response[4]
        self.status: Status = Status(response[5])
 
        __body_n_checksum_section: bytes = response[6: 4 + self.length + 2 + 1]
        self.payload: bytes = __body_n_checksum_section[0:-2]
        self.checksum: bytes = __body_n_checksum_section[-2:]
 
        # Verify checksum
        data = bytearray(header_section)
        data.extend(bytearray([self.status.value]))
        if self.payload:
            data.extend(self.payload)
        crc_msb, crc_lsb = calculate_checksum(data)
        assert self.checksum[0] == crc_msb and self.checksum[1] == crc_lsb
 
    def __str__(self) -> str:
        response = [
            "<<< START RESPONSE ================================",
            f"COMMAND   >> {self.command}",
            f"STATUS    >> {self.status}",
        ]
        if self.payload:
            response.append(f"PAYLOAD   >> {hex_readable(self.payload)}")
        response.append("<<< END RESPONSE   ================================")
        return "\n".join(response).strip().upper()
 
 
class RfidProtocol(Enum):
    """Only for ISO 18000-6C"""
    ISO_18000_6C = 0x00
    GBT_29768 = 0x01
    GJB_7377_1 = 0x02
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return RfidProtocol.DISPLAY_STRINGS[self.value]
 
 
RfidProtocol.DISPLAY_STRINGS = [
    "ISO 18000-6C",
    "GB/T 29768",
    "GJB 7377.1"
]
 
 
class BaudRate(Enum):
    BPS_9600 = 0x00
    BPS_19200 = 0x01
    BPS_38400 = 0x02
    BPS_57600 = 0x03
    BPS_115200 = 0x04
 
    _ignore_ = ["INT"]
    INT = []
 
    def __str__(self) -> str:
        return f'{self.to_int} bps'
 
    @property
    def to_int(self) -> int:
        return self.INT[self.value]
 
    @classmethod
    def from_int(cls, value: int) -> T:
        for baud_rate in BaudRate:
            if baud_rate.to_int == value:
                return baud_rate
 
 
BaudRate.INT = [9600, 19200, 38400, 57600, 115200]
 
 
class Relay(Enum):
    OPEN = 0x01
    CLOSE = 0x02
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return Relay.DISPLAY_STRINGS[self.value - 1]
 
    def to_index(self) -> int:
        return self.value - 1
 
 
Relay.DISPLAY_STRINGS = ["Open", "Close"]
 
 
class WorkMode(Enum):
    ANSWER_MODE = 0x00
    ACTIVE_MODE = 0x01
    TRIGGER_MODE = 0x02
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return WorkMode.DISPLAY_STRINGS[self.value]
 
 
WorkMode.DISPLAY_STRINGS = ["Answer Mode", "Active Mode", "Trigger Mode"]
 
 
class OutputInterface(Enum):
    WIEGAND = 0x99
    RS232 = 0x80
    RS485 = 0x40
    RJ45 = 0x20
    # WiFi = 0x10
    USB = 0x01
    KEYBOARD = 0x02
    # CDC_COM = 0x04
 
    _ignore_ = ["DISPLAY_STRINGS"]
 
    DISPLAY_STRINGS = []
 
    @property
    def index(self) -> int:
        for index, value in enumerate(OutputInterface):
            if self == value:
                return index
 
    def __str__(self) -> str:
        return OutputInterface.DISPLAY_STRINGS[self.index]
 
    @classmethod
    def from_index(cls: Type[T], index: int) -> T:
        for i, value in enumerate(OutputInterface):
            if index == i:
                return value
 
 
OutputInterface.DISPLAY_STRINGS = [
    "Wiegand",
    "RS232",
    "RS485",
    "RJ45",
    "USB",
    "Keyboard",
    # "CDC_COM"
]
 
 
class Session(Enum):
    SESSION_0 = 0x00
    SESSION_1 = 0x01
    SESSION_2 = 0x02
    SESSION_3 = 0x03
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return Session.DISPLAY_STRINGS[self.value]
 
 
Session.DISPLAY_STRINGS = [
    "S0",
    "S1",
    "S2",
    "S3"
]
 
 
class MemoryBank(Enum):
    PASSWORD = 0x00
    EPC = 0x01
    TID = 0x02
    USER = 0x03
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return MemoryBank.DISPLAY_STRINGS[self.value]
 
 
MemoryBank.DISPLAY_STRINGS = [
    "Password",
    "EPC",
    "TID",
    "User"
]
 
 
class LockMemoryBank(Enum):
    KILL_PASSWORD = 0x00
    ACCESS_PASSWORD = 0x01
    EPC = 0x02
    # TID = 0x03  # Unlock/lock response is None
    USER = 0x04
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def to_index(self) -> int:
        for index, lock_memory_bank in enumerate(LockMemoryBank):
            if lock_memory_bank.value == self.value:
                return index
 
    @classmethod
    def from_index(cls: Type[T], index: int) -> T:
        for i, value in enumerate(LockMemoryBank):
            if index == i:
                return value
 
    def __str__(self) -> str:
        return LockMemoryBank.DISPLAY_STRINGS[self.to_index()]
 
 
LockMemoryBank.DISPLAY_STRINGS = [
    "Access Password",
    "Kill Password",
    "EPC",
    "User"
]
 
 
class LockAction(Enum):
    UNLOCK = 0x00
    UNLOCK_PERMANENT = 0x01
    LOCK = 0x02
    LOCK_PERMANENT = 0x03
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return LockAction.DISPLAY_STRINGS[self.value]
 
 
LockAction.DISPLAY_STRINGS = [
    "Unlock",
    "Unlock (Permanent)",
    "Lock",
    "Lock (Permanent)",
]
 
 
class Region:
    def __init__(self, name: str, value: int,
                 start_frequency: float, end_frequency: float, default_channel_number: int) -> None:
        self.name = name
        self.value = value
        self.start_frequency = start_frequency
        self.end_frequency = end_frequency
        self.default_channel_number = default_channel_number
        self.step = round((self.end_frequency - self.start_frequency) / (self.default_channel_number - 1), 2)
 
    def __str__(self) -> str:
        return self.name
 
    @property
    def index(self) -> int:
        for index, region in enumerate(REGIONS):
            if self.value == region.value:
                return index
 
    @property
    def values(self) -> list[float]:
        return [round(self.start_frequency + i * self.step, 3) for i in range(self.default_channel_number)]
 
    @classmethod
    def from_value(cls: Type[T], value: int) -> T:
        for region in REGIONS:
            if region.value != value:
                continue
            return region
 
    @classmethod
    def from_name(cls: Type[T], name: str) -> T:
        for region in REGIONS:
            if region.name != name:
                continue
            return region
 
    @classmethod
    def from_index(cls: Type[T], index: int) -> T:
        for i, region in enumerate(REGIONS):
            if i != index:
                continue
            return region
 
 
REGION_CUSTOM = Region("Custom", 0x00, 840, 960, 0)  # ? CN-nya?
REGION_USA = Region("USA", 0x01, 902.75, 927.25, 50)
REGION_KOREA = Region("Korea", 0x02, 917.1, 923.3, 32)
REGION_EUROPE = Region("Europe", 0x03, 865.1, 867.9, 15)
REGION_JAPAN = Region("Japan", 0x04, 952.2, 953.6, 8)
REGION_MALAYSIA = Region("Malaysia", 0x05, 919.5, 922.5, 7)
REGION_EUROPE_3 = Region("Europe 3", 0x06, 865.7, 867.5, 4)
REGION_CHINA_1 = Region("China 1", 0x07, 840.125, 844.875, 20)
REGION_CHINA_2 = Region("China 2", 0x08, 920.125, 924.875, 20)
REGIONS = [REGION_USA, REGION_KOREA, REGION_EUROPE, REGION_JAPAN, REGION_MALAYSIA,
           REGION_EUROPE_3, REGION_CHINA_1, REGION_CHINA_2]
 
 
@dataclass
class Frequency:
    region: Region
    min_frequency: float
    max_frequency: float
 
    @property
    def channel_number(self) -> int:
        hop = 1
        temp = self.min_frequency
        while True:  # REFACTOR
            if temp == self.max_frequency:
                return hop
            temp = round(temp + self.region.step, 3)
            hop += 1
 
    @classmethod
    def from_bytes(cls: Type[T], data: bytes) -> T:
        assert len(data) == 8
        region = Region.from_value(data[0])
        start_fred = int.from_bytes(data[3:5], "big") / 1000
        channel_number = data[-1]
        step = int.from_bytes(data[5:7], "big")
        min_frequency_int = int.from_bytes(data[1:3], "big")
        min_frequency = min_frequency_int + start_fred
        max_frequency = min_frequency + (channel_number - 1) * step / 1000
        return Frequency(region, min_frequency, max_frequency)
 
    def to_command_data(self) -> bytes:
        assert self.min_frequency <= self.max_frequency
 
        step: int = int(self.region.step * 1000)
        min_frequency_int: int = int(self.min_frequency)
        min_frequency_fraction: int = int((self.min_frequency - min_frequency_int) * 1000)
 
        data = bytearray([self.region.value])
        data.extend(min_frequency_int.to_bytes(2, "big"))
        data.extend(min_frequency_fraction.to_bytes(2, "big"))
        data.extend(step.to_bytes(2, "big"))
        data.extend(self.channel_number.to_bytes(1, "big"))
        return data
 
    def __str__(self) -> str:
        return_value = ''
        value = f'- REGION        >> {self.region}'
        return_value = f'{return_value}\n{value}'
        value = f'      - MIN FREQUENCY >> {self.min_frequency}'
        return_value = f'{return_value}\n{value}'
        value = f'      - MAX FREQUENCY >> {self.max_frequency}'
        return_value = f'{return_value}\n{value}'
        return return_value.strip().upper()
 
 
class WiegandProtocol(Enum):
    WG_26 = 0x00
    WG_34 = 0x01
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return WiegandProtocol.DISPLAY_STRINGS[self.value]
 
 
WiegandProtocol.DISPLAY_STRINGS = ["WG26", "WG34"]
 
 
class WiegandByteFirstType(Enum):
    LOW_BYTE_FIRST = 0x00
    HIGH_BYTE_FIRST = 0x01
 
    _ignore_ = ["DISPLAY_STRINGS"]
    DISPLAY_STRINGS = []
 
    def __str__(self) -> str:
        return WiegandByteFirstType.DISPLAY_STRINGS[self.value]
 
 
WiegandByteFirstType.DISPLAY_STRINGS = ["Low byte first", "High byte first"]
 
 
@dataclass
class Wiegand:
    is_open: bool
    protocol: WiegandProtocol
    byte_first_type: WiegandByteFirstType
 
    @classmethod
    def from_bytes(cls: Type[T], data: int) -> T:
        bits: list[int] = [int(x) for x in list('{0:08b}'.format(data))]
        # bit_4, bit_3, bit_2, bit_1, bit_0 = bits[3:8]  # Reserved
        return Wiegand(bool(bits[0]), WiegandProtocol(bits[1]), WiegandByteFirstType(bits[2]))
 
    def to_int(self) -> int:
        bits_int = [int(self.is_open), self.protocol.value, self.byte_first_type.value,
                    0, 0, 0, 0, 0]
        bits_str = ''.join(str(bit) for bit in bits_int)
        return int(bits_str, 2)
 
    def __str__(self) -> str:
        return f'Wiegand -> is_open: {self.is_open}, ' \
               f'protocol: {self.protocol}, byte_first_type: {self.byte_first_type}'
 
 
@dataclass
class Antenna:
    ant_8: bool
    ant_7: bool
    ant_6: bool
    ant_5: bool
    ant_4: bool
    ant_3: bool
    ant_2: bool
    ant_1: bool
 
    @classmethod
    def from_bytes(cls: Type[T], data: int) -> T:
        bits = [bool(int(x)) for x in list('{0:08b}'.format(data))]
        ant_8, ant_7, ant_6, ant_5, ant_4, ant_3, ant_2, ant_1 = bits
        return Antenna(ant_8, ant_7, ant_6, ant_5, ant_4, ant_3, ant_2, ant_1)
 
    def to_int(self) -> int:
        bits_int = [int(self.ant_8), int(self.ant_7), int(self.ant_6), int(self.ant_5),
                    int(self.ant_4), int(self.ant_3), int(self.ant_2), int(self.ant_1)]
        bits_str = ''.join(str(bit) for bit in bits_int)
        return int(bits_str, 2)
 
    def __str__(self) -> str:
        return f'Antenna: ant 1({self.ant_1}) -> ant 2({self.ant_2}) -> ant 3({self.ant_3}) -> ant 4({self.ant_4})' \
               f' -> ant 5({self.ant_5}) -> ant 6({self.ant_6}) -> ant 7({self.ant_7}) -> ant 8({self.ant_8})'
 
 
@dataclass
class ReaderSettings:
    address: int
    rfid_protocol: RfidProtocol
    work_mode: WorkMode
    output_interface: OutputInterface
    baud_rate: BaudRate
    wiegand: Wiegand
    antenna: Antenna
    frequency: Frequency
    power: int
    output_memory_bank: MemoryBank
    q_value: int
    session: Session
    output_start_address: int
    output_length: int
    filter_time: int
    trigger_time: int
    buzzer_time: int
    inventory_interval: int
 
    def __post_init__(self):
        assert 0x00 <= self.address <= 0xFF
        assert 0 <= self.power <= 33
        assert 0 <= self.q_value <= 15
        assert 0x00 <= self.output_start_address <= 0xFF
        assert 0x00 <= self.output_length <= 0xFF
        assert 0x00 <= self.filter_time <= 0xFF
        assert 0x00 <= self.trigger_time <= 0xFF
        assert 0x00 <= self.buzzer_time <= 0xFF
        assert 0x00 <= self.inventory_interval <= 0xFF
 
    @classmethod
    def from_bytes(cls: Type[T], data: bytes) -> T:
        wiegand = Wiegand.from_bytes(data[5])
        output_interface = OutputInterface.WIEGAND if wiegand.is_open else OutputInterface(data[3])
        return ReaderSettings(data[0], RfidProtocol(data[1]), WorkMode(data[2]), output_interface,
                              BaudRate(data[4]), wiegand, Antenna.from_bytes(data[6]),
                              Frequency.from_bytes(data[7:15]), data[15], MemoryBank(data[16]), data[17],
                              Session(data[18]), data[19], data[20], data[21], data[22], bool(data[23]), data[24])
 
    def to_command_data(self) -> bytes:
        # Wiegand
        wiegand = self.wiegand
        if self.output_interface == OutputInterface.WIEGAND:
            wiegand.is_open = True
        output_interface = OutputInterface.RS232 \
            if self.output_interface == OutputInterface.WIEGAND else self.output_interface
 
        data = bytearray([self.address, self.rfid_protocol.value, self.work_mode.value,
                          output_interface.value, self.baud_rate.value,
                          wiegand.to_int(), self.antenna.to_int()])
        data.extend(self.frequency.to_command_data())
        data.extend([self.power, self.output_memory_bank.value, self.q_value, self.session.value,
                     self.output_start_address, self.output_length,
                     self.filter_time, self.trigger_time, self.buzzer_time, self.inventory_interval])
        return data
 
    def __str__(self) -> str:
        settings = [
            "<<< START READER SETTINGS ================================",
            f"ADDRESS            >> {self.address}",
            f"RFID PROTOCOL      >> {self.rfid_protocol}",
            f"WORK MODE          >> {self.work_mode}",
            f"OUT INTERFACE      >> {self.output_interface}",
            f"BAUD RATE          >> {self.baud_rate}",
            f"WIEGAND            >> {self.wiegand}",
            f"ANTENNA            >> {self.antenna}",
            f"FREQUENCY          >>\n{self.frequency}",
            f"POWER              >> {self.power}",
            f"OUT MEMORY BANK    >> {self.output_memory_bank}",
            f"Q VALUE            >> {self.q_value}",
            f"SESSION            >> {self.session}",
            f"OUT START ADDRESS  >> {self.output_start_address}",
            f"OUT LENGTH         >> {self.output_length}",
            f"FILTER TIME        >> {self.filter_time}",
            f"TRIGGER TIME       >> {self.trigger_time}",
            f"BUZZER TIME        >> {self.buzzer_time}",
            f"INVENTORY INTERVAL >> {self.inventory_interval}",
            "<<< END READER SETTINGS   ================================"
        ]
        return "\n".join(settings).strip().upper()
