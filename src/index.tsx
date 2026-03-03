import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const ensureRandomUUID = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject || typeof cryptoObject.randomUUID === 'function') {
    return;
  }

  const getRandomValues = cryptoObject.getRandomValues?.bind(cryptoObject);
  if (!getRandomValues) {
    return;
  }

  const randomUUID = () => {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  };

  Object.defineProperty(cryptoObject, 'randomUUID', {
    value: randomUUID,
    configurable: true,
    writable: true
  });
};

ensureRandomUUID();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
