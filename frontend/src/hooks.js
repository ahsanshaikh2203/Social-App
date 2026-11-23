import { useEffect, useRef, useState } from 'react'

export function useWebSocket(onMessage, enabled = true) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const callbackRef = useRef(onMessage)
  callbackRef.current = onMessage

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let retry
    let delay = 1000

    function connect() {
      if (stopped) return
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${location.host}/ws`)
      socketRef.current = socket
      socket.onopen = () => {
        setConnected(true)
        delay = 1000
      }
      socket.onmessage = event => {
        try { callbackRef.current(JSON.parse(event.data)) } catch { callbackRef.current({ type: 'message', data: event.data }) }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!stopped) retry = setTimeout(connect, delay)
        delay = Math.min(delay * 2, 30000)
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      socketRef.current?.close()
    }
  }, [enabled])

  return connected
}
