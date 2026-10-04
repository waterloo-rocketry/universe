import pytest
from pydantic import ValidationError

from parsley.parsley_message import ParsleyObject, ParsleyError

def test_parsley_error_getitem():
    err = ParsleyError(
        msg_prio='HIGH',
        board_type_id='ANY',
        board_inst_id='GROUND',
        msg_type='RESET_CMD',
        msg_metadata=0,
        msg_data='deadbeef',
        error='something went wrong'
    )

    assert err['msg_prio'] == 'HIGH'
    assert err['board_type_id'] == 'ANY'
    assert err['board_inst_id'] == 'GROUND'
    assert err['msg_type'] == 'RESET_CMD'
    assert err['msg_metadata'] == 0
    assert err['msg_data'] == 'deadbeef'
    assert err['error'] == 'something went wrong'


def test_parsley_object_getitem():
    obj = ParsleyObject(
        board_type_id='ANY',
        board_inst_id='GROUND',
        msg_prio='HIGH',
        msg_type='RESET_CMD',
        msg_metadata=0,
        data={}
    )

    assert obj['board_type_id'] == 'ANY'
    assert obj['board_inst_id'] == 'GROUND'
    assert obj['msg_prio'] == 'HIGH'
    assert obj['msg_type'] == 'RESET_CMD'
    assert obj['msg_metadata'] == 0
    assert obj['data'] == {}


def test_parsley_object_unknown_prio_raises():
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='ANY',
            board_inst_id='GROUND',
            msg_prio='0x03',
            msg_type='RESET_CMD',
            msg_metadata=0,
            data={}
        )


def test_parsley_object_metadata_string_must_match_msg_type_enum():
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='LOGGER',
            board_inst_id='ROCKET',
            msg_prio='LOW',
            msg_type='SENSOR_ANALOG16',
            msg_metadata='ACTUATOR_OX_INJECTOR_VALVE',
            data={'time': 0.0, 'value': 0},
        )


def test_parsley_object_metadata_string_rejected_for_numeric_msg_type():
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='ANY',
            board_inst_id='GROUND',
            msg_prio='HIGH',
            msg_type='RESET_CMD',
            msg_metadata='SENSOR_PT_CHANNEL_1',
            data={}
        )


def test_parsley_object_metadata_int_always_allowed_in_range():
    obj = ParsleyObject(
        board_type_id='LOGGER',
        board_inst_id='ROCKET',
        msg_prio='LOW',
        msg_type='SENSOR_ANALOG16',
        msg_metadata=250,
        data={'time': 0.0, 'value': 0},
    )
    assert obj['msg_metadata'] == 250


def test_parsley_object_metadata_string_matching_enum_accepted():
    obj = ParsleyObject(
        board_type_id='LOGGER',
        board_inst_id='ROCKET',
        msg_prio='LOW',
        msg_type='SENSOR_ANALOG16',
        msg_metadata='SENSOR_PT_CHANNEL_1',
        data={'time': 0.0, 'value': 0},
    )
    assert obj['msg_metadata'] == 'SENSOR_PT_CHANNEL_1'


def test_parsley_object_empty_prio_raises():
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='ANY',
            board_inst_id='GROUND',
            msg_prio='',
            msg_type='RESET_CMD',
            msg_metadata=0,
            data={}
        )


def test_parsley_object_metadata_boundary():
    # 0 and 255 are valid (8-bit field), 256 is not
    ParsleyObject(board_type_id='ANY', board_inst_id='GROUND', msg_prio='HIGH', msg_type='RESET_CMD', msg_metadata=0, data={})
    ParsleyObject(board_type_id='ANY', board_inst_id='GROUND', msg_prio='HIGH', msg_type='RESET_CMD', msg_metadata=255, data={})
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='ANY',
            board_inst_id='GROUND',
            msg_prio='HIGH',
            msg_type='RESET_CMD',
            msg_metadata=256,
            data={}
        )


def test_parsley_object_invalid_type_raises():
    with pytest.raises(ValidationError):
        ParsleyObject(
            board_type_id='ANY',
            board_inst_id='GROUND',
            msg_prio='HIGH',
            msg_type='BAD_TYPE',
            msg_metadata=0,
            data={}
        )
