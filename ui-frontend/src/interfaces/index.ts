import { RouterState } from 'connected-react-router';

export interface IRequest {
  id?: string;
  requester?: string;
  request_account?: string;
  request_role?: string;
  request_duration?: string;
  request_justification?: string;
  request_status?: string;
  request_time?: string;
  expiration_time?: string;
  review_time?: string;
  reviewer?: string;
  request_url?: string;
}

export interface ICredential {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export interface IError {
  Code?: string;
  Message?: string;
}

export interface IUserInfo {
  token: string;
  user: string;

  requester: boolean;
  reviewer: boolean;
  auditor: boolean;

  accountMap: Map<any, any>;
}

export interface ReduxState {
  userInfo: IUserInfo;
}

export interface ReduxRoot {
  router: RouterState;
  breakGlassReducerState: ReduxState;
}