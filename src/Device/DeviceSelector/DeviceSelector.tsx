/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { NrfutilDeviceLib } from '../../../nrfutil/device';
import { DeviceTraits } from '../../../nrfutil/device/common';
import logger from '../../logging';
import simplifyDevice from '../../telemetry/simplifyDevice';
import telemetry from '../../telemetry/telemetry';
import useHotKey from '../../utils/useHotKey';
import {
    clearWaitForDevice,
    setAutoSelectDevice,
} from '../deviceAutoSelectSlice';
import {
    hasModem,
    startWatchingDevices,
    stopWatchingDevices,
} from '../deviceLister';
import { DeviceSetupConfig, setupDevice } from '../deviceSetup';
import DeviceSetupView from '../DeviceSetup/DeviceSetupView';
import {
    deselectDevice,
    deselectVirtualDevice,
    Device,
    DeviceSelector,
    getDeviceSelectors,
    isDeviceWithSerialNumber,
    selectDevice,
    selectVirtualDevice,
    setSelectedDeviceInfo,
    addDeviceSelector,
    toggleDeviceSelector,
    getDeviceSelector,
} from '../deviceSlice';
import DeviceList from './DeviceList/DeviceList';
import SelectDevice from './SelectDevice';
import SelectedDevice from './SelectedDevice';
import SelectedVirtualDevice from './SelectedVirtualDevice';

export interface Props {
    deviceSelectedList?: string[];
    deviceListing: DeviceTraits;
    deviceSetupConfig?: DeviceSetupConfig;
    onDeviceSelected?: (
        selector: number,
        device: Device,
        autoReselected: boolean,
        abortController: AbortController
    ) => void;
    onDeviceDeselected?: (selector: number) => void;
    onDeviceConnected?: (device: Device) => void;
    onDeviceDisconnected?: (device: Device) => void;
    onDeviceIsReady?: (device: Device) => void;
    deviceFilter?: (device: Device) => boolean;
    virtualDevices?: string[];
    onVirtualDeviceSelected?: (selector: number, device: string) => void;
    onVirtualDeviceDeselected?: (selector: number) => void;
}

