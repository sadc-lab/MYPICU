#!/usr/bin/env python3
"""Generate deterministic, explicitly synthetic monitoring fixtures."""

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "example_patients"
SAMPLES = 360
LONG_AUTOREG_SAMPLES = 1440
START = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)
DISPLAY_SMOOTHING_ALPHA = 0.35

SCENARIOS = [
    {
        "id": 99001,
        "file": "99001_well.json",
        "label": "Stable illustrative observations",
        "mode": "PRX",
        "severity": 0,
        "pic": 10.5,
        "ppc": 66,
        "map": 77,
        "spo2": 98,
        "nirs": 68,
        "heart_rate": 91,
    },
    {
        "id": 99002,
        "file": "99002_concerning.json",
        "label": "Concerning illustrative observations",
        "mode": "PRX",
        "severity": 2,
        "pic": 21,
        "ppc": 56,
        "map": 77,
        "spo2": 94,
        "nirs": 62,
        "heart_rate": 126,
    },
    {
        "id": 99003,
        "file": "99003_critical.json",
        "label": "Critical illustrative observations",
        "mode": "PRX",
        "severity": 3,
        "pic": 30,
        "ppc": 43,
        "map": 74,
        "spo2": 87,
        "nirs": 54,
        "heart_rate": 158,
    },
    {
        "id": 99004,
        "file": "99004_cox.json",
        "label": "NIRS and arterial-pressure recording",
        "mode": "COX",
        "severity": 1,
        "pic": None,
        "ppc": None,
        "map": 73,
        "spo2": 96,
        "nirs": 65,
        "heart_rate": 108,
    },
    {
        "id": 99005,
        "file": "99005_prx.json",
        "label": "Intracranial-pressure recording",
        "mode": "PRX",
        "severity": 1,
        "pic": 17,
        "ppc": 59,
        "map": 77,
        "spo2": 96,
        "nirs": 64,
        "heart_rate": 106,
    },
]

AUTOREG_CHANNELS = (
    "Variable_PIC_autoreg",
    "Variable_PPC_autoreg",
    "Variable_PAM_autoreg",
    "Variable_NIRS_autoreg",
    "Variable_licox_autoreg",
    "Variable_fc_autoreg",
    "Variable_spo2_autoreg",
)


class MeanRevertingSignal:
    """A seeded AR(1) signal with quantization similar to monitor values."""

    def __init__(self, rng, mean, innovation_sd, persistence=0.82, digits=1):
        self.rng = rng
        self.mean = mean
        self.innovation_sd = innovation_sd
        self.persistence = persistence
        self.digits = digits
        self.value = mean

    def next(self, offset=0, linked=0):
        target = self.mean + offset + linked
        self.value = (
            target
            + self.persistence * (self.value - target)
            + self.rng.gauss(0, self.innovation_sd)
        )
        return round(self.value, self.digits)


def event_offsets(scenario, index, sample_count):
    """Clinical phases are sustained episodes, not periodic waveforms."""
    offsets = {"pic": 0, "ppc": 0, "map": 0, "spo2": 0, "nirs": 0, "hr": 0}
    if scenario["id"] == 99002:
        if 110 <= index < 170:
            offsets.update(pic=4.5, ppc=-9, map=-4, spo2=-1.2, hr=12)
        elif 275 <= index < sample_count:
            offsets.update(pic=5, ppc=-12, map=-6, spo2=-2.2, hr=18)
    elif scenario["id"] == 99003:
        if 65 <= index < 205:
            offsets.update(pic=4, ppc=-5, map=-2, spo2=-1, nirs=-3, hr=8)
        elif 205 <= index < sample_count:
            offsets.update(pic=7, ppc=-8, map=-5, spo2=-4, nirs=-7, hr=16)
    elif scenario["id"] == 99004:
        if 220 <= index < 300:
            offsets.update(map=-7, nirs=-5, spo2=-1.5, hr=8)
    elif scenario["id"] == 99005:
        if 260 <= index < sample_count:
            offsets.update(pic=4, ppc=-6, map=-2, spo2=-1, hr=8)
    return offsets


