import json
from typing import Optional

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from shared.errors import ValidationError


def validate_body(model_class: type[BaseModel], body: Optional[str]) -> BaseModel:
    if not body:
        raise ValidationError("Request body is required")
    try:
        data = json.loads(body)
        return model_class(**data)
    except PydanticValidationError as e:
        raise ValidationError(str(e))
    except (json.JSONDecodeError, TypeError):
        raise ValidationError("Invalid JSON body")
