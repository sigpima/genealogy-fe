import Link from 'next/link';

type AuthHeaderProps = {
  heading: string;
  paragraph: string;
  linkName?: string;
  linkUrl?: string;
};

export default function AuthHeader({ heading, paragraph, linkName, linkUrl = '#' }: AuthHeaderProps) {
  return (
    <div className="mb-10">
      <h2 className="mt-6 text-center text-3xl font-extrabold text-default">{heading}</h2>
      <p className="mt-2 text-center text-sm text-muted">
        {paragraph}
        {linkName && (
          <>
            {' '}
            <Link href={linkUrl} className="font-medium accent-text hover:underline">
              {linkName}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
