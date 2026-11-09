import React from 'react';
import {createRoot} from 'react-dom/client';
import {PrimeReactProvider} from 'primereact/api';
import 'primereact/resources/themes/lara-dark-cyan/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import './styles.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<PrimeReactProvider value={{ripple:true}}><App/></PrimeReactProvider>);
