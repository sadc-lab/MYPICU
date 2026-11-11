---
title: User guide
---

# User guide

How to use the MYPICU dashboard, step by step. Each section describes one task
from the user's point of view. For what the computations mean, see
{doc}`optibrain-module`.

:::{note}
This guide is a work in progress. Sections marked **To complete** are being
written.
:::

```{contents}
:local:
:depth: 2
```

## Progress

- [ ] Signing in
- [ ] Finding a patient
- [ ] Reading the monitoring chart
- [ ] Using the Optimisation cérébrale dialog
- [ ] Importing data (to confirm whether this exists in this version)
- [ ] Troubleshooting
- [x] Glossary (first version)

## Overview

The dashboard runs on one host with no cloud dependency. Patient data is
extracted automatically from the ICCA source and processed by the Optibrain
module; the user reads the results on each patient's page.

:::{admonition} To complete
Diagram of the main user journey (Mermaid flowchart), once the screens below
are confirmed.
:::

## Signing in

| | |
|---|---|
| Goal | access the dashboard |
| Before you start | |
| Related test(s) | |

**Steps**

1. 
2. 
3. 

**Expected result:**

:::{admonition} To complete
- URL / how users reach the dashboard
- Exact labels of fields and buttons
- Screenshot
:::

## Finding a patient

| | |
|---|---|
| Goal | open a patient's page |
| Before you start | be signed in |
| Related test(s) | |

**Steps**

1. 
2. 
3. 

**Expected result:** the patient page is displayed.

:::{admonition} To complete
- What the patient list shows (columns, search, filters)
- How to open a patient page
- Screenshot
:::

## Reading the monitoring chart

| | |
|---|---|
| Goal | display a patient's monitor channels over time |
| Before you start | open a patient page |
| Related test(s) | |

The patient page shows a monitoring chart alongside the clinical-target
indicators. Depending on what was recorded for the patient, the channels that
can be selected include:

- NIRS (`Variable_rSO2`)
- PAM
- heart rate
- respiratory rate
- SpO₂
- systolic and diastolic PIC

> **Only channels recorded for this patient are offered.** A missing channel
> means there is no data for it.

The general chart can combine measurements with different units, so it does
**not** show autoregulation windows. Those appear only in the
**Optimisation cérébrale** dialog (see below).

**Steps**

1. 
2. 
3. 

:::{admonition} To complete
- Where the channel selector is and its exact label
- Screenshot
:::

## Using the Optimisation cérébrale dialog

| | |
|---|---|
| Goal | see the patient's cerebral autoregulation result |
| Before you start | open a patient page |
| Related test(s) | |

**What the dialog shows**

The dialog pairs a stored autoregulation result with the two channels it
depends on:

| Result | Channels | Pressure channel |
|---|---|---|
| PRx | PIC + PPC | PPC |
| COx | NIRS + PAM | PAM |

- A result is shown only when **both** of its channels are present and its
  optimum and limits are complete.
- If both results are usable, **PRx is shown**.
- The signal and the pressure are plotted on **separate scales**.
- The **shaded area** is the autoregulation window. The status tells you whether
  the current pressure is **inside**, **below** or **above** it.
- The window and status apply to the pressure channel only: PPC for PRx, PAM
  for COx.
- Missing channels and incomplete windows are identified. **No limits are
  invented.**

```{mermaid}
flowchart TD
    A[Open Optimisation cérébrale] --> B{PRx usable?}
    B -- Yes --> C[Show PRx with PIC / PPC]
    B -- No --> D{COx usable?}
    D -- Yes --> E[Show COx with NIRS / PAM]
    D -- No --> F[Show which channels or limits are missing]
```

:::{important}
PRx currently cannot be computed: the ICCA source does not provide PPC for the
tracked patients. COx is available for patients with both NIRS and PAM. See
{doc}`optibrain-module`.
:::

**Steps**

1. 
2. 
3. 

:::{admonition} To complete
- How to open the dialog (exact button and location)
- Screenshot of a COx result
- Screenshot of the "missing data" state
:::

## Importing data

:::{admonition} To complete
Confirm whether manual file import exists in this version. If not, remove this
section.

Observed during earlier testing of the import screen, to re-check in this
version:

- a file with missing required columns was accepted without an error message;
- accented characters were corrupted in exported CSV files.
:::

## Troubleshooting

| Problem | Likely cause | What to do |
|---|---|---|
| No PRx result | No PPC in the source data | Expected — see {doc}`optibrain-module` |
| No autoregulation result at all | A required channel is missing or the window is incomplete | Expected — the dashboard does not invent limits |
| A channel is not offered in the chart | No data recorded for this patient | Expected |
| | | |

## Glossary

| Term | Meaning |
|---|---|
| PIC | Pression intracrânienne — intracranial pressure |
| PAM | Pression artérielle moyenne — mean arterial pressure |
| PPC | Pression de perfusion cérébrale — cerebral perfusion pressure |
| NIRS | Near-infrared spectroscopy — cerebral oxygenation (rSO₂) |
| PRx | Pressure reactivity index — autoregulation index based on PIC and PPC |
| COx | Cerebral oxygenation index — autoregulation index based on NIRS and PAM |
| Autoregulation window | Pressure range in which cerebral autoregulation is preserved |
| ICCA | Clinical information system the patient data is extracted from |
| | |

## Related

- {doc}`optibrain-module` — what the computations mean
- {doc}`operations` — day-to-day running