import {createStore, applyMiddleware, compose, Store} from 'redux';
import { createHashHistory } from 'history';
import {routerMiddleware} from 'connected-react-router';
import createRootReducer from './reducers';

export const history = createHashHistory({
    hashType: 'slash'
});

let store: Store;

export default function configureStore(preloadedState?: any) {
  const composeEnhancer: typeof compose = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  const connectedRouterMiddleware = routerMiddleware(history);
  const middlewares = [connectedRouterMiddleware];
  const newStore = createStore(
    createRootReducer(history),
    preloadedState,
    composeEnhancer(applyMiddleware(...middlewares))
  );

  store = newStore;
  // Hot reloading
  if ((module as any).hot) {
    (module as any).hot.accept('./reducers', () => {
      store.replaceReducer(createRootReducer(history));
    });
  }

  return newStore;
}