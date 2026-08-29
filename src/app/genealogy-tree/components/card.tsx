import { OnlyNameCardProps } from "@/types/common";

export function OnlyNameCard({ name, text_mode = 'horizontal' }: OnlyNameCardProps) {
  const chars = name.split('');

  return (
    <div className="flex items-center justify-center border-2 border-gray-300 rounded-lg p-4 shadow-sm">
      {/* Mode 1: Chữ ngang 1 dòng */}
      {text_mode === 'horizontal' && (
        <p className="text-gray-600 text-center">{name}</p>
      )}

      {/* Mode 2: Chữ ngang nhưng mỗi chữ một dòng */}
      {text_mode === 'multi-line' && (
        <div className="flex flex-col items-center text-gray-600">
          {chars.map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
      )}

      {/* Mode 3: Chữ dọc (xoay chữ 90 độ, dọc xuống) */}
      {text_mode === 'vertical' && (
        <div className="flex flex-col items-center text-gray-600">
          {chars.map((ch, i) => (
            <span
              key={i}
              className="rotate-90 origin-center"
            >
              {ch}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type BasicCardWithImageProps = {
  name: string;
  imageSrc: string;
};

export function BasicCardWithImage({
  name,
  imageSrc,
}: BasicCardWithImageProps) {
  return (
    <div
      className={`flex items-center border-2 border-gray-300 rounded-lg p-4 shadow-sm`}
    >
      <div className="w-16">
        <img
          className="block rounded-full m-auto shadow-md"
          alt={name}
          src={imageSrc}
        />
      </div>
      <div className="text-gray-600">
        <p>{name}</p>
      </div>
    </div>
  );
}
