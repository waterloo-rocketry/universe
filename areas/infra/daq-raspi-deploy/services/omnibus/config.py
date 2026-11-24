#### DAQ CONFIG ####
## This is the documented sensor calibrations, as well as the port configurations in use on the DAQ Box.
## To use the LabJack Source, duplicate this file and name it `config.py`, uncomment and modify as needed.
## NOTE: If `config.py` is updated, please also update this file as required
## Last modified 2026-07-26 - Chris Yang (@ChrisYx511) for COMP SIMULATOR 1 

from calibration import Connection, LinearCalibration, Sensor, ThermistorCalibration

# pyright: basic

# LabJack Stream Configuration
# Configured at 25 readings per read, and 1000 readings per second per channel.
SCANS_PER_READ = 25
SCAN_RATE = 1000 


def setup():
    """
    Setup the sensors.
    """

    # B1 P1
    # Promass 83 flowmeter: 4-20mA 0-2600 kg/h (configurable)
    Sensor("[FLOW-101] Flowmeter", "AIN87", 10, Connection.SINGLE,
          LinearCalibration(1/100*(2600/3600)/0.016, -0.004*(2600/3600)/0.016, "kg/s"))

    # B1 P2
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[NPT-201] N2 Fill", "AIN86", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    # IFM PT 2402: 4-20mA 1-1000 psi
    Sensor("[NPT-202] Pneumatics", "AIN94", 10, Connection.SINGLE,
          LinearCalibration(1/100*1000/0.016, -0.004*1000/0.016, "psi"))

    # B1 P3
    # TDH40-B-G-3000-03-A00-5, 4-20mA 0-3000 psi
    Sensor("[OPT-101] Ox Fill", "AIN85", 10, Connection.SINGLE,
          LinearCalibration(1/100*3000/0.016, -0.004*3000/0.016, "psi"))

    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[NPT-201] N2 Fill", "AIN86", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))

    # B2 P3
    # TDM: 4-20mA 0-3000 psi
    Sensor("[CDPT-401] CO2 Fill", "AIN82", 10, Connection.SINGLE,
          LinearCalibration(1/100*3000/0.016, -0.004*3000/0.016, "psi"))

    # B4 P1
    # Kulite ETM-375-70BARSG Pressure Transucer
    # 0-70bar (~1000 psi), converted to PSI, 0-5V output
    Sensor("[OPT-301] Ox Tank", "AIN70", 10, Connection.DIFFERENTIAL,
          LinearCalibration(70/5 * 14.5038, 0, "psi"))
    Sensor("[FPT-301] Fuel Tank", "AIN69", 10, Connection.DIFFERENTIAL,
          LinearCalibration(70/5 * 14.5038, 0, "psi"))

    #B5 P3
    # Adafruit anemometer. 0.4 - 2V mapping to 0-32.4 m/s
    Sensor("Anemometer", "AIN65", 10, Connection.SINGLE,
          LinearCalibration(32.4 / (2 - 0.4) / 0.725, -0.4 * 32.4 / (2 - 0.4) / 0.725, "m/s"))

