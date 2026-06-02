/* Global JSX types to satisfy TypeScript React JSX usage in the project */
import React from 'react';

declare global {
  namespace JSX {
    type Element = React.ReactElement;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
