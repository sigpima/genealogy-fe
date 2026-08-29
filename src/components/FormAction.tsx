type FormActionProps = {
  handleSubmit?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'Button' | 'Link';
  action?: 'submit' | 'reset' | 'button';
  text: string;
};

export default function FormAction({ handleSubmit, type = 'Button', action = 'submit', text }: FormActionProps) {
  if (type !== 'Button') return null;
  return (
    <button
      type={action}
      className="group relative mt-10 flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 focus:outline-none focus:ring-2"
      onClick={handleSubmit}
    >
      {text}
    </button>
  );
}
