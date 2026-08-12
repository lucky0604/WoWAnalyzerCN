import type { ComponentPropsWithoutRef } from 'react';

type Props = Omit<ComponentPropsWithoutRef<'svg'>, 'xmlns' | 'viewBox' | 'className'>;

// A portcullis gate: the classic "dungeon" glyph, drawn as a filled frame with
// the opening cut out (evenodd) and two hanging bars across it.
// Inspired by the dungeon/keep icon family on the Noun Project.
const Icon = (props: Props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="icon" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50,6C26.7,6 8,24.7 8,48 L8,86 C8,89.3 10.7,92 14,92 L86,92 C89.3,92 92,89.3 92,86 L92,48 C92,24.7 73.3,6 50,6 Z M50,20 C33.4,20 20,33.4 20,50 L20,78 C20,79.1 20.9,80 22,80 L78,80 C79.1,80 80,79.1 80,78 L80,50 C80,33.4 66.6,20 50,20 Z"
    />
    <path d="M20,54 L80,54 L80,60 L20,60 Z M20,63 L80,63 L80,69 L20,69 Z" />
  </svg>
);

export default Icon;
