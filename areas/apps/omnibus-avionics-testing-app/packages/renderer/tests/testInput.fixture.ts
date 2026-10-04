import type { BoardMessage } from '@/components/types.ts'

/* Example layout of data that can be fed into the application:
[
    [
        "CAN/Parsley",
        1746896237.84619,
        {
            "boardTypeId": "PROCESSOR",
            "boardInstId": "GENERIC",
            "msgPriority": "LOW",
            "msgType": "SENSOR_IMU_Z",
            "data": {
                "time": 40.523,
                "imu_id": "IMU_PROC_ALTIMU10",
                "linear_accel": -0.247314453125,
                "angular_velocity": -0.244140625
            }
        }
    ]
]*/

export interface testDataTemplate {
    time: number
    imu_id: string
    linear_accel: number
    angular_velocity: number
}
export const sourceArray: BoardMessage<testDataTemplate>[] = [
    {
        boardTypeId: 'PROC',
        boardInstId: 'A',
        msgPriority: 'LOW',
        msgType: 'SENSOR_IMU_Z',
        data: {
            time: 40.523,
            imu_id: 'IMU_PROC_ALTIMU10',
            linear_accel: -0.247314453125,
            angular_velocity: -0.244140625,
        },
    },
    {
        boardTypeId: 'PROC',
        boardInstId: 'B',
        msgPriority: 'HIGH',
        msgType: 'SENSOR_IMU_Z',
        data: {
            time: 40.523,
            imu_id: 'IMU_PROC_ALTIMU10',
            linear_accel: -0.247314453125,
            angular_velocity: -0.244140625,
        },
    },
    {
        boardTypeId: 'SENSOR',
        boardInstId: 'C',
        msgPriority: 'MED',
        msgType: 'SENSOR_IMU_Z',
        data: {
            time: 40.523,
            imu_id: 'IMU_PROC_ALTIMU10',
            linear_accel: -0.247314453125,
            angular_velocity: -0.244140625,
        },
    },
]
export const sourceData: [string, number, BoardMessage<testDataTemplate>] = [
    'CAN/Parsley',
    1746896237.84619,
    {
        boardTypeId: 'PROCESSOR',
        boardInstId: 'GENERIC',
        msgPriority: 'LOW',
        msgType: 'SENSOR_IMU_Z',
        data: {
            time: 40.523,
            imu_id: 'IMU_PROC_ALTIMU10',
            linear_accel: -0.247314453125,
            angular_velocity: -0.244140625,
        },
    },
]
