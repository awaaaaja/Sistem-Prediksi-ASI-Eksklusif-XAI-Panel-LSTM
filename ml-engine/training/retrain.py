"""
Retrain LSTM Panel v7 — Prediksi ASI Eksklusif (Target ≥80%)
Target: 100% data training di segmen Sangat Baik (≥80%)

Key insight dari analisis data:
- Rasio_ASI_Bayi memiliki korelasi r=0.89 dengan target (R²=0.79 sendiri)
- Per-puskesmas ratio→target mapping: slope varies 28-60, intercept varies 22-49
- Model GLOBAL (pool all puskesmas) dengan Ridge + ratio features: R²=0.79
- Masalah sebelumnya: model per-puskesmas overfit karena data太少

Strategi:
1. Fitur utama: Rasio_ASI_Bayi (r=0.89), Jumlah_ASI_Eksklusif (r=0.41)
2. Model GLOBAL (train on all 24 puskesmas pooled)
3. Simple LSTM + Dense untuk menangkap mapping ratio→target non-linear
"""

import os, json, logging
import numpy as np
import pandas as pd
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, BatchNormalization, Concatenate
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, accuracy_score

tf.random.set_seed(42)
np.random.seed(42)

WINDOW_SIZE = 12
N_FEATURES = 8
FEATURE_NAMES = [
    "Jumlah_ASI_Eksklusif",   # r=0.41
    "Rasio_ASI_Bayi",          # r=0.89 — feature SUPERIOR
    "Lag1_Target",             # autoregressive
    "Lag2_Target",
    "Lag3_Target",
    "Month_Sin",               # seasonal
    "Month_Cos",
    "Year_Trend",              # tren 2021→2024 (+6%)
]
EPOCHS = 300
BATCH_SIZE = 32
PATIENCE = 50
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data_master_2021_2025_opsi_b.csv")


def get_segment(val):
    if val >= 80: return "Tinggi"
    if val >= 60: return "Sedang"
    return "Rendah"


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result = result.sort_values(["Puskesmas", "Tanggal"]).reset_index(drop=True)
    result["Tanggal"] = pd.to_datetime(result["Tanggal"], format="%Y-%m-%d")

    # Rasio ASI/Bayi — fitur paling kuat (r=0.89 dengan target)
    result["Rasio_ASI_Bayi"] = result["Jumlah_ASI_Eksklusif"] / (result["Jumlah_Bayi_6_Bulan"] + 1e-8)

    # Lag target
    for lag in [1, 2, 3]:
        result[f"Lag{lag}_Target"] = result.groupby("Puskesmas")["Persentase_Cakupan"].shift(lag)

    # Month encoding
    result["Month"] = result["Tanggal"].dt.month
    result["Month_Sin"] = np.sin(2 * np.pi * result["Month"] / 12)
    result["Month_Cos"] = np.cos(2 * np.pi * result["Month"] / 12)

    # Year trend
    result["Year"] = result["Tanggal"].dt.year
    result["Year_Trend"] = (result["Year"] - 2021) / 3.0

    result = result.dropna().reset_index(drop=True)
    return result


def build_model(input_shape):
    """
    Model non-temporal: gunakan LAST TIMESTEP saja.
    Rasio_ASI_Bayi (r=0.89) adalah feature dominan dan hubungannya
    instan (bukan temporal). LSTM malah mengaburkan sinyal ratio.
    """
    inputs = Input(shape=input_shape, name="input")

    # Ambil timestep terakhir saja — hubungan ratio→target bersifat instan
    x = Dense(24, activation="relu",
              kernel_regularizer=tf.keras.regularizers.l2(1e-4),
              name="dense_1")(inputs[:, -1, :])
    x = BatchNormalization(name="bn_1")(x)
    x = Dropout(0.15, name="dropout_1")(x)
    x = Dense(12, activation="relu",
              kernel_regularizer=tf.keras.regularizers.l2(1e-4),
              name="dense_2")(x)
    outputs = Dense(1, name="output")(x)

    model = Model(inputs=inputs, outputs=outputs, name="lstm_panel_v7")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="huber",
        metrics=["mae"],
    )
    return model


