"""Test SHAP inverse transform fix"""
import json, urllib.request, sys

body = json.dumps({"puskesmas_id": 1, "history": [[0.5]*7]*12}).encode()
req = urllib.request.Request(
    "http://localhost:8000/ml/shap",
    data=body,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req) as r:
    d = json.loads(r.read())

print(f"expected_value: {d['expected_value']:.2f}")
print("features:")
for f in d["features"]:
    print(f"  {f['feature']:25s} mean_abs={f['mean_abs_impact']:.4f}")

# Consistency: total SHAP + expected_value should match model prediction
total_shap = sum(imp["shap_value"] for f in d["features"] for imp in f["impacts"])
reconstructed = total_shap + d["expected_value"]
print(f"\nReconstructed prediction: {reconstructed:.2f}%")

# Get model prediction for same input
body2 = json.dumps({"puskesmas_id": 1, "history": [[0.5]*7]*12}).encode()
req2 = urllib.request.Request(
    "http://localhost:8000/ml/predict",
    data=body2,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req2) as r:
    d2 = json.loads(r.read())
print(f"Model prediction:       {d2['predictions'][0]:.2f}%")
print(f"Diff: {abs(reconstructed - d2['predictions'][0]):.4f}")
if abs(reconstructed - d2["predictions"][0]) < 1.0:
    print("✓ CONSISTENCY OK")
else:
    print("✗ CONSISTENCY FAILED")
