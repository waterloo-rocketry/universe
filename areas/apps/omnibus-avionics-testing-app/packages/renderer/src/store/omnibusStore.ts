import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ParsleyMessage } from '@waterloorocketry/omnibus-ts'

type OmnibusDataPoint = ParsleyMessage<any>

interface OmnibusStore {
    series: Record<string, OmnibusDataPoint>
    updateSeries: (key: string, dataPoint: OmnibusDataPoint) => void
    updateMultipleSeries: (updates: Record<string, OmnibusDataPoint>) => void
}

export const useOmnibusStore = create<OmnibusStore>()(
    subscribeWithSelector((set) => ({
        series: {},

        updateSeries: (key, dataPoint) =>
            set((state) => ({
                series: { ...state.series, [key]: dataPoint },
            })),

        updateMultipleSeries: (updates) =>
            set((state) => ({
                series: { ...state.series, ...updates },
            })),
    }))
)