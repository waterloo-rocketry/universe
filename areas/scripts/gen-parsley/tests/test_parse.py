from gen_parsley.errors import RocketCANError


def test_rocketcan_error_message_includes_path():
    err = RocketCANError("messages[2].field[0]", "missing key name")

    assert isinstance(err, ValueError)
    assert err.path == "messages[2].field[0]"
    assert str(err) == "messages[2].field[0]: missing key name"
