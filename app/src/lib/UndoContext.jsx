import { createContext, useContext, useState } from 'react'

const UndoContext = createContext(null)

export function UndoProvider({ children }) {
  const [stack, setStack] = useState([])

  function push(action) {
    // action = { label: string, undo: async fn }
    setStack(s => [...s, action])
  }

  async function pop() {
    if (!stack.length) return
    const action = stack[stack.length - 1]
    setStack(s => s.slice(0, -1))
    await action.undo()
  }

  return (
    <UndoContext.Provider value={{ stack, push, pop }}>
      {children}
    </UndoContext.Provider>
  )
}

export function useUndo() {
  return useContext(UndoContext)
}
