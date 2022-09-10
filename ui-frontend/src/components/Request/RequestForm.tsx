import React, {FunctionComponent, useEffect} from 'react';
import { useHistory } from 'react-router-dom';
import Container from 'aws-northstar/layouts/Container';
import FormRenderer, { componentTypes} from 'aws-northstar/components/FormRenderer';
import {createRequest} from "../../data";
import {IRequest, IUserInfo, ReduxRoot} from "../../interfaces";
import Flashbar, {FlashbarMessage} from 'aws-northstar/components/Flashbar';
import CustomSelect from "../../common/CustomSelect";
import {useSelector} from "react-redux";

export type FormData = {
  requester?: string;
  request_account?: string;
  request_role?: string;
  request_duration?: string;
  request_justification?: string;
  request_emergency?: string;
}

const RequestForm: FunctionComponent = () => {

  const userInfo = useSelector( (state:ReduxRoot) => {
    return state.breakGlassReducerState.userInfo
  });

  const [justification, setJustification] = React.useState("");
  const [accounts, setAccounts] = React.useState([{ label: "", value: "" }]);
  const [account, setAccount] = React.useState({ label: "", value: "" });
  const [roles, setRoles] = React.useState([{ label: "", value: "" }]);
  const [role, setRole] = React.useState({ label: "", value: "" });
  const [roleDisabled, setRoleDisabled] = React.useState(true);
  const [duration, setDuration] = React.useState("");
  const [errors, setErrors] = React.useState<FlashbarMessage[]>([]);

  const onJustificationChange = (value:string) => {

    setJustification(value);
  };

  const onAccountChange = (event:any) => {

    setAccount(get_account_entry(event.value));
    const role_values = get_roles_values(event.value, userInfo)
    setRoles(role_values);
    setRoleDisabled(false);
    setRole({label: "", value: ""});
  };

  const onRoleChange = (event:any) => {

    setRole(get_role_entry(event.target.value));
  };

  const onDurationChange = (value:string) => {

    setDuration(value);
  };

  const formSchema = {
    header: 'Temporary elevated access request form',
    description: 'Raise temporary elevated access request here',
    fields: [
      {
        component: componentTypes.TEXT_FIELD,
        name: 'justificationField',
        label: 'Justification for requesting temporary elevated access',
        helperText: 'Maximum 1000 characters',
        isRequired: true,
        initialValue: justification,
        onChange: onJustificationChange
      },
      {
        component: componentTypes.SELECT,
        name: 'accountField',
        label: 'Account requesting access for',
        helperText: 'Select from accounts you have access to',
        placeholder: 'Choose the account',
        options: accounts,
        isRequired: true,
        isSearchable: true,
        isClearable: true,
        selectedOption: {account},
        onChange:onAccountChange
      },
      {
        component: componentTypes.CUSTOM,
        CustomComponent: CustomSelect,
        name: 'roleField',
        label: 'Role requesting access to',
        placeholder: 'Choose the role',
        helperText: 'Select from roles you have access to, please select an account first',
        options: roles,
        initializeOnMount: true,
        initialValue: role,
        isRequired: true,
        isSearchable: true,
        isClearable: true,
        isDisabled: roleDisabled,
        selectedOption: {role},
        onChange:onRoleChange
      },
      {
        component: componentTypes.TEXT_FIELD,
        name: 'durationField',
        label: 'Requested duration for elevated access in minutes',
        type: 'number',
        helperText: 'Maximum 480 minutes',
        initialValue: duration,
        onChange: onDurationChange
      }
    ]
  };

  const history = useHistory();

  const onSubmit = async (data:any) => {

    if (!validateForm()) {

      return;
    }

    try {
      await createRequest(userInfo.token, account.value, role.value, duration, justification).then(
          (result: IRequest[]) => {
            return result;
          });
      history.goBack()
      history.push('/Request-dashboard');
    }
    catch (err) {
      if (justification === "") {
        const items:FlashbarMessage[] = [
            {
              header: 'Could not create the request: ' + err.toString(),
              type: 'error',
              dismissible: true,
            }
        ];
        setErrors(items);
      }
    }
  }

  const validateForm = () => {

    let error = false;
    let errorsFound:FlashbarMessage[] = [];

    if (justification === "") {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data : Please provide a justification',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }

    if (account.value === "") {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data : Please select an account',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }

    if (role.value === "") {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data : Please select a role',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }
    else if (userInfo.accountMap.has(account.value)) {

      const roles: Array<string> = userInfo.accountMap.get(account.value)

      if (!roles.includes(role.value)) {
        const item:FlashbarMessage =
          {
            header: 'Form has Invalid Data: Please select a role associated with the account',
            type: 'error',
            dismissible: true,
          };
        errorsFound.push(item);
        error = true;
      }
    }
    else {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data: Selected account does not exist',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }

    if (duration === "") {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data : Please provide a duration',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }
    else if (parseInt(duration) <= 0 || parseInt(duration) > 480) {
      const item:FlashbarMessage =
        {
          header: 'Form has Invalid Data : Please provide a positive value less than 480 for duration',
          type: 'error',
          dismissible: true,
        };
      errorsFound.push(item);
      error = true;
    }

    if (error) {
      setErrors(errorsFound)
      return false
    }
    else {
      return true;
    }
  }

  useEffect( () => {
    setAccounts(get_accounts_values(userInfo));
  }, [userInfo]);

  return  <Container>
    <FormRenderer schema={formSchema} onSubmit={onSubmit} onCancel={() => history.goBack()} />
    <Flashbar items={errors} />
  </Container>
}

function get_accounts(userInfo: IUserInfo) {
  let list: Array<any> = [];
  // console.log("Size of Account Map : " + userInfo.accountMap.size)
  userInfo.accountMap.forEach(function(value, key) {
    // console.log('Key in Api AccountMap : ' + key)
    list.push(key)
  })

  return list;
}

function get_roles(account:string,userInfo: IUserInfo) {
  return userInfo.accountMap.get(account)
}

function get_accounts_values(userInfo: IUserInfo) {
  let accounts = get_accounts(userInfo)
  let list: Array<any> = [];
  accounts.sort();
  for (var account of accounts) {
    list.push({label: account, value: account});
  }
  return list;
}

function get_roles_values(account:string, userInfo: IUserInfo) {
  let roles = get_roles(account, userInfo);
  let list: Array<any> = [];
  for (var role of roles) {
    // console.log("Role : " + role)
    list.push({label: role, value: role});
  }
  return list;
}

function get_account_entry(account:string) {
  return {label: account, value: account};
}

function get_role_entry(role:string) {
  return {label: role, value: role};
}

export default RequestForm;