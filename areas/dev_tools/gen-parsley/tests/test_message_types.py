from gen_parsley.gen_ts import message_types
from gen_parsley.models import Bitfield, BitfieldBit, Enum, EnumValue, RocketCAN, SID


def test_render_uses_explicit_enum_values_and_bit_positions():
    data = RocketCAN(
        sid=SID(),
        message_fields=[],
        messages=[],
        enums=[Enum(name="state", prefix="STATE", value=[
            EnumValue(name="HIGH", id=9),
            EnumValue(name="LOW", id=2),
        ])],
        bitfields=[Bitfield(name="flags", prefix="FLAG", bits=[
            BitfieldBit(name="HIGH", bit=7),
            BitfieldBit(name="LOW", bit=1),
        ])],
    )

    result = message_types.render(data)

    assert "STATE_HIGH: 0x09" in result
    assert "STATE_LOW: 0x02" in result
    assert "FLAG_HIGH: 0x07" in result
    assert "FLAG_LOW: 0x01" in result
