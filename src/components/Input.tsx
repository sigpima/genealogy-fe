const fixedInputClass =
  'rounded-lg appearance-none relative block w-full px-3 py-2 border border-default bg-surface placeholder:text-muted text-default focus:outline-none focus:ring-2 sm:text-sm ';

type InputProps = {
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
  labelFor: string;
  labelText: string;
  id: string;
  name: string;
  type: string;
  isRequired?: boolean;
  placeholder?: string;
  customClass?: string;
};

export default function Input({
  handleChange,
  value,
  labelFor,
  labelText,
  id,
  name,
  type,
  isRequired = false,
  placeholder,
  customClass,
}: InputProps) {
  return (
    <div className="my-5">
      <label htmlFor={labelFor} className="sr-only">
        {labelText}
      </label>

      <input
        onChange={handleChange}
        value={value}
        id={id}
        name={name}
        type={type}
        required={isRequired}
        className={fixedInputClass + customClass}
        placeholder={placeholder}
      />
    </div>
  );
}
