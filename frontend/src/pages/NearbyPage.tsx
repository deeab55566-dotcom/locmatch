import React from 'react';
import { RadiusMapFilter } from '@/components/Location/RadiusMapFilter';
import { NearbyUsers } from '@/components/Location/NearbyUsers';
import { BluetoothDiscovery } from '@/components/Bluetooth/BluetoothDiscovery';

export const NearbyPage: React.FC = () => {
  return (
    <div className="nearby-page-wrap">
      <div className="nearby-page-map">
        <RadiusMapFilter />
      </div>
      <div className="nearby-page-list">
        <NearbyUsers />
      </div>
      <div className="nearby-page-bluetooth">
        <BluetoothDiscovery />
      </div>
    </div>
  );
};
