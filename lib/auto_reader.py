import serial
 
ser = serial.Serial('COM3', 115200, timeout=1)
 
print("Start reading RFID...")
 
last = None
 
while True:
    data = ser.read(64)
    if data:
        hex_data = data.hex()
 
        # cari EPC (pattern e2...)
        if "e2" in hex_data:
            start = hex_data.find("e2")
            epc = hex_data[start:start+24]  
 
            if epc != last:
                last = epc
                print("EPC:", epc.upper())
