import os
import logging

import numpy as np
import shap

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FEATURE_NAMES = [
    "Jumlah_ASI_Eksklusif",
    "Rasio_ASI_Bayi",
    "Lag1_Target",
    "Lag2_Target",
    "Lag3_Target",
    "Month_Sin",
    "Month_Cos",
    "Year_Trend",
]
WINDOW_SIZE = 12
N_FEATURES = 8

explainer = None
background_data = None


def init_shap(model, bg_path=None):
    bg_path = bg_path or os.path.join(_BASE_DIR, "models", "background_data.npy")
    global explainer, background_data

    try:
        background_data = np.load(bg_path)
        logger.info(f"Background loaded from {bg_path}, shape: {background_data.shape}")
    except FileNotFoundError:
        background_data = np.random.randn(100, WINDOW_SIZE, N_FEATURES).astype(np.float32)
        logger.warning(f"Using random background, shape {background_data.shape}")

    explainer = shap.GradientExplainer(model, background_data)
    logger.info("SHAP GradientExplainer initialized")


def compute_shap(input_tensor: np.ndarray, model=None) -> tuple:
    if explainer is None:
        raise RuntimeError("SHAP Explainer belum diinisialisasi.")

    shap_values = explainer.shap_values(input_tensor)

    if isinstance(shap_values, list):
        shap_arr = shap_values[0]
    else:
        shap_arr = shap_values

    ev = 0.0
    if model is not None:
        try:
            preds = model.predict(background_data[:50], verbose=0)
            ev = float(np.mean(preds))
        except Exception as e:
            logger.warning(f"Expected value failed: {e}")

    return shap_arr, ev


def format_shap(shap_arr, expected_value, puskesmas_id: int, scaler_y=None) -> dict:
    # Inverse-transform SHAP values and expected_value from scaled to percentage space
    if scaler_y is not None:
        # Support both MinMaxScaler and StandardScaler
        if hasattr(scaler_y, "data_max_"):
            scale = float(scaler_y.data_max_[0] - scaler_y.data_min_[0])
            offset = float(scaler_y.data_min_[0])
        else:
            scale = float(scaler_y.scale_[0])
            offset = float(scaler_y.mean_[0])
        expected_value = expected_value * scale + offset
    else:
        scale = 1.0
        offset = 0.0

    features = []

    for feat_idx in range(N_FEATURES):
        impacts = []
        for lag in range(WINDOW_SIZE):
            if shap_arr.ndim == 4:
                val = float(shap_arr[0, lag, feat_idx, 0])
            elif shap_arr.ndim == 3:
                val = float(shap_arr[lag, feat_idx])
            else:
                val = float(shap_arr[lag, feat_idx])
            shap_pct = val * scale
            impacts.append({
                "lag": WINDOW_SIZE - lag,
                "shap_value": round(shap_pct, 6),
                "feature_name": FEATURE_NAMES[feat_idx],
            })

        mean_abs = sum(abs(i["shap_value"]) for i in impacts) / len(impacts)
        features.append({
            "feature": FEATURE_NAMES[feat_idx],
            "mean_abs_impact": round(mean_abs, 6),
            "impacts": impacts,
        })

    return {
        "success": True,
        "puskesmas_id": puskesmas_id,
        "expected_value": round(expected_value, 6),
        "features": features,
    }