const noop = () => {};
export default ({
    deviceSelectedList = ["SELECT DEVICE"],
    deviceListing,
    deviceSetupConfig,
    onDeviceSelected = noop,
    onDeviceDeselected = noop,
    onDeviceConnected = noop,
    onDeviceDisconnected = noop,
    onDeviceIsReady = noop,
    deviceFilter,
    virtualDevices = [],
    onVirtualDeviceSelected = noop,
    onVirtualDeviceDeselected = noop,
}: Props) => {
    const dispatch = useDispatch();
    const deviceSelectors = useSelector(getDeviceSelectors);

    const currentSelector = useSelector(getDeviceSelector);
    const currentDevice = currentSelector?.selectedDevice;
    const currentVirtualDevice = currentSelector?.selectedVirtualDevice;

    const abortController = useRef<AbortController>();

    const doDeselectDevice = useCallback(
        (selector?: number, device?: Device) => {
            abortController.current?.abort();
            if (device) {
                telemetry.sendEvent(
                    'device deselected ',
                    simplifyDevice(device)
                );
            }

            dispatch(clearWaitForDevice());
            dispatch(setAutoSelectDevice(undefined));
            logger.info(`Deselected device`);
            onDeviceDeselected(selector ?? -3);
            if (device) {
                dispatch(deselectDevice(device));
            }
        },
        [dispatch, onDeviceDeselected]
    );

    // Ensure that useCallback is
    // not updated frequently as this
    // will have a side effect to stop and start the hotplug events
    const doSelectDevice = useCallback(
        async (selector: number, device: Device, autoReselected: boolean) => {
            logger.info(
                `Selecting device with the serial number ${device.serialNumber}`
            );
            abortController.current?.abort();
            const controller = new AbortController();
            abortController.current = controller;

            dispatch(clearWaitForDevice());
            dispatch(selectDevice(device));
            dispatch(setAutoSelectDevice(device));

            const deviceInfo = await NrfutilDeviceLib.deviceInfo(
                device,
                undefined,
                undefined,
                controller
            );

            // Modem might be set to false when using external jLink or custom PCBs
            if (!device.traits.modem && hasModem(device, deviceInfo)) {
                const newDevice = {
                    ...device,
                    traits: { ...device.traits, modem: true },
                };
                dispatch(selectDevice(newDevice));
                dispatch(setAutoSelectDevice(newDevice));
            }

            if (!controller.signal.aborted) {
                dispatch(setSelectedDeviceInfo(deviceInfo));
                logger.info(
                    `Selected device with the serial number ${device.serialNumber}`
                );
                onDeviceSelected(selector, device, autoReselected, controller);

                telemetry.sendEvent('device selected', {
                    device: simplifyDevice(device),
                    deviceInfo,
                });

                if (deviceSetupConfig) {
                    if (isDeviceWithSerialNumber(device)) {
                        dispatch(
                            setupDevice(
                                device,
                                deviceSetupConfig,
                                onDeviceIsReady,
                                (d) => doDeselectDevice(selector, d),
                                deviceInfo
                            )
                        );
                    } else {
                        logger.warn(
                            `Selected device has no serial number. Device setup is not supported.`
                        );
                        onDeviceIsReady(device);
                    }
                }
            }
        },
        [
            deviceSetupConfig,
            dispatch,
            doDeselectDevice,
            onDeviceIsReady,
            onDeviceSelected,
        ]
    );

    const doStartWatchingDevices = useCallback(() => {
        dispatch(
            startWatchingDevices(
                deviceListing,
                onDeviceConnected,
                onDeviceDisconnected,
                () => onDeviceDeselected(-1),
                (d, a) => doSelectDevice(-1, d, a),
            )
        );
    }, [
        deviceListing,
        dispatch,
        onDeviceConnected,
        onDeviceDisconnected,
        onDeviceDeselected,
        doSelectDevice,
    ]);

    useEffect(() => {
        doStartWatchingDevices();
        return stopWatchingDevices;
    }, [doStartWatchingDevices]);

    useHotKey({
        hotKey: 'alt+s',
        title: 'Select device',
        isGlobal: true,
        action: () => dispatch(toggleDeviceSelector(currentSelector?.id ?? 0)),
    });

    const toggleDeviceListVisible = (selector: number) => {
        let count = 0;
        deviceSelectors.forEach((sel, index) => {
            if (sel.isListVisible && index !== selector) {
                dispatch(toggleDeviceSelector(index));
                count++;
            }
        });
        if (count === 0) {
            dispatch(toggleDeviceSelector(selector));
        } else {
            setTimeout(() => {
                dispatch(toggleDeviceSelector(selector));
            }, 300);
        }
    }
    
    const devices = deviceSelectedList.map((title, index) => {
        const deviceSeletor:DeviceSelector = {
            id: index,
            isListVisible: false,
        };
        dispatch(addDeviceSelector(deviceSeletor));

        return <div className="select-item" key={index}>
            <SelectDevice
                selectorId={index}
                deviceTitle={title}
                toggleDeviceListVisible={() => toggleDeviceListVisible(index)}
            />
            <SelectedDevice
                selectorId={index}
                doDeselectDevice={(d) => doDeselectDevice(index, d)}
                toggleDeviceListVisible={() => toggleDeviceListVisible(index)}
            />
            <SelectedVirtualDevice
                selectorId={index}
                doDeselectDevice={() => {
                    onVirtualDeviceDeselected(index);
                    dispatch(deselectVirtualDevice(index));
                }}
                toggleDeviceListVisible={() => toggleDeviceListVisible(index)}
            />
        </div> 
    });

    return (
        <div className="core19-device-selector">
            <div className="select-container">
                { devices }
            </div>
            <DeviceList
                isVisible={!!currentSelector}
                doSelectDevice={(device, autoReselected) => {
                    if (device.id === currentDevice?.id) {
                        dispatch(toggleDeviceSelector(-1));
                        return;
                    }

                    const index = deviceSelectors.findIndex(
                        item => 
                            device.id === item.selectedDevice?.id ||
                            device.serialNumber === item.selectedDevice?.serialNumber
                    );
                    if (index !== -1) {
                        doDeselectDevice(index, device);
                    }

                    if (!!currentDevice) {
                        doDeselectDevice(currentSelector.id, currentDevice);
                    }

                    if (!!currentVirtualDevice) {
                        dispatch(deselectVirtualDevice(-1));
                        onVirtualDeviceDeselected(currentSelector.id);
                    }

                    doSelectDevice(currentSelector?.id ?? -2, device, autoReselected);
                }}
                virtualDevices={virtualDevices}
                doSelectVirtualDevice={device => {
                    if (currentVirtualDevice === device) {
                        dispatch(toggleDeviceSelector(-1));
                        return;
                    }

                    const index = deviceSelectors.findIndex(
                        item => device === item.selectedVirtualDevice
                    );
                    if (index !== -1) {
                        dispatch(deselectVirtualDevice(index));
                    }

                    if (!!currentDevice) {
                        doDeselectDevice(currentSelector.id, currentDevice);
                    }

                    if (!!currentVirtualDevice) {
                        dispatch(deselectVirtualDevice(-1));
                        onVirtualDeviceDeselected(currentSelector.id);
                    }

                    dispatch(clearWaitForDevice());
                    abortController.current?.abort();

                    dispatch(selectVirtualDevice(device));
                    onVirtualDeviceSelected(currentSelector?.id ?? -2, device);
                }}
                deviceFilter={deviceFilter}
            />
            <DeviceSetupView />
        </div>
    );
};
