import os

import boto3

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
TABLE_NAME = os.environ.get("TABLE_NAME", "TaskManagementTable")


def get_table():
    return dynamodb.Table(TABLE_NAME)
