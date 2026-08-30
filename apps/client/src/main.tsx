import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>BUSY Course Delivery</h1>
      <p>Foundation established. Application features will be added in later phases.</p>
    </main>
  </StrictMode>
);
