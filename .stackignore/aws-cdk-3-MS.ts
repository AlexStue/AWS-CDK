#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StackArchAll } from '../lib/network-stack';

const app = new cdk.App();
new StackArchAll(app, 'StackArchAll', {
  env: {
    region: 'eu-central-1', // The region where you want to deploy
    account: '038462748247', // Your AWS account ID
  }
});

/*
const app = new cdk.App();

// Deploy to eu-central-1
new MultiRegionStack(app, 'StackEuCentral1', {
  env: { 
    region: 'eu-central-1', 
    account: '123456789012' 
  }
});

// Deploy to us-east-1
new MultiRegionStack(app, 'StackUsEast1', {
  env: { 
    region: 'us-east-1', 
    account: '123456789012' 
  }
});
*/