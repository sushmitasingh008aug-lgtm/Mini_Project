"""ML Risk Service & Explainability (Blueprint v2 Section 11, 12, 14.3 & 21).

Point-in-Time Future Failure Prediction:
    Y_i = 1 if asset experiences a defined critical failure/event within 30 days, else 0.
Model estimates:
    R_i = P(Y_i = 1 | X_i)
    RiskScore_i = 100 * R_i

Integrates:
    - Champion Model Registry loading (ml_risk_model.pkl + ml_model_meta.json)
    - TreeSHAP feature contributions (via explainability.py)
    - Calibrated heuristic fallback when offline
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'ml_risk_model.pkl')
META_PATH = os.path.join(BASE_DIR, 'ml_model_meta.json')

_CHAMPION_MODEL = None
_CHAMPION_META = None

def get_champion():
    """Loads champion model and metadata from registry with memoization."""
    global _CHAMPION_MODEL, _CHAMPION_META
    if _CHAMPION_MODEL is not None and _CHAMPION_META is not None:
        return _CHAMPION_MODEL, _CHAMPION_META
        
    if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
        try:
            _CHAMPION_MODEL = joblib.load(MODEL_PATH)
            with open(META_PATH, 'r', encoding='utf-8') as f:
                _CHAMPION_META = json.load(f)
            return _CHAMPION_MODEL, _CHAMPION_META
        except Exception as e:
            print(f"Warning: could not load champion model: {e}")
            
    return None, None

def extract_features(task_dict: dict) -> dict:
    """Extracts point-in-time features strictly available at inference time."""
    cond = float(task_dict.get('condition_score', 70.0))
    health = float(task_dict.get('health_index', cond - 5.0))
    age = float(task_dict.get('asset_age_years', 12.0))
    imp = float(task_dict.get('asset_importance', 0.85))
    overdue = float(task_dict.get('days_overdue', 0.0))
    dur = float(task_dict.get('duration_minutes', 60.0))
    defects = float(task_dict.get('defects_30d', 2.0 if cond < 45 else (1.0 if cond < 65 else 0.0)))
    
    # 30d/90d historical estimates
    repeat = 1.0 if cond < 50 else 0.0
    failures_30d = 2.0 if cond < 40 else (1.0 if cond < 65 else 0.0)
    failures_90d = failures_30d + (2.0 if cond < 55 else 1.0)
    detention_30d = failures_30d * 45.0

    dept = str(task_dict.get('department', 'Engineering'))
    ttype = str(task_dict.get('task_type', ''))
    
    feats = {
        'condition_score': cond,
        'health_index': health,
        'asset_age_years': age,
        'asset_importance': imp,
        'days_overdue': overdue,
        'duration_minutes': dur,
        'defects_30d': defects,
        'failures_30d': failures_30d,
        'failures_90d': failures_90d,
        'detention_minutes_30d': detention_30d,
        'repeat_failure_flag': repeat,
        f'dept_{dept}': 1.0,
        f'task_{ttype}': 1.0
    }
    return feats

def predict_task_risk(task_dict: dict) -> dict:
    """Calculates ML risk probability R_i in [0, 1] and risk score in [0, 100]."""
    model, meta = get_champion()
    features = extract_features(task_dict)
    
    if model is not None and meta is not None:
        try:
            feat_names = meta.get('feature_names', list(features.keys()))
            X_row = pd.DataFrame([[features.get(f, 0.0) for f in feat_names]], columns=feat_names)
            probs = model.predict_proba(X_row.values)[0]
            # Probability of critical event (class 1)
            prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
            model_ver = meta.get('model_version', 'v2.1-champion')
            source = f"ML-{meta.get('champion_model', 'Ensemble')}"
        except Exception as e:
            prob = fallback_risk_probability(features)
            model_ver = 'v2.0-fallback'
            source = 'Heuristic Fallback'
    else:
        prob = fallback_risk_probability(features)
        model_ver = 'v2.0-fallback'
        source = 'Heuristic Fallback'
        
    prob = float(np.clip(prob, 0.05, 0.99))
    risk_score = round(prob * 100.0, 2)
    
    # Categorize Risk Band
    if risk_score >= 80.0:
        band = 'CRITICAL'
    elif risk_score >= 60.0:
        band = 'HIGH'
    elif risk_score >= 40.0:
        band = 'MEDIUM'
    else:
        band = 'LOW'
        
    return {
        'risk_probability': round(prob, 4),
        'risk_score': risk_score,
        'risk_band': band,
        'model_version': model_ver,
        'source': source,
        'features': features
    }

def fallback_risk_probability(features: dict) -> float:
    """Calibrated sigmoidal heuristic when ML model weights are offline."""
    cond = features.get('condition_score', 75.0)
    overdue = features.get('days_overdue', 0.0)
    fail30 = features.get('failures_30d', 0.0)
    
    # Degraded condition and overdue days strongly drive risk probability
    z = (65.0 - cond) * 0.045 + (overdue * 0.12) + (fail30 * 0.40)
    prob = 1.0 / (1.0 + np.exp(-z))
    return float(np.clip(prob, 0.05, 0.95))

if __name__ == '__main__':
    t_sample = {
        'task_id': 'TSK_1013',
        'condition_score': 32,
        'health_index': 28,
        'asset_age_years': 18,
        'days_overdue': 4,
        'duration_minutes': 60
    }
    pred = predict_task_risk(t_sample)
    print("Risk Service Test Prediction:")
    print(f"  R_i = {pred['risk_probability']} -> Risk Score: {pred['risk_score']} ({pred['risk_band']})")
    print(f"  Model Version: {pred['model_version']} [{pred['source']}]")
