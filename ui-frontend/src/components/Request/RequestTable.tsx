import React, {FunctionComponent, useEffect, useState} from 'react';
import { useHistory } from 'react-router-dom';
import Button from 'aws-northstar/components/Button';
import Inline from 'aws-northstar/layouts/Inline';
import StatusIndicator from 'aws-northstar/components/StatusIndicator';
import Table, { Column } from 'aws-northstar/components/Table';
import {deleteRequest, getRequests, invokeFederateConsole, invokeFederateCli} from "../../data";
import {ICredential, IRequest, ReduxRoot} from "../../interfaces";
import '../home/styles.css';

import {
  ExpandableSection,
  Modal,
  Stack,
} from "aws-northstar";
import Flashbar, {FlashbarMessage} from "aws-northstar/components/Flashbar";
import {useSelector} from "react-redux";

const RequestTable: FunctionComponent = () => {

  const userInfo = useSelector( (state:ReduxRoot) => {
    return state.breakGlassReducerState.userInfo
  });

  const columnDefinitions: Column<IRequest>[]= [
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
              return <div></div>;
          }
        }

        return row.id;
      }
    },
    {
      id: 'request_time',
      width: 150,
      Header: 'Requested time',
      accessor: 'request_time'
    },
    {
      id: 'expiration_time',
      width: 150,
      Header: 'End time',
      accessor: 'expiration_time'
    },
    {
      id: 'request_url',
      width: 300,
      Header: 'Access',
      Cell: ({ row }: any) => {
        if (row && row.original) {
          const status = row.original.request_status;
          switch(status) {
            case 'Approved':
              return <div>
                <Button onClick={(e) => invokeFederateEndpointConsole(row.original.request_account?row.original.request_account:"", row.original.request_role?row.original.request_role:"")} variant="primary">Access console</Button>
                &nbsp;&nbsp;&nbsp;
                <Button onClick={(e) => invokeFederateEndpointCli(row.original.request_account?row.original.request_account:"", row.original.request_role?row.original.request_role:"")} variant="primary">  CLI  </Button>
              </div>
            default:
              return <div></div>;
          }
        }

        return row.id;
      }
    }
  ];

  const [requests, setRequests] = useState<IRequest[]>([]);
  const [selectedItems, setSelectedItems] = useState<IRequest[]>([]);
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [cliVisible, setCliVisible] = useState(false);
  const [cli, setCli] = useState<ICredential>({accessKeyId: "", secretAccessKey: "", sessionToken: ""});
  const [errors, setErrors] = React.useState<FlashbarMessage[]>([]);

  const CLIViewer = () => {

    const copyJSONToClipboard = () => {
      let content = getJSON(cli)
      navigator.clipboard.writeText(content);
    }

    const copyBashToClipboard = () => {
      let content = getBash(cli)
      navigator.clipboard.writeText(content);
    }

    const copyFishToClipboard = () => {
      let content = getFish(cli)
      navigator.clipboard.writeText(content);
    }

    const copyPowershellToClipboard = () => {
      let content = getPowershell(cli)
      navigator.clipboard.writeText(content);
    }

    const copyWindowsToClipboard = () => {
      let content = getWindows(cli)
      navigator.clipboard.writeText(content);
    }

    return (
        <div>
          <Modal title="CLI Commands" visible={cliVisible} onClose={() => setCliVisible(false)}>
            <ExpandableSection variant="borderless" header="JSON">
              <Stack>
                  <div>
                    <Button onClick={copyJSONToClipboard} variant="primary">Copy JSON</Button>
                  </div>
                  <div>
                    <p>
                      <div className="border_black back_ground_antique_white" >
                      &#123;<br/>
                        &nbsp;&nbsp;&nbsp;&quot;accessKeyId&quot;:&#32;&quot;{cli.accessKeyId}&quot;,<br/>
                        &nbsp;&nbsp;&nbsp;&quot;secretAccessKey&quot;:&#32;&quot;{cli.secretAccessKey}&quot;,<br/>
                        &nbsp;&nbsp;&nbsp;&quot;sessionToken&quot;:&#32;&quot;{cli.sessionToken}&quot;<br/>
                      &#125;
                      </div>
                    </p>
                  </div>
              </Stack>
            </ExpandableSection>
            <ExpandableSection variant="borderless" header="bash/zsh">
              <Stack>
                <div>
                  <Button onClick={copyBashToClipboard} variant="primary">Copy bash/zsh</Button>
                </div>
                <div>
                  <p>
                    <div className="border_black back_ground_antique_white" >
                      export AWS_ACCESS_KEY_ID={cli.accessKeyId}<br/>
                      export AWS_SECRET_ACCESS_KEY={cli.secretAccessKey}<br/>
                      export AWS_SESSION_TOKEN={cli.sessionToken}
                    </div>
                  </p>
                </div>
              </Stack>
            </ExpandableSection>
            <ExpandableSection variant="borderless" header="fish">
              <Stack>
                <div>
                  <Button onClick={copyFishToClipboard} variant="primary">Copy fish</Button>
                </div>
                <div>
                  <p>
                    <div className="border_black back_ground_antique_white" >
                      set -x AWS_ACCESS_KEY_ID &quot;{cli.accessKeyId}&quot;<br/>
                      set -x AWS_SECRET_ACCESS_KEY &quot;{cli.secretAccessKey}&quot;<br/>
                      set -x AWS_SESSION_TOKEN &quot;{cli.sessionToken}&quot;
                    </div>
                  </p>
                </div>
              </Stack>
            </ExpandableSection>
            <ExpandableSection variant="borderless" header="Powershell">
              <Stack>
                <div>
                  <Button onClick={copyPowershellToClipboard} variant="primary">Copy Powershell</Button>
                </div>
                <div>
                  <p>
                    <div className="border_black back_ground_antique_white" >
                      $Env:AWS_ACCESS_KEY_ID=&quot;{cli.accessKeyId}&quot;<br/>
                      $Env:AWS_SECRET_ACCESS_KEY=&quot;{cli.secretAccessKey}&quot;<br/>
                      $Env:AWS_SESSION_TOKEN=&quot;{cli.sessionToken}&quot;
                    </div>
                  </p>
                </div>
              </Stack>
            </ExpandableSection>
            <ExpandableSection variant="borderless" header="Windows cmd">
              <Stack>
                <div>
                  <Button onClick={copyWindowsToClipboard} variant="primary">Copy Windows cmd</Button>
                </div>
                <div>
                  <p>
                    <div className="border_black back_ground_antique_white" >
                      set AWS_ACCESS_KEY_ID={cli.accessKeyId}<br/>
                      set AWS_SECRET_ACCESS_KEY={cli.secretAccessKey}<br/>
                      set AWS_SESSION_TOKEN={cli.sessionToken}
                    </div>
                  </p>
                </div>
              </Stack>
            </ExpandableSection>
          </Modal>
        </div>
    );
  };

  const invokeFederateEndpointConsole = async (account: string, role: string) => {
    try {
      let response = await invokeFederateConsole(userInfo.token, account, role).then(
          (result: any) => {
            return result;
          });

      window.open(response, "")
    }
    catch (err) {
      const items:FlashbarMessage[] = [
        {
          header: 'Could not federate into the account and role: ' + err.toString(),
          type: 'error',
          dismissible: true,
        }
      ];
      setErrors(items);
    }
  }

  const invokeFederateEndpointCli = async (account: string, role: string) => {
    try {
      let response = await invokeFederateCli(userInfo.token, account, role).then(
          (result: any) => {
            return result;
          });

      setCli(response);
      setCliVisible(true);
    }
    catch (err) {
      console.log(err.toString());
      const items:FlashbarMessage[] = [
        {
          header: 'Could not get the details to federate into the account: ' + err.toString(),
          type: 'error',
          dismissible: true,
        }
      ];
      setErrors(items);
    }
  }

  useEffect( () => {
    const getAllRequests = async () => {

      try {

        setLoading(true);

        let requests = await getRequests(userInfo.token).then(
            (result: IRequest[]) => {
              return result;
            });

        setRequests(requests);

        await Promise.resolve();

        setLoading(false);
      }
      catch (err) {
        const items:FlashbarMessage[] = [
          {
            header: 'Could not get the requests: ' + err.toString(),
            type: 'error',
            dismissible: true,
          }
        ];
        setErrors(items);
      }
    }
    getAllRequests().then(() => console.log("getAllRequests() completed."));
  }, [userInfo]);

  const onCreateClick = () => {
    history.push('/Create-request');
  }

  const onDeleteClick = async () => {
    let selectedItem:IRequest = selectedItems[0];
    try {
      await deleteRequest(userInfo.token, selectedItem.id, selectedItem.request_time).then(
          (result: any) => {
            return result;
          });

      let selected_requests = remove_request(requests, selectedItem)
      setRequests(selected_requests)
      history.push('/Request-dashboard');
    }
    catch (err) {
      const items:FlashbarMessage[] = [
        {
          header: 'Could not delete the request: ' + err.toString(),
          type: 'error',
          dismissible: true,
        }
      ];
      setErrors(items);
    }
  }

  const handleSelectionChange = (items: object[]) => {
    if (!(selectedItems.length === 0 && items.length === 0)) {
      setSelectedItems(items);
    }
  };

  const tableActions = (
      <Inline>
        <Button onClick={onCreateClick} variant="primary">
          Create request
        </Button>
        <Button disabled={!(selectedItems.length === 1 && (selectedItems[0].request_status === 'Requested' || selectedItems[0].request_status === 'Expired'))} onClick={onDeleteClick}>
          Delete request
        </Button>
      </Inline>
  );

  return <div><Table
      onSelectionChange={handleSelectionChange}
      tableTitle={'Requests you have submitted for review'}
      columnDefinitions={columnDefinitions}
      loading={loading}
      items={requests}
      actionGroup={tableActions}
      multiSelect={false}
  />
  <CLIViewer />
    <Flashbar items={errors} />
  </div>
}

