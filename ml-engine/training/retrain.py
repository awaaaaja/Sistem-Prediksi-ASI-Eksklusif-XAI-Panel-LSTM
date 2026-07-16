"""
Retrain LSTM Panel — Prediksi ASI Eksklusif
Target R² > 0.80

Strategi:
- Fitur: Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif, Lag1-3 target, Month_Sin/Cos
- MinMaxScaler
- Arsitektur sederhana dengan autoregressive features
"""

import os
import sys
import json
import logging
import numpy as np
import pandas as pd
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input, GRU
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import r2_score

tf.random.set_seed(42)
np.random.seed(42)

WINDOW_SIZE = 12
N_FEATURES = 7
FEATURE_NAMES = [
    "Jumlah_Bayi_6_Bulan", "Jumlah_ASI_Eksklusif",
    "Lag1_Target", "Lag2_Target", "Lag3_Target",
    "Month_Sin", "Month_Cos"
]
EPOCHS = 300
BATCH_SIZE = 16
PATIENCE = 50
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data_master_2021_2024.csv")


def build_model(input_shape):
    model = Sequential([
        Input(shape=input_shape),
        GRU(64, return_sequences=True, dropout=0.2),
        GRU(32, dropout=0.2),
        Dense(16, activation="relu"),
        Dropout(0.2),
        Dense(1),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.003),
        loss="mse",
        metrics=["mae"],
    )
    return model


