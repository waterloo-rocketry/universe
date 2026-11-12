class RocketCANError(ValueError):
    """Raised when RocketCAN input data is invalid. The message includes the path to the bad value."""

    def __init__(self, path: str, message: str):
        self.path = path
        self.message = message
        super().__init__(f"{path}: {message}")
