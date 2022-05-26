import os
import json
import time
import dateutil.parser
import datetime
import calendar
import traceback
from botocore.exceptions import ClientError

import boto3

def get_base_value_epoch_seconds(base_value):
    epoch_seconds = None
    base_value_float = None
    try:
        parsed = dateutil.parser.parse(base_value)
        epoch_seconds = int(parsed.strftime('%s'))
    except Exception as error:
        print(base_value + " is not an ISO8601 string: " + str(error))
    return epoch_seconds

def get_expiry(base_value, ttl_duration):
    expiry_ttl = None
    future = datetime.datetime.fromtimestamp(float(base_value)) + datetime.timedelta(days=int(ttl_duration))
    expiry_ttl = calendar.timegm(future.timetuple())
    return expiry_ttl

def update_item(table_name, key, ttl_attrib_name, ttl_attrib_value, client):
    status = False
    key_str = json.dumps(key)
    print("updating item " + key_str + " in table " + table_name)
    response = client.update_item(
        TableName=table_name,
        Key=key,
        ExpressionAttributeNames={
            '#ED': ttl_attrib_name
        },
        ExpressionAttributeValues={
            ':ed': {
                'N': str(ttl_attrib_value),
            }
        },
        ReturnValues='ALL_NEW',
        UpdateExpression='SET #ED = :ed'
    )

    if 'ResponseMetadata' in response:
        if 'HTTPStatusCode' in response['ResponseMetadata']:
            if response['ResponseMetadata']['HTTPStatusCode'] != 200:
                print("ERROR: error updating key " + key_str)
                status = False
            else:
                print("+ Successfully updated " + key_str)
                status = True
        else:
            print("ERROR: No http status code in response when trying to update " + key_str)
            status = False
    else:
        print("ERROR: No response metadata when trying to update " + key_str)
        status = False

    return status


