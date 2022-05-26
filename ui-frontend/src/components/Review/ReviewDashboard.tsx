import React, { FunctionComponent } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
// import ApprovalTable from "./ApprovalTable";
import ReviewView from "./ReviewView";

const ReviewDashboard: FunctionComponent = () => {
    return <Stack>
        <ReviewView/>
    </Stack>
}

export default ReviewDashboard;