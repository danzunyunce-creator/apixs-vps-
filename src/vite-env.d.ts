/// <reference types="vite/client" />

// CSS module declarations
declare module '*.css';

declare module '*.svg' {
    import type * as React from 'react';
    const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
    export default ReactComponent;
}

declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.jpg' {
    const src: string;
    export default src;
}
