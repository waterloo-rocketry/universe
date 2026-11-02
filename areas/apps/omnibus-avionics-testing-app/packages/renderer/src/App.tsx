import './App.css'
import BoardStatusDashboard from './components/BoardStatus/BoardStatusDashboard'
import ConnectToOmnibus from './components/ConnectToOmnibus'
import { useOmnibusStore } from '@/store/omnibusStore'
import { OmnibusProvider } from './components/OmnibusProvider'
import { CanSender } from '@/components/CanSender'

function AppContent() {
    // setting up zustand store
    const series = useOmnibusStore((state) => state.series)

    const boardData = Object.values(series).map((msg) => {
        return {
            boardTypeId: msg.boardTypeId,
            boardInstId: msg.boardInstId,
            msgPriority: msg.msgPrio,
            msgType: msg.msgType,
            data: (msg.data as Record<string, string | number> | null) ?? null,
        }
    })

    return (
        <div className="App">
            <ConnectToOmnibus />
            <BoardStatusDashboard boardInfoArray={boardData} />
            <CanSender />
        </div>
    )
}

function App() {
    return (
        <OmnibusProvider>
            <AppContent />
        </OmnibusProvider>
    )
}

export default App
