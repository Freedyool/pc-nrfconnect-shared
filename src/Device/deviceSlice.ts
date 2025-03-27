/*
 * Copyright (c) 2021 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AutoDetectTypes } from '@serialport/bindings-cpp';
import { SerialPortOpenOptions } from 'serialport';

import { DeviceInfo } from '../../nrfutil/device';
import { NrfutilDevice } from '../../nrfutil/device/common';
import type { RootState } from '../store';
import {
    persistIsFavorite,
    persistNickname,
    persistSerialPortSettings as persistSerialPortSettingsToStore,
} from '../utils/persistentStore';

export interface Device extends NrfutilDevice {
    nickname?: string;
    favorite?: boolean;
    persistedSerialPortOptions?: SerialPortOpenOptions<AutoDetectTypes>;
}

export interface DeviceWithSerialNumber extends Device {
    serialNumber: string;
}

export interface DeviceSelector {
    id: number;
    isListVisible: boolean;
    selectedDevice?: Device;
    selectedDeviceInfo?: DeviceInfo;
    selectedVirtualDevice?: string;
}

export const isDeviceWithSerialNumber = (
    device: Device
): device is DeviceWithSerialNumber =>
    !!(device as DeviceWithSerialNumber).serialNumber;

const findDeviceItem = (
    devices: Device[],
    id: number,
    serialNumber?: string | null
) => {
    const index = devices.findIndex(
        d => d.id === id || d.serialNumber === serialNumber
    );

    return { index, device: devices[index] };
};

const updateDevice = (
    state: DeviceState,
    updateToMergeIn: Partial<Device>,
    id: number,
    serialNumber?: string | null
) => {
    const device = findDeviceItem(state.devices, id, serialNumber).device;
    if (device) {
        Object.assign(device, updateToMergeIn);
    }
};

const findCurrentSelector = (
    selectors: DeviceSelector[],
) => {
    const index = selectors.findIndex(ds => ds.isListVisible === true);

    return { index, selector: selectors[index] };
}

const updateDeviceSelector = (
    state: DeviceState,
    updateToMergeIn: Partial<DeviceSelector>,
    id?: number,
) => {
    const deviceSelector = id !== undefined ? state.deviceSelectors[id] : state.deviceSelectors.find(sel => sel.isListVisible === true);
    if (deviceSelector) {
        Object.assign(deviceSelector, updateToMergeIn);
    }
};

export interface DeviceState {
    devices: Device[];
    deviceSelectors: DeviceSelector[],
    selectedDevice?: Device;
    selectedDeviceInfo?: DeviceInfo;
    selectedVirtualDevice?: string;
}

const initialState: DeviceState = {
    devices: [],
    deviceSelectors: [],
};

const slice = createSlice({
    name: 'device',
    initialState,
    reducers: {
        /*
         * Indicates that a device has been selected.
         */
        selectDevice: (state, action: PayloadAction<Device>) => {
            updateDeviceSelector(
                state,
                {
                    selectedDevice: action.payload,
                    isListVisible: false,
                },
            );
        },

        setSelectedDeviceInfo: (
            state,
            action: PayloadAction<DeviceInfo | undefined>
        ) => {
            updateDeviceSelector(
                state,
                {
                    selectedDeviceInfo: action.payload,
                },
            );
        },

        addDevice: (state, action: PayloadAction<Device>) => {
            const index = state.devices.findIndex(
                item =>
                    item.serialNumber === action.payload.serialNumber ||
                    item.id === action.payload.id
            );
            if (index !== -1) {
                state.devices[index] = action.payload;
            } else {
                state.devices.push(action.payload);
            }
        },

        persistSerialPortOptions: (
            state,
            action: PayloadAction<SerialPortOpenOptions<AutoDetectTypes>>
        ) => {
            if (!state.selectedDevice) return;

            const selectedDevice = state.selectedDevice;

            if (selectedDevice) {
                const vComIndex = selectedDevice.serialPorts?.findIndex(
                    e => e.comName === action.payload.path
                );

                if (
                    selectedDevice.serialNumber && // we want to disregard comparing devices with no sn
                    vComIndex !== undefined &&
                    vComIndex !== -1
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used to filter out the path property
                    const { path: _, ...serialPortOptions } = action.payload;

                    persistSerialPortSettingsToStore(
                        selectedDevice.serialNumber,
                        {
                            serialPortOptions,
                            vComIndex,
                        }
                    );

                    updateDevice(
                        state,
                        {
                            ...selectedDevice,
                            persistedSerialPortOptions: action.payload,
                        },
                        selectedDevice.id,
                        selectedDevice.serialNumber
                    );
                }
            }
        },

        removeDevice: (state, action: PayloadAction<Device>) => {
            const index = findDeviceItem(
                state.devices,
                action.payload.id,
                action.payload.serialNumber
            ).index;
            state.devices.splice(index, 1);

            if (action.payload.id === state.selectedDevice?.id) {
                state.selectedDevice = undefined;
                state.selectedDeviceInfo = undefined;
            }
        },

        toggleDeviceFavorited: (state, action: PayloadAction<Device>) => {
            const device = findDeviceItem(
                state.devices,
                action.payload.id,
                action.payload.serialNumber
            ).device;

            if (!device.serialNumber) return;

            const newFavoriteState = !device.favorite;

            persistIsFavorite(device.serialNumber, newFavoriteState);
            updateDevice(
                state,
                {
                    favorite: newFavoriteState,
                },
                action.payload.id,
                action.payload.serialNumber
            );
        },

        setDeviceNickname: {
            prepare: (device: Device, nickname: string) => ({
                payload: { device, nickname },
            }),
            reducer: (
                state,
                action: PayloadAction<{
                    device: Device;
                    nickname: string;
                }>
            ) => {
                if (!action.payload.device.serialNumber) return;

                persistNickname(
                    action.payload.device.serialNumber,
                    action.payload.nickname
                );
                updateDevice(
                    state,
                    {
                        nickname: action.payload.nickname,
                    },
                    action.payload.device.id,
                    action.payload.device.serialNumber
                );
            },
        },

        resetDeviceNickname: (state, action: PayloadAction<Device>) => {
            if (!action.payload.serialNumber) return;

            persistNickname(action.payload.serialNumber, '');
            updateDevice(
                state,
                {
                    nickname: '',
                },
                action.payload.id,
                action.payload.serialNumber
            );
        },

        selectVirtualDevice: (state, action: PayloadAction<string>) => {
            updateDeviceSelector(
                state,
                {
                    selectedVirtualDevice: action.payload,
                    isListVisible: false,
                },
            );
        },

        /*
         * Indicates that the currently selected device has been deselected.
         */
        deselectDevice: (state, action: PayloadAction<Device>) => {
            const index = state.deviceSelectors.findIndex(
                item => item.selectedDevice?.id === action.payload.id
            );
            if (index !== -1) {
                updateDeviceSelector(
                    state,
                    {
                        selectedDevice: undefined,
                        selectedVirtualDevice: undefined,
                    },
                    index,
                )
            }
        },

        deselectVirtualDevice: (state, action: PayloadAction<number>) => {
            if (action.payload >= state.deviceSelectors.length) return;
            updateDeviceSelector(
                state,
                {
                    selectedVirtualDevice: undefined,
                },
                action.payload === -1 ? undefined : action.payload,
            )
        },

        addDeviceSelector: (state, action: PayloadAction<DeviceSelector>) => {
            const index = state.deviceSelectors.findIndex(
                item => item.id === action.payload.id
            );
            if (index === -1) {
                state.deviceSelectors?.push(action.payload);
            }
        },

        toggleDeviceSelector: (state, action: PayloadAction<number>) => {
            if (action.payload >= state.deviceSelectors.length) return;
            if (action.payload === -1) {
                updateDeviceSelector(state, { isListVisible: false });
            } else {
                updateDeviceSelector(
                    state,
                    {
                        isListVisible: !state.deviceSelectors[action.payload].isListVisible,
                    },
                    action.payload,
                )
            }
        }
    },
});

