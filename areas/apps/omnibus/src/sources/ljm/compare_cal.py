import json, math, random

# the following classes are pasted from calibration.py to avoid importing LabJack issues
class Calibration:
    """
    Represents a calibration curve which transforms a voltage input into a value
    with units.
    """

    def __init__(self, unit: str):
        self.unit = unit

    def calibrate(self, value: float | int) -> float | int:
        """
        Apply the calibration to an input voltage.
        """
        return value

    def __repr__(self) -> str:
        return f"x ({self.unit})"

class LinearCalibration(Calibration):
    """
    Represents a linear calibration with a configurable slope and zero offset.
    """

    def __init__(self, slope: float | int, offset: float | int, unit: str):
        super().__init__(unit)
        self.slope = slope
        self.offset = offset

    def calibrate(self, value: float | int) -> float | int:
        return self.slope * value + self.offset

    def __repr__(self) -> str:
        return f"{self.slope}*x + {self.offset} ({self.unit})"


class ThermistorCalibration(Calibration):
    """
    Represents the calibration for a thermistor.
    """

    def __init__(
        self,
        voltage: float | int,
        resistance: float | int,
        B: float | int,
        r_inf: float | int,
    ):
        super().__init__("C")
        self.voltage = voltage  # voltage powering the thermistor
        self.resistance = resistance  # voltage divider resistance
        self.B = B  # not sure, pulled from the LabVIEW
        self.r_inf = r_inf  # not sure, pulled from the LabVIEW

    def calibrate(self, value: float | int) -> float | int:
        # thermistor magic pulled from the LabVIEW
        R_therm = (self.voltage - value) / (value / self.resistance)
        if R_therm <= 0:
            return 0
        return self.B / math.log(R_therm / self.r_inf) - 273.15

    def __repr__(self) -> str:
        return (
            f"Thermistor({self.voltage}, {self.resistance}, {self.B}, x) ({self.unit})"
        )


rng = random.Random(42)

def run(cal, v): 
    try: 
        val = cal.calibrate(v)
    except ZeroDivisionError: 
        return {"ok": False, "why": "zerodiv"}
    if isinstance(cal, ThermistorCalibration): 
        # Omnibus returns 0 when R <= 0 and could pass NaN/Inf through
        R = (cal.voltage - v) / (v / cal.resistance) if v != 0 else float("nan")
        if R <= 0: 
            return {"ok": False, "why": "r_nonpositive"}
        if math.isnan(val) or math.isinf(val): 
            return {"ok": False, "why": "naninf"}
    return {"ok": True, "value": repr(val)}

base_inputs = [0.4, 1.0, 2.0, 2.9496, 2.5, 4.0, 0.0, -1.0, 5.0, 9.99]

def linear_inputs(): 
    pts = base_inputs + [-10.0, 10.0, -0.001, 0.001]
    pts += [rng.uniform(-10, 10) for _ in range(200)]
    return pts

def thermistor_inputs(supply): 
    eps = 1e-9
    edges = [
        0.0,           # division by 0
        -1.0,          # R <= 0
        supply,        # R == 0
        supply + 0.01, # R < 0
        9.99,          # > supply
        eps,           # tiny > 0 (huge R)
        supply - eps,  # tiny R > 0, T huge
        2.5,           # normal
    ]
    valid_interval   = [rng.uniform(eps, supply-eps) for _ in range(200)]
    invalid_interval = [rng.uniform(-10, 0) for _ in range(20)] + \
                       [rng.uniform(supply, 10) for _ in range(20)]
    return edges + valid_interval + invalid_interval


linear = [(906.25, -362.5, "psi"), (250, -125, "psi")]
thermistors = [(5, 10000, 3434, 0.099524)]

rows = []
for slope, offset, unit in linear: 
    c = LinearCalibration(slope, offset, unit)
    for v in linear_inputs(): 
        rows.append({
            "curve": "linear", 
            "data": {"slope": slope, "offset": offset, "unit": unit, "v": v, **run(c, v)}
        })
for therm in thermistors: 
    supply = therm[0]
    c = ThermistorCalibration(*therm)
    for v in thermistor_inputs(supply): 
        rows.append({
            "curve": "thermistor", 
            "data": {"params": therm, "v": v, **run(c, v)}
        })

with open("omnibus.json", "w", encoding="utf-8") as f: 
    json.dump(rows, f, indent=2)
