#### DAQ CONFIG ####
## This is the documented sensor calibrations, as well as the port configurations in use on the DAQ Box.
## To use the LabJack Source, duplicate this file and name it `config.py`, uncomment and modify as needed.
## NOTE: If `config.py` is updated, please also update this file as required
## Last modified 2026-11-17- Jason Xu for FYDP27 Pump Spin Test 1

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
    Sensor("[FFM-401] Flowmeter", "AIN87", 10, Connection.SINGLE,
          LinearCalibration(1/100*(2600/3600)/0.016, -0.004*(2600/3600)/0.016, "kg/s"))

    # B1 P2
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[NPT-201] Pneumatics", "AIN86", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[NPT-301] Nitrogen Pressurization", "AIN94", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))

    # B1 P3
    # TDH40-B-G-3000-03-A00-5, 4-20mA 0-3000 psi
    Sensor("[FPT-302] Fuel Tank", "AIN85", 10, Connection.SINGLE,
          LinearCalibration(1/100*3000/0.016, -0.004*3000/0.016, "psi"))
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[FPT-401] Pump Inlet", "AIN93", 10, Connection.SINGLE,
          LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))

    # B2 P1
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[FPT-402] Pump Outlet", "AIN84", 10, Connection.SINGLE,
        LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[FPT-403] Coolant Inlet", "AIN92", 10, Connection.SINGLE,
        LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))

    # B2 P2
    # IFM PT 5402: 4-20mA 1-1450 psi
    Sensor("[FPT-404] Coolant Outlet", "AIN83", 10, Connection.SINGLE,
        LinearCalibration(1/100*1450/0.016, -0.004*1450/0.016, "psi"))
