import os
import logging

import numpy as np
import shap
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input

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
wrapper_model = None


def init_shap(original_model, bg_path=None):
    global explainer, background_data, wrapper_model

    bg_path = bg_path or os.path.join(_BASE_DIR, "models", "background_data.npy")

    try:
        background_data = np.load(bg_path)
        logger.info(f"Background loaded from {bg_path}, shape: {background_data.shape}")
    except FileNotFoundError:
        background_data = np.random.randn(100, WINDOW_SIZE, N_FEATURES).astype(np.float32)
        logger.warning(f"Using random background, shape {background_data.shape}")

    # Build wrapper: original model takes (12,8) → slices timestep 12 → Dense layers
    # Wrapper takes only last timestep (8,) so SHAP can attribute correctly
    inp = Input(shape=(N_FEATURES,), name="shap_input")
    x = original_model.get_layer("dense_1")(inp)
    x = original_model.get_layer("bn_1")(x)
    x = original_model.get_layer("dropout_1")(x, training=False)
    x = original_model.get_layer("dense_2")(x)
    out = original_model.get_layer("output")(x)
    wrapper_model = Model(inputs=inp, outputs=out, name="shap_wrapper")
    wrapper_model.compile()

    # Background: take only last timestep
    bg_last = background_data[:, -1, :]
    logger.info(f"Wrapper input shape: {wrapper_model.input_shape}, bg shape: {bg_last.shape}")

    explainer = shap.DeepExplainer(wrapper_model, bg_last)
    logger.info("SHAP DeepExplainer initialized on last-timestep wrapper")


def compute_shap(input_tensor: np.ndarray, model=None) -> tuple:
    if explainer is None:
        raise RuntimeError("SHAP Explainer belum diinisialisasi.")

    # Take only last timestep
    if input_tensor.ndim == 3:
        input_last = input_tensor[:, -1, :]
    else:
        input_last = input_tensor

    shap_values = explainer.shap_values(input_last)

    if isinstance(shap_values, list):
        shap_arr = shap_values[0]
    else:
        shap_arr = shap_values

    ev = 0.0
    if wrapper_model is not None:
        try:
            bg_last = background_data[:, -1, :]
            preds = wrapper_model.predict(bg_last, verbose=0)
            ev = float(np.mean(preds))
        except Exception as e:
            logger.warning(f"Expected value failed: {e}")

    return shap_arr, ev


def format_shap(shap_arr, expected_value, puskesmas_id: int, scaler_y=None) -> dict:
    if scaler_y is not None:
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
        val = float(shap_arr[0, feat_idx])

        shap_pct = val * scale
        features.append({
            "feature": FEATURE_NAMES[feat_idx],
            "shap_value": round(shap_pct, 6),
            "mean_abs_impact": round(abs(shap_pct), 6),
        })

    return {
        "success": True,
        "puskesmas_id": puskesmas_id,
        "expected_value": round(expected_value, 6),
        "features": features,
    }
