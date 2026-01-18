import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const container = document.getElementById('root')

if (!container) {
  console.error('❌ Root element (#root) not found. Ensure index.html has <div id="root"></div>.')
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
