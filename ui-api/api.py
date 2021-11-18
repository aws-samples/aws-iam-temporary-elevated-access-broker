import json, urllib, sys
import requests
import jwt
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
import boto3
import logging
import traceback
from datetime import datetime, timedelta
import time
import os
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
import argparse

patch_all()

def enable_logging():
    root = logging.getLogger()
    if root.handlers:
        for handler in root.handlers:
            root.removeHandler(handler)
    logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)

enable_logging()

def deep_get(d, keys, default=None):
    assert type(keys) is list
    if d is None:
        return default
    if not keys:
        return d
    return deep_get(d.get(keys[0]), keys[1:], default)

def cors_headers():
    return {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,HEAD,PUT,DELETE,PATCH'
    }


# ********** Query METHODS ************#

def lambda_handler(event, context):
    logging.debug("HTTP OPTIONS: Returning CORS Headers")
    return {
        'headers': {
            "Access-Control-Allow-Origin": '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,HEAD,PUT,DELETE,PATCH'
        },
        'statusCode': 200,
        'body': json.dumps('Returning CORS Headers')
    }

def get_requests(event, context):
    loader = DatabaseLoader()
    return loader.get_requests(event, context)

def get_pending_requests(event, context):
    loader = DatabaseLoader()
    return loader.get_pending_requests(event, context)

def get_processed_requests(event, context):
    loader = DatabaseLoader()
    return loader.get_processed_requests(event, context)

def get_all_requests(event, context):
    loader = DatabaseLoader()
    return loader.get_all_requests(event, context)

def create_request(event, context):
    loader = DatabaseLoader()
    return loader.create_request(event, context)

def delete_request(event, context):
    loader = DatabaseLoader()
    return loader.delete_request(event, context)

def approve_request(event, context):
    loader = DatabaseLoader()
    return loader.approve_request(event, context)

def reject_request(event, context):
    loader = DatabaseLoader()
    return loader.reject_request(event, context)

def federate_console(event, context):
    loader = DatabaseLoader()
    return loader.federate_console(event, context)

def federate_cli(event, context):
    loader = DatabaseLoader()
    return loader.federate_cli(event, context)

