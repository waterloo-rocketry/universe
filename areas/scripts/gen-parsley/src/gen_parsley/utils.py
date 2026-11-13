def snake_to_title_case(s: str) -> str:
    """convert snake_case string to Title Case"""
    return " ".join(w.title() for w in s.split("_"))

