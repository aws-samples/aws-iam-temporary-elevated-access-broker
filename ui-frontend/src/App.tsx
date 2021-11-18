import React, {ComponentType, FunctionComponent} from 'react';
import {BrowserRouter as Router, Route, useHistory} from 'react-router-dom';
import NorthStarThemeProvider from 'aws-northstar/components/NorthStarThemeProvider';
import AppLayout from "./components/AppLayout";
import {OktaAuth, toRelativeUrl} from "@okta/okta-auth-js";
import {LoginCallback, Security} from "@okta/okta-react";
import {HomepageContent} from "./components/home/HomePageContent";
import RequestDashboard from "./components/Request/RequestDashboard";
import ReviewDashboard from "./components/Review/ReviewDashboard";
import AuditDashboard from "./components/Audit/AuditDashboard";
import RequestForm from "./components/Request/RequestForm";
import LogoffForm from "./components/Logoff/Logoff";

const withLayout = (Component: ComponentType): FunctionComponent => (props) => (
    <AppLayout>
      <Component {...props} />
    </AppLayout>);

const App = () => {
  const history = useHistory();

  const oktaAuth = new OktaAuth({
    issuer: 'https://<yourOktaDomain>/oauth2/default', // NOTE: Replace with the URL of the authorization server that will perform authentication
    clientId: '<clientId>', // NOTE: Replace with the client ID of your SPA application
    redirectUri: '<CloudFrontURL>', // NOTE: Replace with your CloudFront distribution URL
    pkce: true
  });

  const restoreOriginalUri = (_oktaAuth:any, originalUri:any) => {
    history.replace(toRelativeUrl(originalUri, window.location.origin));
  }

  return (
      <NorthStarThemeProvider>
        <Router>
          <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
            <Route exact path='/' component={withLayout(HomepageContent)}></Route>
            <Route exact path='/Request-dashboard' component={withLayout(RequestDashboard)}/>
            <Route exact path='/Review-dashboard' component={withLayout(ReviewDashboard)}/>
            <Route exact path='/Audit-dashboard' component={withLayout(AuditDashboard)}/>
            <Route exact path='/Create-request' component={withLayout(RequestForm)}/>
            <Route exact path='/Logoff' component={withLayout(LogoffForm)}></Route>
            <Route path='/login/callback' component={LoginCallback} />
          </Security>
        </Router>
      </NorthStarThemeProvider>
  );
}

export default App;
