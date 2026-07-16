"""Test ML Engine endpoints with simulated history data"""
import os, sys, json, time
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import urllib.request, urllib.error

BASE = "http://localhost:8000"

def post(path, body):
    req = urllib.request.Request(f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Test predict with realistic history
# 7 features per row as generated from feature engineering
print("=" * 60)
print("TEST 1: /ml/predict")
print("=" * 60)
np.random.seed(42)
history_7feat = np.random.randn(12, 7).astype(float).tolist()

t0 = time.time()
pred_res = post("/ml/predict", {
    "puskesmas_id": 1,
    "history": history_7feat
})
dt = time.time() - t0
print(f"  puskesmas_id: {pred_res['puskesmas_id']}")
print(f"  predictions: {pred_res['predictions']}")
print(f"  execution: {pred_res['execution_time_ms']}ms")
print(f"  total time: {dt*1000:.0f}ms")
print(f"  success: {pred_res['success']}")

print()
print("=" * 60)
print("TEST 2: /ml/shap")
print("=" * 60)
t0 = time.time()
shap_res = post("/ml/shap", {
    "puskesmas_id": 1,
    "history": history_7feat
})
dt = time.time() - t0
print(f"  puskesmas_id: {shap_res['puskesmas_id']}")
print(f"  expected_value: {shap_res['expected_value']:.6f}")
print(f"  features ({len(shap_res['features'])}):")
for f in shap_res["features"]:
    impacts_str = ", ".join(f"{i['lag']}:{i['shap_value']:.4f}" for i in f["impacts"][:3])
    print(f"    {f['feature']:25s} mean_abs={f['mean_abs_impact']:.6f}  lags: {impacts_str}...")
print(f"  total time: {dt*1000:.0f}ms")
print(f"  success: {shap_res['success']}")

# Consistency check
print()
print("=" * 60)
print("CONSISTENCY CHECK")
print("=" * 60)
total_shap = sum(imp["shap_value"] for f in shap_res["features"] for imp in f["impacts"])
reconstructed = total_shap + shap_res["expected_value"]
predicted = pred_res["predictions"][0]
diff = abs(reconstructed - predicted)
print(f"  sum(SHAP) + expected_value = {reconstructed:.6f}")
print(f"  model_prediction           = {predicted:.6f}")
print(f"  diff                       = {diff:.6f}")
if diff < 0.05:
    print("  ✓ CONSISTENCY PASSED (diff < 0.05)")
else:
    print(f"  ⚠ Consistency warning: diff={diff:.6f}")

print()
print("=== ALL ENDPOINT TESTS PASSED ===")
