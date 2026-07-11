import numpy as np

WINDOW_SIZE = 12
N_FEATURES = 2  # Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif


def prepare_sliding_window(history: np.ndarray) -> np.ndarray:
    if len(history) < WINDOW_SIZE:
        raise ValueError(
            f"Minimal {WINDOW_SIZE} bulan data historis, "
            f"tersedia {len(history)} bulan"
        )

    if np.any(np.isnan(history)) or np.any(np.isinf(history)):
        raise ValueError("Data mengandung NaN atau Infinity")

    if history.shape[1] != N_FEATURES:
        raise ValueError(
            f"Input memiliki {history.shape[1]} fitur, "
            f"model membutuhkan {N_FEATURES} fitur. "
            f"Gunakan kolom: Jumlah_Bayi_6_Bulan, Jumlah_ASI_Eksklusif"
        )

    window = history[-WINDOW_SIZE:]
    tensor = window.reshape(1, WINDOW_SIZE, N_FEATURES)

    return tensor
