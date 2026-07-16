"""Feature Engineering untuk LSTM Panel — Prediksi ASI Eksklusif

Menghasilkan 12 fitur dari data mentah:
1. Jumlah_Bayi_6_Bulan (original)
2. Jumlah_ASI_Eksklusif (original)
3. Rasio_ASI_per_Bayi (turunan)
4. Lag1_Bayi (t-1)
5. Lag1_ASI (t-1)
6. Lag2_Bayi (t-2)
7. Lag2_ASI (t-2)
8. RollingMean3_Bayi
9. RollingMean3_ASI
10. Month_Sin (seasonal)
11. Month_Cos (seasonal)
12. Trend_Linear
"""

import numpy as np
import pandas as pd
from typing import Tuple

WINDOW_SIZE = 12
N_FEATURES = 12

FEATURE_NAMES = [
    "Jumlah_Bayi_6_Bulan",
    "Jumlah_ASI_Eksklusif",
    "Rasio_ASI_per_Bayi",
    "Lag1_Jumlah_Bayi_6_Bulan",
    "Lag1_Jumlah_ASI_Eksklusif",
    "Lag2_Jumlah_Bayi_6_Bulan",
    "Lag2_Jumlah_ASI_Eksklusif",
    "RollingMean3_Jumlah_Bayi_6_Bulan",
    "RollingMean3_Jumlah_ASI_Eksklusif",
    "Month_Sin",
    "Month_Cos",
    "Trend_Linear",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Generate derived features from raw data grouped by Puskesmas."""
    result = df.copy()
    result = result.sort_values(["Puskesmas", "Tanggal"]).reset_index(drop=True)

    # 1. Rasio ASI per Bayi (dengan epsilon untuk hindari division by zero)
    result["Rasio_ASI_per_Bayi"] = (
        result["Jumlah_ASI_Eksklusif"] / (result["Jumlah_Bayi_6_Bulan"] + 1e-8)
    )

    # 2. Lag features (1 dan 2 bulan) — shift dalam grup Puskesmas
    for col in ["Jumlah_Bayi_6_Bulan", "Jumlah_ASI_Eksklusif"]:
        result[f"Lag1_{col}"] = result.groupby("Puskesmas")[col].shift(1)
        result[f"Lag2_{col}"] = result.groupby("Puskesmas")[col].shift(2)

    # 3. Rolling mean 3 bulan
    for col in ["Jumlah_Bayi_6_Bulan", "Jumlah_ASI_Eksklusif"]:
        result[f"RollingMean3_{col}"] = (
            result.groupby("Puskesmas")[col]
            .transform(lambda x: x.rolling(3, min_periods=1).mean())
        )

    # 4. Seasonal encoding (siklus tahunan)
    result["Month"] = result["Tanggal"].dt.month
    result["Month_Sin"] = np.sin(2 * np.pi * result["Month"] / 12)
    result["Month_Cos"] = np.cos(2 * np.pi * result["Month"] / 12)

    # 5. Linear trend (0, 1, 2, ... per puskesmas)
    result["Trend_Linear"] = result.groupby("Puskesmas").cumcount()

    # Drop rows with NaN from lag shifting
    result = result.dropna().reset_index(drop=True)

    return result


def create_sequences(
    data: np.ndarray, target: np.ndarray, window_size: int = WINDOW_SIZE
) -> Tuple[np.ndarray, np.ndarray]:
    """Buat sliding window sequences untuk LSTM.

    Args:
        data: array fitur shape (n_timesteps, n_features)
        target: array target shape (n_timesteps,)
        window_size: panjang window (default 12)

    Returns:
        X: shape (n_sequences, window_size, n_features)
        y: shape (n_sequences,)
    """
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i : i + window_size])
        y.append(target[i + window_size])
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def prepare_training_data(
    csv_path: str,
    window_size: int = WINDOW_SIZE,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, object, object]:
    """Load CSV, engineer features, scale, create sequences.

    Returns:
        X_train, X_val, y_train, y_val, scaler_X, scaler_y
    """
    from sklearn.preprocessing import StandardScaler

    df = pd.read_csv(csv_path)
    df["Tanggal"] = pd.to_datetime(df["Tanggal"])

    # Feature engineering
    df_feat = engineer_features(df)

    # Split by ratio: 80% train, 20% val per puskesmas (sequential)
    train_X_seqs = []
    train_y_seqs = []
    val_X_seqs = []
    val_y_seqs = []

    for pkm in df_feat["Puskesmas"].unique():
        pkm_data = df_feat[df_feat["Puskesmas"] == pkm].sort_values("Tanggal")

        # Feature columns
        feat_cols = [c for c in FEATURE_NAMES if c in pkm_data.columns]
        X_raw = pkm_data[feat_cols].values
        y_raw = pkm_data["Persentase_Cakupan"].values

        # Create all sequences first, then split by ratio
        X_all, y_all = create_sequences(X_raw, y_raw, window_size)

        if len(X_all) < 2:
            continue

        # Use last 20% for validation (time-consistent split)
        split_idx = int(len(X_all) * 0.8)
        if split_idx < 1:
            split_idx = 1

        train_X_seqs.append(X_all[:split_idx])
        train_y_seqs.append(y_all[:split_idx])
        val_X_seqs.append(X_all[split_idx:])
        val_y_seqs.append(y_all[split_idx:])

    # Concatenate all puskesmas
    X_train = np.concatenate(train_X_seqs, axis=0) if train_X_seqs else np.array([])
    y_train = np.concatenate(train_y_seqs, axis=0) if train_y_seqs else np.array([])
    X_val = np.concatenate(val_X_seqs, axis=0) if val_X_seqs else np.array([])
    y_val = np.concatenate(val_y_seqs, axis=0) if val_y_seqs else np.array([])

    print(f"Train sequences: {X_train.shape}")
    print(f"Val sequences: {X_val.shape}")

    # Scale features
    scaler_X = StandardScaler()
    n_train = X_train.shape[0]
    n_val = X_val.shape[0]

    # Reshape to 2D for scaling: (n, window, features) -> (n * window, features)
    X_train_2d = X_train.reshape(-1, X_train.shape[-1])
    X_train_scaled = scaler_X.fit_transform(X_train_2d).reshape(X_train.shape)

    if n_val > 0:
        X_val_2d = X_val.reshape(-1, X_val.shape[-1])
        X_val_scaled = scaler_X.transform(X_val_2d).reshape(X_val.shape)
    else:
        X_val_scaled = X_val

    # Scale target
    scaler_y = StandardScaler()
    y_train_scaled = scaler_y.fit_transform(y_train.reshape(-1, 1)).flatten()
    y_val_scaled = (
        scaler_y.transform(y_val.reshape(-1, 1)).flatten() if n_val > 0 else y_val
    )

    print(f"Scaler_X mean: {scaler_X.mean_}")
    print(f"Scaler_X scale: {scaler_X.scale_}")
    print(f"Scaler_y mean: {scaler_y.mean_[0]:.4f}, scale: {scaler_y.scale_[0]:.4f}")

    return X_train_scaled, X_val_scaled, y_train_scaled, y_val_scaled, scaler_X, scaler_y
