/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import PseudoButton from '../../PseudoButton/PseudoButton';
import {
    getAutoReselectDevice,
    getWaitingForDeviceTimeout,
    getWaitingToAutoReselect,
} from '../deviceAutoSelectSlice';
import { Device, getDeviceSelectors } from '../deviceSlice';
import DisconnectDevice from './DisconnectDevice';

import './selected-device.scss';
import InlineInput from '../../InlineInput/InlineInput';
import { displayedDeviceName } from '../deviceInfo/deviceInfo';
import BasicDeviceInfo from './BasicDeviceInfo';

export default ({
    selectorId,
    doDeselectDevice,
    toggleDeviceListVisible,
}: {
    selectorId: number;
    doDeselectDevice: (device: Device) => void;
    toggleDeviceListVisible: () => void;
}) => {
    const waitingForAutoReselect = useSelector(getWaitingToAutoReselect);
    const waitingForDevice = useSelector(getWaitingForDeviceTimeout);
    const autoReconnectDevice = useSelector(getAutoReselectDevice);
    
    const dispatch = useDispatch();
    const deviceSelectors = useSelector(getDeviceSelectors);
    const selector = deviceSelectors[selectorId];
    
    const device = selector.selectedDevice ?? autoReconnectDevice;
    const isVisible = !!selector.selectedDevice || waitingForAutoReselect;
    const isSingleSelector = deviceSelectors.length === 1;

    return (
        <PseudoButton
            className={`selected-device ${
                waitingForAutoReselect || waitingForDevice ? 'reconnecting' : ''
            } ${ isVisible || 'hidden' }`}
            onClick={toggleDeviceListVisible}
        >
            {device && (isSingleSelector ? (
                <BasicDeviceInfo
                    device={device}
                    toggles={
                        <DisconnectDevice doDeselectDevice={() => doDeselectDevice(device)} />
                    }
                    showWaitingStatus
                />
            ) : (
                <div className="basic-device-info tw-h-[42px] tw-ml-1.5">
                    <div className="details tw-flex tw-flex-col">
                        <InlineInput
                            className="name"
                            value={displayedDeviceName(device)}
                            isValid={name => name !== ''}
                            onChange={()=>{}}
                        />
                        <div className="serial-number">{device.serialNumber}</div>
                    </div>
                    <div className="tw-mr-1.5 tw-flex tw-h-full tw-w-8 tw-flex-col tw-items-center tw-justify-center">
                        <DisconnectDevice doDeselectDevice={() => doDeselectDevice(device)} />
                    </div>
                </div>
            ))}
        </PseudoButton>
    );
};
