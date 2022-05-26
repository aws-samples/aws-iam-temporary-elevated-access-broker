var apiARN = process.env.api_ARN;
var apiStage = process.env.api_stage;
var jwtIssuer = process.env.jwt_issuer;
var clientId = process.env.clientId;
var audience = process.env.aud;

const apiPermissions = [
  {
    "arn": apiARN, 
    "resource": "*", 
    "stage": apiStage,
    "httpVerb": "*"
  }
];

const defaultDenyAllPolicy = {
  "principalId":"user",
  "policyDocument":{
    "Version":"2012-10-17",
    "Statement":[
      {
        "Action":"execute-api:Invoke",
        "Effect":"Deny",
        "Resource":"*"
      }
    ]
  }
};

function generatePolicyStatement(apiName, apiStage, apiVerb, apiResource, action) {
  // Generate an IAM policy statement
  const statement = {};
  statement.Action = 'execute-api:Invoke';
  statement.Effect = action;
  const methodArn = apiName + "/" + apiStage + "/" + apiVerb + "/" + apiResource;
  statement.Resource = methodArn;
  return statement;
};

function generatePolicy(principalId, policyStatements) {
  // Generate a fully formed IAM policy
  const authResponse = {};
  authResponse.principalId = principalId;
  const policyDocument = {};
  policyDocument.Version = '2012-10-17';
  policyDocument.Statement = policyStatements;
  authResponse.policyDocument = policyDocument;
  return authResponse;
};

async function verifyIdToken(idToken) {
  console.log('VerifyIdToken Called');
  const OktaJwtVerifier = require('@okta/jwt-verifier');
  const jwt_decode = require('jwt-decode');

  const decoded = jwt_decode(idToken);
  const nonce = decoded.nonce; 

  const oktaJwtVerifier = new OktaJwtVerifier({
    issuer: jwtIssuer,  // issuer required
    clientId: clientId
  });
  
  const jwt = oktaJwtVerifier.verifyIdToken(idToken, clientId, nonce)
  .then( jwt => {
    // the token is valid 
    console.log(jwt.claims);
    console.log('Verified IdToken');
    return jwt;
  })

  return jwt;
};


async function verifyAccessToken(accessToken) {
  console.log('VerifyAccessToken Called');
  const OktaJwtVerifier = require('@okta/jwt-verifier');

  const oktaJwtVerifier = new OktaJwtVerifier({
    issuer: jwtIssuer,  // issuer required
    clientId: clientId,
    assertClaims: {
      cid: clientId
    }
  });
  
  const jwt = oktaJwtVerifier.verifyAccessToken(accessToken, audience)
  .then( jwt => {
    // the token is valid 
    console.log(jwt.claims);
    console.log('Verified AccessToken');
    return jwt;
  })

  return jwt;
};


function generateIAMPolicy(scopeClaims) {
  // Declare empty policy statements array
  const policyStatements = [];
  // Iterate over API Permissions
  for ( let i = 0; i < apiPermissions.length; i++ ) {
  // Check if token scopes exist in API Permission
  //if ( scopeClaims.indexOf(apiPermissions[i].scope) > -1 ) {
  // User token has appropriate scope, add API permission to policy statements
  policyStatements.push(generatePolicyStatement(apiPermissions[i].arn, apiPermissions[i].stage,
    apiPermissions[i].httpVerb, apiPermissions[i].resource, "Allow"));
  //  }
  }
  // Check if no policy statements are generated, if so, create default deny all policy statement
  if (policyStatements.length === 0) {
    return defaultDenyAllPolicy;
  } else {
    return generatePolicy('user', policyStatements);
  }
};

exports.handler = async function(event, context) {
  // Declare Policy
  let iamPolicy = null;
  // Capture raw token and trim 'Bearer ' string, if present
  const idToken = event.authorizationToken.split(" ")[2];
  const accessToken = event.authorizationToken.split(" ")[1];
  // Validate token
  await verifyAccessToken(accessToken).then(data => {
    // Retrieve token scopes
    const scopeClaims = data.claims.scp;
  })
  await verifyIdToken(idToken).then(data => {
    // Retrieve token scopes
    const scopeClaims = data.claims.scp;
    // Generate IAM Policy
    iamPolicy = generateIAMPolicy(scopeClaims);
  })
  .catch(err => {
    console.log(err);
    iamPolicy = defaultDenyAllPolicy;
  });
  return iamPolicy;
};