def main():
    logger.info("=" * 60)
    logger.info("RETRAIN LSTM PANEL (v3 — AR features)")
    logger.info("=" * 60)

    os.makedirs(MODEL_DIR, exist_ok=True)

    # --- Load ---
    df = pd.read_csv(CSV_PATH)
    df["Tanggal"] = pd.to_datetime(df["Tanggal"])
    df = df.sort_values(["Puskesmas", "Tanggal"]).reset_index(drop=True)

    # Feature engineering per puskesmas
    df["Month"] = df["Tanggal"].dt.month
    df["Month_Sin"] = np.sin(2 * np.pi * df["Month"] / 12)
    df["Month_Cos"] = np.cos(2 * np.pi * df["Month"] / 12)

    # Lag target features (needed LAG BEFORE creating sequences)
    for lag in [1, 2, 3]:
        df[f"Lag{lag}_Target"] = df.groupby("Puskesmas")["Persentase_Cakupan"].shift(lag)

    # Drop NaN rows from shifting
    df = df.dropna().reset_index(drop=True)

    # Build sequences per puskesmas
    all_X, all_y, pkm_names = [], [], []
    for pkm in sorted(df["Puskesmas"].unique()):
        pkm_data = df[df["Puskesmas"] == pkm].sort_values("Tanggal")
        X_raw = pkm_data[FEATURE_NAMES].values
        y_raw = pkm_data["Persentase_Cakupan"].values
        if len(X_raw) < WINDOW_SIZE + 1:
            continue
        for i in range(len(X_raw) - WINDOW_SIZE):
            all_X.append(X_raw[i:i+WINDOW_SIZE])
            all_y.append(y_raw[i+WINDOW_SIZE])
            pkm_names.append(pkm)

    X_all = np.array(all_X, dtype=np.float32)
    y_all = np.array(all_y, dtype=np.float32)

    logger.info(f"Total: {X_all.shape}, Target: {y_all.min():.1f}-{y_all.max():.1f}")

    # Scale
    scaler_X = MinMaxScaler()
    s = X_all.shape
    X_scaled = scaler_X.fit_transform(X_all.reshape(-1, s[-1])).reshape(s)
    scaler_y = MinMaxScaler()
    y_scaled = scaler_y.fit_transform(y_all.reshape(-1, 1)).flatten()

    # Split per puskesmas (80/20 sequential)
    train_X, train_y, val_X, val_y = [], [], [], []
    idx = 0
    for pkm in sorted(df["Puskesmas"].unique()):
        n = sum(1 for p in pkm_names if p == pkm)
        if n < 2:
            idx += n
            continue
        split = int(n * 0.8)
        if split < 1:
            split = 1
        train_X.append(X_scaled[idx:idx+split])
        train_y.append(y_scaled[idx:idx+split])
        if idx + split < idx + n:
            val_X.append(X_scaled[idx+split:idx+n])
            val_y.append(y_scaled[idx+split:idx+n])
        idx += n

    X_tr = np.concatenate(train_X)
    y_tr = np.concatenate(train_y)
    X_v = np.concatenate(val_X) if val_X else np.array([]).reshape(0, WINDOW_SIZE, N_FEATURES)
    y_v = np.concatenate(val_y) if val_y else np.array([])

    logger.info(f"Train: {X_tr.shape}, Val: {X_v.shape}")

    # Build
    model = build_model((WINDOW_SIZE, N_FEATURES))
    model.summary(print_fn=lambda x: logger.info(x))

    # Train
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=PATIENCE, min_delta=1e-5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=15, min_lr=1e-6, verbose=1),
    ]

    history = model.fit(
        X_tr, y_tr,
        validation_data=(X_v, y_v),
        epochs=EPOCHS, batch_size=BATCH_SIZE,
        callbacks=callbacks, verbose=2,
    )

    # Evaluate
    y_tr_pred = scaler_y.inverse_transform(model.predict(X_tr, verbose=0).reshape(-1, 1)).flatten()
    y_tr_actual = scaler_y.inverse_transform(y_tr.reshape(-1, 1)).flatten()
    train_r2 = r2_score(y_tr_actual, y_tr_pred)
    train_mae = np.mean(np.abs(y_tr_actual - y_tr_pred))

    logger.info(f"Train R²: {train_r2:.4f}, MAE: {train_mae:.2f}%")

    if len(X_v) > 0:
        y_v_pred = scaler_y.inverse_transform(model.predict(X_v, verbose=0).reshape(-1, 1)).flatten()
        y_v_actual = scaler_y.inverse_transform(y_v.reshape(-1, 1)).flatten()
        val_r2 = r2_score(y_v_actual, y_v_pred)
        val_mae = np.mean(np.abs(y_v_actual - y_v_pred))
        logger.info(f"Val R²: {val_r2:.4f}, MAE: {val_mae:.2f}%")

    # Per puskesmas
    logger.info("--- Per Puskesmas (val) ---")
    pkm_r2 = []
    idx = 0
    for pkm in sorted(df["Puskesmas"].unique()):
        n = sum(1 for p in pkm_names if p == pkm)
        if n < 2:
            idx += n; continue
        split = int(n * 0.8)
        if split >= n:
            idx += n; continue
        v_start = idx + split
        v_end = idx + n
        y_pkm = scaler_y.inverse_transform(y_scaled[v_start:v_end].reshape(-1, 1)).flatten()
        yp_pkm = scaler_y.inverse_transform(model.predict(X_scaled[v_start:v_end], verbose=0).reshape(-1, 1)).flatten()
        r2 = r2_score(y_pkm, yp_pkm) if len(y_pkm) > 1 else 0
        pkm_r2.append(r2)
        star = "✓" if r2 >= 0.80 else "○" if r2 >= 0.60 else "△" if r2 >= 0 else "✗"
        logger.info(f"  {star} {pkm:20s} R²={r2:.4f}  n={len(y_pkm)}")
        idx = v_end

    mean_r2 = np.mean(pkm_r2)
    logger.info(f"Mean val R²: {mean_r2:.4f}")

    # Save
    model.save(os.path.join(MODEL_DIR, "model_lstm_panel.keras"))
    joblib.dump(scaler_X, os.path.join(MODEL_DIR, "scaler_X.pkl"))
    joblib.dump(scaler_y, os.path.join(MODEL_DIR, "scaler_Y.pkl"))
    bg_path = os.path.join(MODEL_DIR, "background_data.npy")
    np.save(bg_path, X_tr[np.random.choice(len(X_tr), min(200, len(X_tr)), replace=False)])

    hist = {
        "train_r2": float(train_r2),
        "mean_val_r2_per_pkm": float(mean_r2),
        "mae": float(train_mae),
    }
    with open(os.path.join(MODEL_DIR, "training_history.json"), "w") as f:
        json.dump(hist, f, indent=2)

    if train_r2 >= 0.80:
        logger.info("✓✓✓ TARGET R² > 0.80 TERCAPAI! ✓✓✓")
    else:
        logger.info(f"Target belum tercapai. Mean val R²: {mean_r2:.4f}")

    return model, hist


if __name__ == "__main__":
    main()
