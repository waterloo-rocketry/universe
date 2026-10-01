from dataclasses import dataclass, asdict
from typing import Generic, TypeVar
from pydantic import BaseModel, field_validator, model_validator
import parsley.message_types as mt
from parsley.message_definitions import CAN_MESSAGE
from parsley.fields import Enum as _Enum

T = TypeVar("T")

BoardTypeID = str
BoardInstID = str
MsgPrio = str
MsgType = str
MsgMetadata = int | str

@dataclass
class ParsleyError():
    """Custom error container for Parsley errors."""
    msg_prio: MsgPrio
    board_type_id: BoardTypeID
    board_inst_id: BoardInstID
    msg_type: MsgType
    msg_metadata: MsgMetadata
    msg_data: str
    error: str

    def __getitem__(self, key: str):
        return asdict(self)[key]
    
class ParsleyObject(BaseModel, Generic[T]):
    """
    Dataclass to store parsed CAN message data.
    """

    board_type_id: BoardTypeID
    board_inst_id: BoardInstID
    msg_prio: MsgPrio
    msg_type: MsgType
    msg_metadata: MsgMetadata
    data: T # ParsleyDataType

    @field_validator("msg_prio")
    def validate_msg_prio(cls, value: str) -> str:
        if value not in mt.msg_prio:
            raise ValueError(
                f"Invalid msg_prio '{value}' (expected one of {list(mt.msg_prio)})"
            )
        return value

    @field_validator("msg_type")
    def validate_msg_type(cls, value: str) -> str:
        if value not in mt.msg_type:
            raise ValueError(f"Invalid msg_type type '{value}'")
        return value

    @field_validator("msg_metadata")
    def validate_msg_metadata(cls, value: int | str) -> int | str:
        if type(value) is int:
            if not (0 <= value <= 255):
                raise ValueError(f"msg_metadata '{value}' is out of range (0-255)")
        elif isinstance(value, str):
            if len(value) == 0:
                raise ValueError('msg_metadata string must be non-empty')
        else:
            raise ValueError('msg_metadata must be int or str')
        return value

    @model_validator(mode='after')
    def validate_msg_metadata_against_msg_type(self):
        if isinstance(self.msg_metadata, str):
            metadata_field = CAN_MESSAGE.get_fields(self.msg_type)[3]
            if not isinstance(metadata_field, _Enum):
                raise ValueError(
                    f"msg_metadata is a string ('{self.msg_metadata}') but msg_type "
                    f"'{self.msg_type}' uses a numeric metadata byte"
                )
            if self.msg_metadata not in metadata_field.map_key_val:
                raise ValueError(
                    f"msg_metadata '{self.msg_metadata}' is not a valid key for "
                    f"msg_type '{self.msg_type}' "
                    f"(expected a name from {list(metadata_field.map_key_val.keys())[:3]}…)"
                )
        return self

    def __getitem__(self, key: str):
        return self.model_dump()[key]
