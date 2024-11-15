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
