import {
    IUserInfo
} from '../../interfaces';

export enum ActionTypes {

    STORE_USER_INFO = "STORE_USER_INFO"
}

export const storeUserInfoAction = (userInfo:IUserInfo) => (
    { type: ActionTypes.STORE_USER_INFO, userInfo })