def lambda_handler(event, context):
    status = True
    do_update = False
    table_name = None
    master_attribute_value = None
    master_attribute = "request_time"
    ttl_attribute_name = "request_ttl"
    time_to_live_days = "1"

    session = boto3.session.Session()
    region = session.region_name
    ses_client = boto3.client("ses", region_name=region)
    CHARSET = "UTF-8"
    sns_client = boto3.client('sns')
    cloudfrontURL = os.environ['cloudfront_url']
    ses_email = os.environ['ses_email']

    for record in event['Records']:
        if record["eventName"] == 'MODIFY' and record["dynamodb"]["NewImage"]["request_status"]["S"] == 'Approved':
            try:
                reviewer = record["dynamodb"]["NewImage"]["reviewer"]["S"]
                expiration_time = record["dynamodb"]["NewImage"]["expiration_time"]["S"]
                requester = record["dynamodb"]["NewImage"]["requester"]["S"]
                request_account = record["dynamodb"]["NewImage"]["request_account"]["S"]
                request_time = record["dynamodb"]["NewImage"]["request_time"]["S"]
                request_role = record["dynamodb"]["NewImage"]["request_role"]["S"]
                request_duration = record["dynamodb"]["NewImage"]["request_duration"]["S"]
                ses_client.send_email(
                    Destination={
                        "ToAddresses": [
                            requester,
                        ],
                    },
                    Message={
                        "Body": {
                            "Text": {
                                "Charset": CHARSET,
                                "Data": "The following privileged access request has been APPROVED by {}:\n\nSubmitted (UTC): {}\nAccount: {}\nRole: {}\nDuration: {}\n\nYour elevated access will expire on {} UTC. You can obtain temporary security credentials for your approved elevation by accessing your request dashboard: {}".format(
                                    reviewer,
                                    request_time,
                                    request_account,
                                    request_role,
                                    request_duration,
                                    expiration_time,
                                    cloudfrontURL,
                                ),
                            }
                        },
                        "Subject": {
                            "Charset": CHARSET,
                            "Data": "Your privileged access request has been APPROVED",
                        },  
                    },
                    Source=ses_email,
                )
            except Exception as error:
                print("Unexpected error while processing DynamoDB record:", error)
                pass
        if record["eventName"] == 'MODIFY' and record["dynamodb"]["NewImage"]["request_status"]["S"] == 'Rejected':
            try:
                reviewer = record["dynamodb"]["NewImage"]["reviewer"]["S"]
                requester = record["dynamodb"]["NewImage"]["requester"]["S"]
                request_account = record["dynamodb"]["NewImage"]["request_account"]["S"]
                request_time = record["dynamodb"]["NewImage"]["request_time"]["S"]
                request_role = record["dynamodb"]["NewImage"]["request_role"]["S"]
                request_duration = record["dynamodb"]["NewImage"]["request_duration"]["S"]
                ses_client.send_email(
                    Destination={
                        "ToAddresses": [
                            requester,
                        ],
                    },
                    Message={
                        "Body": {
                            "Text": {
                                "Charset": CHARSET,
                                "Data": "The following privileged access request has been REJECTED by {}:\n\nSubmitted (UTC): {}\nAccount: {}\nRole: {}\nDuration: {}\n\nPlease visit your request dashboard to submit a new request: {}".format(
                                    reviewer,
                                    request_time,
                                    request_account,
                                    request_role,
                                    request_duration,
                                    cloudfrontURL,
                                ),
                            }
                        },
                        "Subject": {
                            "Charset": CHARSET,
                            "Data": "Your privileged access request has been REJECTED",
                        },
                    },
                    Source=ses_email,
                )
            except Exception as error:
                print("Unexpected error while processing DynamoDB record:", error)
                pass          
        if record['eventName'] == 'INSERT':
            try:
                table_name = record["eventSourceARN"].split("/")[1]
                requester = record["dynamodb"]["NewImage"]["requester"]["S"]
                request_account = record["dynamodb"]["NewImage"]["request_account"]["S"]
                request_time = record["dynamodb"]["NewImage"]["request_time"]["S"]
                request_role = record["dynamodb"]["NewImage"]["request_role"]["S"]
                request_duration = record["dynamodb"]["NewImage"]["request_duration"]["S"]
                request_justification = record["dynamodb"]["NewImage"]["request_justification"]["S"]
            except Exception as error:
                print("Unexpected error while processing DynamoDB record:", error)
                pass
            print("New INSERT into table " + table_name + " detected - adding TTL if not already present")
            if ttl_attribute_name not in record["dynamodb"]["NewImage"]:
                print("no TTL attribute name " + ttl_attribute_name + " found - computing and adding")
                if master_attribute not in record["dynamodb"]["NewImage"]:
                    print("ERROR: The master attribute " + master_attribute + " to base the TTL on does not exist")
                else:
                    print("Computing a new TTL based on the value in " + master_attribute + " that is " + str(time_to_live_days) + " days in the future")
                    if 'S' in record["dynamodb"]["NewImage"][master_attribute]:
                        master_attribute_value = record["dynamodb"]["NewImage"][master_attribute]['S']
                    elif 'N' in record["dynamodb"]["NewImage"][master_attribute]:
                        master_attribute_value = record["dynamodb"]["NewImage"][master_attribute]['N']
                    else:
                        print("ERROR: Unknown attribute type for the master attribute. Unable to continue")
                        status = False

                    if master_attribute_value:
                        print("Found a " + master_attribute + " value of " + master_attribute_value)
                        master_epoch_seconds = get_base_value_epoch_seconds(master_attribute_value)

                        if master_epoch_seconds:
                            ttl_value = get_expiry(master_epoch_seconds, time_to_live_days)
                            print("The TTL value is " + str(ttl_value))

                            table_key = record['dynamodb']['Keys']
                            do_update = True
                        else:
                            print("ERROR: Unable to obtain the original timestamp attribute value to compute a TTL")
                            status = False
                try:
                    sns_client.publish(
                        TopicArn=os.environ["topic_arn"],
                        Message="The following privileged access request is awaiting approval:\n\nSubmitted (UTC): {}\nRequester: {}\nAccount: {}\nRole: {}\nDuration: {}\nJustification: {}\n\nIf no action is taken, the request will automatically expire after 24 hours. Approve or reject the request: {}".format(
                            request_time,
                            requester,
                            request_account,
                            request_role,
                            request_duration,
                            request_justification,
                            cloudfrontURL,
                        ),
                        Subject="Privileged Access request for " + requester,
                    )
                except Exception as error:
                    print("Unexpected SNS error:", error)
                    pass
            else:
                print("TTL already present - no update required")

        if do_update:
            session = boto3.session.Session(region_name=record['awsRegion'])
            dynamodb_client = session.client('dynamodb')

            if update_item(table_name, table_key, ttl_attribute_name, ttl_value, dynamodb_client):
                status = True
            else:
                status = False

        return status
