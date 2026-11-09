# Building the LogiCade MLR training data

This workflow can create an explicitly synthetic demonstration dataset or build an offline research dataset from real, pseudonymous exports. It trains two exploratory L2 multinomial logistic-regression models: one from raw features and one from the interpretation bands. It does not change the live difficulty picker.

## Synthetic pipeline demonstration

Generate a labeled sample dataset without participant records:

```powershell
python scripts/generate_synthetic_mlr_dataset.py
python scripts/train_difficulty_mlr.py "data\mlr\synthetic_demo_difficulty_training.csv" `
  --out-dir "artifacts\mlr_synthetic_demo"
```

The default generator creates 600 decisions from 120 fictional participants. Its labels are generated from synthetic scenarios, not instructor judgments. This is only for checking the dataset and training pipeline; do not use it for research results, selecting the production model, or live learner difficulty.

For research use, follow the real-export and independent expert-label workflow below. Do not merge synthetic rows into real training data.

## 1. Export pseudonymous records

In Admin, open **Reports and Exports** and download CSV files for:

- **Research signals by attempt** (`research_attempts`)
- **Difficulty decisions** (`difficulty`)
- **Levels and progression** (`levels`)
- **Gameplay events** (`events`), recommended for response-time medians

Keep the exports in a private local folder. The export uses pseudonymous participant IDs; do not replace them with names or student numbers. The builder does not connect to Supabase and does not need service-role credentials.

## 2. Build features and a label worksheet

From the project root, run:

```powershell
python scripts/build_mlr_difficulty_dataset.py `
  --attempts "C:\path\to\research_attempts.csv" `
  --decisions "C:\path\to\difficulty.csv" `
  --levels "C:\path\to\levels.csv" `
  --events "C:\path\to\events.csv" `
  --out "data\mlr\difficulty_training.csv" `
  --labels-template "data\mlr\expert_labels_template.csv"
```

Two instructors should independently review each eligible decision's evidence using the approved difficulty-label rubric. Resolve disagreements through the study's agreed adjudication process, then fill `expert_label` in the generated worksheet with `needs_support`, `standard`, `advanced`, or `insufficient_evidence`. The builder accepts only adjudicated `expert_label` or `adjudicated_label` entries from a labels CSV keyed by `decision_id`; it never derives the training target from the system's existing difficulty choice. Rebuild the dataset with `--labels` to attach those labels:

```powershell
python scripts/build_mlr_difficulty_dataset.py `
  --attempts "C:\path\to\research_attempts.csv" `
  --decisions "C:\path\to\difficulty.csv" `
  --levels "C:\path\to\levels.csv" `
  --events "C:\path\to\events.csv" `
  --labels "data\mlr\expert_labels_template.csv" `
  --out "data\mlr\difficulty_training.csv"
```

Each dataset row represents a learner's next-stage decision. Attempts and scored-submission events are included only when their timestamps precede that decision. The builder keeps pseudonymous participant IDs only for participant-grouped validation; the trainer excludes them from predictors.

## 3. Train and evaluate

```powershell
python scripts/train_difficulty_mlr.py "data\mlr\difficulty_training.csv" `
  --out-dir "artifacts\mlr"
```

The trainer excludes unlabeled and `insufficient_evidence` rows, requires all three adjudicated classes, and creates a participant-separated holdout. It reports accuracy, macro-F1, per-class recall, confusion matrices, multiclass log loss, and multiclass Brier score. It writes raw-feature and interpretation-band model artifacts plus `difficulty_mlr_evaluation.json`. Review the evaluation before any further study decision; a single small holdout is exploratory and should not be used to select a production model.

The raw model uses numeric measures and exposure denominators. The band model uses the rubric's categories. Completion-time and response-time ratios use medians fit on training participants only; matched objective-and-prior-difficulty groups need at least three observations, with objective-level and then training-only global fallback medians. No evaluation learner contributes to those baselines.

## Feature coverage and handling

| Feature | Source and rule |
|---|---|
| Mistakes | Incorrect scored submissions in the preceding stage; keeps total scored submissions and mistakes per submission. |
| Hints | Observed hint count is retained. It becomes a model feature/band only when the export includes a positive `hint_opportunities` or `hints_available` denominator. Current research-attempt exports do not provide that denominator, so hints remain unavailable to the model until the source data records it. |
| Completion time | First completed run's foreground active time, divided by the training-only matched-task median. Missing when no completed run or usable baseline exists. |
| Level-run attempts | Run records through the first clear, or through the decision if there was no clear. Includes incomplete/exited runs present in the export. |
| Accuracy | Correct scored submissions divided by scored submissions on the first evaluated run; denominator retained. |
| First-try success | Whether the first evaluated run completed; missing when no run was evaluated. |
| Failure rate | Failed runs divided by evaluated runs among the last five comparable runs. Requires at least three. |
| Retries | Question plus activity retries in the preceding stage, when instrumented. Missing legacy counters remain missing. |
| Topic mastery | First-try completed tasks divided by distinct comparable objective tasks; requires at least three tasks. This is a gameplay proxy, not a validated learning outcome. |
| Response time | Median first measured response per task target from scored-submission events, divided by a training-only matched-task median. Without the events export, this remains missing. |
| Session duration and inactivity | Retained as context columns for audit only. They are never predictors. |

Blank values are not changed to zero. The builder does not infer hint opportunities, response samples, or mastery from unrelated records. `difficulty_selected` and `difficulty_served` are not model inputs or targets. The next-stage objective and prior difficulty may be categorical predictors when present.

## Important limitations

- The project currently uses its existing rule-based difficulty engine. These scripts do not connect a trained model to `/serve`.
- Do not train from the historical `difficulty_selected` field as the target: that would teach the model to imitate the old picker. Use independently adjudicated instructor labels.
- Missing hint-opportunity data means the hints feature is currently excluded from model fitting. The response-time feature also requires event exports with per-submission response times.
- A dataset without enough labeled participants in every class will fail the participant-separated holdout checks. Do not weaken those checks by splitting rows randomly; collect and adjudicate more participant histories.
- Keep the `difficulty_mlr_*.joblib` artifacts and raw exports private. The saved estimator is not an authenticated service and has no live-serving safeguards.
