import React from 'react';
import ReactDOM from 'react-dom';
import registerResolver from './utils/register'

import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<App />, document.getElementById('root'));
registerServiceWorker();
registerResolver()
