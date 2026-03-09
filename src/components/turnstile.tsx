'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface TurnstileProps {
  siteKey: string
  onSuccess: (token: string) => void
  onError?: () => void
  trigger?: boolean
}

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'error-callback': () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export default function Turnstile({ siteKey, onSuccess, onError, trigger = false }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(false)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!trigger || !containerRef.current || rendered) return

    const container = containerRef.current

    const loadScript = () => {
      if (container.querySelector('.cf-turnstile')) {
        setRendered(true)
        return
      }

      if (window.turnstile) {
        window.turnstile.render(container, {
          sitekey: siteKey,
          callback: (token: string) => {
            onSuccessRef.current(token)
          },
          'error-callback': () => {
            onErrorRef.current?.()
          },
          'expired-callback': () => {
            onErrorRef.current?.()
          },
          theme: 'light',
        })
        setRendered(true)
        return
      }

      if (!document.querySelector('script[src*="turnstile"]')) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
        script.async = true
        script.defer = true
        script.id = 'turnstile-script'
        document.body.appendChild(script)

        script.onload = () => {
          if (window.turnstile && container) {
            window.turnstile.render(container, {
              sitekey: siteKey,
              callback: (token: string) => {
                onSuccessRef.current(token)
              },
              'error-callback': () => {
                onErrorRef.current?.()
              },
              'expired-callback': () => {
                onErrorRef.current?.()
              },
              theme: 'light',
            })
            setRendered(true)
          }
        }
      }
    }

    loadScript()
  }, [trigger, siteKey, rendered])

  if (!trigger) return null

  return <div ref={containerRef} />
}
