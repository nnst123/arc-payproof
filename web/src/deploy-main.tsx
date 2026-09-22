import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import Deploy from './Deploy'
import { wagmiConfig } from './lib/network'
import './style.css'
import './deploy.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Deploy />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
