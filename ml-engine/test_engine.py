"""Quick test of ML Engine: model load, predict, SHAP"""
import os, sys
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import tensorflow as tf
print(f"TensorFlow {tf.__version__}")

import shap
print(f"SHAP {shap.__version__}")

print("Loading model...")
from model_loader import load_models
status = load_models()
print(f"  Model loaded: {status['model_loaded']}")
print(f"  Scaler_X: {status['scaler_X_loaded']}, Scaler_Y: {status['scaler_Y_loaded']}")

import model_loader as ml
sx = ml.scaler_X
sy = ml.scaler_Y
model = ml.model

from preprocess import prepare_sliding_window, N_FEATURES
print(f"N_FEATURES: {N_FEATURES}")

dummy = np.random.randn(12, N_FEATURES).astype(np.float32)
tensor = prepare_sliding_window(dummy)
print(f"Tensor: {tensor.shape}")

if sx is not None:
    s = tensor.shape
    tensor[:] = sx.transform(tensor.reshape(-1, s[-1])).reshape(s)

pred = model.predict(tensor, verbose=0)
if sy is not None:
    pred = sy.inverse_transform(pred)
print(f"Prediction: {pred[0,0]:.4f}")

print("Testing SHAP...")
from shap_explainer import init_shap, compute_shap, format_shap
init_shap(model)
shap_vals, ev = compute_shap(tensor, model)
print(f"SHAP values shape: {shap_vals.shape}, expected value: {ev:.4f}")

result = format_shap(shap_vals, ev, puskesmas_id=999)
print(f"SHAP features: {len(result['features'])}")
for f in result["features"]:
    print(f"  {f['feature']}: mean_abs={f['mean_abs_impact']:.6f}")
    
print("\n=== ALL TESTS PASSED ===")
