"""Evaluasi Model LSTM per Puskesmas — Prediksi ASI Eksklusif

Menghitung R², MAE, MAPE untuk setiap Puskesmas secara individu.
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from feature_engineering import engineer_features, create_sequences, WINDOW_SIZE, N_FEATURES, FEATURE_NAMES

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data_master_2021_2024_scaled.csv")


def evaluate_per_puskesmas():
    """Evaluasi model untuk setiap Puskesmas."""
    logger.info("=" * 60)
    logger.info("EVALUASI PER PUSKESMAS")
    logger.info("=" * 60)

    # Load model dan scalers
    model_path = os.path.join(MODEL_DIR, "model_lstm_panel.h5")
    scaler_X_path = os.path.join(MODEL_DIR, "scaler_X.pkl")
    scaler_y_path = os.path.join(MODEL_DIR, "scaler_Y.pkl")

    if not os.path.exists(model_path):
        logger.error(f"Model not found: {model_path}")
        return

    model = tf.keras.models.load_model(model_path, compile=False)
    scaler_X = joblib.load(scaler_X_path)
    scaler_y = joblib.load(scaler_y_path)
    logger.info(f"Model loaded. Input shape: {model.input_shape}")
    logger.info(f"Scaler_X: {scaler_X.mean_}")
    logger.info(f"Scaler_y: mean={scaler_y.mean_[0]:.4f}, scale={scaler_y.scale_[0]:.4f}")

    # Load dan engineer features
    df = pd.read_csv(CSV_PATH)
    df["Tanggal"] = pd.to_datetime(df["Tanggal"])
    df_feat = engineer_features(df)

    results = []

    for pkm in sorted(df_feat["Puskesmas"].unique()):
        pkm_data = df_feat[df_feat["Puskesmas"] == pkm].sort_values("Tanggal")

        # Sliding window
        X_raw = pkm_data[[c for c in FEATURE_NAMES if c in pkm_data.columns]].values
        y_raw = pkm_data["Persentase_Cakupan"].values

        if len(X_raw) < WINDOW_SIZE + 1:
            logger.warning(f"{pkm}: data insufficient ({len(X_raw)} rows)")
            continue

        X_seq, y_seq = create_sequences(X_raw, y_raw, WINDOW_SIZE)

        # Scale
        X_shape = X_seq.shape
        X_2d = X_seq.reshape(-1, X_shape[-1])
        X_scaled = scaler_X.transform(X_2d).reshape(X_shape)

        # Predict
        y_pred_scaled = model.predict(X_scaled, verbose=0).flatten()
        y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

        # Metrics
        r2 = r2_score(y_seq, y_pred)
        mae = mean_absolute_error(y_seq, y_pred)
        rmse = np.sqrt(mean_squared_error(y_seq, y_pred))
        mape = np.mean(np.abs((y_seq - y_pred) / (y_seq + 1e-8))) * 100

        # Get kecamatan for this puskesmas
        kecamatan = pkm_data["Kecamatan"].iloc[0]

        results.append({
            "puskesmas": pkm,
            "kecamatan": kecamatan,
            "n_seq": len(y_seq),
            "r2": round(r2, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mape": round(mape, 2),
            "y_mean": round(float(np.mean(y_seq)), 2),
            "y_std": round(float(np.std(y_seq)), 2),
        })

        star = "✓" if r2 >= 0.80 else "⚠" if r2 >= 0.60 else "✗"
        logger.info(f"  {star} {pkm:20s} ({kecamatan:20s}) R²={r2:.4f}  MAE={mae:.2f}  MAPE={mape:.1f}%  n={len(y_seq)}")

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)

    df_results = pd.DataFrame(results)

    mean_r2 = df_results["r2"].mean()
    mean_mae = df_results["mae"].mean()
    mean_mape = df_results["mape"].mean()
    n_above_80 = (df_results["r2"] >= 0.80).sum()
    n_above_60 = (df_results["r2"] >= 0.60).sum()
    n_total = len(df_results)

    logger.info(f"Puskesmas evaluated: {n_total}")
    logger.info(f"Mean R²:  {mean_r2:.4f}")
    logger.info(f"Mean MAE: {mean_mae:.2f}%")
    logger.info(f"Mean MAPE: {mean_mape:.1f}%")
    logger.info(f"R² >= 0.80: {n_above_80}/{n_total} ({n_above_80/n_total*100:.0f}%)")
    logger.info(f"R² >= 0.60: {n_above_60}/{n_total} ({n_above_60/n_total*100:.0f}%)")

    if mean_r2 >= 0.80:
        logger.info("")
        logger.info("✓✓✓ TARGET R² > 0.80 TERCAPAI! ✓✓✓")
    else:
        logger.info("")
        logger.warning(f"⚠ R² rata-rata {mean_r2:.4f}, target > 0.80")

    # Per-kecamatan aggregation
    logger.info("")
    logger.info("--- Per Kecamatan ---")
    for kec in sorted(df_results["kecamatan"].unique()):
        sub = df_results[df_results["kecamatan"] == kec]
        logger.info(f"  {kec:25s} R²={sub['r2'].mean():.4f}  MAE={sub['mae'].mean():.2f}  ({len(sub)} puskesmas)")

    return df_results


if __name__ == "__main__":
    results = evaluate_per_puskesmas()
    if results is not None:
        print("\nTop 5:")
        print(results.nlargest(5, "r2")[["puskesmas", "kecamatan", "r2", "mae"]].to_string(index=False))
        print("\nBottom 5:")
        print(results.nsmallest(5, "r2")[["puskesmas", "kecamatan", "r2", "mae"]].to_string(index=False))
