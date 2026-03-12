import type { SVGProps } from 'react';

export const CustomIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" {...props}>
      <rect width="100" height="100" fill="#FFD700" stroke="#333" strokeWidth="5" />
      <text x="50" y="65" fontSize="40" textAnchor="middle" fill="#333">OBJ</text>
    </svg>
);
