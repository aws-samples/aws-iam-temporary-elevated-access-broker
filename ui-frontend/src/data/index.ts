import ApiHandler, {ApiMethod} from '../common/api'
import {IRequest, ICredential} from '../interfaces/index'
import {BG_ENDPOINTS} from '../config/index'

export const api = new ApiHandler(
    BG_ENDPOINTS.Endpoint,
    BG_ENDPOINTS.ApiKey,
    BG_ENDPOINTS.Resources
);

export const getRequests = (token: string, user_params?:any) => api.get_authorized_resource<IRequest[]>(
    "get_requests", token, ApiMethod.GET,null,[])

export const getPendingRequests = (token: string, user_params?:any) => api.get_authorized_resource<IRequest[]>(
    "get_pending_requests", token, ApiMethod.GET,null,[])

export const getProcessedRequests = (token: string, user_params?:any) => api.get_authorized_resource<IRequest[]>(
    "get_processed_requests", token, ApiMethod.GET,null,[])

export const getAllRequests = (token: string, user_params?:any) => api.get_authorized_resource<IRequest[]>(
    "get_all_requests", token, ApiMethod.GET,null,[])

export const createRequest = (token: string, request_account:any, request_role:any, request_duration:any, request_justification:any, user_params?:any) => api.get_authorized_resource<any>(
    "create_request", token, ApiMethod.POST, {request_account: request_account, request_role: request_role, request_duration: request_duration, request_justification: request_justification}, [])

export const deleteRequest = (token: string, id:any, request_time:any, user_params?:any) => api.get_authorized_resource<any>(
    "delete_request", token, ApiMethod.POST, {id: id, request_time: request_time}, [])

export const approveRequest = (token: string, id:any, request_time:any, request_duration:any, reviewer:any, user_params?:any) => api.get_authorized_resource<any>(
    "approve_request", token, ApiMethod.POST, {id: id, request_time: request_time, request_duration: request_duration, reviewer: reviewer}, [])

export const rejectRequest = (token: string, id:any, request_time:any, reviewer:any, user_params?:any) => api.get_authorized_resource<any>(
    "reject_request", token, ApiMethod.POST, {id: id, request_time: request_time, reviewer: reviewer}, [])

export const updateRequestURL = (token: string, id:any, request_time:any, request_url:any, user_params?:any) => api.get_authorized_resource<any>(
    "update_request_url", token, ApiMethod.POST, {id: id, request_time: request_time, request_url: request_url}, [])

export const invokeFederateConsole = (token: string, account:any, role:any, user_params?:any) => api.get_authorized_resource<any>(
    "federate_console", token, ApiMethod.GET,null,[{key:"account", value:account}, {key:"role", value:role}])

export const invokeFederateCli = (token: string, account:any, role:any, user_params?:any) => api.get_authorized_resource<ICredential>(
    "federate_cli", token, ApiMethod.GET,null,[{key:"account", value:account}, {key:"role", value:role}])
