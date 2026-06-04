/**
 * Protocol Stats Component
 * Displays protocol parameters and statistics
 */

'use client';

import React from 'react';

interface ProtocolParams {
  minCollateralRatio: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  feePercentage: number;
}

interface ProtocolStatsProps {
  params: ProtocolParams;
}

const ProtocolStats: React.FC<ProtocolStatsProps> = ({ params }) => {
  return (
    <div className="protocol-stats">
      <div className="stat-item">
        <label>Min Collateral Ratio</label>
        <span>{(params.minCollateralRatio / 100).toFixed(1)}%</span>
      </div>
      <div className="stat-item">
        <label>Liquidation Threshold</label>
        <span>{(params.liquidationThreshold / 100).toFixed(1)}%</span>
      </div>
      <div className="stat-item">
        <label>Liquidation Bonus</label>
        <span>{(params.liquidationBonus / 100).toFixed(2)}%</span>
      </div>
      <div className="stat-item">
        <label>Trading Fee</label>
        <span>{(params.feePercentage / 100).toFixed(2)}%</span>
      </div>
    </div>
  );
};

export default ProtocolStats;
