#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MultiRegionStack } from '../lib/network-stack';

const app = new cdk.App();

// List of regions to deploy the stack
const regions = ['eu-central-1', 'eu-west-1']; 
// New Region --> "cdk bootstrap"

regions.forEach(region => {
  new MultiRegionStack(app, `Stack-${region}`, {
    env: {
      region: region, // Specify the region explicitly
      account: '038462748247', // Your AWS Account ID
    },
  });
});
