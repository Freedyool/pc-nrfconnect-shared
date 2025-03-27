/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';

import PseudoButton from '../../PseudoButton/PseudoButton';
import classNames from '../../utils/classNames';
import chevron from './arrow-down.svg';

import './select-device.scss';
import { useDispatch, useSelector } from 'react-redux';
import { getDeviceSelectors } from '../deviceSlice';

interface Props {
    selectorId: number;
    deviceTitle?: string;
    toggleDeviceListVisible: () => void;
}

export default ({ selectorId, deviceTitle = "Select device", toggleDeviceListVisible }: Props) => {
    const dispatch = useDispatch();
    const deviceSelectors = useSelector(getDeviceSelectors);
    const selector = deviceSelectors[selectorId];

    const isVisible = !selector.selectedDevice && !selector.selectedVirtualDevice;
    const isListVisible = selector.isListVisible;
    const isSingleSelector = deviceSelectors.length === 1;

    return (
        <PseudoButton
            title="alt+s"
            className={classNames(
                'select-device',
                isListVisible && 'device-list-visible',
                isVisible || 'hidden',
                isSingleSelector && 'single',
            )}
            onClick={toggleDeviceListVisible}
            >
            <div>{deviceTitle}</div>
            <img
                className={classNames(
                    isListVisible && 'img-rotate',
                    isSingleSelector && 'single',
                )}
                src={chevron}
                alt=""
            />
        </PseudoButton>
    )
};
