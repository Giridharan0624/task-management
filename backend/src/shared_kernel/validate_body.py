import json
from typing import Optional

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from shared_kernel.errors import ValidationError


def validate_body(model_class: type[BaseModel], body: Optional[str]) -> BaseModel:
    if not body:
        raise ValidationError("The request is missing required data. Please try again.")
    try:
        data = json.loads(body)
        return model_class(**data)
    except PydanticValidationError as e:
        raise ValidationError(str(e))
    except (json.JSONDecodeError, TypeError):
        raise ValidationError("The request data is not in the correct format. Please try again.")
