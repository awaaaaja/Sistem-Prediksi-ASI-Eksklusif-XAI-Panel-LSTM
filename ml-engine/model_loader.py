import os
import logging

import joblib
import tensorflow as tf

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = None
scaler_X = None
scaler_Y = None


def load_models():
    global model, scaler_X, scaler_Y

    model_path = os.getenv("MODEL_PATH", os.path.join(_BASE_DIR, "models", "model_lstm_panel.h5"))
    scaler_X_path = os.getenv("SCALER_X_PATH", os.path.join(_BASE_DIR, "models", "scaler_X.pkl"))
    scaler_Y_path = os.getenv("SCALER_Y_PATH", os.path.join(_BASE_DIR, "models", "scaler_Y.pkl"))

    status = {
        "model_loaded": False,
        "scaler_X_loaded": False,
        "scaler_Y_loaded": False,
    }

    try:
        model = tf.keras.models.load_model(model_path, compile=False)
        status["model_loaded"] = True
        logger.info(f"Model loaded. Input shape: {model.input_shape}, Output shape: {model.output_shape}")
    except Exception as e:
        logger.error(f"Model load failed: {e}")

    try:
        scaler_X = joblib.load(scaler_X_path)
        status["scaler_X_loaded"] = True
        logger.info(f"Scaler_X loaded. Type: {type(scaler_X).__name__}, features: {scaler_X.n_features_in_}")
    except Exception as e:
        logger.error(f"Scaler_X load failed: {e}")

    try:
        scaler_Y = joblib.load(scaler_Y_path)
        status["scaler_Y_loaded"] = True
        logger.info(f"Scaler_Y loaded. Type: {type(scaler_Y).__name__}, features: {scaler_Y.n_features_in_}")
    except Exception as e:
        logger.error(f"Scaler_Y load failed: {e}")

    return status
