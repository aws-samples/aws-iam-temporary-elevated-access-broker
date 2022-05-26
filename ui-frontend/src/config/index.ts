
export const BG_ENDPOINTS = {
    ApiKey: '<ApiKey>', // NOTE: Replace with your API Gateway key value
    Endpoint: 'https://<CloudFrontURL>/<APIStage>', // NOTE: Replace with the URL of your CloudFront distribution and API stage
    Resources : ['get_requests', 'get_pending_requests', 'get_processed_requests', 'get_all_requests', 'create_request', 'delete_request', 'approve_request', 'reject_request', 'federate_console', 'federate_cli']
};