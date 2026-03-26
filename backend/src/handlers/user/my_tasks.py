from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        board_repo = BoardDynamoRepository()
        task_repo = TaskDynamoRepository()

        # Get all boards user is a member of
        boards = board_repo.find_boards_for_user(auth.user_id)

        my_tasks = []
        for board in boards:
            tasks = task_repo.find_by_board(board.board_id)
            for task in tasks:
                if task.assigned_to == auth.user_id:
                    task_dict = task.to_dict()
                    task_dict["board_name"] = board.name
                    my_tasks.append(task_dict)

        return build_success(200, my_tasks)
    except Exception as e:
        return build_error(e)
