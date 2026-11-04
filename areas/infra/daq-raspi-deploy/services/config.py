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
    # IFM (round) PT 5402: 4-20mA 0-1450 psi
    # B1 P1
    Sensor("[OPT-101] Ox Fill", "AIN87", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    ## IFM PT 2402: 4-20mA 0-1000 psi
    Sensor("[OPT-102] Ox Fill", "AIN95", 10, Connection.SINGLE,
          LinearCalibration(1/100*1000/0.016, -0.004*1000/0.016, "psi"))

    # B1 P2
    Sensor("[NPT-201] N2 Fill", "AIN86", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    Sensor("[NPT-202] Pneumatics", "AIN94", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    # TDM
    # B2 P3 TDM
    # Sensor("[CDPT-401] CO2 Fill", "AIN82", 10, Connection.SINGLE,
    #       LinearCalibration(1/100*3000/0.016, -0.004*3000/0.016, "psi"))

    # Kulite ETM-375-70BARSG Pressure Transucer
    # 0-70bar (~1000 psi), converted to PSI, 0-5V output
    # B4 P1
#     Sensor("[OPT-301] Ox Tank", "AIN70", 10, Connection.DIFFERENTIAL,
#           LinearCalibration(70/5 * 14.5038, 0, "psi"))
#     Sensor("[FPT-301] Fuel Tank", "AIN69", 10, Connection.DIFFERENTIAL,
#           LinearCalibration(70/5 * 14.5038, 0, "psi"))
    #B5 P3
    # Adafruit anemometer. 0.4 - 2V mapping to 0-32.4 m/s
    Sensor("Anemometer", "AIN65", 10, Connection.SINGLE,
          LinearCalibration(32.4 / (2 - 0.4) / 0.725, -0.4 * 32.4 / (2 - 0.4) / 0.725, "m/s"))

