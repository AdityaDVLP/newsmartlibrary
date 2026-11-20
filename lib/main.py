from typing import Iterator
 
from response import Tag, ReaderSettings
from transport import Transport, SerialTransport, BaudRate, TcpTransport
from reader import Reader, StopType
 
transport: Transport = SerialTransport('COM3', BaudRate.BPS_57600)
 
# transport: Transport = TcpTransport('192.168.1.250', 2022)
 
reader: Reader = Reader(transport)
 
# 1. Inventory answer mode
tags: Iterator[Tag] = reader.start_inventory_answer_mode(
    stop_type=StopType.TIME,
    value=3
)
 
for tag in tags:
    print(tag)
 
# 2. Get reader settings
reader_settings: ReaderSettings = reader.reader_settings()
print(reader_settings)
 
# 3. Set power & buzzer
reader_settings.power = 5
reader_settings.buzzer_time = False
 
response = reader.set_reader_settings(reader_settings)
print(f"Response set power & buzzer: {response.status}")
 
reader.close()
