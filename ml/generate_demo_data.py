#!/usr/bin/env python3
"""
FraudLens - stand-in data generator
-----------------------------------
The real project uses the public "Credit Card Fraud Detection" file
(creditcard.csv: 284,807 transactions, 492 frauds). That file is not
bundled here, so this script makes a small look-alike so you can run the
whole pipeline end to end before you download the real one.

The look-alike keeps the same column layout (Time, V1..V28, Amount, Class)
and the same kind of problem: very few frauds, some of them loud and some
of them quiet. It is NOT real card data and any numbers trained on it are
for testing only.

Usage:
    python generate_demo_data.py                 # writes data/creditcard_demo.csv
    python generate_demo_data.py --rows 70000 --frauds 490
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

# spread of each hidden column among normal transactions
SD = np.array([
    1.96, 1.65, 1.52, 1.42, 1.38, 1.33, 1.24, 1.19, 1.10, 1.09,
    1.02, 1.00, 1.00, 0.96, 0.92, 0.88, 0.85, 0.84, 0.81, 0.77,
    0.73, 0.73, 0.62, 0.61, 0.52, 0.48, 0.40, 0.33,
])

# how far a "loud" fraud sits from normal on each column, in units of spread
SHIFT = {
    1: -1.3, 2: 1.2, 3: -1.8, 4: 1.8, 5: -1.0, 6: -0.5, 7: -1.5, 9: -1.2,
    10: -2.0, 11: 1.9, 12: -2.4, 14: -2.9, 16: -1.6, 17: -1.9, 18: -0.9, 19: 0.4,
}


def make_demo(rows=70000, frauds=490, seed=7):
    rng = np.random.default_rng(seed)
    n_norm = rows - frauds

    # normal transactions
    V = rng.normal(0, 1, size=(n_norm, 28)) * SD
    amount = np.clip(rng.lognormal(3.3, 1.45, n_norm), 0.0, 6000).round(2)
    # daytime-heavy clock (seconds over two days)
    hour = np.clip(rng.normal(14, 5.5, n_norm), 0, 23.99) % 24
    day = rng.integers(0, 2, n_norm)
    t_norm = (day * 86400 + hour * 3600 + rng.uniform(0, 3600, n_norm)).clip(0, 172791)

    # fraud: 86% loud, 14% quiet (the quiet ones are the hard ones)
    loud = rng.random(frauds) < 0.86
    strength = np.where(loud, 1.0, 0.35)[:, None]
    shift = np.zeros(28)
    for k, v in SHIFT.items():
        shift[k - 1] = v
    Vf = rng.normal(0, 1.25, size=(frauds, 28)) * SD + (shift * SD) * strength
    amount_f = np.clip(rng.lognormal(2.7, 1.9, frauds), 0.0, 2500).round(2)
    # fraud likes the small hours
    hour_f = np.where(rng.random(frauds) < 0.45,
                      rng.uniform(0, 6, frauds), rng.uniform(0, 24, frauds))
    day_f = rng.integers(0, 2, frauds)
    t_fraud = (day_f * 86400 + hour_f * 3600).clip(0, 172791)

    X = np.vstack([V, Vf])
    df = pd.DataFrame(X, columns=[f"V{i}" for i in range(1, 29)])
    df.insert(0, "Time", np.concatenate([t_norm, t_fraud]).round(0))
    df["Amount"] = np.concatenate([amount, amount_f])
    df["Class"] = np.concatenate([np.zeros(n_norm, int), np.ones(frauds, int)])
    df = df.sample(frac=1, random_state=seed).sort_values("Time").reset_index(drop=True)
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=70000)
    ap.add_argument("--frauds", type=int, default=490)
    ap.add_argument("--out", default=str(Path(__file__).parent / "data" / "creditcard_demo.csv"))
    a = ap.parse_args()
    d = make_demo(a.rows, a.frauds)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    d.to_csv(a.out, index=False)
    print(f"wrote {a.out}  rows={len(d):,}  frauds={int(d.Class.sum())}")
