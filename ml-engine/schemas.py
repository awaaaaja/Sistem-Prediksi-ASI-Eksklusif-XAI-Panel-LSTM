from pydantic import BaseModel, Field
from typing import List, Optional


class PredictRequest(BaseModel):
    puskesmas_id: int = Field(..., ge=1, le=999)
    history: List[List[float]] = Field(
        ..., min_length=12,
        description="Array 2D [12 bulan x 7 fitur]: Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif, Lag1_Target, Lag2_Target, Lag3_Target, Month_Sin, Month_Cos"
    )


class PredictResponse(BaseModel):
    success: bool
    puskesmas_id: int
    predictions: List[float]
    execution_time_ms: float


class BatchPredictRequest(BaseModel):
    stations: List[dict]


class BatchPredictResponse(BaseModel):
    success: bool
    results: List[dict]
    errors: List[dict]


class ShapRequest(BaseModel):
    puskesmas_id: int = Field(..., ge=1, le=999)
    history: List[List[float]] = Field(
        ..., min_length=12,
        description="Array 2D [12 bulan x 7 fitur] untuk kalkulasi SHAP"
    )


class ShapImpact(BaseModel):
    lag: int
    shap_value: float
    feature_name: str


class ShapFeature(BaseModel):
    feature: str
    mean_abs_impact: float
    impacts: List[ShapImpact]


class ShapResponse(BaseModel):
    success: bool
    puskesmas_id: int
    expected_value: float
    features: List[ShapFeature]


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model_loaded: bool
    scaler_X_loaded: bool
    scaler_Y_loaded: bool
    tensorflow_version: str
    uptime_seconds: float
    model_input_shape: Optional[List[int]] = None
