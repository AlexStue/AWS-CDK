#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import * as ga_endpoints from 'aws-cdk-lib/aws-globalaccelerator-endpoints';
import { MultiRegionStack } from '../lib/network-stack';

const app = new cdk.App();

// ------------------------------------ List of Regions

const regions = ['eu-central-1', 'eu-west-1'];
const stacks: MultiRegionStack[] = [];

// ------------------------------------ Infra Regional

regions.forEach(region => {
    const stack = new MultiRegionStack(app, `Stack-${region}`, {
      env: {
        region: region,
        account: '038462748247',
      },
    });
    stacks.push(stack);
  });

// ------------------------------------ Global Accelerator

// New stack
    const gaStack = new cdk.Stack(app, 'GlobalAcceleratorStack', {
      env: {
        region: 'eu-central-1', // Global Accelerator is created in us-west-2
        account: '038462748247',
      },
    });

// Global Accelerator
    const accelerator = new globalaccelerator.Accelerator(gaStack, 'MyAccelerator', {
      acceleratorName: 'MyMultiRegionAccelerator',
      ipAddressType: globalaccelerator.IpAddressType.IPV4,
    });

// Listener
    const listener = accelerator.addListener('Listener', {
      portRanges: [
        { fromPort: 80 },
      ],
    });

// Add endpoint groups for each region
    stacks.forEach((regionalStack, index) => {
      listener.addEndpointGroup(`EndpointGroup-${regions[index]}`, {
        endpoints: [
          new ga_endpoints.ApplicationLoadBalancerEndpoint(regionalStack.alb, {
            weight: 100,
            //preserveClientIp: true, // Optional, set to true if you want to preserve client IP
          }),
        ],
      });
    });