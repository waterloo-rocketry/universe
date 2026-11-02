from parsley.fields import ASCII, Enum, Numeric, Switch, Bitfield

import parsley.message_types as mt

# returns data scaled in seconds (ie. reads raw data in milliseconds and outputs seconds)
TIMESTAMP_2 = Numeric('time', 16, scale=1/1000, unit='s')

MESSAGE_PRIO = Enum('msg_prio', 2, mt.msg_prio)
MESSAGE_TYPE = Enum('msg_type', 7, mt.msg_type)
BOARD_TYPE_ID = Enum('board_type_id', 6, mt.board_type_id)
BOARD_INST_ID = Enum('board_inst_id', 6, mt.board_inst_id)
MESSAGE_METADATA = Numeric('msg_metadata', 8)
MESSAGE_SID = Enum('msg_sid', MESSAGE_PRIO.length + MESSAGE_TYPE.length + BOARD_TYPE_ID.length + BOARD_INST_ID.length + MESSAGE_METADATA.length, {}) # used purely as a length constant

# we parse BOARD_ID seperately from the CAN message (since we want to continue parsing even if BOARD_ID throws)
# but BOARD_ID is still here so that Omnibus has all the fields it needs when creating messages to send
MESSAGES = {
    'GENERAL_BOARD_STATUS':  [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Bitfield('board_error_bitfield', 32, 'E_NOMINAL', mt.board_error_bitfield_offset)],
    'RESET_CMD':             [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Enum('target_board_type_id', 8, mt.board_type_id), Enum('target_board_inst_id', 8, mt.board_inst_id)],
    'DEBUG_RAW':             [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, ASCII('string', 48)],
    'CONFIG_SET':            [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Enum('target_board_type_id', 8, mt.board_type_id), Enum('target_board_inst_id', 8, mt.board_inst_id), Numeric('config_id', 16), Numeric('config_value', 16)],
    'CONFIG_STATUS':         [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('config_id', 16), Numeric('config_value', 16)],
    'ACTUATOR_CMD':          [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.actuator_id), TIMESTAMP_2, Enum('cmd_state', 8, mt.actuator_state)],
    'ACTUATOR_STATUS':       [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.actuator_id), TIMESTAMP_2, Enum('cmd_state', 8, mt.actuator_state), Enum('curr_state', 8, mt.actuator_state)],
    'ALT_ARM_CMD':           [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.altimeter_id), TIMESTAMP_2, Enum('alt_arm_state', 8, mt.alt_arm_state)],
    'ALT_ARM_STATUS':        [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.altimeter_id), TIMESTAMP_2, Enum('alt_arm_state', 8, mt.alt_arm_state), Numeric('drogue_v', 16), Numeric('main_v', 16)],
    'SENSOR_ANALOG16':       [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.analog_sensor_id), TIMESTAMP_2, Numeric('value', 16)],
    'SENSOR_ANALOG32':       [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.analog_sensor_id), TIMESTAMP_2, Numeric('value', 32)],
    'SENSOR_2D_ANALOG24':    [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.dem_2d_sensor_id), TIMESTAMP_2, Numeric('value_x', 24), Numeric('value_y', 24)],
    'SENSOR_3D_ANALOG16':    [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.dem_3d_sensor_id), TIMESTAMP_2, Numeric('value_x', 16), Numeric('value_y', 16), Numeric('value_z', 16)],
    'GPS_TIMESTAMP':         [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('hrs', 8), Numeric('mins', 8), Numeric('secs', 8), Numeric('dsecs', 8)],
    'GPS_LATITUDE':          [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('degs', 8), Numeric('mins', 8), Numeric('dmins', 16), ASCII('direction', 8)],
    'GPS_LONGITUDE':         [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('degs', 8), Numeric('mins', 8), Numeric('dmins', 16), ASCII('direction', 8)],
    'GPS_ALTITUDE':          [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('altitude', 32), Numeric('daltitude', 8)],
    'GPS_INFO':              [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('num_sats', 8), Numeric('quality', 8)],
    'STREAM_STATUS':         [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, Numeric('total_size', 24), Numeric('tx_size', 24)],
    'STREAM_DATA':           [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2, ASCII('data', 48)],
    'STREAM_RETRY':          [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA, TIMESTAMP_2],
    'TELEMETRY_INFO':        [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.board_inst_id), TIMESTAMP_2, Numeric('lqi', 8), Numeric('rssi', 8, signed=True)],
    'TELEMETRY_STATE_SWITCH':[MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('msg_metadata', 8, mt.board_inst_id), TIMESTAMP_2],
    'CANARD_FIRMWARE_ERROR': [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, Enum('module_id', 8, mt.canards_module_id), TIMESTAMP_2, Bitfield('error_bitfield', 32, 'E_NOMINAL', mt.canards_module_error_bitfield_offset), Enum('severity', 8, mt.canards_health_severity)],
    'LEDS_ON':               [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA],
    'LEDS_OFF':              [MESSAGE_PRIO, BOARD_TYPE_ID, BOARD_INST_ID, MESSAGE_METADATA]
}

# entire CAN message minus board_id
# board_id is parsed seperately because if it throws, we want to continue parsing
CAN_MESSAGE = Switch('msg_type', MESSAGE_TYPE.length, mt.msg_type, MESSAGES)
