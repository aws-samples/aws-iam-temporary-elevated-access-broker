import React, { FunctionComponent } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
import RequestTable from "./RequestTable";

const RequestDashboard: FunctionComponent = () => {
  return <Stack>
    <RequestTable/>
  </Stack>
}

export default RequestDashboard;