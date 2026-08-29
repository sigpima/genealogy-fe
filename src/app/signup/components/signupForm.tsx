'use client';

import { useState } from 'react';
import { signupFields } from '@/constants/formFields';
import FormAction from '@/components/FormAction';
import Input from '@/components/Input';

const fields = signupFields;
const fieldsState: { [key: string]: string } = {};
fields.forEach((field) => (fieldsState[field.id] = ''));

export default function Signup() {
  const [signupState, setSignupState] = useState(fieldsState);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupState({ ...signupState, [e.target.id]: e.target.value });
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(signupState);
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div>
        {fields.map((field) => (
          <Input
            key={field.id}
            handleChange={handleChange}
            value={signupState[field.id]}
            labelText={field.labelText}
            labelFor={field.labelFor}
            id={field.id}
            name={field.name}
            type={field.type}
            isRequired={field.isRequired}
            placeholder={field.placeholder}
          />
        ))}
        <FormAction handleSubmit={handleSubmit} text="Signup" />
      </div>
    </form>
  );
}