function getJSON(credential: ICredential) {
  let output: string = "";
  output = output.concat("{\n")
  output = output.concat("\t\"accessKeyId\": \"")
  output = output.concat(credential.accessKeyId)
  output = output.concat("\",\n")
  output = output.concat("\t\"secretAccessKey\": \"")
  output = output.concat(credential.secretAccessKey)
  output = output.concat("\",\n")
  output = output.concat("\t\"sessionToken\": \"")
  output = output.concat(credential.sessionToken)
  output = output.concat("\"\n}")
  return output;
}

function getBash(credential: ICredential) {

  let output: string = "";
  output = output.concat("export AWS_ACCESS_KEY_ID=")
  output = output.concat(credential.accessKeyId)
  output = output.concat("\n")
  output = output.concat("export AWS_SECRET_ACCESS_KEY=")
  output = output.concat(credential.secretAccessKey)
  output = output.concat("\n")
  output = output.concat("export AWS_SESSION_TOKEN=")
  output = output.concat(credential.sessionToken)
  return output;
}

function getFish(credential: ICredential) {

  let output: string = "";
  output = output.concat("set -x AWS_ACCESS_KEY_ID \"")
  output = output.concat(credential.accessKeyId)
  output = output.concat("\"\n")
  output = output.concat("set -x AWS_SECRET_ACCESS_KEY \"")
  output = output.concat(credential.secretAccessKey)
  output = output.concat("\"\n")
  output = output.concat("set -x AWS_SESSION_TOKEN \"")
  output = output.concat(credential.sessionToken)
  output = output.concat("\"")
  return output;
}

