import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

type Props = {
  options: {
    value: string;
    label: string;
  }[];
  value?: string;
  onValueChange?: (value: string) => void;
};

const RadioGroupCards = (props: Props) => {
  return (
    <RadioGroupPrimitive.Root
      className="flex"
      defaultValue={props.options[0].value}
      value={props.value}
      onValueChange={(value) => {
        props.onValueChange?.(value);
      }}
    >
      {props.options.map((option, i) => {
        const isFirst = i === 0;
        const isLast = i === props.options.length - 1;
        return (
          <RadioGroupPrimitive.Item
            className={`${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''} 
            px-5 py-2 flex items-center border border-border data-[state=checked]:border-primary cursor-pointer
            data-[state=checked]:bg-primary data-[state=checked]:text-white`}
            key={option.value}
            value={option.value}
          >
            <span className="text-base leading-none">{option.label}</span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
};

export default RadioGroupCards;