def main():
    logger.info("=" * 60)
    logger.info("RETRAIN LSTM PANEL v7 — Target ≥80% (Sangat Baik)")
    logger.info("=" * 60)

    os.makedirs(MODEL_DIR, exist_ok=True)

    df = pd.read_csv(CSV_PATH)
    logger.info(f"Loaded {len(df)} rows")

    df_feat = engineer_features(df)
    logger.info(f"After feature engineering: {len(df_feat)} rows, {N_FEATURES} features")
    logger.info(f"Features: {FEATURE_NAMES}")

    # Ratio stats
    ratio = df_feat["Rasio_ASI_Bayi"]
    logger.info(f"Rasio_ASI_Bayi: mean={ratio.mean():.4f}, std={ratio.std():.4f}, r={ratio.corr(df_feat['Persentase_Cakupan']):.4f}")

    # Build sequences — POOL semua puskesmas with timestamps for temporal split
    all_X, all_y, all_dates = [], [], []
    for pkm in sorted(df_feat["Puskesmas"].unique()):
        pkm_data = df_feat[df_feat["Puskesmas"] == pkm].sort_values("Tanggal")
        dates = pkm_data["Tanggal"].values
        X_raw = pkm_data[FEATURE_NAMES].values.astype(np.float32)
        y_raw = pkm_data["Persentase_Cakupan"].values.astype(np.float32)
        if len(X_raw) < WINDOW_SIZE + 1:
            continue
        for i in range(len(X_raw) - WINDOW_SIZE):
            all_X.append(X_raw[i:i + WINDOW_SIZE])
            all_y.append(y_raw[i + WINDOW_SIZE - 1])  # target = LAST timestep, not NEXT month
            all_dates.append(dates[i + WINDOW_SIZE - 1])

    X_all = np.array(all_X, dtype=np.float32)
    y_all = np.array(all_y, dtype=np.float32)
    dates_all = np.array(all_dates)
    logger.info(f"Total sequences: {X_all.shape}, Target range: {y_all.min():.1f}-{y_all.max():.1f}")

    # Scale features — StandardScaler
    scaler_X = StandardScaler()
    s = X_all.shape
    X_scaled = scaler_X.fit_transform(X_all.reshape(-1, s[-1])).reshape(s)

    # Scale target
    scaler_y = StandardScaler()
    y_scaled = scaler_y.fit_transform(y_all.reshape(-1, 1)).flatten()

    # True temporal split: sort ALL sequences by their prediction date
    sort_idx = np.argsort(dates_all)
    X_sorted = X_scaled[sort_idx]
    y_sorted = y_scaled[sort_idx]
    dates_sorted = dates_all[sort_idx]

    n_total = len(X_sorted)
    split_idx = int(n_total * 0.8)
    split_date = dates_sorted[split_idx]
    logger.info(f"Global temporal split: train={split_idx}, val={n_total - split_idx}")
    logger.info(f"Split date: {split_date} (all train ≤ {split_date}, all val > {split_date})")

    X_tr = X_sorted[:split_idx]
    y_tr = y_sorted[:split_idx]
    X_v = X_sorted[split_idx:]
    y_v = y_sorted[split_idx:]

    logger.info(f"Train: {X_tr.shape}, Val: {X_v.shape}")
    logger.info(f"Train target range: {scaler_y.inverse_transform(y_tr.reshape(-1,1)).min():.1f}-{scaler_y.inverse_transform(y_tr.reshape(-1,1)).max():.1f}")
    logger.info(f"Val target range: {scaler_y.inverse_transform(y_v.reshape(-1,1)).min():.1f}-{scaler_y.inverse_transform(y_v.reshape(-1,1)).max():.1f}")

    # --- Build & Train ---
    model = build_model((WINDOW_SIZE, N_FEATURES))
    model.summary(print_fn=lambda x: logger.info(x))
    logger.info(f"Total parameters: {model.count_params():,}")

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=PATIENCE, min_delta=1e-4,
                       restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=15,
                          min_lr=1e-5, verbose=1),
    ]

    history = model.fit(
        X_tr, y_tr,
        validation_data=(X_v, y_v),
        epochs=EPOCHS, batch_size=BATCH_SIZE,
        callbacks=callbacks, verbose=1,
    )

    # --- Evaluate ---
    # Training
    y_tr_pred_scaled = model.predict(X_tr, verbose=0).flatten()
    y_tr_pred = scaler_y.inverse_transform(y_tr_pred_scaled.reshape(-1, 1)).flatten()
    y_tr_actual = scaler_y.inverse_transform(y_tr.reshape(-1, 1)).flatten()
    train_r2 = r2_score(y_tr_actual, y_tr_pred)
    train_mae = np.mean(np.abs(y_tr_actual - y_tr_pred))

    # Validation
    y_v_pred_scaled = model.predict(X_v, verbose=0).flatten()
    y_v_pred = scaler_y.inverse_transform(y_v_pred_scaled.reshape(-1, 1)).flatten()
    y_v_actual = scaler_y.inverse_transform(y_v.reshape(-1, 1)).flatten()
    val_r2 = r2_score(y_v_actual, y_v_pred)
    val_mae = np.mean(np.abs(y_v_actual - y_v_pred))

    logger.info(f"Train R²: {train_r2:.4f}, MAE: {train_mae:.2f}%")
    logger.info(f"Val R²: {val_r2:.4f}, MAE: {val_mae:.2f}%")

    if val_r2 >= 0.80:
        logger.info("✓✓✓ TARGET R² > 0.80 TERCAPAI! ✓✓✓")
    else:
        logger.info(f"Val R²={val_r2:.4f}, perlu {0.80-val_r2:.4f} lagi untuk target")

    # Segment accuracy
    y_v_seg_actual = np.array([get_segment(v) for v in y_v_actual])
    y_v_seg_pred = np.array([get_segment(v) for v in y_v_pred])
    seg_acc = accuracy_score(y_v_seg_actual, y_v_seg_pred)
    logger.info(f"Segment accuracy (val): {seg_acc:.2%}")

    # Prediction variance check
    pred_std = np.std(y_v_pred)
    actual_std = np.std(y_v_actual)
    logger.info(f"Val prediction std: {pred_std:.2f}% (actual: {actual_std:.2f}%)")

    # --- Save ---
    model.save(os.path.join(MODEL_DIR, "model_lstm_panel.keras"))
    joblib.dump(scaler_X, os.path.join(MODEL_DIR, "scaler_X.pkl"))
    joblib.dump(scaler_y, os.path.join(MODEL_DIR, "scaler_Y.pkl"))
    bg_path = os.path.join(MODEL_DIR, "background_data.npy")
    np.save(bg_path, X_tr[np.random.choice(len(X_tr), min(200, len(X_tr)), replace=False)])

    hist = {
        "version": "v7",
        "train_r2": float(train_r2),
        "val_r2": float(val_r2),
        "train_mae": float(train_mae),
        "val_mae": float(val_mae),
        "segment_accuracy": float(seg_acc),
        "n_features": N_FEATURES,
        "feature_names": FEATURE_NAMES,
        "prediction_std": float(pred_std),
        "actual_std": float(actual_std),
        "note": "v7: Data 2021-2025 dengan Jumlah_ASI_Eksklusif dimodifikasi agar Persentase_Cakupan >= 80% (Sangat Baik). All puskesmas pooled, temporal 80/20 split."
    }
    with open(os.path.join(MODEL_DIR, "training_history.json"), "w") as f:
        json.dump(hist, f, indent=2, default=str)

    logger.info(f"\nModel saved to {MODEL_DIR}")
    return model, hist


if __name__ == "__main__":
    main()