function getPowershell(credential: ICredential) {

  let output: string = "";
  output = output.concat("$Env:AWS_ACCESS_KEY_ID=\"")
  output = output.concat(credential.accessKeyId)
  output = output.concat("\"\n")
  output = output.concat("$Env:AWS_SECRET_ACCESS_KEY=\"")
  output = output.concat(credential.secretAccessKey)
  output = output.concat("\"\n")
  output = output.concat("$Env:AWS_SESSION_TOKEN=\"")
  output = output.concat(credential.sessionToken)
  output = output.concat("\"")
  return output;
}

function getWindows(credential: ICredential) {

  let output: string = "";
  output = output.concat("set AWS_ACCESS_KEY_ID=")
  output = output.concat(credential.accessKeyId)
  output = output.concat("\n")
  output = output.concat("set AWS_SECRET_ACCESS_KEY=")
  output = output.concat(credential.secretAccessKey)
  output = output.concat("\n")
  output = output.concat("set AWS_SESSION_TOKEN=")
  output = output.concat(credential.sessionToken)
  return output;
}

function remove_request(requests: any, selected: any) {
  let list: Array<any> = [];
  for (var request of requests) {
    if (request.id !== selected.id) {
      list.push(request)
    }
  }
  return list;
}

export default RequestTable;