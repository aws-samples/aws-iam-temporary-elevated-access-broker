import * as React from "react";
import Select from "aws-northstar/components/Select";
import FormField from "aws-northstar/components/FormField";
import useFieldApi, {
  UseFieldApiConfig
} from "@data-driven-forms/react-form-renderer/use-field-api";
import FormSpy from "@data-driven-forms/react-form-renderer/form-spy";

const CustomSelect: React.FunctionComponent<UseFieldApiConfig> = (props) => {
  const {
    label,
    description,
    helperText,
    isRequired,
    isDisabled,
    isReadOnly,
    placeholder,
    input,
    options,
    loadingMessage,
    isSearchable,
    validateOnMount,
    stretch,
    showError,
    multiSelect,
    renderReload,
    onReloadClick,
    createNewLinkHref,
    createNewLink,
    secondaryControl,
    selectedOption,
    meta: { error, submitFailed },
    ...rest
  } = useFieldApi(props);
  const [selectedValue, setSelectedValue] = React.useState<string>("");

  const handleChange = (
      event: React.ChangeEvent<{
        name?: string;
        value: unknown;
      }>,
      _: React.ReactNode
  ) => {
    console.log("Component handleChange Called")
    setSelectedValue(String(event.target.value));
    props.onChange?.(event);
  };

  const errorText =
      ((validateOnMount || submitFailed || showError) && error) || "";
  return (
      <FormSpy subscription={{ values: true }}>
        {() => (
            <FormField
                controlId={input.name}
                label={label}
                description={description}
                hintText={helperText}
                errorText={errorText}
                stretch={stretch}
                secondaryControl={secondaryControl}
                renderReload={renderReload}
                onReloadClick={onReloadClick}
                createNewLink={createNewLink}
                createNewLinkHref={createNewLinkHref}
            >
              <Select
                  {...input}
                  {...rest}
                  invalid={!!errorText}
                  controlId={input.name}
                  disabled={isDisabled || isReadOnly}
                  options={options}
                  placeholder={placeholder}
                  loadingText={loadingMessage}
                  ariaRequired={isRequired}
                  selectedOption={{
                    label: selectedValue,
                    value: selectedValue
                  }}
                  onChange={handleChange}
              />
            </FormField>
        )}
      </FormSpy>
  );
};

export default CustomSelect;
