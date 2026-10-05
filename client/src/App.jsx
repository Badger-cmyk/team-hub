import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [status, setStatus] = useState('Checking the server…');

  useEffect(() => {
    api
      .health()
      .then(() => setStatus('Connected to the API.'))
      .catch((err) => setStatus(err.message));
  }, []);

  return (
    <main>
      <h1>Team hub</h1>
      <p role="status">{status}</p>
    </main>
  );
}