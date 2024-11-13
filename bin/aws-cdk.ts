#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyVpcAppStack } from '../lib/network-stack';

const app = new cdk.App();
new MyVpcAppStack(app, 'MyVpcAppStack', {
  env: {
    region: 'eu-central-1', // The region where you want to deploy
    account: '038462748247', // Your AWS account ID
  }
});
