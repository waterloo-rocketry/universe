import pytest
import parsley

from parsley.bitstring import BitString
from parsley.fields import Enum, Numeric
from parsley.message_definitions import TIMESTAMP_2, CAN_MESSAGE

import parsley.message_types as mt
import utils as tu

class TestCANMetadata:
    # our TIMESTAMP_2 can store ~65.5 seconds
    def test_timestamp2(self):
        TIMESTAMP_2.encode(0)
        TIMESTAMP_2.encode(65)
        TIMESTAMP_2.encode(65.535)
        with pytest.raises(ValueError):
            TIMESTAMP_2.encode(-1)
        with pytest.raises(ValueError):
            TIMESTAMP_2.encode(65.536)
        with pytest.raises(ValueError):
            TIMESTAMP_2.encode(66)
        TIMESTAMP_2.encode(30.2312)

    def test_timestamp2_message(self):
        # Test that TIMESTAMP_2 is correctly parsed alongside other fields
        # Uses ALT_ARM_STATUS which has: TIMESTAMP_2, alt_arm_state, drogue_v, main_v
        msg_data = BitString()
        msg_data.push(*TIMESTAMP_2.encode(1.234))
        msg_data.push(*Enum('alt_arm_state', 8, mt.alt_arm_state).encode('ALT_ARM_STATE_ARMED'))
        msg_data.push(*Numeric('drogue_v', 16).encode(1234))
        msg_data.push(*Numeric('main_v', 16).encode(5678))

        res = parsley.parse_fields(msg_data, CAN_MESSAGE.get_fields('ALT_ARM_STATUS')[4:])
        assert res['time'] == tu.approx(1.234)
        assert res['alt_arm_state'] == 'ALT_ARM_STATE_ARMED'
        assert res['drogue_v'] == 1234
        assert res['main_v'] == 5678