class DatabaseLoader:

    def get_requests(self, event, context):
        result = ''
        status_code = 500
        requests = list()
        try:
            AuthHeader = event['headers']['Authorization']
            accessToken = AuthHeader[len('Bearer '):]
            accessTokenSplit = accessToken.split(' ', 1)[0]
            decodedToken = jwt.decode(accessTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            requester = decodedToken['sub']
            epochTimeNow = int(time.time()) 

            if requester:
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                now = datetime.now().strftime('%x %X')
                response = table.query(
                    IndexName='requester-index',
                    KeyConditionExpression=Key('requester').eq(requester),
                    ScanIndexForward=False
                )
                for item in response['Items']:
                    try:
                        if item['request_ttl'] < epochTimeNow:
                            item['request_status'] = "Expired"
                            table.put_item(Item=item)
                    except KeyError:
                        pass
                    if item['request_status'] == "Approved" and item['expiration_time'] <= now:
                        item['request_status'] = "Ended"
                        table.put_item(Item=item)     
                    request = Request(item)
                    requests.append(request)
                while 'LastEvaluatedKey' in response:
                    response = table.query(
                        IndexName='requester-index',
                        KeyConditionExpression=Key('requester').eq(requester),
                        ScanIndexForward=False,
                        ExclusiveStartKey=response['LastEvaluatedKey']
                    )
                    for item in response['Items']:   
                        try:
                            if item['request_ttl'] < epochTimeNow:
                                item['request_status'] = "Expired"
                                table.put_item(Item=item)
                        except KeyError:
                            pass
                        if item['request_status'] == "Approved" and item['expiration_time'] <= now:
                            item['request_status'] = "Ended"
                            table.put_item(Item=item)     
                        request = Request(item)
                        requests.append(request)
                result = [request.to_dict() for request in requests]
                status_code = 200
            else:
                result = "Error, incorrect post body"
                status_code = 400
        except Exception as error:
            print("Error running get requests", error)
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def get_pending_requests(self, event, context):
        result = ''
        status_code = 500
        requests = list()
        try:
            dynamodb = boto3.resource('dynamodb')
            dbname = os.environ['db_table']
            table = dynamodb.Table(dbname)
            AuthHeader = event['headers']['Authorization']
            idToken = AuthHeader[len('Bearer '):]
            idTokenSplit = idToken.split(' ', 1)[-1]
            decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            groups = decodedToken['groups']
            requester = decodedToken['email']
            reviewerGroup = os.environ['reviewer_group'] 
            epochTimeNow = int(time.time()) 
            if reviewerGroup in groups:
                response = table.query(
                    IndexName='request-status-index',
                    KeyConditionExpression=Key('request_status').eq('Requested'),
                    FilterExpression=Attr('request_ttl').gt(epochTimeNow),
                    ScanIndexForward=False
                    )
                for item in response['Items']:
                    request = Request(item)
                    requests.append(request)
                result = [request.to_dict() for request in requests]
                status_code = 200
            else:
                result = "The idToken for " + reviewer + " does not contain the " + reviewerGroup + " group"
                print(result)
                status_code = 400
        except Exception as error:
            print("Error running get pending requests", error)
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def get_processed_requests(self, event, context):
        result = ''
        status_code = 500
        requests = list()
        try:
            AuthHeader = event['headers']['Authorization']
            idToken = AuthHeader[len('Bearer '):]
            idTokenSplit = idToken.split(' ', 1)[-1]
            decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            groups = decodedToken['groups']
            reviewer = decodedToken['email']
            reviewerGroup = os.environ['reviewer_group'] 
            if reviewerGroup in groups:
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                scan_kwargs = {
                    'FilterExpression': Attr('request_status').ne('Requested') & Attr('request_status').ne('Expired')
                }
                done = False
                start_key = None
                while not done:
                    if start_key:
                        scan_kwargs['ExclusiveStartKey'] = start_key
                    response = table.scan(**scan_kwargs)
                    start_key = response.get('LastEvaluatedKey', None)
                    done = start_key is None
                for item in response['Items']:
                    request = Request(item)
                    requests.append(request)
                result = [request.to_dict() for request in requests]
                status_code = 200
            else:
                result = "The idToken for " + reviewer + " does not contain the " + reviewerGroup + " group"
                print(result)
                status_code = 400
        except Exception as error:
            print("Error running get processed requests", error)
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def get_all_requests(self, event, context):
        result = ''
        status_code = 500
        requests = list()
        try:
            dynamodb = boto3.resource('dynamodb')
            dbname = os.environ['db_table']
            table = dynamodb.Table(dbname)
            AuthHeader = event['headers']['Authorization']
            idToken = AuthHeader[len('Bearer '):]
            idTokenSplit = idToken.split(' ', 1)[-1]
            decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            reviewer = decodedToken['email']
            groups = decodedToken['groups']
            auditorGroup = os.environ['auditor_group'] 
            if auditorGroup in groups:
                epochTimeNow = int(time.time())
                scan_kwargs = {}
                done = False
                start_key = None
                while not done:
                    if start_key:
                        scan_kwargs['ExclusiveStartKey'] = start_key
                    response = table.scan(**scan_kwargs)
                    start_key = response.get('LastEvaluatedKey', None)
                    done = start_key is None
                for item in response['Items']:
                    request = Request(item)
                    requests.append(request)
                result = [request.to_dict() for request in requests]
                status_code = 200
            else:
                result = "The idToken for " + reviewer + " does not contain the " + auditorGroup + " group"
                print(result)
                status_code = 400
        except Exception as error:
            print("Error running get all requests", error)
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def create_request(self, event, context):
        result = ''
        status_code = 500
        try:
            input_body = event.get("body")
            if input_body:
                json_param = json.loads(input_body)
                AuthHeader = event['headers']['Authorization']
                accessToken = AuthHeader[len('Bearer '):]
                accessTokenSplit = accessToken.split(' ', 1)[0]
                decodedToken = jwt.decode(accessTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
                requester = decodedToken['sub']
                request_account = json_param["request_account"]
                request_role = json_param["request_role"]
                request_duration = json_param["request_duration"]
                request_justification = json_param["request_justification"]
                request_time = datetime.now().strftime('%x %X')
                id = requester + '#' + request_account + '#' + request_role + '#' + str(request_time)
                request = {
                    'id': id,
                    'requester': requester,
                    'request_account': request_account,
                    'request_role': request_role,
                    'request_duration': request_duration,
                    'request_justification': request_justification,
                    'request_status': 'Requested',
                    'request_time': request_time,
                    'expiration_time': '',
                    'review_time': '',
                    'reviewer': ''
                }
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                table.put_item(Item=request)
                status_code = 200
            else:
                result = "Error, incorrect post body"
                status_code = 400
        except Exception as error:
            print("Error running create request " + str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def approve_request(self, event, context):
        result = ''
        status_code = 500
        try:
            input_body = event.get("body")
            if input_body:
                json_param = json.loads(input_body)
                id = json_param["id"]
                request_time = json_param["request_time"]
                request_duration = json_param["request_duration"]
                AuthHeader = event['headers']['Authorization']
                idToken = AuthHeader[len('Bearer '):]
                idTokenSplit = idToken.split(' ', 1)[-1]
                decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
                reviewer = decodedToken['email']
                groups = decodedToken['groups']
                reviewerGroup = os.environ['reviewer_group'] 
                now = datetime.now().strftime('%x %X')
                epochTimeNow = int(time.time()) 
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                print("Approve request initiated by " + reviewer + " for the following id: " + id)
                if reviewerGroup in groups:
                    print("Verified that the idToken for " + reviewer + " contains the " + reviewerGroup + " group")
                    try:
                        table.update_item(
                            Key={
                                'id': id,
                                'request_time': request_time
                            },
                            UpdateExpression="set request_status=:v1, expiration_time=:v2, review_time=:v3, reviewer=:v4 REMOVE request_ttl",
                            ConditionExpression="requester <> :v4 AND request_ttl > :v5",
                            ExpressionAttributeValues={
                                ':v1': 'Approved',
                                ':v2': (datetime.strptime(now, '%x %X') + timedelta(minutes=int(request_duration))).strftime('%x %X'),
                                ':v3': datetime.now().strftime('%x %X'),
                                ':v4': reviewer,
                                ':v5': epochTimeNow
                            },
                            ReturnValues="UPDATED_NEW"
                        )
                        status_code = 200
                    except ClientError as e:
                        if e.response['Error']['Code']=='ConditionalCheckFailedException':  
                            result = "Users can not review (approve/reject) their own requests"
                            print(result)
                            status_code = 400
                else:
                    result = "The idToken for " + reviewer + " does not contain the " + reviewerGroup + " group"
                    print(result)
                    status_code = 400
            else:
                result = "Error, incorrect post body"
                status_code = 400
        except Exception as error:
            print("Error running approve request " + str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def reject_request(self, event, context):
        result = ''
        status_code = 500
        try:
            input_body = event.get("body")
            if input_body:
                json_param = json.loads(input_body)
                id = json_param["id"]
                request_time = json_param["request_time"]
                AuthHeader = event['headers']['Authorization']
                idToken = AuthHeader[len('Bearer '):]
                idTokenSplit = idToken.split(' ', 1)[-1]
                decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
                reviewer = decodedToken['email']
                groups = decodedToken['groups']
                reviewerGroup = os.environ['reviewer_group'] 
                epochTimeNow = int(time.time())
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                print("Reject request initiated by " + reviewer + " for the following id: " + id)
                if reviewerGroup in groups:
                    print("Verified that the idToken for " + reviewer + " contains the " + reviewerGroup + " group")
                    try:
                        table.update_item(
                            Key={
                                'id': id,
                                'request_time': request_time
                            },
                            UpdateExpression="set request_status=:v1, review_time=:v2, reviewer=:v3 REMOVE request_ttl",
                            ConditionExpression="requester <> :v3 AND request_ttl > :v4",
                            ExpressionAttributeValues={
                                ':v1': 'Rejected',
                                ':v2': datetime.now().strftime('%x %X'),
                                ':v3': reviewer,
                                ':v4': epochTimeNow
                            },
                            ReturnValues="UPDATED_NEW"
                        )
                        status_code = 200
                    except ClientError as e:
                        if e.response['Error']['Code']=='ConditionalCheckFailedException':  
                            result = "Users can not review (approve/reject) their own requests"
                            print(result)
                            status_code = 400                
                else:
                    result = "The idToken for " + reviewer + " does not contain the " + reviewerGroup + " group"
                    print(result)
                    status_code = 400
            else:
                result = "Error, incorrect post body"
                status_code = 400
        except Exception as error:
            print("Error running reject request " + str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def delete_request(self, event, context):
        result = ''
        status_code = 500
        try:
            input_body = event.get("body")
            AuthHeader = event['headers']['Authorization']
            accessToken = AuthHeader[len('Bearer '):]
            accessTokenSplit = accessToken.split(' ', 1)[0]
            decodedToken = jwt.decode(accessTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            requester = decodedToken['sub']
            if input_body:
                try:
                    json_param = json.loads(input_body)
                    id = json_param["id"]
                    request_time = json_param["request_time"]
                    dynamodb = boto3.resource('dynamodb')
                    dbname = os.environ['db_table']
                    table = dynamodb.Table(dbname)
                    print("Delete request initiated by " + requester + " for the following id: " + id)
                    response = table.delete_item(
                        Key={
                            'id': id,
                            'request_time': request_time
                        },
                        ConditionExpression="(requester = :v1) AND (request_status IN (:v2, :v3))",
                        ExpressionAttributeValues={':v1': requester, ':v2': 'Requested', ':v3': 'Expired'}
                    )
                    status_code = 200
                except ClientError as e:
                    if e.response['Error']['Code']=='ConditionalCheckFailedException':  
                        result = "Delete operation is only permitted if you own the request and it is in REQUESTED or EXPIRED status"
                        print(result)
                        status_code = 400
            else:
                result = "Error, incorrect post body"
                print(result)
                status_code = 400
        except Exception as error:
            print("Error running delete request " + str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def federate_console(self, event, context):
        result = ''
        status_code = 500
        try:
            account = deep_get(event, ["queryStringParameters", "account"])
            role = deep_get(event, ["queryStringParameters", "role"])
            AuthHeader = event['headers']['Authorization']
            idToken = AuthHeader[len('Bearer '):]
            idTokenSplit = idToken.split(' ', 1)[-1]
            decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            requester = decodedToken['email']
            print("Elevation request initiated by " +  requester + " for Account:" + account + " Role:" + role)
            groups = decodedToken['groups']
            print("idToken for " + requester + " contains the following groups " + str(groups))
            SearchPrefix = os.environ['search_prefix']
            groups = [x for x in groups if x.startswith(SearchPrefix)]
            veryifymembership = [element for element in groups if account in element and role in element] 
            if not veryifymembership:
                result = "The idToken for " + requester + " does not contain the requested elevation group"
                print(result)
                status_code = 400
            elif account and role and veryifymembership:
                print("Verified that the idToken for " + requester + " contained the requested elevation group - Proceeding to DynamoDB verification...")
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                now = datetime.now().strftime('%x %X')
                response = table.query(
                    IndexName='request-status-index',
                    KeyConditionExpression=Key('request_status').eq('Approved'),
                    FilterExpression=Attr('request_account').eq(account) & Attr('request_role').eq(role) & Attr('requester').eq(requester) & Attr('expiration_time').gte(now),
                    ScanIndexForward=False
                )
                items = response['Items']
                if items:
                    print("Confirmed there is an approved active elevation request for " + requester + " - Initializing STS request for console access...")
                    sts_connection = boto3.client('sts')
                    assumed_role_object = sts_connection.assume_role(
                        RoleArn="arn:aws:iam::" + account + ":role/" + role,
                        RoleSessionName= requester + "-" + role,
                        )
                    url_credentials = {}
                    url_credentials['sessionId'] = assumed_role_object.get('Credentials').get('AccessKeyId')
                    url_credentials['sessionKey'] = assumed_role_object.get('Credentials').get('SecretAccessKey')
                    url_credentials['sessionToken'] = assumed_role_object.get('Credentials').get('SessionToken')
                    json_string_with_temp_credentials = json.dumps(url_credentials)
                    request_parameters = "?Action=getSigninToken"
                    if sys.version_info[0] < 3:
                        def quote_plus_function(s):
                            return urllib.quote_plus(s)
                    else:
                        def quote_plus_function(s):
                            return urllib.parse.quote_plus(s)
                    request_parameters += "&Session="
                    request_parameters += quote_plus_function(json_string_with_temp_credentials)
                    request_url = "https://signin.aws.amazon.com/federation"
                    request_url += request_parameters
                    r = requests.get(request_url)
                    sign_in_token = json.loads(r.text)["SigninToken"]
                    request_parameters = "?Action=login" 
                    request_parameters += "&Issuer=" 
                    request_parameters += "&Destination=" + quote_plus_function("https://console.aws.amazon.com/")
                    request_parameters += "&SigninToken=" + sign_in_token
                    request_url = "https://signin.aws.amazon.com/federation" + request_parameters
                    result = request_url
                    status_code = 200
                else:
                    result = "Unable to find an approved active elevation request for " + requester
                    print(result)
                    status_code = 400
            else:
                result = "Error, incorrect query parameters"
                print(result)
                status_code = 400
        except Exception as error:
            print(str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

    def federate_cli(self, event, context):
        result = ''
        status_code = 500
        try:
            account = deep_get(event, ["queryStringParameters", "account"])
            role = deep_get(event, ["queryStringParameters", "role"])
            AuthHeader = event['headers']['Authorization']
            idToken = AuthHeader[len('Bearer '):]
            idTokenSplit = idToken.split(' ', 1)[-1]
            decodedToken = jwt.decode(idTokenSplit, algorithms=["RS256"], options={"verify_signature": False})
            requester = decodedToken['email']
            print("Elevation request initiated by " +  requester + " for Account:" + account + " Role:" + role)
            groups = decodedToken['groups']
            print("idToken for " + requester + " contains the following groups " + str(groups))
            SearchPrefix = os.environ['search_prefix']
            groups = [x for x in groups if x.startswith(SearchPrefix)]
            veryifymembership = [element for element in groups if account in element and role in element] 
            if not veryifymembership:
                result = "The idToken for " + requester + " does not contain the requested elevation group"
                print(result)
                status_code = 400
            elif account and role and veryifymembership:
                print("Verified that the idToken for " + requester + " contained the requested elevation group - Proceeding to DynamoDB verification...")
                dynamodb = boto3.resource('dynamodb')
                dbname = os.environ['db_table']
                table = dynamodb.Table(dbname)
                now = datetime.now().strftime('%x %X')
                response = table.query(
                    IndexName='request-status-index',
                    KeyConditionExpression=Key('request_status').eq('Approved'),
                    FilterExpression=Attr('request_account').eq(account) & Attr('request_role').eq(role) & Attr('requester').eq(requester) & Attr('expiration_time').gte(now),
                    ScanIndexForward=False
                )
                items = response['Items']
                if items:
                    print("Confirmed there is an approved active elevation request for " + requester + " - Initializing STS request for CLI credentials...")
                    sts_connection = boto3.client('sts')
                    assumed_role_object = sts_connection.assume_role(
                        RoleArn="arn:aws:iam::" + account + ":role/" + role,
                        RoleSessionName= requester + "-" + role,
                        )
                    cli_credentials = {}
                    cli_credentials['sessionId'] = assumed_role_object.get('Credentials').get('AccessKeyId')
                    cli_credentials['sessionKey'] = assumed_role_object.get('Credentials').get('SecretAccessKey')
                    cli_credentials['sessionToken'] = assumed_role_object.get('Credentials').get('SessionToken')
                    credentials = Credentials(cli_credentials['sessionId'], cli_credentials['sessionKey'], cli_credentials['sessionToken'])
                    result = credentials.cli()
                    status_code = 200
                else:
                    result = "Unable to find an approved active elevation request for " + requester
                    print(result)
                    status_code = 400
            else:
                result = "Error, incorrect query parameters"
                print(result)
                status_code = 400
        except Exception as error:
            print(str(error))
            traceback.print_exc()
            result = str(error)
        response = {
            "statusCode": status_code,
            'headers': cors_headers(),
            "body": json.dumps(result, indent=2, sort_keys=True, default=str)
        }
        return response

class Request:
    """
    It represents a request.
    """
    def __init__(self,
                 record):
        """
        Initializes the Request from the database record.

        :param record:   The database record.
        """
        self.id = record.get('id', 0)
        self.requester = record.get('requester', '')
        self.request_account = record.get('request_account', '')
        self.request_role = record.get('request_role', '')
        self.request_duration = record.get('request_duration', 0)
        self.request_justification = record.get('request_justification', '')
        self.request_status = record.get('request_status', '')
        self.request_time = record.get('request_time', '')
        self.expiration_time = record.get('expiration_time', '')
        self.review_time = record.get('review_time', '')
        self.reviewer = record.get('reviewer', '')

    def to_dict(self):
        return {
            'id': self.id,
            'requester': self.requester,
            'request_account': self.request_account,
            'request_role': self.request_role,
            'request_duration': self.request_duration,
            'request_justification': self.request_justification,
            'request_status': self.request_status,
            'request_time': self.request_time,
            'expiration_time': self.expiration_time,
            'review_time': self.review_time,
            'reviewer': self.reviewer
        }

    def format_date2(self, value):
        if value == '':
            return ''
        else:
            date_value = datetime.strptime(value, '%Y-%m-%d %H:%M:%S.%f')
            return date_value.strftime('%x %X')

class Credentials:

    def __init__(self, AccessKeyId, SecretAccessKey, SessionToken):
        self.AccessKeyId = AccessKeyId
        self.SecretAccessKey = SecretAccessKey
        self.SessionToken = SessionToken

    def cli(self):
        return {
            'accessKeyId': self.AccessKeyId,
            'secretAccessKey': self.SecretAccessKey,
            'sessionToken': self.SessionToken
        }

def invoke_command(cmd):

    params = {"queryStringParameters": {}}
    response = get_pending_requests(params, None)
    print(response)

def dispatch_command():
    """
    Dispatches the command based on command line parameters.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--cmd", help="Enter one of the commands: Y2D (yaml to database), Y2S (yaml to service), D2S (database to service)")
    args = parser.parse_args()

    invoke_command(args.cmd)


if __name__ == "__main__":
    dispatch_command()