def row(charttime, value):
    return {"charttime": charttime, "valeur": value}


AUTOREG_PRESSURE_ORDERS = (
    (45, 65, 75, 85, 55),
    (45, 75, 65, 85, 55),
    (65, 55, 85, 45, 75),
    (65, 75, 55, 85, 45),
    (75, 55, 85, 45, 65),
    (75, 65, 55, 85, 45),
)


def autoregulation_profile(signal_mean, signal_trend, pressure_offset, seed):
    """Build a seeded, non-repeating pressure profile with gradual deterioration."""
    state = seed

    def uniform():
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 4294967296

    def normal():
        return (
            (-2 * math.log(max(uniform(), 1e-12))) ** 0.5
            * math.cos(2 * math.pi * uniform())
        )

    pressure_residual = 0
    signal_residual = 0
    profile = []
    for hour in range(24):
        pressure_order = AUTOREG_PRESSURE_ORDERS[int(uniform() * len(AUTOREG_PRESSURE_ORDERS))]
        block_lengths = [12] * len(pressure_order)
        first_block = int(uniform() * len(block_lengths))
        second_block = int(uniform() * len(block_lengths))
        if first_block != second_block:
            block_lengths[first_block] -= 1
            block_lengths[second_block] += 1

        for block, level in enumerate(pressure_order):
            centered_level = (level - 65) / 20
            pressure_coupling = 0.2 if abs(level - 65) >= 20 else 0
            for _ in range(block_lengths[block]):
                index = len(profile)
                pressure_residual = (
                    0.3 * pressure_residual
                    + normal() * (1 - 0.3**2) ** 0.5
                )
                signal_residual = (
                    0.2 * signal_residual
                    + normal() * 0.5 * (1 - 0.2**2) ** 0.5
                )
                pressure = round(
                    level + pressure_offset - 6 * index / (LONG_AUTOREG_SAMPLES - 1)
                    + pressure_residual,
                    1,
                )
                signal = round(
                    signal_mean
                    + signal_trend * index / (LONG_AUTOREG_SAMPLES - 1)
                    + 2 * centered_level**2
                    + pressure_coupling * pressure_residual
                    + signal_residual,
                    1,
                )
                profile.append((pressure, signal))
    return profile


