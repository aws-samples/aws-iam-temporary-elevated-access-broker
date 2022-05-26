import {combineReducers, Reducer} from 'redux';
import {History} from 'history';
import {connectRouter} from 'connected-react-router';
import {ReduxState} from '../../interfaces';
import {ActionTypes} from "../actions";

let initialState: ReduxState = {
  userInfo: {
    token: "",
    user: "",

    requester: false,
    reviewer: false,
    auditor: false,

    accountMap: new Map([])
  }
};

export const BreakGlassReducer: Reducer<ReduxState> = (state = initialState, action) => {

  switch(action.type) {
    case ActionTypes.STORE_USER_INFO: {
      return {
        ...state,
        userInfo: action.userInfo
      };
    }

  }
  return state;
};

const createRootReducer = (history: History) => combineReducers({
  router: connectRouter(history),
  breakGlassReducerState: BreakGlassReducer
});

export default createRootReducer;
export type RootState = ReturnType<typeof createRootReducer>;