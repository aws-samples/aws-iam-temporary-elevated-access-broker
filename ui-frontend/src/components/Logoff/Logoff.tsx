import React, {FunctionComponent, useEffect} from 'react';
import { useOktaAuth } from '@okta/okta-react';

const LogoffForm: FunctionComponent = () => {

  const { oktaAuth } = useOktaAuth();

  useEffect( () => {
    oktaAuth.closeSession()
    oktaAuth.signOut()
  }, [oktaAuth]);

  return <div />
}

export default LogoffForm;