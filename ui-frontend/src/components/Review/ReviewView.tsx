import Tabs from 'aws-northstar/components/Tabs';
import PendingTable from "./PendingTable";
import ReviewedTable from "./ReviewedTable";
import React, {FunctionComponent} from "react";
import Stack from "aws-northstar/layouts/Stack";

const tabs = [
  {
    label: 'Pending requests',
    id: 'first',
    content: <PendingTable/>
  },
  {
    label: 'Reviewed requests',
    id: 'second',
    content: <ReviewedTable/>
  }
];

const ReviewView: FunctionComponent = () => {
  return <Stack>
    <Tabs tabs={tabs} variant="container" />
  </Stack>
}

export default ReviewView;