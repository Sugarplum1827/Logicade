#!/usr/bin/env python3
"""Train and evaluate raw-feature and interpretation-band MLR baselines.

Requires adjudicated three-class expert labels from build_mlr_difficulty_dataset.py.
The participant-grouped holdout is used for reporting only; models are then fit
on all eligible labeled rows and saved as research artifacts, not live pickers.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss, recall_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


CLASSES = ["needs_support", "standard", "advanced"]
NUMERIC_RAW = [
    "mistakes", "scored_submissions", "mistakes_per_submission",
    "hints_for_model", "hint_opportunities", "completion_time_ratio",
    "level_run_attempts", "accuracy", "accuracy_scored_checks",
    "first_try_success", "failure_rate_last_five", "failure_rate_evaluated_runs",
    "retries", "topic_mastery", "topic_mastery_task_count",
    "response_time_ratio", "response_time_sample_count",
]
NUMERIC_BANDS = ["mistakes_band", "hints_band", "completion_time_band",
                 "level_run_attempts_band", "accuracy_band", "first_try_success_band",
                 "failure_rate_band", "retries_band", "topic_mastery_band",
                 "response_time_band"]
CATEGORICAL = ["objective_id", "target_objective_id", "difficulty_before", "target_week", "target_stage"]
TIME_COLUMNS = {"completion_time_ms": "completion_time_ratio",
                "response_time_median_ms": "response_time_ratio"}


def finite_number(value: Any) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def clean_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    for col in [*NUMERIC_RAW, *TIME_COLUMNS, "target_week", "target_stage"]:
        if col in frame:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")
    for col in ["objective_id", "difficulty_before"]:
        if col in frame:
            frame[col] = frame[col].fillna("").astype(str).replace("nan", "")
    return frame


def fit_time_baselines(train: pd.DataFrame) -> dict:
    """Fit pilot medians on training participants only; require 3 observations."""
    result: dict[str, Any] = {"minimum_group_n": 3, "features": {}}
    for source, output in TIME_COLUMNS.items():
        usable = train[[source, "objective_id", "difficulty_before"]].copy()
        usable[source] = pd.to_numeric(usable[source], errors="coerce")
        usable = usable.dropna(subset=[source])
        usable = usable[usable[source] >= 0]
        if len(usable) < 3:
            result["features"][output] = {"global": None, "objective": {}, "objective_difficulty": {}}
            continue
        global_value = float(usable[source].median())
        objective: dict[str, float] = {}
        for obj, group in usable.groupby("objective_id", dropna=False):
            if len(group) >= 3 and str(obj):
                objective[str(obj)] = float(group[source].median())
        objective_difficulty: dict[str, float] = {}
        for (obj, diff), group in usable.groupby(["objective_id", "difficulty_before"], dropna=False):
            if len(group) >= 3 and str(obj) and str(diff):
                objective_difficulty[f"{obj}|{diff}"] = float(group[source].median())
        result["features"][output] = {"global": global_value, "objective": objective,
                                       "objective_difficulty": objective_difficulty}
    return result


def apply_time_ratios(frame: pd.DataFrame, baselines: dict) -> pd.DataFrame:
    frame = frame.copy()
    for source, output in TIME_COLUMNS.items():
        spec = baselines["features"][output]
        ratios: list[float | None] = []
        for _, row in frame.iterrows():
            value = finite_number(row.get(source))
            obj = str(row.get("objective_id") or "")
            diff = str(row.get("difficulty_before") or "")
            key = f"{obj}|{diff}"
            base = spec["objective_difficulty"].get(key)
            if base is None:
                base = spec["objective"].get(obj)
            if base is None:
                base = spec["global"]
            ratios.append(value / base if value is not None and base is not None and base > 0 else None)
        frame[output] = ratios
    return frame


def band_count(value: Any, support_at: float, standard_at: float | None = None) -> str | None:
    x = finite_number(value)
    if x is None:
        return None
    if x >= support_at:
        return "needs_support"
    if standard_at is not None and x >= standard_at:
        return "standard"
    if standard_at is None and x > 0:
        return "standard"
    return "advanced"


def band_ratio(value: Any, lower: float = 0.75, upper: float = 1.25) -> str | None:
    x = finite_number(value)
    if x is None:
        return None
    if x > upper:
        return "needs_support"
    if x < lower:
        return "advanced"
    return "standard"


def band_accuracy(value: Any, lower: float, upper: float) -> str | None:
    x = finite_number(value)
    if x is None:
        return None
    if x < lower:
        return "needs_support"
    return "advanced" if x >= upper else "standard"


def add_bands(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame["mistakes_band"] = [band_count(v, 3, 1) if finite_number(n) is not None and n > 0 else None
                               for v, n in zip(frame.get("mistakes", pd.Series(index=frame.index, dtype=float)),
                                               frame.get("scored_submissions", pd.Series(index=frame.index, dtype=float)))]
    # The rubric requires an opportunity denominator. Leave the band missing when
    # the source export cannot establish that hints were available to the learner.
    frame["hints_band"] = [band_count(v, 3, 1) if finite_number(o) is not None and o > 0 else None
                           for v, o in zip(frame.get("hints_for_model", pd.Series(index=frame.index, dtype=float)),
                                           frame.get("hint_opportunities", pd.Series(index=frame.index, dtype=float)))]
    frame["completion_time_band"] = [band_ratio(v) for v in frame.get("completion_time_ratio", pd.Series(index=frame.index, dtype=float))]
    frame["level_run_attempts_band"] = [band_count(v, 3, 2) for v in frame.get("level_run_attempts", pd.Series(index=frame.index, dtype=float))]
    frame["accuracy_band"] = [band_accuracy(v, .60, .80) for v in frame.get("accuracy", pd.Series(index=frame.index, dtype=float))]
    frame["first_try_success_band"] = [None if finite_number(v) is None else ("advanced" if float(v) == 1 else "needs_support")
                                        for v in frame.get("first_try_success", pd.Series(index=frame.index, dtype=float))]
    frame["failure_rate_band"] = [None if finite_number(n) is None or n < 3 or finite_number(v) is None else
                                  ("needs_support" if finite_number(v) > .50 else
                                   "advanced" if finite_number(v) == 0 else "standard")
                                  for v, n in zip(frame.get("failure_rate_last_five", pd.Series(index=frame.index, dtype=float)),
                                                  frame.get("failure_rate_evaluated_runs", pd.Series(index=frame.index, dtype=float)))]
    frame["retries_band"] = [band_count(v, 3, 1) for v in frame.get("retries", pd.Series(index=frame.index, dtype=float))]
    frame["topic_mastery_band"] = [None if finite_number(n) is None or n < 3 else band_accuracy(v, .50, .80)
                                    for v, n in zip(frame.get("topic_mastery", pd.Series(index=frame.index, dtype=float)),
                                                    frame.get("topic_mastery_task_count", pd.Series(index=frame.index, dtype=float)))]
    frame["response_time_band"] = [band_ratio(v) for v in frame.get("response_time_ratio", pd.Series(index=frame.index, dtype=float))]
    return frame


def make_pipeline(numeric: list[str], categorical: list[str]) -> Pipeline:
    numeric_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)),
        ("scale", StandardScaler()),
    ])
    categorical_pipe = Pipeline([
        ("impute", SimpleImputer(strategy="constant", fill_value="__MISSING__")),
        ("encode", OneHotEncoder(handle_unknown="ignore")),
    ])
    transformer = ColumnTransformer([
        ("numeric", numeric_pipe, numeric),
        ("categorical", categorical_pipe, categorical),
    ], remainder="drop")
    return Pipeline([
        ("features", transformer),
        ("mlr", LogisticRegression(l1_ratio=0.0, C=1.0, solver="lbfgs", max_iter=3000,
                                    random_state=42)),
    ])


def choose_group_holdout(x: pd.DataFrame, y: pd.Series, groups: pd.Series, test_size: float = .25):
    expected = set(CLASSES)
    unique_groups = groups.nunique()
    if unique_groups < 4:
        raise ValueError(f"Need at least 4 distinct participants for a grouped holdout; found {unique_groups}.")
    splitter = GroupShuffleSplit(n_splits=400, test_size=test_size, random_state=2026)
    best = None
    for train_idx, test_idx in splitter.split(x, y, groups):
        train_classes, test_classes = set(y.iloc[train_idx]), set(y.iloc[test_idx])
        if train_classes == expected and test_classes == expected:
            best = (train_idx, test_idx)
            break
    if best is None:
        counts = {label: int(groups[y == label].nunique()) for label in CLASSES}
        raise ValueError("Cannot make a participant-separated holdout containing every class in both sets. "
                         f"Participants represented by class: {counts}. Collect/adjudicate more learners per class.")
    return best


def metrics_for(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict:
    probabilities = model.predict_proba(x_test)
    predicted = model.classes_[np.argmax(probabilities, axis=1)]
    expected_order = list(model.classes_)
    truth = y_test.to_numpy()
    onehot = np.zeros_like(probabilities)
    class_index = {label: i for i, label in enumerate(expected_order)}
    for i, label in enumerate(truth):
        onehot[i, class_index[label]] = 1.0
    return {
        "n_test_rows": int(len(y_test)),
        "n_test_participants": int(x_test["participant_id"].nunique()) if "participant_id" in x_test else None,
        "accuracy": float(accuracy_score(truth, predicted)),
        "macro_f1": float(f1_score(truth, predicted, labels=expected_order, average="macro", zero_division=0)),
        "per_class_recall": {label: float(value) for label, value in zip(
            expected_order, recall_score(truth, predicted, labels=expected_order, average=None, zero_division=0))},
        "confusion_matrix_rows_actual_columns_predicted": confusion_matrix(
            truth, predicted, labels=expected_order).tolist(),
        "multiclass_log_loss": float(log_loss(truth, probabilities, labels=expected_order)),
        "multiclass_brier_score": float(np.mean(np.sum((onehot - probabilities) ** 2, axis=1))),
    }


def top_coefficients(pipeline: Pipeline, feature_names: list[str], limit: int = 20) -> dict:
    model = pipeline.named_steps["mlr"]
    names = list(pipeline.named_steps["features"].get_feature_names_out())
    result = {}
    for class_name, coefs in zip(model.classes_, model.coef_):
        order = np.argsort(np.abs(coefs))[::-1][:limit]
        result[str(class_name)] = [{"feature": names[i], "coefficient": float(coefs[i])} for i in order]
    return result


def train_one(name: str, base: pd.DataFrame, train_idx: np.ndarray, test_idx: np.ndarray,
              output_dir: Path, keep_bands: bool) -> dict:
    train_base, test_base = base.iloc[train_idx].copy(), base.iloc[test_idx].copy()
    baselines = fit_time_baselines(train_base)
    train = add_bands(apply_time_ratios(train_base, baselines))
    test = add_bands(apply_time_ratios(test_base, baselines))
    numeric = ([col for col in NUMERIC_RAW if col in train and train[col].notna().any()]
               if not keep_bands else [])
    categorical = [col for col in CATEGORICAL if col in train and train[col].notna().any()]
    if keep_bands:
        categorical += [col for col in NUMERIC_BANDS if col in train and train[col].notna().any()]
    if not numeric and not categorical:
        raise ValueError("No measurable predictor columns remain. Check telemetry coverage in the dataset.")
    model = make_pipeline(numeric, categorical)
    model.fit(train[numeric + categorical], train["expert_label"])
    report = metrics_for(model, test[numeric + categorical], test["expert_label"])
    report["n_test_participants"] = int(test_base["participant_id"].nunique())

    # After participant-separated evaluation, fit the research artifact on all labeled
    # rows. It is not wired into /serve and must not be treated as deployed.
    final_baselines = fit_time_baselines(base)
    final = add_bands(apply_time_ratios(base, final_baselines))
    final_model = make_pipeline(numeric, categorical)
    final_model.fit(final[numeric + categorical], final["expert_label"])
    artifact = {
        "model": final_model,
        "time_baselines": final_baselines,
        "numeric_features": numeric,
        "categorical_features": categorical,
        "classes": list(final_model.named_steps["mlr"].classes_),
        "target_column": "expert_label",
        "dataset_origin": "synthetic_demo_not_research" if base.get("synthetic", pd.Series(False, index=base.index)).astype(str).str.lower().isin({"true", "1", "yes"}).any() else "labeled_export_data",
        "participant_id_is_not_a_predictor": True,
        "training_rows": int(len(final)),
        "training_participants": int(final["participant_id"].nunique()),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scikit_learn_version": sklearn.__version__,
        "caveat": "Research artifact only; expert labels, pilot validation and approval required before serving.",
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"difficulty_mlr_{name}.joblib"
    joblib.dump(artifact, model_path)
    report.update({
        "representation": name,
        "n_train_rows": int(len(train_idx)),
        "n_train_participants": int(base.iloc[train_idx]["participant_id"].nunique()),
        "n_total_rows_after_exclusions": int(len(base)),
        "n_total_participants": int(base["participant_id"].nunique()),
        "numeric_features": numeric,
        "categorical_features": categorical,
        "top_absolute_coefficients_by_class": top_coefficients(final_model, numeric + categorical),
        "artifact": str(model_path),
        "model_is_live": False,
    })
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="CSV from build_mlr_difficulty_dataset.py")
    parser.add_argument("--out-dir", type=Path, default=Path("artifacts/mlr"))
    args = parser.parse_args()
    try:
        frame = clean_frame(pd.read_csv(args.dataset, encoding="utf-8-sig"))
        if "synthetic" in frame:
            markers = frame["synthetic"].fillna(False).astype(str).str.lower().isin({"true", "1", "yes"})
            if markers.any() and not markers.all():
                raise ValueError("Synthetic and non-synthetic rows cannot be mixed in one training dataset.")
            is_synthetic = bool(markers.all())
        else:
            is_synthetic = False
        required = {"decision_id", "participant_id", "expert_label"}
        if not required.issubset(frame.columns):
            raise ValueError(f"Dataset must include columns: {', '.join(sorted(required))}")
        frame["expert_label"] = frame["expert_label"].astype(str).str.strip().str.lower().map(
            {"needs support": "needs_support", "needs_support": "needs_support", "need_help": "needs_support",
             "standard": "standard", "advance": "advanced", "advanced": "advanced",
             "insufficient evidence": "insufficient_evidence", "insufficient_evidence": "insufficient_evidence"})
        eligible = frame[frame["expert_label"].isin(CLASSES)].copy()
        if eligible["decision_id"].duplicated().any():
            raise ValueError("Dataset has duplicate decision_id rows; each learner-next-stage decision must appear once.")
        if eligible["participant_id"].isna().any() or (eligible["participant_id"].astype(str).str.strip() == "").any():
            raise ValueError("Every labeled row must have a stable pseudonymous participant_id for grouped validation.")
        counts = eligible["expert_label"].value_counts().reindex(CLASSES, fill_value=0)
        if (counts == 0).any():
            raise ValueError(f"Training requires all 3 adjudicated labels. Current rows: {counts.to_dict()}")
        if len(eligible) < 12:
            raise ValueError(f"Only {len(eligible)} adjudicated decisions. Need at least 12 before a pilot holdout can be attempted.")

        train_idx, test_idx = choose_group_holdout(eligible, eligible["expert_label"], eligible["participant_id"])
        output_dir = args.out_dir
        reports = []
        reports.append(train_one("raw", eligible, train_idx, test_idx, output_dir, keep_bands=False))
        reports.append(train_one("bands", eligible, train_idx, test_idx, output_dir, keep_bands=True))
        report_path = output_dir / "difficulty_mlr_evaluation.json"
        report_path.write_text(json.dumps({
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "dataset_origin": "synthetic_demo_not_research" if is_synthetic else "labeled_export_data",
            "synthetic_warning": "Feature patterns and labels were generated together; metrics are only a pipeline demonstration, not learner prediction performance." if is_synthetic else None,
            "method": "L2 multinomial logistic regression; one participant-grouped holdout; split seed search for class coverage",
            "excluded_insufficient_evidence_rows": int((frame["expert_label"] == "insufficient_evidence").sum()),
            "excluded_unlabeled_rows": int(frame["expert_label"].isna().sum()),
            "classes": CLASSES,
            "split_seed": 2026,
            "sklearn_version": sklearn.__version__,
            "representations": reports,
            "interpretation": "Exploratory pilot metrics only; do not choose a production model from this holdout alone.",
        }, indent=2), encoding="utf-8")
        print(f"Evaluation report: {report_path}")
        for item in reports:
            print(f"{item['representation']}: macro-F1={item['macro_f1']:.3f}, accuracy={item['accuracy']:.3f}, "
                  f"test participants={item['n_test_participants']}")
            print(f"  artifact: {item['artifact']}")
        print("These are offline research artifacts; LogiCade's live difficulty picker has not been changed.")
        return 0
    except (OSError, ValueError, ImportError, KeyError) as exc:
        print(f"MLR training failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
