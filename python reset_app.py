# reset_app.py
import boto3

REGION = 'ap-south-1'
TABLE = 'TaskManagementTable'
POOL_ID = 'ap-south-1_72qWKeSH5'

table = boto3.resource('dynamodb', region_name=REGION).Table(TABLE)
cognito = boto3.client('cognito-idp', region_name=REGION)

# 1. Clean DynamoDB
response = table.scan()
items = response['Items']
while 'LastEvaluatedKey' in response:
    response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
    items.extend(response['Items'])

for item in items:
    if item.get('PK', '').startswith('USER#') and item.get('SK') == 'PROFILE' and item.get('system_role') == 'OWNER':
        continue
    table.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})

# 2. Clean Cognito
for user in cognito.list_users(UserPoolId=POOL_ID)['Users']:
    attrs = {a['Name']: a['Value'] for a in user['Attributes']}
    if attrs.get('custom:systemRole') != 'OWNER':
        cognito.admin_delete_user(UserPoolId=POOL_ID, Username=attrs['email'])

print('Done - fresh application!')
