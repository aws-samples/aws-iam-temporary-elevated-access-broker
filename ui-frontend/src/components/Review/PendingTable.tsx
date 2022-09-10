import React, {FunctionComponent, useEffect, useState} from 'react';
import Button from 'aws-northstar/components/Button';
import Inline from 'aws-northstar/layouts/Inline';
import StatusIndicator from 'aws-northstar/components/StatusIndicator';
import Table, {Column} from 'aws-northstar/components/Table';
import {IRequest, ReduxRoot} from "../../interfaces";
import {approveRequest, getPendingRequests, rejectRequest} from "../../data";
import Flashbar, {FlashbarMessage} from "aws-northstar/components/Flashbar";
import {useSelector} from "react-redux";

const columnDefinitions: Column<IRequest>[]  = [
  {
    id: 'requester',
    width: 150,
    Header: 'Requester',
    accessor: 'requester'
  },
  {
    id: 'request_account',
    width: 150,
    Header: 'Account',
    accessor: 'request_account'
  },
  {
    id: 'request_role',
    width: 200,
    Header: 'Role',
    accessor: 'request_role'
  },
  {
    id: 'request_duration',
    width: 100,
    Header: 'Duration',
    accessor: 'request_duration'
  },
  {
    id: 'request_justification',
    width: 200,
    Header: 'Justification',
    accessor: 'request_justification'
  },
  {
    id: 'request_status',
    width: 100,
    Header: 'Status',
    accessor: 'request_status',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        const status = row.original.request_status;
        switch(status) {
          case 'Requested':
            return <StatusIndicator  statusType='info'>Requested</StatusIndicator>;
          case 'Approved':
            return <StatusIndicator  statusType='positive'>Approved</StatusIndicator>;
          case 'Rejected':
            return <StatusIndicator  statusType='negative'>Rejected</StatusIndicator>;
          case 'Expired':
            return <StatusIndicator statusType='negative'>Expired</StatusIndicator>;
          case 'Ended':
            return <StatusIndicator statusType='negative'>Ended</StatusIndicator>;
          default:
            return null;
        }
      }

      return row.id;
    }
  },
  {
    id: 'request_time',
    width: 150,
    Header: 'Requested Time',
    accessor: 'request_time'
  },
  {
    id: 'expiration_time',
    width: 150,
    Header: 'Expiration Time',
    accessor: 'expiration_time'
  }
];

const PendingTable: FunctionComponent = () => {

  const userInfo = useSelector( (state:ReduxRoot) => {
    return state.breakGlassReducerState.userInfo
  });

  const [requests, setRequests] = useState<IRequest[]>([]);
  const [selectedItems, setSelectedItems] = useState<object[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = React.useState<FlashbarMessage[]>([]);

  useEffect( () => {
    const getAllRequests = async () => {
      try {

        setLoading(true);

        let requests = await getPendingRequests(userInfo.token).then(
            (result: IRequest[]) => {
              return result;
            });

        let pending_requests = update_requests(requests);
        setRequests(pending_requests)

        await Promise.resolve();

        setLoading(false);
      }
      catch (err) {
        console.log(err.toString());
        const items:FlashbarMessage[] = [
          {
            header: 'Could not get the pending requests: ' + err.toString(),
            type: 'error',
            dismissible: true,
          }
        ];
        setErrors(items);
      }
    }
    getAllRequests().then(() => console.log("getPendingRequests() completed."));
  }, [userInfo]);

  const handleSelectionChange = (items: object[]) => {
    if (!(selectedItems.length === 0 && items.length === 0)) {
      setSelectedItems(items);
    }
  };

  const onApproveClick = async () => {
    let selectedItem:IRequest = selectedItems[0];
    try {
      await approveRequest(userInfo.token, selectedItem.id, selectedItem.request_time, selectedItem.request_duration, userInfo.user).then(
          (result: any) => {
            return result;
          });

      let requests = await getPendingRequests(userInfo.token).then(
          (result: IRequest[]) => {
            return result;
          });

      let pending_requests = update_requests(requests);
      setRequests(pending_requests)

    }
    catch (err) {
      console.log(err.toString());
      const items:FlashbarMessage[] = [
        {
          header: 'Could not approve the request: ' + err.toString(),
          type: 'error',
          dismissible: true,
        }
      ];
      setErrors(items);
    }
  }

  const onRejectClick = async () => {
    let selectedItem:IRequest = selectedItems[0];
    try {
      await rejectRequest(userInfo.token, selectedItem.id, selectedItem.request_time, userInfo.user).then(
          (result: any) => {
            return result;
          });

      let requests = await getPendingRequests(userInfo.token).then(
          (result: IRequest[]) => {
            return result;
          });

      let pending_requests = update_requests(requests);
      setRequests(pending_requests)

    }
    catch (err) {
      console.log(err.toString());
      const items:FlashbarMessage[] = [
        {
          header: 'Could not reject the request: ' + err.toString(),
          type: 'error',
          dismissible: true,
        }
      ];
      setErrors(items);
    }
  }

  const tableActions = (
      <Inline>
        <Button disabled={selectedItems.length !== 1} variant="primary" onClick={onApproveClick}>
          Approve
        </Button>
        <Button disabled={selectedItems.length !== 1} variant="primary" onClick={onRejectClick}>
          Reject
        </Button>
      </Inline>
  );

  function update_requests(requests: any) {
    let list: Array<any> = [];
    for (var request of requests) {
      if (request.request_status === 'Requested') {
        list.push(request);
      }
    }
    return list;
  }

  return <div><Table
      onSelectionChange={handleSelectionChange}
      tableTitle={'Requests awaiting your review'}
      columnDefinitions={columnDefinitions}
      items={requests}
      loading={loading}
      actionGroup={tableActions}
      multiSelect={false}
  />
  <Flashbar items={errors} />
  </div>
}

export default PendingTable;