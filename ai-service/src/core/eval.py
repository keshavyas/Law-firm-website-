def evaluate(original: str, summary: str) -> dict:
    original_len = len(original)
    summary_len = len(summary)
    ratio = summary_len / original_len if original_len > 0 else 0
    return {
        "original_length": original_len,
        "summary_length": summary_len,
        "compression_ratio": round(ratio, 2)
    }