def generate(scenario):
    rng = random.Random(scenario["id"])
    pid = scenario["id"]
    mode = scenario["mode"]
    is_prx = mode == "PRX"
    sample_count = LONG_AUTOREG_SAMPLES if pid in (99004, 99005) else SAMPLES
    has_extended_autoreg = pid in (99004, 99005)
    autoregulation = (
        autoregulation_profile(
            13 if is_prx else scenario["nirs"],
            9 if is_prx else -9,
            0 if is_prx else 6,
            162 if is_prx else 620,
        )
        if has_extended_autoreg else []
    )

    pic = MeanRevertingSignal(
        rng, scenario["pic"] or 0,
        0.4 if pid == 99005 else 0.65,
        0.25 if pid == 99005 else 0.89,
    )
    ppc = MeanRevertingSignal(rng, scenario["ppc"] or 0, 1.25, 0.85)
    arterial = MeanRevertingSignal(rng, scenario["map"], 1.8, 0.88)
    nirs = MeanRevertingSignal(
        rng, scenario["nirs"],
        0.4 if pid == 99004 else 0.8,
        0.25 if pid == 99004 else 0.9,
    )
    heart_rate = MeanRevertingSignal(rng, scenario["heart_rate"], 2.4, 0.84, 0)
    spo2 = MeanRevertingSignal(rng, scenario["spo2"], 0.22, 0.79, 0)
    temperature = MeanRevertingSignal(rng, 37.1, 0.025, 0.96, 1)
    resp_rate = MeanRevertingSignal(rng, 24 if scenario["id"] == 99003 else 20, 0.65, 0.8, 0)
    etco2 = MeanRevertingSignal(rng, 37 if scenario["id"] != 99003 else 43, 0.55, 0.87)
    paco2 = MeanRevertingSignal(rng, 39 if scenario["id"] != 99003 else 49, 0.75, 0.9)
    pupil_right = MeanRevertingSignal(rng, 3.0, 0.08, 0.6)
    pupil_left = MeanRevertingSignal(rng, 3.0, 0.08, 0.6)

    channel_names = (
        "Variable_FC",
        "Variable_FR",
        "Variable_PIC",
        "Variable_PPC",
        "Variable_PAM",
        "Variable_SPO2",
        "Variable_rSO2",
        "Variable_temperature",
        "Variable_EtCO2",
        "Variable_paco2",
        "Variable_position_tete",
        "Variable_pupille_droite",
        "Variable_pupille_gauche",
        "Variable_plaquettes",
        "Variable_hemoglobine",
        "Variable_glycemie",
        "Variable_INR",
    )
    vitals = {name: [] for name in channel_names}
    autoreg = {name: [] for name in AUTOREG_CHANNELS}
    fisher_rows = []
    validity = {"id_patient": pid}
    display_smoother = {}

    for index in range(sample_count):
        time = START + timedelta(minutes=index)
        timestamp = time.isoformat(timespec="seconds").replace("+00:00", "Z")
        offsets = event_offsets(scenario, index, sample_count)
        if has_extended_autoreg:
            if is_prx:
                offsets["pic"] = offsets["ppc"] = 0
            else:
                offsets["map"] = offsets["nirs"] = 0
        map_value = arterial.next(offsets["map"])
        pressure_target = None
        autoreg_pressure = None

        if has_extended_autoreg:
            pressure_target, template_signal = autoregulation[index]
            autoreg_pressure = pressure_target
            if not is_prx:
                map_value = autoreg_pressure

        if is_prx:
            if has_extended_autoreg:
                ppc_value = autoreg_pressure
                pic_value = template_signal
            else:
                pic_value = pic.next(offsets["pic"], linked=max(0, map_value - scenario["map"]) * 0.12)
                ppc_value = ppc.next(offsets["ppc"], linked=(map_value - scenario["map"]) * 0.24)
                # Small independent monitor-channel difference avoids a mathematically
                # perfect identity while keeping all values physiologically coherent.
                ppc_value = round(ppc_value + rng.gauss(0, 0.45), 1)
            nirs_value = None
        else:
            pic_value = ppc_value = None
            if has_extended_autoreg:
                nirs_value = template_signal
            else:
                nirs_value = nirs.next(
                    offsets["nirs"],
                    linked=(map_value - scenario["map"]) * 0.32,
                )

        hr_value = heart_rate.next(offsets["hr"], linked=max(0, 70 - map_value) * 0.12)
        spo2_value = spo2.next(offsets["spo2"])
        temp_value = temperature.next()
        rr_value = resp_rate.next(linked=max(0, 40 - spo2_value) * 0.1)
        etco2_value = etco2.next(linked=(rr_value - 20) * -0.07)
        paco2_value = paco2.next(linked=(etco2_value - 37) * 0.2)
        pupil_r = pupil_right.next(offsets["pic"] * -0.015)
        pupil_l = pupil_left.next(offsets["pic"] * -0.015)
        ppc_export = round(ppc_value, 1) if ppc_value is not None else None
        pic_export = round(pic_value, 1) if pic_value is not None else None
        nirs_export = round(nirs_value, 1) if nirs_value is not None else None

        observed = {
            "Variable_FC": round(hr_value),
            "Variable_FR": round(rr_value),
            "Variable_PIC": pic_export,
            "Variable_PPC": ppc_export,
            "Variable_PAM": round(map_value, 1),
            "Variable_SPO2": round(spo2_value),
            "Variable_rSO2": nirs_export,
            "Variable_temperature": round(temp_value, 1),
            "Variable_EtCO2": round(etco2_value, 1),
            "Variable_paco2": round(paco2_value, 1),
            "Variable_position_tete": 30 if index < 200 else 25,
            "Variable_pupille_droite": round(pupil_r, 1),
            "Variable_pupille_gauche": round(pupil_l, 1),
        }

        if has_extended_autoreg:
            for key in ("Variable_PIC", "Variable_PPC", "Variable_PAM", "Variable_rSO2"):
                value = observed[key]
                if value is not None:
                    previous = display_smoother.get(key, value)
                    smoothed = (
                        (1 - DISPLAY_SMOOTHING_ALPHA) * previous
                        + DISPLAY_SMOOTHING_ALPHA * value
                    )
                    display_smoother[key] = smoothed
                    observed[key] = round(smoothed, 1)

        for key, value in observed.items():
            if value is not None and rng.random() > 0.012:
                vitals[key].append(row(timestamp, value))

        # Labs are intermittent measurements, not artificially sampled each minute.
        if index % 60 == 0:
            labs = {
                "Variable_plaquettes": round(rng.gauss(245 if scenario["id"] != 99003 else 112, 7)),
                "Variable_hemoglobine": round(rng.gauss(118 if scenario["id"] != 99003 else 91, 2)),
                "Variable_glycemie": round(rng.gauss(6.2 if scenario["id"] != 99003 else 9.1, 0.25), 1),
                "Variable_INR": round(rng.gauss(1.05 if scenario["id"] != 99003 else 1.4, 0.04), 2),
            }
            for key, value in labs.items():
                vitals[key].append(row(timestamp, value))

        fisher_values = (
            timestamp,
            "" if pic_export is None else str(pic_export),
            str(round(map_value, 1)),
            "" if ppc_export is None else str(ppc_export),
            "" if nirs_export is None else str(nirs_export),
        )
        fisher_rows.append({"Horodate,PIC,PAM,PPC,NIRS": ",".join(fisher_values)})

        channels = {
            "Variable_PIC_autoreg": ("PIC", pic_export),
            "Variable_PPC_autoreg": ("PPC", ppc_export),
            "Variable_PAM_autoreg": ("PAM", round(map_value, 1)),
            "Variable_NIRS_autoreg": ("NIRS", nirs_export),
            "Variable_licox_autoreg": ("Licox", None),
            "Variable_fc_autoreg": ("FC", round(hr_value)),
            "Variable_spo2_autoreg": ("SpO2", round(spo2_value)),
        }
        for channel, (field, value) in channels.items():
            if value is not None and (has_extended_autoreg or rng.random() > 0.008):
                autoreg[channel].append({
                    "noadmsip": str(pid),
                    "horodate": timestamp,
                    field: value,
                })

        hour = index // 60
        validity[f"H{hour}"] = (
            1 if scenario["severity"] >= 3
            else 1 if scenario["severity"] == 2 and hour in (2, 5)
            else 0
        )

    data = {
        "autoregulation_samples": fisher_rows,
        "example_patient": {
            "synthetic": True,
            "scenario": scenario["label"],
            "autoregulation_mode": mode,
            "severity": scenario["severity"],
            "clinical_use": False,
        },
        "autoreg_data": autoreg,
        "matrices_rt_PICData_validite": [validity],
        "Variable_age": [{
            "noadmsip": pid,
            "dateofbirth": "2018-03-15",
        }],
        "Variable_premiere_frequence_cardiaque": [{
            "encounterid": pid,
            "intime": START.isoformat(),
        }],
        **vitals,
        "Variable_opioides": [{
            "charttime": (START + timedelta(minutes=45)).isoformat(),
            "drugname": "synthetic test infusion",
            "variable": "debit",
            "valeur": "0.1",
        }, {
            "charttime": (START + timedelta(minutes=210)).isoformat(),
            "drugname": "synthetic test infusion",
            "variable": "debit",
            "valeur": "0.08",
        }],
    }

    # Keep one deterministic quality check for scripts/tests: measurements
    # should contain monitor-like variation, not a periodic waveform template.
    pic_values = [item["valeur"] for item in vitals["Variable_PIC"]]
    varying_signal = pic_values if is_prx else [item["valeur"] for item in vitals["Variable_rSO2"]]
    assert len(set(varying_signal)) > 12
    destination = OUTPUT / scenario["file"]
    destination.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"{destination.name}: {sample_count} minute samples, {sum(map(len, vitals.values()))} imported observations")


if __name__ == "__main__":
    for profile in SCENARIOS:
        generate(profile)
