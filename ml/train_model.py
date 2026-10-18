#!/usr/bin/env python3
"""
FraudLens - model training
==========================
Trains and compares three models on the card-fraud data:

    1. Logistic Regression
    2. Gradient Boosting
    3. Random Forest   (the one the app uses)

Steps
    load data -> 80/20 split (stratified) -> train with extra weight on fraud
    -> test on the 20% the models never saw -> save models + results

Usage
    python train_model.py                          # looks for data/creditcard.csv
    python train_model.py --data path/to/creditcard.csv
    python train_model.py --demo                   # uses the stand-in data (testing only)

Then run  python export_for_web.py  to push the results into the website.
"""
import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight

HERE = Path(__file__).parent
SEED = 42
THRESHOLD = 0.5  # default cut-off; the app lets the user slide it


def load(args):
    if args.demo:
        from generate_demo_data import make_demo
        print("Using the synthetic stand-in data (--demo). Results are for testing only.")
        return make_demo(), True
    path = Path(args.data)
    if not path.exists():
        raise SystemExit(
            f"\nCould not find {path}.\n"
            "Download creditcard.csv (Kaggle: 'Credit Card Fraud Detection', ULB) and put it in\n"
            "ml/data/, or run with --demo to try the pipeline on stand-in data.\n")
    return pd.read_csv(path), False


def evaluate(name, y_true, prob):
    pred = (prob >= THRESHOLD).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred).ravel()
    return {
        "name": name,
        "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred)),
        "f1": float(f1_score(y_true, pred)),
        "roc_auc": float(roc_auc_score(y_true, prob)),
        "pr_auc": float(average_precision_score(y_true, prob)),
    }


def main():
    ap = argparse.ArgumentParser(description="Train the FraudLens models")
    ap.add_argument("--data", default=str(HERE / "data" / "creditcard.csv"))
    ap.add_argument("--demo", action="store_true", help="use synthetic stand-in data")
    ap.add_argument("--trees", type=int, default=100, help="trees in the random forest")
    args = ap.parse_args()

    df, is_demo = load(args)
    features = [c for c in df.columns if c != "Class"]
    X, y = df[features], df["Class"]
    print(f"\nData: {len(df):,} transactions, {int(y.sum())} fraud ({y.mean()*100:.2f}%)")

    # --- 80 / 20 split, keeping the same fraud share in both parts -------------
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=SEED)
    print(f"Train: {len(X_tr):,} rows ({int(y_tr.sum())} fraud)   "
          f"Test: {len(X_te):,} rows ({int(y_te.sum())} fraud)\n")

    # --- the three models. Fraud counts for more than normal ('balanced') ------
    models = {
        "logreg": make_pipeline(
            StandardScaler(),
            LogisticRegression(class_weight="balanced", max_iter=2000, random_state=SEED)),
        "gboost": GradientBoostingClassifier(random_state=SEED),
        "forest": RandomForestClassifier(
            n_estimators=args.trees, max_depth=12, min_samples_leaf=4,
            class_weight="balanced_subsample", n_jobs=-1, random_state=SEED),
    }
    labels = {"logreg": "Logistic Regression", "gboost": "Gradient Boosting",
              "forest": "Random Forest"}

    probs, results = {}, []
    for key, model in models.items():
        t0 = time.time()
        if key == "gboost":  # this one takes weights instead of a class_weight option
            model.fit(X_tr, y_tr, sample_weight=compute_sample_weight("balanced", y_tr))
        else:
            model.fit(X_tr, y_tr)
        probs[key] = model.predict_proba(X_te)[:, 1]
        r = evaluate(labels[key], y_te, probs[key])
        r["key"] = key
        r["train_seconds"] = round(time.time() - t0, 1)
        results.append(r)
        joblib.dump(model, HERE / "models" / f"{key}.joblib", compress=3)
        print(f"  {labels[key]:<20} caught {r['tp']:>3}/{r['tp']+r['fn']:<3}  "
              f"false alarms {r['fp']:>5}  precision {r['precision']*100:5.1f}%  "
              f"recall {r['recall']*100:5.1f}%  ({r['train_seconds']}s)")

    # --- save everything the export step needs --------------------------------
    art = HERE / "artifacts"
    art.mkdir(exist_ok=True)
    np.savez_compressed(
        art / "test_set.npz",
        X_test=X_te.to_numpy(dtype=np.float64), y_test=y_te.to_numpy(),
        features=np.array(features),
        **{f"p_{k}": v for k, v in probs.items()})
    (art / "metrics.json").write_text(json.dumps({
        "demo": is_demo, "threshold": THRESHOLD, "seed": SEED,
        "rows": int(len(df)), "frauds": int(y.sum()),
        "train_rows": int(len(X_tr)), "test_rows": int(len(X_te)),
        "test_frauds": int(y_te.sum()), "models": results}, indent=2))
    print("\nSaved models to ml/models and results to ml/artifacts."
          "\nNext:  python export_for_web.py")


if __name__ == "__main__":
    main()
