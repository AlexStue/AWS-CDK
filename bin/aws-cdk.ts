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
      crossRegionReferences: true, // Enable cross-region references
    });
    stacks.push(stack);
  });

// ------------------------------------ Global Accelerator

// Create a new stack for Global Accelerator
const gaStack = new cdk.Stack(app, 'GlobalAcceleratorStack', {
  env: {
    region: 'us-west-2', // Global Accelerator is created in us-west-2
    account: '038462748247',
  },
  crossRegionReferences: true, // Enable cross-region references
});

// Create the Global Accelerator
const accelerator = new globalaccelerator.Accelerator(gaStack, 'MyAccelerator', {
  acceleratorName: 'MyMultiRegionAccelerator',
  ipAddressType: globalaccelerator.IpAddressType.IPV4,
  
});

// Create a listener for the Global Accelerator
const listener = accelerator.addListener('Listener', {
  portRanges: [
    { fromPort: 80 },
    { fromPort: 443 },
  ],
});

// Add endpoint groups for each region using ALB ARN
stacks.forEach((regionalStack, index) => {
  const endpointGroup = new globalaccelerator.CfnEndpointGroup(gaStack, `EndpointGroup-${regions[index]}`, {
    listenerArn: listener.listenerArn,
    endpointGroupRegion: regions[index], // Specify the region for the endpoint group
    endpointConfigurations: [{
      endpointId: regionalStack.alb.attrLoadBalancerArn, // Use loadBalancerArn
      weight: 100,
      clientIpPreservationEnabled: true,
    }],
  });
});