export const {
    reducer,
    actions: {
        deselectDevice,
        resetDeviceNickname,
        selectDevice,
        setSelectedDeviceInfo,
        addDevice,
        removeDevice,
        setDeviceNickname,
        toggleDeviceFavorited,
        persistSerialPortOptions,
        selectVirtualDevice,
        deselectVirtualDevice,
        addDeviceSelector,
        toggleDeviceSelector,
    },
} = slice;

export const getDevice = (state: RootState, serialNumber: string) =>
    state.device.devices.find(d => d.serialNumber === serialNumber);

export const getDevices = (state: RootState) => state.device.devices;

export const deviceIsSelected = (state: RootState) =>
    !!state.device.selectedDevice;

export const selectedDevice = (state: RootState) => state.device.selectedDevice;

export const selectedDeviceInfo = (state: RootState) =>
    state.device.selectedDevice ? state.device.selectedDeviceInfo : undefined;

export const selectedSerialNumber = (state: RootState) =>
    state.device.selectedDevice?.serialNumber;

export const getReadbackProtection = (state: RootState) =>
    state.device.selectedDeviceInfo?.jlink?.protectionStatus;

export const selectedVirtualDevice = (state: RootState) =>
    state.device.selectedVirtualDevice;

export const getDeviceSelector = (state: RootState) =>
    state.device.deviceSelectors.find(ds => ds.isListVisible === true);

export const getDeviceSelectors = (state: RootState) => state.device.deviceSelectors;
