/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';

import PseudoButton from '../../PseudoButton/PseudoButton';
import DisconnectDevice from './DisconnectDevice';

import './selected-device.scss';
import { useDispatch, useSelector } from 'react-redux';
import { deselectVirtualDevice, getDeviceSelectors } from '../deviceSlice';

export default ({
    selectorId,
    doDeselectDevice,
    toggleDeviceListVisible,
}: {
    selectorId: number;
    doDeselectDevice: () => void;
    toggleDeviceListVisible: () => void;
}) => {
    const dispatch = useDispatch();
    const deviceSelectors = useSelector(getDeviceSelectors);
    const selector = deviceSelectors[selectorId];
    const isVisible = !!selector.selectedVirtualDevice;
    const isSingleSelector = deviceSelectors.length === 1;

    return (
        <PseudoButton
            className={`${
                isVisible ? 'tw-flex' : 'hidden'
            } tw-h-10 tw-flex-row tw-items-center tw-bg-gray-700 tw-text-gray-50 hover:tw-bg-gray-600 `}
            onClick={toggleDeviceListVisible}
        >
            { isSingleSelector && <span className="icon mdi mdi-flask-empty tw-text-2xl" /> }
            <div className="details tw-flex tw-flex-grow-[2] tw-flex-col">
                <p className={`${
                    isSingleSelector || 'tw-ml-2.5'
                } tw-m-0  tw-h-[17px] tw-text-sm/[14px] tw-font-bold`}>
                    {selector.selectedVirtualDevice}
                </p>
                { isSingleSelector &&
                    <p className="tw-m-0 tw-text-[11px]/3 tw-uppercase group-hover:tw-text-gray-600">
                        Virtual Device
                    </p>
                }
            </div>
            <div className="tw-mr-2.5 tw-flex tw-h-full tw-items-center tw-justify-center">
                <DisconnectDevice doDeselectDevice={doDeselectDevice} />
            </div>
        </PseudoButton>
    );
}