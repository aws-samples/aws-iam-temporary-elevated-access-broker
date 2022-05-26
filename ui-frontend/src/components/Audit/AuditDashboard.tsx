import React, { FunctionComponent } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
import AuditTable from "./AuditTable";

const AuditDashboard: FunctionComponent = () => {
  return <Stack>
    <AuditTable/>
  </Stack>
}

export default AuditDashboard;